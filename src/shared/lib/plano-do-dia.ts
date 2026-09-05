/* ============================================================
   PLANO DO DIA — cria o daily_goal_plans + hourly_goal_blocks de hoje
   a partir do perfil (base_daily_goal / goal_hours), igual ao que o
   Hub (aba Foco) já fazia sozinho. Extraído pra o DEFCON também poder
   criar: conta nova sai do onboarding direto pro /defcon (Rick, 05/09)
   e não pode esbarrar em "Sem plano hoje".
   ============================================================ */
import { supabase } from "@/integrations/supabase/client";

export interface PlanoDoDia { id: string; daily_goal: number; date: string }

export async function garantirPlanoDoDia(userId: string, date: string): Promise<PlanoDoDia | null> {
  const { data: existente } = await supabase
    .from("daily_goal_plans").select("id, daily_goal, date")
    .eq("user_id", userId).eq("date", date).maybeSingle();
  if (existente) return existente as PlanoDoDia;

  const { data: perfil } = await supabase
    .from("profiles").select("base_daily_goal, goal_hours")
    .eq("user_id", userId).maybeSingle();
  const dg = Number(perfil?.base_daily_goal) || 200;
  const wh = Math.min(16, Math.max(1, Math.round(Number(perfil?.goal_hours) || 8)));

  const { data: novo, error } = await supabase
    .from("daily_goal_plans")
    .insert({ user_id: userId, date, daily_goal: dg, work_hours: wh, mood: "normal", hourly_goal: dg / wh })
    .select("id, daily_goal, date")
    .single();
  if (error || !novo) {
    // corrida: outro lugar (Hub) criou no mesmo instante → lê de novo
    const { data: denovo } = await supabase
      .from("daily_goal_plans").select("id, daily_goal, date")
      .eq("user_id", userId).eq("date", date).maybeSingle();
    return (denovo as PlanoDoDia) ?? null;
  }
  const blocos = Array.from({ length: wh }, (_, i) => ({
    plan_id: novo.id, user_id: userId, hour_index: i, hour_label: `H${i + 1}`, target_amount: dg / wh,
    valor_dinheiro: 0, valor_cartao: 0, valor_pix: 0, valor_calote: 0, timer_status: "idle",
  }));
  await supabase.from("hourly_goal_blocks").insert(blocos);
  return novo as PlanoDoDia;
}
