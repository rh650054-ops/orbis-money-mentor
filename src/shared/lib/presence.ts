import { supabase } from "@/integrations/supabase/client";

/**
 * Presença online (bolinha verde/cinza). Um usuário é considerado "online" se
 * mandou um heartbeat (last_active_at) nos últimos ONLINE_MS — o que acontece
 * enquanto ele está no DEFCON (ver useDefconPresence).
 */
export const ONLINE_MS = 90_000; // 90s = 2x o intervalo do heartbeat

export interface Presence {
  online: boolean;
  /** "no DEFCON agora" | "ativo há Xh" | "" (quando não há registro). */
  label: string;
}

export function presenceInfo(lastActive?: string | null): Presence {
  if (!lastActive) return { online: false, label: "" };
  const t = new Date(lastActive).getTime();
  if (!Number.isFinite(t)) return { online: false, label: "" };
  const diff = Date.now() - t;
  if (diff <= ONLINE_MS) return { online: true, label: "no DEFCON agora" };
  const min = Math.floor(diff / 60000);
  let label: string;
  if (min < 60) label = `ativo há ${min} min`;
  else {
    const h = Math.floor(min / 60);
    label = h < 24 ? `ativo há ${h}h` : `ativo há ${Math.floor(h / 24)}d`;
  }
  return { online: false, label };
}

/** Busca a última atividade (presença) de vários usuários de uma vez. */
export async function fetchPresenceMap(userIds: (string | null | undefined)[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const ids = Array.from(new Set(userIds.filter((x): x is string => !!x)));
  if (ids.length === 0) return map;
  const { data } = await supabase
    .from("user_presence")
    .select("user_id, last_active_at")
    .in("user_id", ids);
  for (const r of (data as { user_id: string; last_active_at: string }[]) || []) {
    map.set(r.user_id, r.last_active_at);
  }
  return map;
}
