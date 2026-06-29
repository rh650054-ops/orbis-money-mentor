// Orbis — verificar-extrato
// A IA le um EXTRATO (print ou PDF) e separa as VENDAS (dinheiro que ENTROU/foi recebido)
// das DESPESAS (compras/saidas do proprio vendedor). So venda conta.
// PRIMARIO: Claude (visao — nao fica sobrecarregado). FALLBACK: Gemini.
// Recebe { file: base64, mime, salvar?, dia?, tipo? }.
// Devolve { ok, motor, salvo, dia, tipo, vendas[], total_vendas, total_ignorado, qtd_vendas }.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PROMPT = `Voce e um auditor financeiro do app Orbis (vendedores de rua). Recebe a imagem ou PDF de um EXTRATO bancario/de pagamentos brasileiro.

Tarefa: listar APENAS as VENDAS = dinheiro que ENTROU (foi RECEBIDO pelo vendedor). IGNORE todas as despesas/saidas.

CONTA como venda (dinheiro que ENTROU):
- "Pix recebido", "Entrada PIX", "Credito", "Recebimento"
- Venda no cartao recebida (credito/debito) que CAIU pra ele
- Qualquer valor de ENTRADA (positivo, recebido)

NAO CONTA (despesa/saida do vendedor — ele gastando):
- "Debito de Cartao" (compras em lojas, ex: ATACADAO, MERCADO, SUPERMERCADO)
- "Saida PIX", "Pix enviado", "Pagamento", "Transferencia enviada"
- Qualquer valor NEGATIVO ou de saida

Na duvida, use o SINAL do valor (positivo = entrou = venda) e a descricao.

Responda SOMENTE um JSON valido (sem texto fora, sem markdown):
{"vendas":[{"descricao":"de quem/origem","valor":35.0}],"total_vendas":387.0,"total_ignorado":244.45,"qtd_vendas":18}`;

// ---- Claude (primario): le imagem ou PDF e devolve o texto (JSON) ----
async function callClaude(key: string, model: string, fileB64: string, mime: string): Promise<string> {
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
      max_tokens: 1500,
      messages: [{ role: "user", content: [{ type: "text", text: PROMPT }, filePart] }],
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
async function callGemini(key: string, fileB64: string, mime: string): Promise<string> {
  const models = (Deno.env.get("GEMINI_VISION_MODELS") ?? "gemini-2.0-flash,gemini-2.5-flash,gemini-flash-latest,gemini-1.5-flash")
    .split(",").map((s) => s.trim()).filter(Boolean);
  const reqBody = JSON.stringify({
    contents: [{ parts: [{ text: PROMPT }, { inlineData: { mimeType: mime, data: fileB64 } }] }],
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
      if (r.status === 400 || r.status === 404) break; // modelo invalido: pula pro proximo
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

    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
    const geminiKey = Deno.env.get("GEMINI_API_KEY");
    const model = Deno.env.get("ANTHROPIC_MODEL") ?? "claude-haiku-4-5-20251001";

    let text = "";
    let motor = "";
    let lastErr = "";

    // 1) Claude primeiro (melhor leitura, nao trava feito o Gemini gratis)
    if (anthropicKey) {
      try {
        text = await callClaude(anthropicKey, model, fileB64, mime);
        motor = "claude";
      } catch (e) {
        lastErr = String((e as Error)?.message || e);
      }
    }

    // 2) Se o Claude falhar ou nao tiver chave, cai no Gemini
    if (!text && geminiKey) {
      try {
        text = await callGemini(geminiKey, fileB64, mime);
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
    const totalVendas = Number(parsed.total_vendas) || 0;
    const qtdVendas = Number(parsed.qtd_vendas) || vendas.length;
    const totalIgnorado = Number(parsed.total_ignorado) || 0;

    // Salva so quando salvar:true (a tela de teste admin NAO salva). Usa o JWT do usuario (RLS).
    let salvo = false;
    if (salvar) {
      try {
        const supa = createClient(
          Deno.env.get("SUPABASE_URL") ?? "",
          Deno.env.get("SUPABASE_ANON_KEY") ?? "",
          { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } },
        );
        const { data: u } = await supa.auth.getUser();
        const uid = u?.user?.id;
        if (uid) {
          const { error: upErr } = await supa.from("extrato_uploads").upsert({
            user_id: uid,
            dia,
            tipo,
            total_verificado: totalVendas,
            qtd_vendas: qtdVendas,
            total_ignorado: totalIgnorado,
            vendas,
            motor,
            updated_at: new Date().toISOString(),
          }, { onConflict: "user_id,dia,tipo" });
          if (upErr) console.error("extrato upsert erro", upErr.message);
          else salvo = true;
        }
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
      vendas,
      total_vendas: totalVendas,
      total_ignorado: totalIgnorado,
      qtd_vendas: qtdVendas,
    });
  } catch (e) {
    console.error("verificar-extrato excecao", e);
    return json({ error: "erro_interno" }, 500);
  }
});
