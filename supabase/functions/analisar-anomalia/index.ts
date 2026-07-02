// Orbis — analisar-anomalia
// Recebe { user_id } de um ADMIN, pega o histórico diário do vendedor (RPC
// defcon_user_history, que já é gated a admin/dono) e manda pra IA (Claude)
// julgar se o padrão é consistente ou tem cara de fraude/inflado.
// Devolve { ok, suspeito, score, motivo }.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface HistRow {
  dia: string;
  valor: number;
  qtd: number;
  worked_min: number;
  ritmo: number | null;
}

function buildPrompt(nome: string, rows: HistRow[]): string {
  const linhas = rows
    .map(
      (r) =>
        `${r.dia}: R$${Number(r.valor || 0).toFixed(2)} | ${r.qtd} vendas | ${Math.round(Number(r.worked_min || 0))} min trabalhados | ritmo ${r.ritmo != null ? r.ritmo + " min/venda" : "-"}`,
    )
    .join("\n");

  return `Você é um auditor anti-fraude do Orbis (app de vendedores de rua). Recebe o histórico DIÁRIO de um vendedor${nome ? ` chamado "${nome}"` : ""}. Cada dia traz: o valor que conta no ranking (cartão + pix, em reais), quantas vendas fez, quantos minutos trabalhou no DEFCON, e o ritmo (minutos por venda).

Sua tarefa: dizer se o padrão é CONSISTENTE ou se tem sinais de resultado INFLADO/fraudado.

Sinais suspeitos (quanto mais, maior o score):
- Um dia MUITO acima da média dos outros dias dele (pico isolado, sem construção gradual).
- Valor alto com POUQUÍSSIMO tempo trabalhado (ex: R$1000 em 20 minutos).
- Valor alto com POUQUÍSSIMAS vendas (tudo concentrado numa "super-venda").
- Ritmo absurdamente rápido comparado ao histórico dele.
- Mudança brusca de patamar sem transição (fazia 500/dia e do nada 1000 todo dia).

Sinais de que é LEGÍTIMO:
- Crescimento gradual, coerente com mais tempo trabalhado / mais vendas.
- Pico acompanhado de mais horas e mais vendas (ritmo normal).

Histórico (mais recente primeiro):
${linhas}

Responda SOMENTE um JSON válido, sem texto fora, sem markdown:
{"suspeito": true, "score": 0, "motivo": "explicação curta e direta em português (1-2 frases), citando o número que chamou atenção"}
- suspeito: true/false
- score: 0 a 100 (0 = totalmente normal, 100 = quase certeza de fraude)
- motivo: por que, em português claro.`;
}

async function callClaude(key: string, model: string, prompt: string): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    signal: AbortSignal.timeout(30000),
    body: JSON.stringify({
      model,
      max_tokens: 500,
      messages: [{ role: "user", content: [{ type: "text", text: prompt }] }],
    }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    console.error("Claude anomalia erro", res.status, t.slice(0, 200));
    throw new Error(`claude_${res.status}`);
  }
  const data = await res.json();
  return (data?.content ?? []).map((b: any) => b?.text || "").join("").trim();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const json = (obj: unknown, status = 200) =>
    new Response(JSON.stringify(obj), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const body = await req.json().catch(() => ({}));
    const userId = typeof body?.user_id === "string" ? body.user_id : "";
    if (!userId) return json({ error: "sem_user_id" }, 400);

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader) return json({ error: "sem_auth" }, 401);

    // Usa o JWT do ADMIN: a própria RPC defcon_user_history só devolve dados pra admin/dono.
    const supa = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: hist, error } = await supa.rpc("defcon_user_history", { p_user_id: userId, p_days: 30 });
    if (error) {
      console.error("defcon_user_history erro", error.message);
      return json({ error: "rpc_falhou", detalhe: error.message }, 500);
    }
    const rows = ((hist as HistRow[]) || []).filter((r) => Number(r.valor || 0) > 0 || Number(r.qtd || 0) > 0);
    if (rows.length === 0) {
      return json({ ok: true, suspeito: false, score: 0, motivo: "Sem histórico suficiente pra avaliar (ou sem permissão)." });
    }

    // Nome (best-effort, só pro prompt).
    let nome = "";
    try {
      const { data: pp } = await supa.from("public_profiles").select("nickname").eq("user_id", userId).maybeSingle();
      nome = ((pp as any)?.nickname ?? "").toString().trim();
    } catch { /* noop */ }

    const key = Deno.env.get("ANTHROPIC_API_KEY");
    const model = Deno.env.get("ANTHROPIC_MODEL") ?? "claude-haiku-4-5-20251001";
    if (!key) return json({ error: "sem_chave_ia" }, 500);

    const raw = await callClaude(key, model, buildPrompt(nome, rows));
    let parsed: { suspeito?: boolean; score?: number; motivo?: string } = {};
    try {
      const m = raw.match(/\{[\s\S]*\}/);
      parsed = m ? JSON.parse(m[0]) : {};
    } catch {
      parsed = {};
    }

    return json({
      ok: true,
      suspeito: !!parsed.suspeito,
      score: Math.max(0, Math.min(100, Number(parsed.score ?? 0))),
      motivo: (parsed.motivo || "Não consegui interpretar o parecer da IA.").toString(),
    });
  } catch (e) {
    console.error("analisar-anomalia exceção", String(e).slice(0, 200));
    return json({ error: "excecao" }, 500);
  }
});
