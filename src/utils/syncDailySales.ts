import { supabase } from "@/integrations/supabase/client";
import { getBrazilDate } from "@/shared/lib/date-utils";

/**
 * Syncs aggregated hourly block data to the daily_sales table.
 * Called on every block value change for real-time dashboard updates.
 * Upserts a single daily_sales record for today with totals from hourly_goal_blocks.
 */
export async function syncBlocksToDailySales(userId: string) {
  const today = getBrazilDate();

  // Get today's plan
  const { data: planData } = await supabase
    .from("daily_goal_plans")
    .select("id")
    .eq("user_id", userId)
    .eq("date", today)
    .maybeSingle();

  if (!planData) return;

  // Aggregate all hourly blocks
  const { data: blocks } = await supabase
    .from("hourly_goal_blocks")
    .select("valor_dinheiro, valor_cartao, valor_pix, valor_calote, valor_gorjeta")
    .eq("plan_id", planData.id);

  if (!blocks || blocks.length === 0) return;

  const totalDinheiro = blocks.reduce((sum, b) => sum + (b.valor_dinheiro || 0), 0);
  const totalCartao = blocks.reduce((sum, b) => sum + (b.valor_cartao || 0), 0);
  const totalPix = blocks.reduce((sum, b) => sum + (b.valor_pix || 0), 0);
  const totalCalote = blocks.reduce((sum, b) => sum + (b.valor_calote || 0), 0);
  const totalGorjeta = blocks.reduce((sum, b) => sum + ((b as any).valor_gorjeta || 0), 0);
  const totalLiquido = totalDinheiro + totalCartao + totalPix;

  // Upsert manual de daily_sales.
  // A constraint UNIQUE(user_id, date) foi removida em migracoes antigas
  // (20251028150206 e 20251028150730), entao .upsert({ onConflict: 'user_id,date' })
  // falhava silenciosamente e os totais do DEFCON/Ritmo nunca chegavam ao daily_sales.
  // Aqui buscamos a linha do dia e atualizamos; se nao existir, inserimos.
  const salesRow = {
    total_profit: totalLiquido,
    total_debt: totalCalote,
    cash_sales: totalDinheiro,
    pix_sales: totalPix,
    card_sales: totalCartao,
    tip_sales: totalGorjeta,
    unpaid_sales: totalCalote > 0 ? 1 : 0,
  };

  // Upsert ATOMICO: 1 linha por (user_id, date). Usa o indice unico
  // daily_sales_user_date_unique (migration 20260620). Substitui o antigo
  // "le-depois-insere" que, em duas atualizacoes concorrentes do DEFCON,
  // criava linha duplicada e dobrava o faturamento no ranking.
  await supabase
    .from("daily_sales")
    .upsert({ user_id: userId, date: today, ...salesRow } as any, { onConflict: "user_id,date" });

  // Also update leaderboard revenue in real-time
  await syncLeaderboardRevenue(userId);
}

/**
 * Updates leaderboard faturamento from daily_sales for the current month.
 * Uses total_profit (same source as Dashboard "Entradas") to ensure consistency.
 * Called on every sale from any source (Ritmo blocks, Nova Venda, DEFCON 4).
 */
export async function syncLeaderboardRevenue(userId: string) {
  const currentMonth = getBrazilDate().slice(0, 7);
  const startOfMonth = `${currentMonth}-01`;
  const today = getBrazilDate();

  // Sum all daily_sales for this month using total_profit (same as Dashboard "Entradas")
  const { data: monthlySales } = await supabase
    .from("daily_sales")
    .select("total_profit, cash_sales, pix_sales, card_sales, total_debt")
    .eq("user_id", userId)
    .gte("date", startOfMonth)
    .lte("date", today);

  // A PARTIR DE 01/07/2026: dinheiro NÃO conta em NENHUM ranking (mensal, semanal,
  // competições, X1) — só cartão + pix, porque precisa ser comprovável pelo extrato.
  // O dinheiro continua salvo nos RELATÓRIOS do usuário; só não vale no ranking.
  const totalFaturamento = (monthlySales || []).reduce(
    (sum, s) => sum + (s.card_sales || 0) + (s.pix_sales || 0),
    0
  );

  // Get user profile for name/avatar
  const { data: profile } = await supabase
    .from("profiles")
    .select("nickname, email, avatar_url, ranking_hidden")
    .eq("user_id", userId)
    .maybeSingle();

  // Moderação: usuário oculto do ranking — remove a entrada do mês e não recria.
  if ((profile as any)?.ranking_hidden) {
    await supabase
      .from("leaderboard_stats")
      .delete()
      .eq("user_id", userId)
      .eq("mes_referencia", currentMonth);
    return;
  }

  const userName = profile?.nickname || profile?.email?.split('@')[0] || 'Usuário';
  const avatarUrl = profile?.avatar_url;

  // Dias com venda que conta no ranking (card + pix), mesma base do faturamento acima.
  const daysWithSales = (monthlySales || []).filter(
    s => ((s.card_sales || 0) + (s.pix_sales || 0)) > 0
  ).length;

  // Get or create leaderboard entry
  const { data: existingEntry } = await supabase
    .from("leaderboard_stats")
    .select("id, dias_trabalhados_mes, constancia_streak_atual, constancia_maior_streak")
    .eq("user_id", userId)
    .eq("mes_referencia", currentMonth)
    .maybeSingle();

  if (existingEntry) {
    await supabase
      .from("leaderboard_stats")
      .update({
        nome_usuario: userName,
        avatar_url: avatarUrl,
        faturamento_total_mes: totalFaturamento,
        dias_trabalhados_mes: Math.max(existingEntry.dias_trabalhados_mes, daysWithSales),
      })
      .eq("id", existingEntry.id);
  } else if (totalFaturamento > 0) {
    await supabase
      .from("leaderboard_stats")
      .insert({
        user_id: userId,
        nome_usuario: userName,
        avatar_url: avatarUrl,
        mes_referencia: currentMonth,
        faturamento_total_mes: totalFaturamento,
        dias_trabalhados_mes: daysWithSales,
        constancia_streak_atual: 1,
        constancia_maior_streak: 1,
      });
  }

  // Recalculate positions
  if (totalFaturamento > 0) {
    await supabase.rpc('recalculate_ranking_positions', { target_month: currentMonth });
  }
}
