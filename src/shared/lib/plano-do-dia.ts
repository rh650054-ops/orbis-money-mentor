/* ============================================================
   PLANO DO DIA — cria o daily_goal_plans + hourly_goal_blocks de hoje.
   Extraído pra o DEFCON também poder criar: conta nova sai do onboarding
   direto pro /defcon (Rick, 05/09) e não pode esbarrar em "Sem plano hoje".

   11/10/2026 (meta viável): a meta do dia vem do cérebro (meta_do_dia →
   metas_dia), não mais do base_daily_goal fixo. Os blocos seguem a curva
   real de hora dele (metaPorBloco). Conta nova ('aprendendo') segue a meta
   manual. Plano já criado antes do cérebro passar é alinhado aqui, desde que
   o DEFCON de hoje ainda não tenha começado.
   ============================================================ */
import { supabase } from "@/integrations/supabase/client";
import { avisar } from "@/shared/lib/avisar";
import { carregarMetaDoDia } from "@/hooks/useMetaDoDia";
import { metaPorBloco, type MetaDoDia } from "@/shared/lib/meta-viavel";

export interface PlanoDoDia { id: string; daily_goal: number; date: string; work_hours?: number }

async function metaDeHoje(date: string, metaBase: number): Promise<{ meta: number; curva: number[]; aprendendo: boolean }> {
  let m: MetaDoDia | null = null;
  try { m = await carregarMetaDoDia(date); } catch (e) { avisar.silencioso("plano-do-dia: meta do cérebro", e); }
  // 25/10: modo padrão = a meta que ele planejou, dividida IGUAL pelas horas (sem curva),
  // inclusive na conta nova. Adaptativo: como antes (curva dele; conta nova na meta manual).
  if (m && m.modo === "padrao" && m.meta > 0) return { meta: m.meta, curva: [], aprendendo: false };
  if (!m || m.status === "aprendendo" || !(m.meta > 0)) return { meta: metaBase, curva: m?.curva ?? [], aprendendo: true };
  return { meta: m.meta, curva: m.curva, aprendendo: false };
}

async function defconJaComecou(userId: string, date: string): Promise<boolean> {
  const { data } = await supabase.from("challenge_sessions").select("id").eq("user_id", userId).eq("date", date).not("started_at", "is", null).limit(1);
  return (data?.length ?? 0) > 0;
}

export async function garantirPlanoDoDia(userId: string, date: string): Promise<PlanoDoDia | null> {
  const { data: perfil } = await supabase
    .from("profiles").select("base_daily_goal, goal_hours")
    .eq("user_id", userId).maybeSingle();
  const base = Number(perfil?.base_daily_goal) || 200;
  const wh = Math.min(16, Math.max(1, Math.round(Number(perfil?.goal_hours) || 8)));
  const { meta: dg, curva, aprendendo } = await metaDeHoje(date, base);

  const { data: existente } = await supabase
    .from("daily_goal_plans").select("id, daily_goal, date, work_hours")
    .eq("user_id", userId).eq("date", date).maybeSingle();
  if (existente) {
    // plano de ontem à noite com meta velha: alinha, se o dia ainda não começou
    if (!aprendendo && Math.abs(Number(existente.daily_goal) - dg) >= 1 && !(await defconJaComecou(userId, date))) {
      const blocos = Math.max(1, Number(existente.work_hours) || wh);
      await supabase.from("daily_goal_plans").update({ daily_goal: dg, hourly_goal: dg / blocos }).eq("id", existente.id);
      const alvos = metaPorBloco(dg, blocos, curva);
      await Promise.all(alvos.map((t, i) => supabase.from("hourly_goal_blocks").update({ target_amount: t }).eq("plan_id", existente.id).eq("hour_index", i)));
      return { id: existente.id, daily_goal: dg, date: existente.date, work_hours: blocos };
    }
    return { id: existente.id, daily_goal: Number(existente.daily_goal), date: existente.date, work_hours: Number(existente.work_hours) || wh };
  }

  const { data: novo, error } = await supabase
    .from("daily_goal_plans")
    .insert({ user_id: userId, date, daily_goal: dg, work_hours: wh, mood: "normal", hourly_goal: dg / wh })
    .select("id, daily_goal, date, work_hours")
    .single();
  if (error || !novo) {
    // corrida: outro lugar (Hub) criou no mesmo instante → lê de novo
    const { data: denovo } = await supabase
      .from("daily_goal_plans").select("id, daily_goal, date, work_hours")
      .eq("user_id", userId).eq("date", date).maybeSingle();
    return (denovo as PlanoDoDia) ?? null;
  }
  const alvos = metaPorBloco(dg, wh, curva);
  const blocos = Array.from({ length: wh }, (_, i) => ({
    plan_id: novo.id, user_id: userId, hour_index: i, hour_label: `H${i + 1}`, target_amount: alvos[i] ?? dg / wh,
    valor_dinheiro: 0, valor_cartao: 0, valor_pix: 0, valor_calote: 0, timer_status: "idle",
  }));
  const { error: blkErr } = await supabase.from("hourly_goal_blocks").insert(blocos);
  if (blkErr) avisar.usuario("Não consegui montar as horas do plano de hoje. Tenta de novo.", blkErr, "plano-do-dia: criar blocos");
  return novo as PlanoDoDia;
}
