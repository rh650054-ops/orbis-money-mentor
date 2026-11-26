// Vant — import-financial-pdf: "Importar histórico" (Finanças). The vendor sends a PDF, a photo
// or loose notes (WhatsApp) with past sales and expenses; the AI organises them by day and the app
// shows the list for the vendor to review before anything is saved.
//
// 26/11/2026: brought into the repository. Until today it only existed in production, sent the
// file to Google Gemini and did NOT check the AI permission. Now:
//   - nothing is read or sent without the vendor's permission on the CURRENT disclosure text,
//     the first one that lists "Importar histórico" (_shared/consentimento-ia.ts → textoAtual);
//   - Anthropic reads it; OpenAI is the reserve. Gemini is gone.
// The answer has the same shape as before: { resumo, dias: [...] } or { error }. A reason the
// vendor can act on now comes back with HTTP 200 (the app only shows { error } on a 2xx; before,
// every message died as "non-2xx status code").
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.0";
import { permissaoIaNoServidor, respostaSemConsentimentoIa } from "../_shared/consentimento-ia.ts";
import { pedirClaude } from "../_shared/ia-claude.ts";
import { pedirOpenAi } from "../_shared/ia-openai.ts";
import { limparDias, lerJsonDaIa } from "./dias.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") ?? "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const SYSTEM = `Você extrai dados financeiros de um vendedor ambulante no Brasil.
A fonte pode ser: (a) uma PLANILHA/relatório em PDF/imagem com linhas por dia, OU (b) ANOTAÇÕES SOLTAS de WhatsApp (ex: "12/07 fiz 300 no pix e 50 em dinheiro, gastei 40 de mercadoria, 2 caloteiros").
Interprete o que houver e organize por DIA. Extraia SOMENTE dias com algum valor (ignore vazios).
Datas: use o formato "YYYY-MM-DD". No WhatsApp, use a data da mensagem/anotação; se só tiver dia/mês, complete com o ano do contexto. Se um dia não tiver data clara, NÃO invente — deixe "data" vazia.
Valores em reais no formato brasileiro (R$ 1.234,56) → número (1234.56).
Responda APENAS com JSON válido, sem markdown.`;

function userPrompt(extra: string) {
  return `Extraia em JSON: { "resumo": "...", "dias": [ ... ] }.
"resumo": 1-2 frases em português dizendo o que você identificou (quantos dias, período, total aproximado, e o que ficou incerto).
Cada item de "dias" (use 0 quando não houver):
- "data": "YYYY-MM-DD" (ou "" se não der pra saber).
- "faturamento": VALOR BRUTO do dia (geralmente dinheiro + pix + gorjeta).
- "dinheiro": vendas em dinheiro.
- "pix": vendas em pix.
- "gorjeta": gorjeta.
- "calote": valor não pago / prejuízo em reais.
- "custo": custo da mercadoria (investimento/produto).
- "transporte": transporte.
- "alimentacao": alimentação.
- "unidades_iniciais": quantas unidades levou.
- "unidades_nao_pagas": unidades não pagas.
Se faturamento vier 0 mas houver dinheiro/pix, faturamento = dinheiro + pix + gorjeta. Ordene por data.${extra}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  // No third-party AI without the vendor's explicit permission on the current text (fails closed).
  const authHeader = req.headers.get("Authorization") ?? "";
  const permissao = await permissaoIaNoServidor(authHeader);
  if (!permissao.permitida || !permissao.textoAtual) return respostaSemConsentimentoIa(corsHeaders);

  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);

    // daily ceiling per account (as before: a failure of the counter does not block the import)
    try {
      const { data: usage } = await supabase.rpc("bump_ai_usage", { p_feature: "import_pdf", p_limit: 10 });
      if ((usage as { over?: boolean } | null)?.over) return json({ error: "Você já importou bastante hoje. Tente amanhã." });
    } catch { /* passa */ }

    const body = await req.json().catch(() => ({}));
    const pdfBase64: string | undefined = body?.pdfBase64;
    const texto: string | undefined = body?.text;
    const mimeType: string = typeof body?.mimeType === "string" && body.mimeType ? body.mimeType : "application/pdf";

    let user_: string; let arquivo: { b64: string; mime: string } | undefined;
    if (typeof texto === "string" && texto.trim().length > 0) {
      if (texto.length > 200_000) return json({ error: "Texto muito grande. Envie um trecho menor (ex: por mês)." });
      user_ = userPrompt(`\n\nANOTAÇÕES DO USUÁRIO:\n${texto}`);
    } else if (typeof pdfBase64 === "string" && pdfBase64.length > 0) {
      if (pdfBase64.length > 11_000_000) return json({ error: "Arquivo muito grande. Envie um menor (~8MB) ou divida por mês." });
      user_ = userPrompt("");
      arquivo = { b64: pdfBase64, mime: mimeType };
    } else {
      return json({ error: "Envie um arquivo (pdfBase64) ou um texto (text)." });
    }

    const pedido = { quem: "import-financial-pdf", system: SYSTEM, user: user_, arquivo, maxTokens: 16000, timeoutMs: 110000, temperature: 0 };
    const aiText = await pedirClaude(pedido) ?? await pedirOpenAi({ ...pedido, json: true });
    if (!aiText) return json({ error: "O leitor está fora do ar agora. Seu arquivo não foi perdido — tenta de novo em instantes." });

    const parsed = lerJsonDaIa(aiText);
    if (!parsed) return json({ error: "Não consegui estruturar os dados. Tente algo mais organizado ou por mês." });
    return json({ resumo: String(parsed.resumo ?? ""), dias: limparDias(parsed.dias) });
  } catch (_e) {
    console.error("import-financial-pdf: erro interno");
    return json({ error: "Erro ao processar. Tente de novo." }, 500);
  }
});
