import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

// ============================================================================
// RESULTADO DO X1 — overlay que aparece 1x quando o duelo liquida (9h05).
// Vitória  = dourado, mostra o prêmio que JÁ caiu na carteira, chama o próximo.
// Derrota  = motivacional (sem humilhar): placar + botão de REVANCHE direto.
// Empate   = neutro, apostas devolvidas, revanche pra desempatar.
// Controle de exibição: localStorage por duelo (orbis_x1_result_seen_<id>).
// Só olha duelos liquidados nas últimas 48h — resultado velho não assombra.
// ============================================================================

const fmt = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);
const seenKey = (id: string) => `orbis_x1_result_seen_${id}`;

interface Resultado {
  id: string;
  venci: boolean;
  empate: boolean;
  meu: number;
  dele: number;
  premio: number;
  stakes: number;
  oppId: string;
  oppNome: string;
}

export function X1ResultBanner({ userId }: { userId: string | undefined }) {
  const navigate = useNavigate();
  const [r, setR] = useState<Resultado | null>(null);

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    (async () => {
      const desde = new Date(Date.now() - 48 * 3600_000).toISOString();
      const { data } = await supabase
        .from("x1_challenges" as any)
        .select("id, challenger_id, opponent_id, winner_user_id, challenger_score, opponent_score, prize_amount, stakes_amount, reviewed_at")
        .or(`challenger_id.eq.${userId},opponent_id.eq.${userId}`)
        .eq("status", "finished")
        .gte("reviewed_at", desde)
        .order("reviewed_at", { ascending: false })
        .limit(5);
      const rows = ((data as any[]) || []).filter((c) => {
        try { return !localStorage.getItem(seenKey(c.id)); } catch { return true; }
      });
      const c = rows[0];
      if (!c || !alive) return;
      const iAmCh = c.challenger_id === userId;
      const oppId = iAmCh ? c.opponent_id : c.challenger_id;
      const { data: p } = await supabase.from("public_profiles").select("nickname").eq("user_id", oppId).maybeSingle();
      if (!alive) return;
      const res: Resultado = {
        id: c.id,
        venci: c.winner_user_id === userId,
        empate: !c.winner_user_id,
        meu: Number(iAmCh ? c.challenger_score : c.opponent_score) || 0,
        dele: Number(iAmCh ? c.opponent_score : c.challenger_score) || 0,
        premio: Number(c.prize_amount) || 0,
        stakes: Number(c.stakes_amount) || 0,
        oppId,
        oppNome: ((p as any)?.nickname as string) || "seu oponente",
      };
      setR(res);
      try {
        if (typeof navigator !== "undefined" && "vibrate" in navigator) {
          navigator.vibrate(res.venci ? [60, 40, 60, 40, 140] : res.empate ? [60] : [220]);
        }
      } catch { /* sem vibração, sem drama */ }
    })().catch(() => {});
    return () => { alive = false; };
  }, [userId]);

  if (!r) return null;

  const fechar = () => {
    try { localStorage.setItem(seenKey(r.id), "1"); } catch { /* ignore */ }
    setR(null);
  };
  const revanche = () => {
    fechar();
    navigate(`/x1?desafiar=${r.oppId}`);
  };

  const tema = r.venci
    ? { borda: "rgba(245,158,11,.6)", glow: "0 0 70px rgba(245,158,11,.35)", fundo: "radial-gradient(ellipse at top,#1a1206,#0c0c0f 70%)" }
    : r.empate
      ? { borda: "rgba(148,163,184,.4)", glow: "0 0 40px rgba(148,163,184,.15)", fundo: "linear-gradient(160deg,#14141a,#0c0c0f)" }
      : { borda: "rgba(239,68,68,.55)", glow: "0 0 60px rgba(239,68,68,.3)", fundo: "radial-gradient(ellipse at top,#1a0808,#0c0c0f 70%)" };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6" style={{ background: "rgba(0,0,0,.85)", backdropFilter: "blur(4px)" }}>
      <div
        className="w-full max-w-sm rounded-3xl p-6 text-center space-y-3 animate-in zoom-in-95"
        style={{ background: tema.fundo, border: `1px solid ${tema.borda}`, boxShadow: tema.glow }}
      >
        <p className="text-5xl">{r.venci ? "🏆" : r.empate ? "🤝" : "⚔️"}</p>

        <p
          className="text-2xl font-black text-white"
          style={{ textShadow: r.venci ? "0 0 22px rgba(245,158,11,.8)" : r.empate ? "none" : "0 0 18px rgba(239,68,68,.7)" }}
        >
          {r.venci ? "VITÓRIA!" : r.empate ? "EMPATE" : "DERROTA"}
        </p>

        {/* Placar oficial do extrato verificado */}
        <div className="flex items-center justify-center gap-3">
          <span className="text-lg font-black tabular-nums" style={{ color: r.venci ? "#22c55e" : "#e5e7eb" }}>{fmt(r.meu)}</span>
          <span className="text-xs font-black italic text-amber-400">VS</span>
          <span className="text-lg font-black tabular-nums" style={{ color: r.venci ? "#9ca3af" : "#f87171" }}>{fmt(r.dele)}</span>
        </div>
        <p className="text-[11px] text-muted-foreground -mt-1">contra {r.oppNome} · extrato verificado das 9h</p>

        {r.venci ? (
          <>
            {r.premio > 0 && (
              <p className="text-sm font-black text-emerald-400">💰 +{fmt(r.premio)} já caiu na sua carteira</p>
            )}
            <p className="text-[12px] text-amber-200/90 font-semibold leading-snug">
              O dia foi seu. Campeão de verdade defende a coroa — quem é o próximo? 👑
            </p>
            <button
              onClick={() => { fechar(); navigate("/x1"); }}
              className="w-full py-3.5 rounded-2xl font-black text-sm active:scale-[0.97] transition-transform"
              style={{ background: "#f59e0b", color: "#000", boxShadow: "0 0 24px rgba(245,158,11,.5)" }}
            >
              ⚔️ ESCOLHER O PRÓXIMO DESAFIANTE
            </button>
          </>
        ) : r.empate ? (
          <>
            {r.stakes > 0 && <p className="text-sm font-bold text-emerald-400">💰 Apostas devolvidas na carteira</p>}
            <p className="text-[12px] text-slate-300/90 font-semibold leading-snug">
              Ninguém cedeu. Isso pede um desempate — amanhã um de vocês sai rei.
            </p>
            <button
              onClick={revanche}
              className="w-full py-3.5 rounded-2xl font-black text-sm active:scale-[0.97] transition-transform"
              style={{ background: "#f59e0b", color: "#000", boxShadow: "0 0 20px rgba(245,158,11,.4)" }}
            >
              ⚡ DESEMPATAR COM {r.oppNome.toUpperCase().slice(0, 14)}
            </button>
          </>
        ) : (
          <>
            <p className="text-[12px] text-red-200/90 font-semibold leading-snug">
              Perdeu a batalha — a guerra continua. Os líderes do ranking são os que voltam
              pra rua no dia seguinte. {r.dele > 0 ? `Faltou ${fmt(Math.max(0, r.dele - r.meu))}. ` : ""}Amanhã esse placar vira.
            </p>
            <button
              onClick={revanche}
              className="w-full py-3.5 rounded-2xl font-black text-sm active:scale-[0.97] transition-transform"
              style={{ background: "linear-gradient(160deg,#7f1d1d,#450a0a)", color: "#fecaca", border: "1px solid rgba(239,68,68,.6)", boxShadow: "0 0 24px rgba(239,68,68,.5)", textShadow: "0 0 10px rgba(239,68,68,.8)" }}
            >
              🔥 PEDIR REVANCHE AGORA
            </button>
          </>
        )}

        <button onClick={fechar} className="text-[11px] text-muted-foreground underline">fechar</button>
      </div>
    </div>
  );
}
