// Orbis — estudio-arte v9: gera o ADESIVO do vendedor com IA. O briefing vem da
// GALERIA (modelo_id da biblioteca estudio_modelos) OU do CHAT da Orbis IA (estilo em
// texto + referência opcional enviada pelo PRÓPRIO usuário). Deixa ÁREA BRANCA pro app
// colocar o QR Pix REAL.
// PROVEDORES (em ordem): 1) Gemini (GEMINI_IMAGE_MODEL, padrao gemini-3.1-flash-image;
// exige billing ativado na conta Google) → 2) OpenAI GPT Image (se OPENAI_API_KEY
// existir nos secrets) — o MESMO gerador de imagem do ChatGPT.
// v5: OpenAI usa gpt-image-2 (o mesmo do ChatGPT atual) com fallback 1.5 -> 1;
// qualidade via OPENAI_IMAGE_QUALITY ("medium" — ~US$0,041 por arte 1024x1536).
// v9 (custo + funil):
//   - TRIAL (3 dias grátis) TAMBÉM gera arte, com limite menor, e a arte sai com
//     marca d'água — pra baixar limpa ele assina. Antes o trial era tratado igual
//     a assinante e baixava tudo de graça.
//   - limites por dia: pagante 4, trial 2 (ESTUDIO_LIMITE_PAGANTE / _TRIAL).
//   - TODA geração é registrada em estudio_geracoes (briefing + provedor + depois
//     a URL e se o vendedor baixou) — é o dado que ensina o que funciona.

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
    const userId = u.user.id;

    const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
    const { data: prof } = await admin.from("profiles")
      .select("plan_status,is_trial_active,trial_end,billing_exempt,is_demo")
      .eq("user_id", userId).maybeSingle();
    const hoje = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });

    // PAGANTE = assinatura ativa (ou conta liberada). TRIAL = os 3 dias grátis.
    // Os dois geram arte; só o pagante baixa sem marca d'água.
    const pagante = !!prof && (prof.billing_exempt || prof.is_demo || prof.plan_status === "active");
    const trial = !!prof && !pagante && !!prof.is_trial_active && String(prof.trial_end ?? "") >= hoje;
    if (!pagante && !trial) return json({ error: "assinatura_necessaria" }, 403);

    const limite = pagante
      ? Number(Deno.env.get("ESTUDIO_LIMITE_PAGANTE") ?? "4")
      : Number(Deno.env.get("ESTUDIO_LIMITE_TRIAL") ?? "2");
    const { data: usage } = await supa.rpc("bump_ai_usage", { p_feature: "estudio", p_limit: limite });
    if ((usage as any)?.over) return json({ error: "limite_diario", limite, plano: pagante ? "pagante" : "trial" });

    const body = await req.json().catch(() => ({}));
    const modeloId = String(body?.modelo_id ?? "").trim();
    const marca = String(body?.marca ?? "").slice(0, 30).trim();
    const produto = String(body?.produto ?? "").slice(0, 140).trim();
    const cores = String(body?.cores ?? "").slice(0, 80).trim();
    const extras = String(body?.extras ?? "").slice(0, 200).trim();
    const origem = String(body?.origem ?? "estudio") === "chat" ? "chat" : "estudio";
    // Briefing vindo do CHAT — estilo em texto e/ou referência ENVIADA pelo usuário.
    const estilo = String(body?.estilo ?? "").slice(0, 300).trim();
    const refUserB64 = typeof body?.ref_b64 === "string" ? body.ref_b64 : "";
    const refUserMime = String(body?.ref_mime ?? "image/jpeg").split(";")[0] || "image/jpeg";
    if (refUserB64.length > 3_000_000) return json({ error: "referencia_grande" });
    // tipo "foto" = MELHORAR a foto real do produto (luz/contraste, sem virar arte de IA).
    // tipo "adesivo" (padrão) = criar o adesivo/QR da marca.
    const tipo = String(body?.tipo ?? "adesivo") === "foto" ? "foto" : "adesivo";
    if (tipo === "foto") {
      if (!refUserB64) return json({ error: "sem_foto" });
    } else if (!marca || !produto || (!modeloId && !estilo && !refUserB64)) {
      return json({ error: "dados_incompletos" });
    }

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

    // Registra a geração ANTES de desenhar: assim a gente vê até os briefings que
    // falharam (provedor fora do ar), que é justamente onde mora o aprendizado.
    let geracaoId = "";
    try {
      const { data: g } = await admin.from("estudio_geracoes").insert({
        user_id: userId,
        origem,
        plano: pagante ? "pagante" : "trial",
        marca, produto, estilo: estilo || String(modelo?.nome ?? ""), cores, extras,
        modelo_id: modeloId || null,
        com_referencia: !!refB64,
      }).select("id").maybeSingle();
      geracaoId = String((g as any)?.id ?? "");
    } catch { /* registro nunca pode derrubar a geração */ }

    const marcaDagua = !pagante;
    const okResp = (imagem: string, mime: string, provedor: string) => {
      if (geracaoId) admin.from("estudio_geracoes").update({ provedor }).eq("id", geracaoId).then(() => {}, () => {});
      return json({ imagem, mime, provedor, geracao_id: geracaoId, marca_dagua: marcaDagua, plano: pagante ? "pagante" : "trial" });
    };

    const estiloDesc = modelo ? `${modelo.nome}: ${modelo.descricao}` : (estilo || "");
    const temFoto = !!refB64;

    // ===== MODO FOTO: melhorar a foto REAL do produto (sem virar arte de IA) =====
    const promptFoto = `Você é um RETOCADOR de fotografia gastronômica/de produto — NÃO um gerador de imagens. Sua tarefa é FAZER RETOQUE FOTOGRÁFICO na foto REAL anexa, como um fotógrafo profissional faria no Lightroom, entregando uma versão vertical (proporção 4:5, formato Instagram).

O QUE FAZER (retoque leve e realista):
- Corrija a iluminação: clareie sombras pesadas, equilibre a exposição, dê um brilho natural e apetitoso.
- Ajuste contraste, nitidez e cor com naturalidade (cores fiéis ao produto real — nada saturado/plástico).
- Limpe distrações discretas do fundo (migalhas fora do lugar, reflexo feio, um cabo de tomada), MAS mantenha o cenário real.
- Se a foto estiver torta, endireite; se houver muito espaço vazio, aproxime levemente o enquadramento no produto.
${estilo ? `- Direção do vendedor: ${estilo}` : ""}

REGRAS DE OURO (o mais importante):
1. É a MESMA foto, o MESMO produto real — NÃO redesenhe, NÃO gere um produto novo, NÃO troque formato, recheio, cor ou textura. Cada detalhe do produto (imperfeições, formato irregular, cobertura) tem que continuar igualzinho. A pessoa precisa reconhecer que é a foto DELA.
2. Resultado tem que parecer FOTOGRAFIA REAL tirada por um bom celular — NUNCA com aquela cara de "imagem de IA" (pele/comida lisa demais, brilho plástico, luz irreal, fundo perfeito demais). Se ficar com cara de IA, você errou.
3. Preserve a autenticidade: pode manter uma pequena imperfeição real (uma borda irregular, uma gota) — é isso que faz o cliente confiar e comprar.
4. Sem texto, sem logo, sem moldura, sem adesivo. Só a foto do produto, melhor iluminada e enquadrada.`;

    const promptAdesivo = `Você é o designer especialista nos adesivos "PAGUE COM PIX" dos vendedores ambulantes brasileiros — aquele estilo de CARICATURA cartoon do vendedor ao lado de um QR do Pix, com letreiro desenhado à mão. Crie um adesivo NOVO e ORIGINAL nesse estilo, orientação vertical/quadrada, acabamento de gráfica profissional.

PERSONAGEM (à esquerda, meio corpo, sorrindo):
${temFoto
  ? `- Transforme a PESSOA da foto anexa numa CARICATURA cartoon vetorial simpática (traço limpo, cores chapadas, estilo desenho brasileiro). Mantenha FIEL: rosto, cor de pele, cabelo, barba/óculos e o sorriso dela. Ela acena OU segura o produto. É o personagem central.`
  : `- Um(a) vendedor(a) cartoon simpático(a), acenando ou segurando o produto.`}

ELEMENTOS OBRIGATÓRIOS (padrão desses adesivos):
- Título grande em LETREIRO desenhado à mão: "PAGUE COM PIX", com tracinhos/raios decorativos e uma SETA curva apontando pra área do QR.
- Um BALÃO DE FALA saindo do personagem com UMA frase curta e emocional${extras ? `. Se fizer sentido, use algo do que o vendedor pediu: "${String(extras).slice(0, 90)}"` : ` (ex.: "Seu apoio transforma meu sonho em realidade")`}.
- Nome da marca "${marca}" com tipografia bonita e destaque.
- FAIXA inferior colorida com um slogan curto de propósito (ex.: "Mais do que um produto, entregamos propósito").
- Linha de contato pequena embaixo (ícones de WhatsApp e Instagram). Deixe os textos de telefone/@ genéricos se não forem informados.

Produto vendido: ${produto}.
Cores/clima: ${cores || "paleta alegre e apetitosa que combine com o produto"}.${estiloDesc ? ` Vibe: ${estiloDesc}.` : ""}

REGRAS DE OURO:
1. Todo texto em português do Brasil, ortografia PERFEITA — confira cada palavra (é o erro nº1 nessas artes).
2. Reserve uma ÁREA CLARA (fundo branco/bem claro), retangular, ocupando ~35% da largura no LADO DIREITO, na altura do meio, TOTALMENTE VAZIA — sem moldura interna, sem QR, sem código de barras. É onde o app encaixa o QR do Pix REAL depois; a seta do "PAGUE COM PIX" deve apontar pra ela.
3. NUNCA desenhe QR code nem código de barras (quebra a leitura). Não copie marca, contato nem personagem de nenhuma referência de estilo — arte 100% original.
4. Nítido, vetorial, bem acabado, digno de gráfica.`;

    const prompt = tipo === "foto" ? promptFoto : promptAdesivo;

    // ===== 1) GEMINI (precisa de billing ativado na conta Google) =====
    const gkey = Deno.env.get("GEMINI_API_KEY");
    if (gkey && (Deno.env.get("IMAGEM_TENTAR_GEMINI") ?? "1") !== "0") {
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
          if (part?.inlineData?.data) return okResp(part.inlineData.data, part.inlineData.mimeType || "image/png", "gemini");
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
            if (b64) return okResp(b64, "image/png", `openai:${om}`);
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
    if (geracaoId) { try { await admin.from("estudio_geracoes").update({ provedor: "falhou" }).eq("id", geracaoId); } catch { /* noop */ } }
    return json({ error: gkey || okey ? "geracao_falhou" : "sem_chave", detalhe: "provedor_de_imagem_indisponivel" });
  } catch (e) {
    console.error("estudio-arte erro", e);
    return json({ error: "erro_interno" }, 500);
  }
});
