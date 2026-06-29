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
    const model = Deno.env.get("GEMINI_VISION_MODEL") ?? "gemini-flash-latest";

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
    const reqBody = JSON.stringify({
      contents: [{ parts: [{ text: PROMPT }, { inlineData: { mimeType: mime, data: fileB64 } }] }],
      generationConfig: { temperature: 0, responseMimeType: "application/json" },
    });

    // O flash gratis as vezes devolve 503/429/500 (sobrecarga/pico). Tenta ate 4x com espera
    // crescente — quase sempre passa na 2a/3a tentativa.
    let res: Response | null = null;
    for (let attempt = 1; attempt <= 4; attempt++) {
      res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(35000),
        body: reqBody,
      });
      if (res.ok) break;
      if (![429, 500, 502, 503].includes(res.status) || attempt === 4) {
        const errTxt = await res.text().catch(() => "");
        console.error("Gemini extrato erro", res.status, errTxt.slice(0, 300));
        return json({ error: `gemini_${res.status}` }, 502);
      }
      await new Promise((r) => setTimeout(r, attempt * 1800));
    }
    if (!res || !res.ok) return json({ error: "gemini_ocupado", dica: "tente de novo em instantes" }, 503);

    const data = await res.json();
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
