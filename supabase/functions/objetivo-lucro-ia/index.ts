// Vant — objetivo-lucro-ia (Rick, 27/10/2026)
// "Quero R$ 5.000 de lucro em 15 dias": the AI reads the seller's last 60 days
// (Open Finance outflows by category, DEFCON sales, calotes, products with cost/price,
// weekday rhythm, trend) and returns a structured plan. The numbers come from the
// database (objetivo_lucro_base); the AI interprets and advises. Anthropic first, OpenAI as the
// reserve; if both fail the app falls back to its own calculation (the 502 below carries no error
// on screen: the mission opens without the AI text).
// 26/11 (Rick): two providers only. Gemini and Cerebras are gone (Cerebras had no quota, Gemini
// was on a free tier: both failed unseen for days). A provider that fails is logged with its HTTP
// status — never the prompt or the answer.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.0";
import { permissaoIaNoServidor, respostaSemConsentimentoIa } from "../_shared/consentimento-ia.ts";
import { pedirClaude } from "../_shared/ia-claude.ts";
import { pedirOpenAi } from "../_shared/ia-openai.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") ?? "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const DOW = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
const brl = (n: number | string | undefined) => `R$ ${Number(n || 0).toFixed(2).replace(".", ",")}`;

const SYSTEM =
  `Você é a Vant, mentora financeira de vendedores de rua no Brasil (quem vende no sinal, na praia, no metrô). ` +
  `Fala direto, de parceiro, com energia de missão: o vendedor está aceitando um desafio e você é a estrategista dele. ` +
  `Sem corporativês, sem fofura, sem motivação vazia — cada frase tem número. Chame o vendedor pelo nome quando tiver. ` +
  `Usa SOMENTE os números recebidos — nunca invente dados. Responda apenas o JSON pedido.`;

