import { supabase } from "@/integrations/supabase/client";
import { getBrazilDate } from "@/shared/lib/date-utils";

// FASE 1 do Agente Orbis: monta um retrato COMPLETO e compacto do vendedor
// (últimos 30 dias de TUDO que ele faz no app) pro mentor de IA personalizar
// os conselhos. Se faltar dado ou der erro, devolve "" — o chat segue normal.

const num = (v: unknown) => Number(v) || 0;
const fmt = (n: number) => `R$ ${n.toFixed(0)}`;
const sb = supabase as any;

export async function buildOrbisUserContext(userId: string): Promise<string> {
  try {
    const todayISO = getBrazilDate(); // "YYYY-MM-DD" no fuso do Brasil
    const base = new Date(`${todayISO}T12:00:00Z`);
    const back = (n: number) => {
      const x = new Date(base); x.setUTCDate(x.getUTCDate() - n);
      return x.toISOString().split("T")[0]!;
    };
    const d7ISO = back(6);
    const d14ISO = back(13);
    const d30ISO = back(29);
    const startTs7 = `${d7ISO}T00:00:00Z`;
    const startTs30 = `${d30ISO}T00:00:00Z`;

    const [salesR, blocksR, hoursR, expR, goalR, profR, rankR, prodLogR, prodR, billsR] = await Promise.all([
      sb.from("daily_sales")
        .select("date,total_profit,total_debt,cost,transport_cost,food_cost,unpaid_units")
        .eq("user_id", userId).gte("date", d30ISO).lte("date", todayISO),
      sb.from("challenge_blocks")
        .select("approaches_count,sales_count,created_at")
        .eq("user_id", userId).gte("created_at", startTs7),
      sb.from("hourly_goal_blocks")
        .select("hour_label,achieved_amount,created_at")
        .eq("user_id", userId).gte("created_at", startTs7),
      sb.from("personal_expenses")
        .select("category,amount")
        .eq("user_id", userId).gte("date", d30ISO),
      sb.from("daily_goal_plans")
        .select("daily_goal")
        .eq("user_id", userId).eq("date", todayISO).maybeSingle(),
      sb.from("profiles")
        .select("nickname,streak_days,monthly_goal,what_i_sell,where_i_sell,city,state")
        .eq("user_id", userId).maybeSingle(),
      sb.from("leaderboard_stats")
        .select("posicao_faturamento,faturamento_total_mes,dias_trabalhados_mes")
        .eq("user_id", userId).eq("mes_referencia", todayISO.slice(0, 7)).maybeSingle(),
      sb.from("product_sales_log")
        .select("product_id,quantity,total_amount")
        .eq("user_id", userId).gte("created_at", startTs30),
      sb.from("products")
        .select("id,name,stock_quantity,stock_min,sale_price,is_active")
        .eq("user_id", userId).eq("is_active", true),
      sb.from("planned_bills")
        .select("name,amount,saved_amount,due_date,paid")
        .eq("user_id", userId).eq("paid", false),
    ]);

    const sales = (salesR.data as Record<string, unknown>[]) || [];
    const blocks = (blocksR.data as Record<string, unknown>[]) || [];
    if (sales.length === 0 && blocks.length === 0) return ""; // ainda sem histórico

    // ---- Faturamento: hoje, 7 dias, 30 dias e TENDÊNCIA (semana atual vs anterior) ----
    const fatDe = (ini: string, fim: string) =>
      sales.filter((d) => String(d.date) >= ini && String(d.date) <= fim).reduce((s, d) => s + num(d.total_profit), 0);
    const fat7 = fatDe(d7ISO, todayISO);
    const fat30 = fatDe(d30ISO, todayISO);
    const fatSemAnt = fatDe(d14ISO, back(7));
    const todayFat = fatDe(todayISO, todayISO);
    const custoMerc = sales.filter((d) => String(d.date) >= d7ISO).reduce((s, d) => s + num(d.cost), 0);
    const custoOp = sales.filter((d) => String(d.date) >= d7ISO).reduce((s, d) => s + num(d.transport_cost) + num(d.food_cost), 0);
    const lucro7 = fat7 - custoMerc - custoOp;
    const calote7 = sales.filter((d) => String(d.date) >= d7ISO).reduce((s, d) => s + num(d.total_debt), 0);
    const tendencia = fatSemAnt > 0 ? ((fat7 - fatSemAnt) / fatSemAnt) * 100 : 0;

    // ---- Melhor dia da semana (média dos 30 dias) ----
    const DIAS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
    const porDia: Record<number, { t: number; c: number }> = {};
    for (const d of sales) {
      const dt = new Date(`${d.date}T12:00:00Z`).getUTCDay();
      const s2 = porDia[dt] || (porDia[dt] = { t: 0, c: 0 });
      s2.t += num(d.total_profit); s2.c++;
    }
    const melhorDia = Object.entries(porDia)
      .map(([k, v]) => ({ k: DIAS[+k], avg: v.c ? v.t / v.c : 0 }))
      .filter((x) => x.avg > 0).sort((a, b) => b.avg - a.avg)[0];

    // ---- Conversão e ticket (7 dias, DEFCON) ----
    const abord = blocks.reduce((s, b) => s + num(b.approaches_count), 0);
    const vendas = blocks.reduce((s, b) => s + num(b.sales_count), 0);
    const conv = abord > 0 ? (vendas / abord) * 100 : 0;
    const ticket = vendas > 0 ? fat7 / vendas : 0;

    // ---- Melhor horário ----
    const byHour: Record<string, { t: number; c: number }> = {};
    for (const h of (hoursR.data as Record<string, unknown>[]) || []) {
      const k = String(h.hour_label ?? "?");
      const slot = byHour[k] || (byHour[k] = { t: 0, c: 0 });
      slot.t += num(h.achieved_amount); slot.c++;
    }
    const bestHour = Object.entries(byHour)
      .map(([k, v]) => ({ k, avg: v.c ? v.t / v.c : 0 }))
      .filter((x) => x.avg > 0).sort((a, b) => b.avg - a.avg)[0];

    // ---- Produtos: o que mais vende (30d) + estoque baixo ----
    const prods = (prodR.data as Record<string, unknown>[]) || [];
    const nomeProd: Record<string, string> = {};
    for (const p of prods) nomeProd[String(p.id)] = String(p.name ?? "produto");
    const porProd: Record<string, { q: number; v: number }> = {};
    for (const l of (prodLogR.data as Record<string, unknown>[]) || []) {
      const k = String(l.product_id ?? "?");
      const s3 = porProd[k] || (porProd[k] = { q: 0, v: 0 });
      s3.q += num(l.quantity); s3.v += num(l.total_amount);
    }
    const topProds = Object.entries(porProd)
      .map(([k, v]) => ({ nome: nomeProd[k] || "produto", ...v }))
      .sort((a, b) => b.v - a.v).slice(0, 2);
    const estoqueBaixo = prods
      .filter((p) => num(p.stock_quantity) <= num(p.stock_min) && num(p.stock_min) > 0)
      .map((p) => `${p.name} (${num(p.stock_quantity)} un.)`).slice(0, 3);

    // ---- Gastos e contas ----
    const byCat: Record<string, number> = {};
    for (const e of (expR.data as Record<string, unknown>[]) || []) {
      const k = String(e.category ?? "Outros");
      byCat[k] = (byCat[k] || 0) + num(e.amount);
    }
    const topGasto = Object.entries(byCat).map(([k, v]) => ({ k, v })).sort((a, b) => b.v - a.v)[0];
    const d10 = back(-10); // 10 dias pra FRENTE
    const contas = ((billsR.data as Record<string, unknown>[]) || [])
      .filter((b) => String(b.due_date) >= todayISO && String(b.due_date) <= d10)
      .sort((a, b) => String(a.due_date).localeCompare(String(b.due_date))).slice(0, 3);

    // ---- Perfil, meta, streak, ranking ----
    const prof = (profR.data as Record<string, unknown> | null) || {};
    const rank = (rankR.data as Record<string, unknown> | null) || {};
    const meta = num((goalR.data as Record<string, unknown> | null)?.daily_goal);
    const streak = num(prof.streak_days);
    const metaMes = num(prof.monthly_goal);

    const lines: (string | null)[] = [
      "DADOS REAIS DESTE VENDEDOR (use pra personalizar; NUNCA invente número):",
      prof.nickname ? `- Nome: ${String(prof.nickname).split(" ")[0]}.${prof.what_i_sell ? ` Vende: ${prof.what_i_sell}.` : ""}${prof.where_i_sell ? ` Onde: ${prof.where_i_sell}.` : ""}${prof.city ? ` Cidade: ${prof.city}/${prof.state ?? ""}.` : ""}` : null,
      `- Últimos 7 dias: faturou ${fmt(fat7)}, lucro líquido ${fmt(lucro7)}. Últimos 30 dias: ${fmt(fat30)}.`,
      fatSemAnt > 0 ? `- Tendência: essa semana está ${tendencia >= 0 ? "+" : ""}${tendencia.toFixed(0)}% vs semana anterior (${fmt(fatSemAnt)}).` : null,
      abord > 0
        ? `- Conversão ${conv.toFixed(0)}% (${abord} abordagens, ${vendas} vendas em 7 dias). Ticket médio ${fmt(ticket)}.`
        : "- Sem abordagens/vendas registradas no DEFCON nos últimos 7 dias.",
      meta > 0
        ? `- Hoje: ${fmt(todayFat)} de uma meta de ${fmt(meta)} (${Math.round((todayFat / meta) * 100)}%).`
        : `- Hoje faturou ${fmt(todayFat)} (sem meta definida hoje).`,
      metaMes > 0 ? `- Meta do mês: ${fmt(metaMes)}.` : null,
      streak > 0 ? `- Sequência (streak): ${streak} dia(s) seguidos trabalhando.` : null,
      rank.posicao_faturamento ? `- Ranking do mês: posição ${rank.posicao_faturamento} com ${fmt(num(rank.faturamento_total_mes))} (${num(rank.dias_trabalhados_mes)} dias trabalhados).` : null,
      melhorDia ? `- Melhor dia da semana dele: ${melhorDia.k} (média ${fmt(melhorDia.avg)}).` : null,
      bestHour ? `- Melhor horário de venda: ${bestHour.k}.` : null,
      topProds.length ? `- Produtos que mais vendem (30d): ${topProds.map((p) => `${p.nome} (${p.q} un., ${fmt(p.v)})`).join("; ")}.` : null,
      estoqueBaixo.length ? `- ATENÇÃO estoque baixo: ${estoqueBaixo.join(", ")}.` : null,
      topGasto ? `- No que mais gasta: ${topGasto.k} (${fmt(topGasto.v)} em 30 dias).` : null,
      contas.length ? `- Contas chegando: ${contas.map((c) => `${c.name} ${fmt(num(c.amount))} vence ${String(c.due_date).slice(8, 10)}/${String(c.due_date).slice(5, 7)}`).join("; ")}.` : null,
      calote7 > 0 ? `- Calote acumulado (7 dias): ${fmt(calote7)}.` : null,
    ];
    return lines.filter(Boolean).join("\n");
  } catch {
    return ""; // qualquer erro: segue sem contexto, sem quebrar o chat
  }
}
