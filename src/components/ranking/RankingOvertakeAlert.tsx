import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Swords, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getBrazilDate } from "@/shared/lib/date-utils";
import { extratoValendo } from "@/shared/lib/ranking-config";
import { currentWeekStart, currentWeekEnd } from "@/hooks/useWeeklyLeaderboard";

// ============================================================================
// "TE ULTRAPASSARAM!" — o gatilho de retenção do ranking semanal.
// Vigia sua posição na semana (poll a cada 90s enquanto o app está aberto).
// Quando alguém te passa: banner vermelho na home + notificação no aparelho,
// com o nome de quem passou, o gap e dois contra-ataques: IR VENDER (DEFCON)
// e DESAFIAR no X1. Trégua de 15min pra não virar spam em placar disputado.
// A posição fica no localStorage POR SEMANA — detecta ultrapassagem até entre
// uma sessão e outra ("abri o app e descobri que caí").
// ============================================================================

const fmt = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);
const COOLDOWN_MS = 15 * 60_000;

interface Overtaker {
  uid: string;
  nome: string;
  gap: number; // quanto ele está na frente
  minhaPos: number;
}

export function RankingOvertakeAlert({ userId }: { userId: string | undefined }) {
  const navigate = useNavigate();
  const [alerta, setAlerta] = useState<Overtaker | null>(null);

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    const week = currentWeekStart();
    const posKey = `orbis_rank_pos_${userId}_${week}`;
    const cdKey = `orbis_rank_overtake_cd_${userId}`;

    const notify = (title: string, body: string) => {
      if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
      navigator.serviceWorker.ready
        .then((reg) => reg.active?.postMessage({ type: "orbis-x1-alert", data: { title, body } }))
        .catch(() => {});
    };

    const poll = async () => {
      try {
        const { data } = await supabase.rpc("get_weekly_ranking_verified", {
          p_week_start: week,
          p_week_end: currentWeekEnd(),
          p_usar_extrato: extratoValendo(getBrazilDate()),
        });
        const rows = ((data as any[]) || []);
        const idx = rows.findIndex((r) => String(r.user_id) === userId);
        if (idx < 0 || !alive) return; // fora do ranking: nada a vigiar
        const pos = idx + 1;

        let prev: { pos: number } | null = null;
        try { prev = JSON.parse(localStorage.getItem(posKey) || "null"); } catch { /* noop */ }
        try { localStorage.setItem(posKey, JSON.stringify({ pos })); } catch { /* noop */ }

        // Só alerta QUEDA (subida já ganha confete na tela do ranking).
        if (!prev || pos <= prev.pos) return;
        const cd = Number(localStorage.getItem(cdKey) || 0);
        if (Date.now() - cd < COOLDOWN_MS) return;

        // Quem está imediatamente acima = o cara que acabou de te engolir.
        const acima = rows[idx - 1];
        if (!acima) return;
        const meu = Number(rows[idx].faturamento_semana) || 0;
        const dele = Number(acima.faturamento_semana) || 0;
        const alvo: Overtaker = {
          uid: String(acima.user_id),
          nome: (acima.nome_usuario as string) || "Um rival",
          gap: Math.max(0, dele - meu),
          minhaPos: pos,
        };
        try { localStorage.setItem(cdKey, String(Date.now())); } catch { /* noop */ }
        if (!alive) return;
        setAlerta(alvo);
        notify(
          `🔻 ${alvo.nome} te ultrapassou no ranking!`,
          `Ele tá ${fmt(alvo.gap)} na sua frente. Cada venda te devolve a posição — reage! 🔥`,
        );
        try {
          if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate([120, 60, 120]);
        } catch { /* noop */ }
      } catch { /* best-effort */ }
    };

    poll();
    const t = setInterval(poll, 90_000);
    return () => { alive = false; clearInterval(t); };
  }, [userId]);

  if (!alerta) return null;

  return (
    <div
      className="mb-3 rounded-2xl p-3.5 flex items-center gap-3 animate-in slide-in-from-top-2 fade-in duration-300"
      style={{ background: "linear-gradient(160deg,#1c0808,#0c0c0f)", border: "1px solid rgba(239,68,68,.55)", boxShadow: "0 0 22px rgba(239,68,68,.25)" }}
    >
      <span className="text-2xl shrink-0">🔻</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-black text-red-300 leading-tight" style={{ textShadow: "0 0 10px rgba(239,68,68,.6)" }}>
          {alerta.nome} te ultrapassou!
        </p>
        <p className="text-[11px] text-red-200/80 font-semibold leading-snug">
          Você caiu pra #{alerta.minhaPos} · falta {fmt(alerta.gap)} pra retomar. A rua devolve — vai buscar.
        </p>
        <div className="flex gap-1.5 mt-2">
          <button
            onClick={() => { setAlerta(null); navigate("/defcon"); }}
            className="flex-1 h-8 rounded-lg text-[11px] font-black active:scale-95 transition-transform"
            style={{ background: "linear-gradient(160deg,#7f1d1d,#450a0a)", color: "#fecaca", border: "1px solid rgba(239,68,68,.6)" }}
          >
            🔥 IR VENDER
          </button>
          <button
            onClick={() => { setAlerta(null); navigate(`/x1?desafiar=${alerta.uid}`); }}
            className="flex-1 h-8 rounded-lg text-[11px] font-black inline-flex items-center justify-center gap-1 active:scale-95 transition-transform"
            style={{ background: "#141417", color: "#f87171", border: "1px solid rgba(239,68,68,.4)" }}
          >
            <Swords className="w-3 h-3" /> DESAFIAR
          </button>
        </div>
      </div>
      <button onClick={() => setAlerta(null)} aria-label="Fechar" className="shrink-0 self-start text-red-200/50 hover:text-red-200">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
