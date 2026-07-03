import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getBrazilDate } from "@/shared/lib/date-utils";

// Vigia o X1 do dia ENQUANTO a pessoa está no DEFCON. A cada 15s puxa o placar
// (x1_placar) e:
//  1) NOTIFICAÇÃO (fora do app) quando a liderança VIRA:
//     - oponente passou  -> "⚔️ X1 — seu oponente passou!"
//     - você retomou     -> "🔥 X1 — você retomou a liderança!"
//     Cooldown de 90s pra não spammar em empate técnico (flip-flop).
//  2) ESTADO AO VIVO pro widget DENTRO da tela do DEFCON (DefconX1Live):
//     placar meu/dele, quem lidera e o "evento" da virada (banner + vibração).
export interface X1LiveEvent {
  type: "overtaken" | "regained";
  at: number;
}
export interface X1LiveState {
  /** true quando existe duelo ATIVO hoje (mostra o widget) */
  hasDuel: boolean;
  oppName: string;
  my: number;
  opp: number;
  stakes: number;
  lead: "me" | "opp" | "tie" | null;
  /** virada recente — o widget mostra o banner e depois chama dismissEvent() */
  event: X1LiveEvent | null;
  dismissEvent: () => void;
}

const EMPTY: X1LiveState = {
  hasDuel: false,
  oppName: "",
  my: 0,
  opp: 0,
  stakes: 0,
  lead: null,
  event: null,
  dismissEvent: () => {},
};

export function useX1DefconAlert(userId: string | undefined, active: boolean): X1LiveState {
  const lastLead = useRef<"me" | "opp" | "tie" | null>(null);
  const lastAlertAt = useRef(0);
  const [state, setState] = useState<X1LiveState>(EMPTY);

  const dismissEvent = useCallback(() => {
    setState((s) => (s.event ? { ...s, event: null } : s));
  }, []);

  useEffect(() => {
    if (!active || !userId) {
      lastLead.current = null;
      setState(EMPTY);
      return;
    }
    let alive = true;
    let duel: { id: string; iAmCh: boolean; oppName: string; stakes: number } | null = null;

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
        .select("id, challenger_id, opponent_id, stakes_amount")
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
      duel = {
        id: c.id,
        iAmCh,
        oppName: ((ls as any)?.nome_usuario as string) || "Seu oponente",
        stakes: Number(c.stakes_amount) || 0,
      };
    };

    const poll = async () => {
      if (!duel) await findDuel();
      if (!alive) return;
      if (!duel) {
        setState((s) => (s.hasDuel ? EMPTY : s));
        return;
      }
      const { data } = await (supabase as any).rpc("x1_placar", { p_id: duel.id });
      const row = ((data as any[]) || [])[0];
      if (!row || !alive) return;
      const my = duel.iAmCh ? Number(row.challenger_total) : Number(row.opponent_total);
      const opp = duel.iAmCh ? Number(row.opponent_total) : Number(row.challenger_total);
      const lead: "me" | "opp" | "tie" = my > opp ? "me" : opp > my ? "opp" : "tie";
      const prev = lastLead.current;
      lastLead.current = lead;

      // Evento de virada (banner dentro do DEFCON + notificação fora), com cooldown.
      let event: X1LiveEvent | null = null;
      if (prev !== null) {
        const now = Date.now();
        if (now - lastAlertAt.current >= 90_000) {
          if (prev !== "opp" && lead === "opp") {
            lastAlertAt.current = now;
            event = { type: "overtaken", at: now };
            notify("⚔️ X1 — seu oponente passou!", `${duel.oppName} tá na sua frente. Bora reagir! 🔥`);
          } else if (prev === "opp" && lead === "me") {
            lastAlertAt.current = now;
            event = { type: "regained", at: now };
            notify("🔥 X1 — você retomou a liderança!", `Você voltou pra frente de ${duel.oppName}. Mantém o ritmo!`);
          }
        }
      }

      setState((s) => ({
        hasDuel: true,
        oppName: duel!.oppName,
        my,
        opp,
        stakes: duel!.stakes,
        lead,
        // não apaga um evento ainda em exibição se este poll não gerou outro
        event: event ?? s.event,
        dismissEvent,
      }));
    };

    poll();
    const t = setInterval(poll, 15_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [userId, active, dismissEvent]);

  return state;
}
