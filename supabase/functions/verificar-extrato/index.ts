// Orbis — verificar-extrato
// A IA (Gemini visao) le um EXTRATO (print ou PDF) e separa as VENDAS (dinheiro que
// ENTROU/foi recebido) das DESPESAS (compras/saidas do proprio vendedor). So venda conta.
// Recebe { file: base64, mime, dia? }. Devolve { vendas[], total_vendas, total_ignorado, qtd_vendas }.

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const json = (obj: unknown, status = 200) =>
    new Response(JSON.stringify(obj), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const body = await req.json().catch(() => ({}));
    const fileB64 = typeof body?.file === "string" ? body.file.replace(/^data:[^;]+;base64,/, "") : "";
    const mime = typeof body?.mime === "string" ? body.mime : "application/pdf";
    if (!fileB64) return json({ error: "sem_arquivo" }, 400);

    const key = Deno.env.get("GEMINI_API_KEY");
    if (!key) return json({ error: "sem_gemini_key" }, 500);
    // Tenta varios modelos do Gemini em ordem. Se um estiver lotado (503) ou indisponivel,
    // cai pro proximo — a leitura nao fica refem de um modelo so. Configuravel via env.
    const models = (Deno.env.get("GEMINI_VISION_MODELS") ?? "gemini-2.0-flash,gemini-2.5-flash,gemini-flash-latest,gemini-1.5-flash")
      .split(",").map((s) => s.trim()).filter(Boolean);
    const reqBody = JSON.stringify({
      contents: [{ parts: [{ text: PROMPT }, { inlineData: { mimeType: mime, data: fileB64 } }] }],
      generationConfig: { temperature: 0, responseMimeType: "application/json" },
    });

    let data: any = null;
    let lastStatus = 0;
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
        if (r.ok) { data = await r.json(); break; }
        lastStatus = r.status;
        const errTxt = await r.text().catch(() => "");
        console.error("Gemini extrato erro", m, r.status, errTxt.slice(0, 200));
        if (r.status === 400 || r.status === 404) break; // modelo invalido: pula pro proximo
        if (attempt < 2) await new Promise((res2) => setTimeout(res2, 1500));
      }
      if (data) break;
    }

    if (!data) {
      return json({ error: `gemini_${lastStatus || "ocupado"}`, dica: "Gemini ocupado, tente de novo em instantes" }, 503);
    }
    const text: string = data?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text || "").join("") ?? "";
    let parsed: any = null;
    try {
      parsed = JSON.parse(text);
    } catch {
      const m = text.match(/\{[\s\S]*\}/);
      if (m) { try { parsed = JSON.parse(m[0]); } catch { /* noop */ } }
    }
    if (!parsed) return json({ error: "leitura_falhou", raw: text.slice(0, 400) }, 422);

    const vendas = Array.isArray(parsed.vendas) ? parsed.vendas : [];
    return json({
      ok: true,
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
