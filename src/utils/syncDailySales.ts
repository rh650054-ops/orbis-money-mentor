import { supabase } from "@/integrations/supabase/client";
import { getBrazilDate } from "@/lib/dateUtils";

/**
 * Syncs aggregated hourly block data to the daily_sales table.
 * Called when DEFCON 4 finishes or Ritmo "Concluir Dia" is clicked.
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
    .select("valor_dinheiro, valor_cartao, valor_pix, valor_calote")
    .eq("plan_id", planData.id);

  if (!blocks || blocks.length === 0) return;

  const totalDinheiro = blocks.reduce((sum, b) => sum + (b.valor_dinheiro || 0), 0);
  const totalCartao = blocks.reduce((sum, b) => sum + (b.valor_cartao || 0), 0);
  const totalPix = blocks.reduce((sum, b) => sum + (b.valor_pix || 0), 0);
  const totalCalote = blocks.reduce((sum, b) => sum + (b.valor_calote || 0), 0);
  const totalBruto = totalDinheiro + totalCartao + totalPix + totalCalote;
  const totalLiquido = totalDinheiro + totalCartao + totalPix;

  // Check if daily_sales record exists for today
  const { data: existing } = await supabase
    .from("daily_sales")
    .select("id")
    .eq("user_id", userId)
    .eq("date", today)
    .maybeSingle();

  if (existing) {
    await supabase
      .from("daily_sales")
      .update({
        total_profit: totalLiquido,
        total_debt: totalCalote,
        cash_sales: totalDinheiro,
        pix_sales: totalPix,
        card_sales: totalCartao,
        unpaid_sales: totalCalote > 0 ? 1 : 0,
      })
      .eq("id", existing.id);
  } else {
    await supabase
      .from("daily_sales")
      .insert({
        user_id: userId,
        date: today,
        total_profit: totalLiquido,
        total_debt: totalCalote,
        cash_sales: totalDinheiro,
        pix_sales: totalPix,
        card_sales: totalCartao,
        unpaid_sales: totalCalote > 0 ? 1 : 0,
      });
  }
}
