import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getBrazilDate } from "@/shared/lib/date-utils";

// Vigia o X1 do dia ENQUANTO a pessoa está no DEFCON. A cada 25s puxa o placar
// (x1_placar) e, quando a liderança VIRA, dispara uma notificação marcada como X1:
//  - oponente passou  -> "⚔️ X1 — seu oponente passou!"
//  - você retomou     -> "🔥 X1 — você retomou a liderança!"
// Tem cooldown de 90s pra não spammar em empate técnico (flip-flop).
export function useX1DefconAlert(userId: string | undefined, active: boolean) {
  const lastLead = useRef<"me" | "opp" | "tie" | null>(null);
  const lastAlertAt = useRef(0);

  useEffect(() => {
    if (!active || !userId) return;
    let alive = true;
    let duel: { id: string; iAmCh: boolean; oppName: string } | null = null;

    const notify = (title: string, body: string) => {
      if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
      navigator.serviceWorker.ready
        .then((reg) => reg.active?.postMessage({ type: "orbis-x1-alert", data: { title, body } }))
        .catch(() => {});
    };

    const findDuel = async () => {
      const today = getBrazilDate();
      const { data } = await supabase
        .from("x1_challenges" as any)
        .select("id, challenger_id, opponent_id")
        .or(`challenger_id.eq.${userId},opponent_id.eq.${userId}`)
        .eq("status", "active")
        .eq("scheduled_date", today)
        .limit(1);
      const c = ((data as any[]) || [])[0];
      if (!c) {
        duel = null;
        return;
      }
      const iAmCh = c.challenger_id === userId;
      const oppId = iAmCh ? c.opponent_id : c.challenger_id;
      const { data: ls } = await supabase
        .from("leaderboard_stats")
        .select("nome_usuario")
        .eq("user_id", oppId)
        .maybeSingle();
      duel = { id: c.id, iAmCh, oppName: ((ls as any)?.nome_usuario as string) || "Seu oponente" };
    };

    const poll = async () => {
      if (!duel) await findDuel();
      if (!duel || !alive) return;
      const { data } = await (supabase as any).rpc("x1_placar", { p_id: duel.id });
      const row = ((data as any[]) || [])[0];
      if (!row || !alive) return;
      const my = duel.iAmCh ? Number(row.challenger_total) : Number(row.opponent_total);
      const opp = duel.iAmCh ? Number(row.opponent_total) : Number(row.challenger_total);
      const lead: "me" | "opp" | "tie" = my > opp ? "me" : opp > my ? "opp" : "tie";
      const prev = lastLead.current;
      lastLead.current = lead;
      if (prev === null) return; // 1ª leitura: só registra o estado
      const now = Date.now();
      if (now - lastAlertAt.current < 90_000) return; // cooldown anti flip-flop
      if (prev !== "opp" && lead === "opp") {
        lastAlertAt.current = now;
        notify("⚔️ X1 — seu oponente passou!", `${duel.oppName} tá na sua frente. Bora reagir! 🔥`);
      } else if (prev === "opp" && lead === "me") {
        lastAlertAt.current = now;
        notify("🔥 X1 — você retomou a liderança!", `Você voltou pra frente de ${duel.oppName}. Mantém o ritmo!`);
      }
    };

    poll();
    const t = setInterval(poll, 25_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [userId, active]);
}
