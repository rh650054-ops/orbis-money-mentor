// Orbis — estudio-arte v6: gera o ADESIVO do vendedor com IA. O briefing vem da
// GALERIA (modelo_id da biblioteca estudio_modelos) OU do CHAT da Orbis IA (estilo em
// texto + referência opcional enviada pelo PRÓPRIO usuário). Deixa ÁREA BRANCA pro app
// colocar o QR Pix REAL. Só assinantes; limite diário via bump_ai_usage('estudio').
// PROVEDORES (em ordem): 1) Gemini (GEMINI_IMAGE_MODEL, padrao gemini-3.1-flash-image;
// exige billing ativado na conta Google) → 2) OpenAI GPT Image (se OPENAI_API_KEY
// existir nos secrets) — o MESMO gerador de imagem do ChatGPT.
// v5: OpenAI usa gpt-image-2 (o mesmo do ChatGPT atual; confirmado disponivel na conta
// do Rick) com fallback automatico 1.5 -> 1; qualidade via OPENAI_IMAGE_QUALITY ("medium").

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") ?? "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function bytesToB64(bytes: Uint8Array): string {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(bin);
}
function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const json = (obj: unknown, status = 200) =>
    new Response(JSON.stringify(obj), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const authH = req.headers.get("Authorization") ?? "";
    if (!authH) return json({ error: "login_necessario" }, 401);
    const supa = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_ANON_KEY") ?? "", { global: { headers: { Authorization: authH } } });
    const { data: u } = await supa.auth.getUser();
    if (!u?.user?.id) return json({ error: "sessao_expirada" }, 401);

    const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
    const { data: prof } = await admin.from("profiles")
      .select("plan_status,is_trial_active,trial_end,billing_exempt,is_demo")
      .eq("user_id", u.user.id).maybeSingle();
    const hoje = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
    const assinante = !!prof && (prof.billing_exempt || prof.is_demo || prof.plan_status === "active" ||
      (prof.is_trial_active && String(prof.trial_end ?? "") >= hoje));
    if (!assinante) return json({ error: "assinatura_necessaria" }, 403);

    const { data: usage } = await supa.rpc("bump_ai_usage", { p_feature: "estudio", p_limit: 6 });
    if ((usage as any)?.over) return json({ error: "limite_diario" });

    const body = await req.json().catch(() => ({}));
    const modeloId = String(body?.modelo_id ?? "").trim();
    const marca = String(body?.marca ?? "").slice(0, 30).trim();
    const produto = String(body?.produto ?? "").slice(0, 140).trim();
    const cores = String(body?.cores ?? "").slice(0, 80).trim();
    const extras = String(body?.extras ?? "").slice(0, 200).trim();
    // v6: briefing vindo do CHAT — estilo em texto e/ou referência ENVIADA pelo usuário.
    const estilo = String(body?.estilo ?? "").slice(0, 300).trim();
    const refUserB64 = typeof body?.ref_b64 === "string" ? body.ref_b64 : "";
    const refUserMime = String(body?.ref_mime ?? "image/jpeg").split(";")[0] || "image/jpeg";
    if (refUserB64.length > 3_000_000) return json({ error: "referencia_grande" });
    if (!marca || !produto || (!modeloId && !estilo && !refUserB64)) return json({ error: "dados_incompletos" });

    let modelo: { nome?: unknown; descricao?: unknown; imagem_url?: unknown; imagem_b64?: unknown } | null = null;
    if (modeloId) {
      const { data } = await admin.from("estudio_modelos")
        .select("nome, descricao, imagem_url, imagem_b64").eq("id", modeloId).eq("ativo", true).maybeSingle();
      if (!data) return json({ error: "modelo_nao_encontrado" });
      modelo = data;
    }

    // Referência visual: a foto do PRÓPRIO usuário tem prioridade; senão, a do modelo da biblioteca.
    let refB64 = refUserB64 || String(modelo?.imagem_b64 ?? "");
    let refMime = refUserB64 ? refUserMime : "image/jpeg";
    if (!refB64 && modelo?.imagem_url) {
      try {
        const ir = await fetch(String(modelo.imagem_url), { signal: AbortSignal.timeout(10000) });
        if (ir.ok) {
          refMime = ir.headers.get("content-type")?.split(";")[0] || "image/jpeg";
          refB64 = bytesToB64(new Uint8Array(await ir.arrayBuffer()));
        }
      } catch { /* segue sem referência visual */ }
    }

    const estiloDesc = modelo ? `${modelo.nome}: ${modelo.descricao}` : (estilo || "estilo livre, bonito e profissional");
    const prompt = `Você é um designer profissional de adesivos e rótulos para vendedores ambulantes brasileiros.
${refB64 ? "A imagem anexa é APENAS uma REFERÊNCIA de estilo, composição e clima" : "Estilo de referência"} (${estiloDesc}).
Crie um adesivo NOVO e ORIGINAL nesse mesmo estilo, em orientação vertical (proporção 3:4), para:
- Marca: "${marca}" (escreva EXATAMENTE assim, com destaque)
- Produto: ${produto}
${cores ? `- Cores da marca: ${cores}` : ""}
${extras ? `- Detalhes pedidos pelo vendedor: ${extras}` : ""}

REGRAS OBRIGATÓRIAS:
1. Todo texto em português do Brasil, com ortografia PERFEITA. Use pouco texto: o nome da marca, no máximo um slogan curto, e o título "PAGUE COM PIX" ou "PAGUE COM CONFIANÇA".
2. Reserve uma ÁREA QUADRADA TOTALMENTE BRANCA E VAZIA (sem nada dentro, sem moldura interna, sem QR desenhado) ocupando cerca de 25% da largura, na parte inferior direita do adesivo — é onde o aplicativo vai colocar o QR code verdadeiro.
3. NÃO desenhe QR code, não desenhe código de barras, não copie textos, contatos, nomes de marca nem personagens da imagem de referência — ela é só inspiração de estilo; a arte deve ser original.
4. Arte apetitosa/simpática de altíssima qualidade, digna de gráfica profissional.`;

    // ===== 1) GEMINI (precisa de billing ativado na conta Google) =====
    const gkey = Deno.env.get("GEMINI_API_KEY");
    if (gkey) {
      try {
        const model = Deno.env.get("GEMINI_IMAGE_MODEL") ?? "gemini-3.1-flash-image";
        const parts: unknown[] = [{ text: prompt }];
        if (refB64) parts.push({ inlineData: { mimeType: refMime, data: refB64 } });
        const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${gkey}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: AbortSignal.timeout(60000),
          body: JSON.stringify({ contents: [{ role: "user", parts }], generationConfig: { responseModalities: ["TEXT", "IMAGE"] } }),
        });
        if (r.ok) {
          const j = await r.json();
          const part = j?.candidates?.[0]?.content?.parts?.find((p: any) => p?.inlineData?.data);
          if (part?.inlineData?.data) return json({ imagem: part.inlineData.data, mime: part.inlineData.mimeType || "image/png", provedor: "gemini" });
          console.error("gemini sem imagem", JSON.stringify(j?.candidates?.[0]?.finishReason ?? "").slice(0, 120));
        } else {
          console.error("gemini imagem erro", r.status, (await r.text().catch(() => "")).slice(0, 200));
        }
      } catch (e) { console.error("gemini imagem excecao", String(e).slice(0, 150)); }
    }

    // ===== 2) OPENAI GPT Image (o gerador do ChatGPT) — se OPENAI_API_KEY existir =====
    const okey = Deno.env.get("OPENAI_API_KEY");
    if (okey) {
      const oQuality = Deno.env.get("OPENAI_IMAGE_QUALITY") ?? "medium";
      // Tenta o modelo atual primeiro; se a conta/endpoint não aceitar, cai pro legado.
      const oModels = [...new Set([Deno.env.get("OPENAI_IMAGE_MODEL") ?? "gpt-image-2", "gpt-image-1.5", "gpt-image-1"])];
      for (const om of oModels) {
        try {
          // Com referência: images/edits (multipart). Sem: images/generations.
          let r: Response;
          if (refB64) {
            const fd = new FormData();
            fd.append("model", om);
            fd.append("prompt", prompt.slice(0, 30000));
            fd.append("size", "1024x1536");
            fd.append("quality", oQuality);
            fd.append("image[]", new Blob([b64ToBytes(refB64)], { type: refMime }), "referencia.jpg");
            r = await fetch("https://api.openai.com/v1/images/edits", {
              method: "POST",
              headers: { Authorization: `Bearer ${okey}` },
              signal: AbortSignal.timeout(90000),
              body: fd,
            });
          } else {
            r = await fetch("https://api.openai.com/v1/images/generations", {
              method: "POST",
              headers: { Authorization: `Bearer ${okey}`, "Content-Type": "application/json" },
              signal: AbortSignal.timeout(90000),
              body: JSON.stringify({ model: om, prompt: prompt.slice(0, 30000), size: "1024x1536", quality: oQuality }),
            });
          }
          if (r.ok) {
            const j = await r.json();
            const b64 = j?.data?.[0]?.b64_json;
            if (b64) return json({ imagem: b64, mime: "image/png", provedor: `openai:${om}` });
            console.error("openai sem imagem", om);
            break;
          } else {
            console.error("openai imagem erro", om, r.status, (await r.text().catch(() => "")).slice(0, 300));
            // 400/404 = provavelmente modelo não aceito → tenta o próximo; outros erros: para.
            if (r.status !== 400 && r.status !== 404) break;
          }
        } catch (e) { console.error("openai imagem excecao", om, String(e).slice(0, 150)); break; }
      }
    }

    // Nenhum provedor disponível/funcionando
    return json({ error: gkey || okey ? "geracao_falhou" : "sem_chave", detalhe: "provedor_de_imagem_indisponivel" });
  } catch (e) {
    console.error("estudio-arte erro", e);
    return json({ error: "erro_interno" }, 500);
  }
});
