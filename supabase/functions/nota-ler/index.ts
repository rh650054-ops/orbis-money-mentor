// Vant — nota-ler (05/10/2026): lê a FOTO da nota fiscal / cupom de uma compra de
// mercadoria (Atacadão, Assaí, mercadinho…) e devolve loja, data, total, forma de
// pagamento e itens. Quem lê é o Claude com visão (mesma chave do chat).
// Usado na tela "Custo do produto pelas notas": ele fotografa as notas, marca o que
// foi mercadoria e a Vant calcula o custo de cada unidade.
// Segurança: exige login (verify_jwt + getUser), teto diário por conta (bump_ai_usage
// feature 'nota') e registra o gasto em ai_custos. A foto não é guardada.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") ?? "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PROMPT = `Você lê nota fiscal / cupom fiscal brasileiro (NFC-e, cupom, nota de atacado) a partir de uma foto.
Devolva SOMENTE um JSON, sem texto antes ou depois, neste formato:
{
  "legivel": true,
  "loja": "nome fantasia da loja (ex.: Atacadão, Assaí, Mercado São José)",
  "data": "AAAA-MM-DD ou null",
  "total": 0.00,
  "pagamentos": [{"tipo": "dinheiro|debito|credito|pix|outro", "valor": 0.00}],
  "itens": [{"descricao": "nome do item como está na nota, legível", "qtd": 1, "unidade": "UN|KG|CX|PCT|L|...", "valor": 0.00}]
}
Regras:
- "valor" de cada item é o valor TOTAL da linha (já multiplicado pela quantidade), com desconto da linha se houver.
- "total" é o valor a pagar da nota. Se não achar, some os itens.
- "pagamentos": leia a seção de forma de pagamento (Dinheiro, Cartão de Débito, Cartão de Crédito, PIX). Se não aparecer, devolva [].
- Números com ponto decimal (12.90), sem "R$".
- Se a foto não for uma nota ou estiver ilegível, devolva {"legivel": false}.
- Nunca invente item: se uma linha estiver cortada, leia o que dá.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const json = (obj: unknown, status = 200) =>
    new Response(JSON.stringify(obj), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const authH = req.headers.get("Authorization") ?? "";
    if (!authH) return json({ error: "login_necessario" }, 401);
    const supa = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_ANON_KEY") ?? "", { global: { headers: { Authorization: authH } } });
    const { data: u } = await supa.auth.getUser();
    const userId = u?.user?.id;
    if (!userId) return json({ error: "sessao_expirada" }, 401);

    const body = await req.json().catch(() => ({}));
    const b64 = typeof body?.imagem_b64 === "string" ? body.imagem_b64.replace(/^data:[^,]+,/, "") : "";
    const mime = String(body?.mime ?? "image/jpeg").split(";")[0];
    if (!b64 || b64.length < 1000) return json({ error: "sem_imagem" });
    if (b64.length > 6_000_000) return json({ error: "imagem_grande" });
    if (!["image/jpeg", "image/png", "image/webp"].includes(mime)) return json({ error: "formato_invalido" });

    // teto diário por conta (falha FECHADO, igual às outras IAs)
    const { data: uso, error: usoErr } = await supa.rpc("bump_ai_usage", { p_feature: "nota", p_limit: 40 });
    if (usoErr) return json({ error: "trava_indisponivel" }, 503);
    if ((uso as { over?: boolean } | null)?.over) return json({ error: "limite_diario" });

    const key = Deno.env.get("ANTHROPIC_API_KEY");
    if (!key) return json({ error: "sem_chave" });
    const model = Deno.env.get("ANTHROPIC_MODEL_NOTA") ?? "claude-sonnet-5";
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
      signal: AbortSignal.timeout(60000),
      body: JSON.stringify({
        model,
        max_tokens: 2500,
        messages: [{
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mime, data: b64 } },
            { type: "text", text: PROMPT },
          ],
        }],
      }),
    });
    if (!r.ok) {
      console.error("nota-ler claude", r.status, (await r.text().catch(() => "")).slice(0, 300));
      return json({ error: "leitura_falhou" });
    }
    const j = await r.json();

    // medidor de gasto (Sonnet: US$ 2/M entrada, 10/M saída)
    try {
      const us = j?.usage ?? {};
      const ent = Number(us.input_tokens) || 0, sai = Number(us.output_tokens) || 0;
      const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
      await admin.from("ai_custos").insert({
        user_id: userId, servico: "nota_fiscal", modelo: model, qtd: ent + sai, unidade: "tokens",
        custo_usd: Math.round((ent * 2 / 1e6 + sai * 10 / 1e6) * 1e6) / 1e6,
      });
    } catch { /* medidor nunca atrapalha */ }

    const texto = ((j?.content ?? []) as { text?: string }[]).map((b) => b?.text ?? "").join("");
    let nota: Record<string, unknown> | null = null;
    try { nota = JSON.parse(texto.match(/\{[\s\S]*\}/)?.[0] ?? "null"); } catch { nota = null; }
    if (!nota || nota.legivel === false) return json({ error: "ilegivel" });

    const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : 0; };
    const itens = (Array.isArray(nota.itens) ? nota.itens : []).slice(0, 150).map((i: Record<string, unknown>) => ({
      descricao: String(i?.descricao ?? "item").slice(0, 80),
      qtd: num(i?.qtd) || 1,
      unidade: String(i?.unidade ?? "").slice(0, 6),
      valor: num(i?.valor),
    })).filter((i) => i.valor > 0);
    const tipos = ["dinheiro", "debito", "credito", "pix", "outro"];
    const pagamentos = (Array.isArray(nota.pagamentos) ? nota.pagamentos : []).slice(0, 4).map((p: Record<string, unknown>) => ({
      tipo: tipos.includes(String(p?.tipo)) ? String(p?.tipo) : "outro",
      valor: num(p?.valor),
    })).filter((p) => p.valor > 0);
    const somaItens = Math.round(itens.reduce((s, i) => s + i.valor, 0) * 100) / 100;
    const data = /^\d{4}-\d{2}-\d{2}$/.test(String(nota.data ?? "")) ? String(nota.data) : null;

    return json({
      loja: String(nota.loja ?? "Loja").slice(0, 60),
      data,
      total: num(nota.total) || somaItens,
      soma_itens: somaItens,
      pagamentos,
      itens,
    });
  } catch (e) {
    console.error("nota-ler erro", String(e).slice(0, 200));
    return json({ error: "erro_interno" }, 500);
  }
});
