// Orbis — verificar-extrato
// A IA le um EXTRATO (print ou PDF) e separa as VENDAS (dinheiro que ENTROU/foi recebido)
// das DESPESAS e dos itens SUSPEITOS DE FRAUDE (auto-transferencia, duplicata).
// PRIMARIO: Claude (visao). FALLBACK: Gemini.
// Recebe { file: base64, mime, salvar?, dia?, tipo? }.
// Devolve { ok, motor, salvo, dia, tipo, vendas[], suspeitas[], total_vendas, total_ignorado, qtd_vendas }.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Monta o prompt com o nome do vendedor (pra IA pegar auto-transferencia).
function buildPrompt(nome: string): string {
  const hint = nome ? `\nDica: o vendedor (titular) provavelmente se chama "${nome}".` : "";
  return `Voce e um auditor financeiro do app Orbis (vendedores de rua). Recebe a imagem ou PDF de um EXTRATO bancario/de pagamentos brasileiro.

Tarefa: listar APENAS as VENDAS = dinheiro que ENTROU (foi RECEBIDO pelo vendedor). IGNORE despesas/saidas E itens suspeitos de fraude.

CONTA como venda (dinheiro que ENTROU):
- "Pix recebido", "Entrada PIX", "Credito", "Recebimento"
- Venda no cartao recebida (credito/debito) que CAIU pra ele
- Qualquer valor de ENTRADA (positivo, recebido)

NAO CONTA (despesa/saida do vendedor):
- "Debito de Cartao" (compras em lojas, ex: ATACADAO, MERCADO), "Saida PIX", "Pix enviado", "Pagamento", "Transferencia enviada"
- Qualquer valor NEGATIVO ou de saida

ANTIFRAUDE — NAO CONTA como venda e coloque em "suspeitas" com o motivo:
- AUTO-TRANSFERENCIA: o extrato mostra o NOME DO TITULAR da conta. Pix recebido cujo REMETENTE seja o PROPRIO titular (mesmo nome ou muito parecido${nome ? `, inclusive parecido com "${nome}"` : ""}) NAO e venda — e o vendedor mandando dinheiro pra si mesmo pra inflar o ranking.
- DUPLICATA: se a MESMA venda aparecer repetida (mesmo valor + mesmo remetente, em horarios colados), conte SO UMA vez; as copias vao pra "suspeitas".
${hint}

total_vendas = soma SO das vendas legitimas (sem despesa e sem suspeita).
total_ignorado = soma de despesas + suspeitas.

Responda SOMENTE um JSON valido (sem texto fora, sem markdown):
{"vendas":[{"descricao":"de quem/origem","valor":35.0}],"suspeitas":[{"descricao":"origem","valor":50.0,"motivo":"auto-transferencia"}],"total_vendas":387.0,"total_ignorado":244.45,"qtd_vendas":18}`;
}

// ---- Claude (primario): le imagem ou PDF e devolve o texto (JSON) ----
async function callClaude(key: string, model: string, prompt: string, fileB64: string, mime: string): Promise<string> {
  const isPdf = mime.includes("pdf");
  const mediaType = isPdf
    ? "application/pdf"
    : (["image/jpeg", "image/png", "image/gif", "image/webp"].includes(mime) ? mime : "image/jpeg");
  const filePart = isPdf
    ? { type: "document", source: { type: "base64", media_type: mediaType, data: fileB64 } }
    : { type: "image", source: { type: "base64", media_type: mediaType, data: fileB64 } };

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    signal: AbortSignal.timeout(40000),
    body: JSON.stringify({
      model,
      max_tokens: 1800,
      messages: [{ role: "user", content: [{ type: "text", text: prompt }, filePart] }],
    }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    console.error("Claude extrato erro", res.status, t.slice(0, 200));
    throw new Error(`claude_${res.status}`);
  }
  const data = await res.json();
  return (data?.content ?? []).map((b: any) => b?.text || "").join("").trim();
}

