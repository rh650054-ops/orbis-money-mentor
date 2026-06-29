import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Marca o usuário como "online" enquanto ele estiver no DEFCON.
 *
 * Grava um heartbeat (last_active_at) na tabela user_presence a cada ~45s
 * enquanto `active` for true, e uma vez na hora em que entra. O ranking usa
 * esse last_active_at pra mostrar a bolinha verde (online) ou cinza ("ativo há Xh").
 *
 * Silencioso/best-effort: se a tabela ainda não existir ou a rede falhar, não quebra nada.
 */
export function useDefconPresence(userId: string | undefined, active: boolean) {
  useEffect(() => {
    if (!userId || !active) return;

    let cancelled = false;
    const beat = () => {
      if (cancelled) return;
      supabase
        .from("user_presence")
        .upsert(
          { user_id: userId, last_active_at: new Date().toISOString() },
          { onConflict: "user_id" },
        )
        .then(
          () => {},
          () => {},
        );
    };

    beat(); // marca presença imediatamente ao entrar no DEFCON
    const id = setInterval(beat, 45000);

    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [userId, active]);
}
