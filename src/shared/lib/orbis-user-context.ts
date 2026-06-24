import { supabase } from "@/integrations/supabase/client";
import { getBrazilDate } from "@/shared/lib/date-utils";

// Monta um resumo COMPACTO dos números reais do vendedor (últimos 7 dias + hoje)
// pra mandar pro mentor de IA personalizar os conselhos. Se faltar dado ou der
// erro, devolve "" — o chat segue normal, sem inventar número.

const num = (v: unknown) => Number(v) || 0;
const fmt = (n: number) => `R$ ${n.toFixed(0)}`;

export async function buildOrbisUserContext(userId: string): Promise<string> {
  try {
    const todayISO = getBrazilDate(); // "YYYY-MM-DD" no fuso do Brasil
    const base = new Date(`${todayISO}T12:00:00Z`);
    const back = (n: number) => {
      const x = new Date(base); x.setUTCDate(x.getUTCDate() - n);
      return x.toISOString().split("T")[0]!;
    };
    const d7ISO = back(6);
    const d30ISO = back(29);
    const startTs = `${d7ISO}T00:00:00Z`;

    const [salesR, blocksR, hoursR, expR, goalR] = await Promise.all([
      supabase.from("daily_sales")
        .select("date,total_profit,total_debt,cost,transport_cost,food_cost,unpaid_units")
        .eq("user_id", userId).gte("date", d7ISO).lte("date", todayISO),
      supabase.from("challenge_blocks")
        .select("approaches_count,sales_count,created_at")
        .eq("user_id", userId).gte("created_at", startTs),
      supabase.from("hourly_goal_blocks")
        .select("hour_label,achieved_amount,created_at")
        .eq("user_id", userId).gte("created_at", startTs),
      supabase.from("personal_expenses")
        .select("category,amount")
        .eq("user_id", userId).gte("date", d30ISO),
      supabase.from("daily_goal_plans")
        .select("daily_goal")
        .eq("user_id", userId).eq("date", todayISO).maybeSingle(),
    ]);

    const sales = (salesR.data as Record<string, unknown>[]) || [];
    const blocks = (blocksR.data as Record<string, unknown>[]) || [];
    if (sales.length === 0 && blocks.length === 0) return ""; // ainda sem histórico

    const fat = sales.reduce((s, d) => s + num(d.total_profit), 0);
    const custoMerc = sales.reduce((s, d) => s + num(d.cost), 0);
    const custoOp = sales.reduce((s, d) => s + num(d.transport_cost) + num(d.food_cost), 0);
    const lucro = fat - custoMerc - custoOp;
    const calote = sales.reduce((s, d) => s + num(d.total_debt), 0);
    const todayFat = sales.filter((d) => d.date === todayISO).reduce((s, d) => s + num(d.total_profit), 0);

    const abord = blocks.reduce((s, b) => s + num(b.approaches_count), 0);
    const vendas = blocks.reduce((s, b) => s + num(b.sales_count), 0);
    const conv = abord > 0 ? (vendas / abord) * 100 : 0;
    const abordPorVenda = vendas > 0 ? abord / vendas : 0;
    const ticket = vendas > 0 ? fat / vendas : 0;

    const byHour: Record<string, { t: number; c: number }> = {};
    for (const h of (hoursR.data as Record<string, unknown>[]) || []) {
      const k = String(h.hour_label ?? "?");
      const slot = byHour[k] || (byHour[k] = { t: 0, c: 0 });
      slot.t += num(h.achieved_amount); slot.c++;
    }
    const bestHour = Object.entries(byHour)
      .map(([k, v]) => ({ k, avg: v.c ? v.t / v.c : 0 }))
      .filter((x) => x.avg > 0)
      .sort((a, b) => b.avg - a.avg)[0];

    const byCat: Record<string, number> = {};
    for (const e of (expR.data as Record<string, unknown>[]) || []) {
      const k = String(e.category ?? "Outros");
      byCat[k] = (byCat[k] || 0) + num(e.amount);
    }
    const topGasto = Object.entries(byCat)
      .map(([k, v]) => ({ k, v }))
      .sort((a, b) => b.v - a.v)[0];

    const meta = num((goalR.data as Record<string, unknown> | null)?.daily_goal);

    const lines: (string | null)[] = [
      "DADOS REAIS DESTE VENDEDOR (use pra personalizar; NUNCA invente número):",
      `- Últimos 7 dias: faturou ${fmt(fat)}, lucro líquido ${fmt(lucro)}.`,
      abord > 0
        ? `- Conversão ${conv.toFixed(0)}% (${abordPorVenda.toFixed(1)} abordagens por venda). Ticket médio ${fmt(ticket)}. Total: ${abord} abordagens, ${vendas} vendas.`
        : "- Ainda sem abordagens/vendas registradas no DEFCON nos últimos 7 dias.",
      meta > 0
        ? `- Hoje: ${fmt(todayFat)} de uma meta de ${fmt(meta)} (${Math.round((todayFat / meta) * 100)}% da meta).`
        : `- Hoje faturou ${fmt(todayFat)} (sem meta definida).`,
      bestHour ? `- Melhor horário de venda dele: ${bestHour.k}.` : null,
      topGasto ? `- No que mais gasta: ${topGasto.k} (${fmt(topGasto.v)} no mês).` : null,
      calote > 0 ? `- Calote acumulado (7 dias): ${fmt(calote)}.` : null,
    ];
    return lines.filter(Boolean).join("\n");
  } catch {
    return ""; // qualquer erro: segue sem contexto, sem quebrar o chat
  }
}