// ---- Gemini (fallback): varios modelos em ordem, desvia do que estiver lotado ----
async function callGemini(key: string, prompt: string, fileB64: string, mime: string): Promise<string> {
  const models = (Deno.env.get("GEMINI_VISION_MODELS") ?? "gemini-2.0-flash,gemini-2.5-flash,gemini-flash-latest,gemini-1.5-flash")
    .split(",").map((s) => s.trim()).filter(Boolean);
  const reqBody = JSON.stringify({
    contents: [{ parts: [{ text: prompt }, { inlineData: { mimeType: mime, data: fileB64 } }] }],
    generationConfig: { temperature: 0, responseMimeType: "application/json" },
  });
  for (const m of models) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${key}`;
    for (let attempt = 1; attempt <= 2; attempt++) {
      let r: Response;
      try {
        r = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: AbortSignal.timeout(35000),
          body: reqBody,
        });
      } catch (e) {
        console.error("Gemini extrato fetch erro", m, String(e).slice(0, 150));
        break;
      }
      if (r.ok) {
        const data = await r.json();
        return data?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text || "").join("") ?? "";
      }
      const errTxt = await r.text().catch(() => "");
      console.error("Gemini extrato erro", m, r.status, errTxt.slice(0, 200));
      if (r.status === 400 || r.status === 404) break;
      if (attempt < 2) await new Promise((res2) => setTimeout(res2, 1500));
    }
  }
  throw new Error("gemini_ocupado");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const json = (obj: unknown, status = 200) =>
    new Response(JSON.stringify(obj), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const body = await req.json().catch(() => ({}));
    const fileB64 = typeof body?.file === "string" ? body.file.replace(/^data:[^;]+;base64,/, "") : "";
    const mime = typeof body?.mime === "string" ? body.mime : "application/pdf";
    const salvar = body?.salvar === true;
    const dia = typeof body?.dia === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.dia)
      ? body.dia : new Date().toISOString().slice(0, 10);
    const tipo = body?.tipo === "cartao" ? "cartao" : "pix";
    if (!fileB64) return json({ error: "sem_arquivo" }, 400);

    // Auth: pega o usuario + nickname (pra IA detectar auto-transferencia).
    let supa: ReturnType<typeof createClient> | null = null;
    let uid: string | null = null;
    let nome = "";
    const authHeader = req.headers.get("Authorization") ?? "";
    if (authHeader) {
      try {
        supa = createClient(
          Deno.env.get("SUPABASE_URL") ?? "",
          Deno.env.get("SUPABASE_ANON_KEY") ?? "",
          { global: { headers: { Authorization: authHeader } } },
        );
        const { data: u } = await supa.auth.getUser();
        uid = u?.user?.id ?? null;
        if (uid) {
          const { data: prof } = await supa.from("public_profiles").select("nickname").eq("user_id", uid).maybeSingle();
          nome = ((prof as any)?.nickname ?? "").toString().trim();
        }
      } catch { /* best-effort */ }
    }

    // Trava de uso: teto de extratos por dia (protege o gasto da IA).
    if (supa && uid) {
      try {
        const { data: usage } = await supa.rpc("bump_ai_usage", { p_feature: "extrato", p_limit: 6 });
        if ((usage as any)?.over) {
          return json({ error: "limite_diario", dica: "Você já enviou bastante extrato hoje. Volta amanhã." }, 200);
        }
      } catch { /* deixa passar se a trava falhar */ }
    }

    const prompt = buildPrompt(nome);
    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
    const geminiKey = Deno.env.get("GEMINI_API_KEY");
    const model = Deno.env.get("ANTHROPIC_MODEL") ?? "claude-haiku-4-5-20251001";

    let text = "";
    let motor = "";
    let lastErr = "";

    if (anthropicKey) {
      try {
        text = await callClaude(anthropicKey, model, prompt, fileB64, mime);
        motor = "claude";
      } catch (e) {
        lastErr = String((e as Error)?.message || e);
      }
    }
    if (!text && geminiKey) {
      try {
        text = await callGemini(geminiKey, prompt, fileB64, mime);
        motor = "gemini";
      } catch (e) {
        lastErr = String((e as Error)?.message || e);
      }
    }

    if (!text) {
      if (!anthropicKey && !geminiKey) return json({ error: "sem_chave_ia" }, 500);
      return json({ error: lastErr || "leitura_indisponivel", dica: "tente de novo em instantes" }, 503);
    }

    let parsed: any = null;
    try {
      parsed = JSON.parse(text);
    } catch {
      const m = text.match(/\{[\s\S]*\}/);
      if (m) { try { parsed = JSON.parse(m[0]); } catch { /* noop */ } }
    }
    if (!parsed) return json({ error: "leitura_falhou", raw: text.slice(0, 400) }, 422);

    const vendas = Array.isArray(parsed.vendas) ? parsed.vendas : [];
    const suspeitas = Array.isArray(parsed.suspeitas) ? parsed.suspeitas : [];
    const totalVendas = Number(parsed.total_vendas) || 0;
    const qtdVendas = Number(parsed.qtd_vendas) || vendas.length;
    const totalIgnorado = Number(parsed.total_ignorado) || 0;

    // ===== ANTIFRAUDE EXTRA (no servidor, alem do que a IA ja faz no prompt) =====
    // 1) DEDUP ENTRE SLOTS: pix e cartao sao documentos DIFERENTES. Se a MESMA
    //    transacao (valor + origem) aparece nos DOIS, e o mesmo extrato subido 2x
    //    -> conta UMA vez (a copia vai pra suspeitas). Mata o bug do "soma em dobro".
    // 2) VALOR ALTO: venda individual acima do teto (ticket de rua e pequeno) vira
    //    suspeita e NAO conta. Teto configuravel via SUSPEITA_VALOR_MAX (default 150).
    let outras: any[] = [];
    if (supa && uid) {
      try {
        const outroTipo = tipo === "cartao" ? "pix" : "cartao";
        const { data: o } = await supa
          .from("extrato_uploads")
          .select("vendas")
          .eq("user_id", uid)
          .eq("dia", dia)
          .eq("tipo", outroTipo)
          .maybeSingle();
        outras = Array.isArray((o as any)?.vendas) ? (o as any).vendas : [];
      } catch { /* segue sem dedup se a leitura falhar */ }
    }
    const LIMITE = Number(Deno.env.get("SUSPEITA_VALOR_MAX") ?? "150");
    const chave = (v: any) =>
      `${Math.round((Number(v?.valor) || 0) * 100)}|${String(v?.descricao ?? "").toLowerCase().replace(/\s+/g, " ").trim().slice(0, 24)}`;
    const outrasKeys = new Set(outras.map(chave));
    const vendasLimpas: any[] = [];
    const suspeitasFinal: any[] = Array.isArray(suspeitas) ? [...suspeitas] : [];
    let addedIgnorado = 0;
    for (const v of vendas) {
      const val = Number(v?.valor) || 0;
      if (outrasKeys.has(chave(v))) {
        suspeitasFinal.push({ ...v, motivo: "duplicata (mesma venda no outro extrato)" });
        addedIgnorado += val;
        continue;
      }
      if (val > LIMITE) {
        suspeitasFinal.push({ ...v, motivo: `valor alto (acima de R$${LIMITE}) - revisar` });
        addedIgnorado += val;
        continue;
      }
      vendasLimpas.push(v);
    }
    const totalLimpo = vendasLimpas.reduce((s, v) => s + (Number(v?.valor) || 0), 0);
    const ignoradoFinal = (Number(totalIgnorado) || 0) + addedIgnorado;

    // Total que o vendedor REGISTROU no DEFCON do dia (cartao + pix) — pra comparar.
    let defconTotal = 0;
    if (supa && uid) {
      try {
        const { data: ds } = await supa
          .from("daily_sales")
          .select("card_sales, pix_sales")
          .eq("user_id", uid)
          .eq("date", dia);
        defconTotal = ((ds as any[]) || []).reduce((s, r) => s + Number(r.card_sales || 0) + Number(r.pix_sales || 0), 0);
      } catch { /* opcional */ }
    }

    // Salva so quando salvar:true (a tela de teste admin NAO salva). Usa o JWT do usuario (RLS).
    let salvo = false;
    if (salvar && supa && uid) {
      try {
        const { error: upErr } = await supa.from("extrato_uploads").upsert({
          user_id: uid,
          dia,
          tipo,
          total_verificado: totalLimpo,
          qtd_vendas: vendasLimpas.length,
          total_ignorado: ignoradoFinal,
          vendas: vendasLimpas,
          motor,
          updated_at: new Date().toISOString(),
        }, { onConflict: "user_id,dia,tipo" });
        if (upErr) console.error("extrato upsert erro", upErr.message);
        else salvo = true;
      } catch (e) {
        console.error("extrato salvar excecao", String(e).slice(0, 150));
      }
    }

    return json({
      ok: true,
      motor,
      salvo,
      dia,
      tipo,
      vendas: vendasLimpas,
      suspeitas: suspeitasFinal,
      total_vendas: totalLimpo,
      total_ignorado: ignoradoFinal,
      qtd_vendas: vendasLimpas.length,
      defcon_total: defconTotal,
      acima_do_defcon: defconTotal > 0 && totalLimpo > defconTotal * 1.2,
    });
  } catch (e) {
    console.error("verificar-extrato excecao", e);
    return json({ error: "erro_interno" }, 500);
  }
});
