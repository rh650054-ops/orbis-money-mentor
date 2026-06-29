// Orbis — verificar-extrato
// A IA le um EXTRATO (print ou PDF) e separa as VENDAS (dinheiro que ENTROU/foi recebido)
// das DESPESAS (compras/saidas do proprio vendedor). So venda conta.
<<<<<<< HEAD
// PRIMARIO: Claude (visao — nao fica sobrecarregado). FALLBACK: Gemini.
// Recebe { file: base64, mime }. Devolve { ok, vendas[], total_vendas, total_ignorado, qtd_vendas }.
=======
// PRINCIPAL: Claude (ANTHROPIC_API_KEY). RESERVA: Gemini (GEMINI_API_KEY) — usado so se a Claude falhar.
// Recebe { file: base64, mime, instrucao? }. Devolve { ok, engine, vendas[], total_vendas, total_ignorado, qtd_vendas }.
>>>>>>> origin/main

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BASE_PROMPT = `Voce e um auditor financeiro do app Orbis (vendedores de rua). Recebe a imagem ou PDF de um EXTRATO bancario/de pagamentos brasileiro.

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

<<<<<<< HEAD
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
=======
function buildPrompt(instrucao?: string): string {
  const extra = instrucao && instrucao.trim()
    ? `\n\nINSTRUCAO EXTRA DO ADMIN (siga com prioridade, mas mantenha o formato JSON acima):\n${instrucao.trim()}`
    : "";
  return BASE_PROMPT + extra;
}

function parseJson(text: string): any | null {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    const m = text.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        return JSON.parse(m[0]);
      } catch {
        /* noop */
      }
    }
  }
  return null;
}

// ---------- PRINCIPAL: Claude (Anthropic) ----------
async function runClaude(fileB64: string, mime: string, prompt: string): Promise<any | null> {
  const key = Deno.env.get("ANTHROPIC_API_KEY");
  if (!key) return null;
  const model = Deno.env.get("CLAUDE_MODEL") ?? "claude-haiku-4-5-20251001";
  const isPdf = mime.includes("pdf");
  const mediaBlock = isPdf
    ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: fileB64 } }
    : { type: "image", source: { type: "base64", media_type: mime || "image/jpeg", data: fileB64 } };

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      signal: AbortSignal.timeout(40000),
      body: JSON.stringify({
        model,
        max_tokens: 2000,
        messages: [{ role: "user", content: [{ type: "text", text: prompt }, mediaBlock] }],
      }),
    });
    if (!r.ok) {
      const errTxt = await r.text().catch(() => "");
      console.error("Claude extrato erro", r.status, errTxt.slice(0, 250));
      return null;
    }
    const data = await r.json();
    const text: string = Array.isArray(data?.content)
      ? data.content.map((c: any) => (typeof c?.text === "string" ? c.text : "")).join("")
      : "";
    return parseJson(text);
  } catch (e) {
    console.error("Claude extrato fetch erro", String(e).slice(0, 150));
    return null;
  }
}

// ---------- RESERVA: Gemini ----------
async function runGemini(fileB64: string, mime: string, prompt: string): Promise<any | null> {
  const key = Deno.env.get("GEMINI_API_KEY");
  if (!key) return null;
  const models = (Deno.env.get("GEMINI_VISION_MODELS") ?? "gemini-2.0-flash,gemini-2.5-flash,gemini-flash-latest,gemini-1.5-flash")
    .split(",").map((s) => s.trim()).filter(Boolean);
  const reqBody = JSON.stringify({
    contents: [{ parts: [{ text: prompt }, { inlineData: { mimeType: mime, data: fileB64 } }] }],
    generationConfig: { temperature: 0, responseMimeType: "application/json" },
  });

>>>>>>> origin/main
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
<<<<<<< HEAD
        return data?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text || "").join("") ?? "";
      }
      const errTxt = await r.text().catch(() => "");
      console.error("Gemini extrato erro", m, r.status, errTxt.slice(0, 200));
      if (r.status === 400 || r.status === 404) break; // modelo invalido: pula pro proximo
      if (attempt < 2) await new Promise((res2) => setTimeout(res2, 1500));
    }
  }
  throw new Error("gemini_ocupado");
=======
        const text: string = data?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text || "").join("") ?? "";
        const parsed = parseJson(text);
        if (parsed) return parsed;
        break;
      }
      const errTxt = await r.text().catch(() => "");
      console.error("Gemini extrato erro", m, r.status, errTxt.slice(0, 200));
      if (r.status === 400 || r.status === 404) break;
      if (attempt < 2) await new Promise((res) => setTimeout(res, 1500));
    }
  }
  return null;
>>>>>>> origin/main
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const json = (obj: unknown, status = 200) =>
    new Response(JSON.stringify(obj), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const body = await req.json().catch(() => ({}));
    const fileB64 = typeof body?.file === "string" ? body.file.replace(/^data:[^;]+;base64,/, "") : "";
    const mime = typeof body?.mime === "string" ? body.mime : "application/pdf";
    const instrucao = typeof body?.instrucao === "string" ? body.instrucao : "";
    if (!fileB64) return json({ error: "sem_arquivo" }, 400);

<<<<<<< HEAD
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
=======
    const hasClaude = !!Deno.env.get("ANTHROPIC_API_KEY");
    const hasGemini = !!Deno.env.get("GEMINI_API_KEY");
    if (!hasClaude && !hasGemini) return json({ error: "sem_ia_key", dica: "Defina ANTHROPIC_API_KEY no Supabase" }, 500);

    const prompt = buildPrompt(instrucao);

    // Tenta Claude primeiro; se falhar (ou nao tiver chave), cai pro Gemini.
    let parsed = await runClaude(fileB64, mime, prompt);
    let engine = "claude";
    if (!parsed) {
      parsed = await runGemini(fileB64, mime, prompt);
      engine = "gemini";
    }
    if (!parsed) return json({ error: "leitura_falhou", dica: "IA ocupada/ilegivel, tente de novo" }, 503);
>>>>>>> origin/main

    const vendas = Array.isArray(parsed.vendas) ? parsed.vendas : [];
    return json({
      ok: true,
<<<<<<< HEAD
      motor,
=======
      engine,
>>>>>>> origin/main
      vendas,
      total_vendas: Number(parsed.total_vendas) || 0,
      total_ignorado: Number(parsed.total_ignorado) || 0,
      qtd_vendas: Number(parsed.qtd_vendas) || vendas.length,
    });
  } catch (e) {
    console.error("verificar-extrato excecao", e);
    return json({ error: "erro_interno" }, 500);
  }
});