function montarPrompt(b: Record<string, unknown>, alvo: number, dias: number, diasTrabalho: number): string {
  const n = (k: string) => Number((b as Record<string, number>)[k] ?? 0);
  const calote = (b.calote ?? {}) as Record<string, number | string | undefined>;
  const quinz = (b.quinzenas ?? {}) as Record<string, number>;
  const un = (b.produto_nome as string | null) ? `${String(b.produto_nome).toLowerCase()}s` : "unidades";
  const semana = ((b.semana ?? []) as Array<{ dow: number; unid_dia: number; dias: number }>)
    .map((s) => `${DOW[s.dow]}: ${s.unid_dia} ${un}/dia (${s.dias} dias)`).join("; ");
  const cats = ((b.categorias ?? []) as Array<{ categoria: string; valor: number; n: number }>)
    .map((c) => `${c.categoria}: ${brl(c.valor)} (${c.n} lançamentos)`).join("; ");
  const produtos = ((b.produtos ?? []) as Array<{ nome: string; preco: number; custo: number; estoque: number; vendidas: number }>)
    .map((p) => `${p.nome}: vende a ${brl(p.preco)}, custo da receita ${brl(p.custo)}, estoque ${p.estoque}`).join("; ");
  const lucroUnid = Math.max(0, n("ticket") - n("custo_unid"));
  const lucroDiaMedio = lucroUnid * n("unid_dia");
  const precisaDia = alvo / Math.max(1, diasTrabalho);
  const unidDia = lucroUnid > 0 ? Math.ceil(precisaDia / lucroUnid) : null;

  return (
    `VENDEDOR: ${b.apelido ? String(b.apelido) : "sem nome"}. Produto: ${b.produto_nome ?? "vários"}.\n` +
    `OBJETIVO: ${brl(alvo)} de LUCRO em ${dias} dias corridos, trabalhando ${diasTrabalho} desses dias (${diasTrabalho} = o ritmo habitual dele; sugira outro número só com motivo). Hoje é ${b.hoje}.\n\n` +
    `VENDAS NO APP (últimos ${b.janela_dias} dias): ${b.unidades} ${un} em ${b.dias_vendidos} dias de venda; ` +
    `média ${b.unid_dia} ${un}/dia; recorde ${b.recorde_dia} num dia (${b.recorde_data}); preço médio ${brl(n("ticket"))}; ` +
    `faturou ${brl(n("vendas"))}. Frequência: trabalhou ${Math.round(n("frequencia") * 100)}% dos dias.\n` +
    `Combos: ${(b.combos as Record<string, number> | undefined)?.um ?? 100}% das vendas são de 1 ${un.slice(0, -1)}, ${(b.combos as Record<string, number> | undefined)?.dois ?? 0}% combo de 2, ${(b.combos as Record<string, number> | undefined)?.tres ?? 0}% de 3+; ` +
    `${(b.combos as Record<string, number> | undefined)?.unid_por_venda ?? 1} ${un} por venda, ${n("vendas_dia")} vendas (atendimentos) por dia. Preço de tabela ${brl(n("preco_tabela"))}; o preço médio por ${un.slice(0, -1)} já considera os combos. ` +
    `Ao falar de meta diária diga ${un} E quantas vendas isso dá.\n` +
    `Por dia da semana: ${semana || "sem dados"}.\n` +
    `Tendência: ${quinz.ultimos15 ?? 0} ${un} nos últimos 15 dias vs ${quinz.anteriores15 ?? 0} nos 15 anteriores.\n\n` +
    `BANCO (Open Finance, ${b.banco ? "conectado" : "NÃO conectado"}): saídas do corre ${brl(n("gastos_corre"))} por categoria: ${cats || "nenhuma"}. ` +
    `Entradas do corre ${brl(n("entradas_corre"))}. Gastos pessoais ${brl(n("gastos_pessoais"))}.\n` +
    `CUSTO POR ${un.slice(0, -1).toUpperCase()}: ${brl(n("custo_unid"))} = receita ${brl(n("custo_receita"))} (ingredientes + produção) + ${brl(n("calote_unid"))} de calote médio por unidade. ` +
    `${b.custo_extrato ? `O banco mostra ${brl(n("custo_extrato"))} por unidade em saídas de mercadoria, mas isso inclui estoque comprado e ainda não vendido — não use como custo.` : ""} ` +
    `Transporte lançado no app ${brl(n("transporte"))}, alimentação ${brl(n("alimentacao"))}.\n\n` +
    `CALOTES (aproximado): ${brl(calote.usado ?? 0)} em ${calote.fonte === "banco" ? calote.dias_banco ?? 0 : b.dias_vendidos} dias de venda = ${brl(calote.por_dia ?? 0)} por dia de venda, ${calote.pct_pix ?? 0}% do pix/cartão. ` +
    `${calote.fonte === "banco" ? `Medido pelo banco desde ${calote.desde ?? "a conexão"} (${calote.dias_banco ?? 0} dias de venda com o banco ligado): ${brl(calote.app_pix_banco ?? 0)} de pix/cartão lançados no app contra ${brl(calote.banco_recebido ?? 0)} que caíram na conta. No app ele registrou ${brl(calote.valor ?? 0)} de fiado e recuperou ${brl(calote.recuperado ?? 0)}.` : `Registrado no app: ${brl(calote.valor ?? 0)} fiado em ${calote.dias ?? 0} dias, recuperou ${brl(calote.recuperado ?? 0)}${calote.estimado_banco != null ? ` (pelo banco daria ${brl(calote.estimado_banco)}, mas ele escolheu usar o do app)` : ""}.`}\n\n` +
    `PRODUTOS: ${produtos || "nenhum cadastrado"}. Estoque pronto: ${b.estoque} ${un}.\n\n` +
    `CONTA BASE (já feita, use como referência): lucro por ${un.slice(0, -1)} ${brl(lucroUnid)}; lucro médio por dia de venda ${brl(lucroDiaMedio)}; ` +
    `em ${diasTrabalho} dias na média dá ${brl(lucroDiaMedio * diasTrabalho)}; pra bater precisa ${brl(precisaDia)}/dia = ${unidDia ?? "?"} ${un}/dia.\n\n` +
    `Responda em JSON com EXATAMENTE estas chaves:\n` +
    `{"veredito":"tranquilo"|"puxado"|"acima" (tranquilo = até ~10% acima da média; puxado = acima da média mas até o recorde; acima = além do recorde),\n` +
    ` "titulo": frase curta de até 7 palavras com o veredito, no tom de missão (ex.: "Rick, é no talo mas dá"),\n` +
    ` "resumo": 2 a 3 frases explicando se dá ou não e por quê, citando números do banco, das vendas e dos calotes,\n` +
    ` "unid_dia": número inteiro de ${un} por dia de trabalho pra bater (use a conta base, ajuste só se tiver motivo e diga qual),\n` +
    ` "dias_trabalho": quantos dos ${dias} dias você recomenda trabalhar (inteiro),\n` +
    ` "melhores_dias": lista com os 2 ou 3 dias da semana mais fortes dele (nomes em minúsculo),\n` +
    ` "passos": lista de 3 a 5 ações concretas, cada uma {"titulo": até 5 palavras, "texto": 1 ou 2 frases com número}. Inclua: faturamento por dia (unidades × preço médio), produção (quanto fazer além do estoque e quanto custa em mercadoria), calote (quanto por dia ele perde e como reduzir: pix na hora, não fiar), e gastos pessoais se eles comerem o lucro,\n` +
    ` "alerta": frase curta com o maior risco, ou null}`
  );
}

// Secret ANTHROPIC_MODEL_MISSAO swaps the model without touching the code (default: the fast one).
function claude(prompt: string): Promise<string | null> {
  return pedirClaude({ quem: "objetivo-lucro-ia", system: SYSTEM, user: prompt, maxTokens: 1500, timeoutMs: 25000, temperature: 0.5, modelo: Deno.env.get("ANTHROPIC_MODEL_MISSAO") });
}

