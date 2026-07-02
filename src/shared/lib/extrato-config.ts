import { supabase } from "@/integrations/supabase/client";

// Horário-limite pra subir o extrato do dia (hora do DIA SEGUINTE, fuso BR).
// Vem do banco (app_settings.extrato_deadline_hour) e é mudável pelo admin.
// Guardamos num cache em memória pra o getExtratoDia poder ler de forma síncrona.

const DEFAULT_HOUR = 9;
let deadlineHour = DEFAULT_HOUR;

// Lê o horário do cache (síncrono).
export function getExtratoDeadlineHour(): number {
  return deadlineHour;
}

export function extratoDeadlineLabel(): string {
  return `${deadlineHour}h`;
}

// Carrega o horário do banco 1x (no boot) e atualiza o cache.
export async function loadExtratoDeadline(): Promise<void> {
  try {
    const { data } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "extrato_deadline_hour")
      .maybeSingle();
    const h = Number((data as { value?: string } | null)?.value);
    if (Number.isFinite(h) && h >= 0 && h <= 23) deadlineHour = h;
  } catch {
    /* mantém o padrão */
  }
}

// Admin: grava o novo horário no banco e já atualiza o cache local.
export async function setExtratoDeadline(hour: number): Promise<{ ok: boolean; error?: string }> {
  const h = Math.max(0, Math.min(23, Math.round(hour)));
  const { error } = await supabase
    .from("app_settings")
    .upsert({ key: "extrato_deadline_hour", value: String(h) });
  if (error) return { ok: false, error: error.message };
  deadlineHour = h;
  return { ok: true };
}