// Reserve: only for a vendor whose answer is on the text that names OpenAI as the reserve.
function openai(prompt: string): Promise<string | null> {
  return pedirOpenAi({ quem: "objetivo-lucro-ia", system: SYSTEM, user: prompt, maxTokens: 1500, timeoutMs: 25000, temperature: 0.5, json: true });
}

function limpar(raw: string): Record<string, unknown> | null {
  try {
    const s = raw.indexOf("{"); const e = raw.lastIndexOf("}");
    const o = JSON.parse(raw.slice(s, e + 1));
    const ok = ["tranquilo", "puxado", "acima"];
    return {
      veredito: ok.includes(String(o.veredito)) ? o.veredito : "puxado",
      titulo: String(o.titulo ?? "").slice(0, 80),
      resumo: String(o.resumo ?? "").slice(0, 600),
      unid_dia: Number.isFinite(Number(o.unid_dia)) ? Math.max(1, Math.round(Number(o.unid_dia))) : null,
      dias_trabalho: Number.isFinite(Number(o.dias_trabalho)) ? Math.max(1, Math.round(Number(o.dias_trabalho))) : null,
      melhores_dias: Array.isArray(o.melhores_dias) ? o.melhores_dias.slice(0, 3).map((d: unknown) => String(d).slice(0, 12)) : [],
      passos: Array.isArray(o.passos)
        ? o.passos.slice(0, 5).map((p: { titulo?: unknown; texto?: unknown }) => ({ titulo: String(p?.titulo ?? "").slice(0, 60), texto: String(p?.texto ?? "").slice(0, 300) }))
        : [],
      alerta: o.alerta ? String(o.alerta).slice(0, 200) : null,
    };
  } catch (_e) {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  // No third-party AI without the vendor's explicit, current permission (fails closed) — _shared/consentimento-ia.ts
  const permissao = await permissaoIaNoServidor(req.headers.get("Authorization") ?? "");
  if (!permissao.permitida) return respostaSemConsentimentoIa(corsHeaders);
  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "sem login" }, 401);
    const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await supa.auth.getUser();
    if (!user) return json({ error: "sem login" }, 401);

    const body = await req.json().catch(() => ({}));
    const alvo = Number(body?.alvo ?? 0);
    const dias = Math.round(Number(body?.dias ?? 0));
    const pedido = body?.diasTrabalho === undefined || body?.diasTrabalho === null ? null : Math.round(Number(body.diasTrabalho));
    if (!(alvo > 0) || !(dias >= 1 && dias <= 366) || (pedido !== null && !(pedido >= 1 && pedido <= dias))) return json({ error: "dados inválidos" }, 400);

    // 20 analyses per day per seller — each one is a full read of his 60 days.
    const { data: uso, error: usoErr } = await supa.rpc("bump_ai_usage", { p_feature: "objetivo_lucro", p_limit: 20 });
    if (usoErr || (uso as { over?: boolean } | null)?.over) return json({ error: "limite", limite: true }, 429);

    // 28/10: the seller may have picked which calote estimate the mission uses (bank coverage / app)
    const caloteFonte = body?.caloteFonte === "banco" || body?.caloteFonte === "app" ? body.caloteFonte : null;
    const { data: base, error: baseErr } = await supa.rpc("objetivo_lucro_analise", { p_calote_fonte: caloteFonte });
    if (baseErr || !base) return json({ error: "sem dados" }, 500);

    // No work days sent: use his usual frequency (e.g. 63% of 15 days → 9).
    const freq = Number((base as { frequencia?: number }).frequencia ?? 0);
    const diasTrabalho = pedido ?? (freq > 0 ? Math.min(dias, Math.max(1, Math.round(dias * freq))) : dias);
    const prompt = montarPrompt(base as Record<string, unknown>, alvo, dias, diasTrabalho);
    // first provider that hands back a plan in the expected shape wins
    const fila: [string, () => Promise<string | null>][] = [["claude", () => claude(prompt)]];
    if (permissao.textoAtual) fila.push(["openai", () => openai(prompt)]);
    let ia: Record<string, unknown> | null = null; let fonte = "";
    for (const [nome, pedir] of fila) {
      let raw: string | null = null;
      try { raw = await pedir(); } catch (e) { console.warn(`objetivo-lucro-ia: ${nome} sem resposta`, (e as Error)?.name); }
      ia = raw ? limpar(raw) : null;
      if (ia) { fonte = nome; break; }
      if (raw) console.warn(`objetivo-lucro-ia: ${nome} respondeu fora do formato`);
    }
    if (!ia) {
      console.error("objetivo-lucro-ia: nenhum provedor entregou um plano");
      return json({ error: "ia indisponível", base, dias_trabalho: diasTrabalho }, 502);
    }
    return json({ ia: { ...ia, fonte }, base, dias_trabalho: diasTrabalho });
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e).slice(0, 200) }, 500);
  }
});
