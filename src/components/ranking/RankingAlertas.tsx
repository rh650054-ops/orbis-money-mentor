/* ============================================================
   BANNER DE RANKING — aparece em QUALQUER tela (fica na raiz do router,
   junto do PaywallGate), inclusive dentro do DEFCON.
     • vermelho: "Lucas te ultrapassou · você caiu pra #14"
     • dourado:  "Você passou Ana · agora é #13"
   Toque em "Ver ranking" leva pro /ranking e marca como visto.
   ============================================================ */
import { useNavigate } from "react-router-dom";
import { ChevronRight, TrendingDown, TrendingUp, X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useRankingAlertas, textoAlerta } from "@/hooks/useRankingAlertas";

export default function RankingAlertas() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { alertas, dispensar, dispensarTodos } = useRankingAlertas(user?.id);
  if (!user || alertas.length === 0) return null;

  return (
    <div className="fixed left-0 right-0 z-[70] px-3 pointer-events-none" style={{ top: "calc(env(safe-area-inset-top) + 8px)" }}>
      <div className="max-w-md mx-auto space-y-2">
        {alertas.slice(0, 2).map((a) => {
          const caiu = a.tipo === "foi_ultrapassado";
          const { titulo, corpo } = textoAlerta(a);
          const cor = caiu ? "#F2465A" : "#F5B800";
          return (
            <div key={a.id} className="orbis-card-in pointer-events-auto rounded-[18px] border px-3.5 py-3 flex items-center gap-3 shadow-2xl"
              style={{ borderColor: `${cor}66`, background: caiu ? "linear-gradient(135deg,#2a0b10 0%,#120608 100%)" : "linear-gradient(135deg,#2a1f05 0%,#120e03 100%)", boxShadow: `0 18px 40px -18px ${cor}99` }}>
              <span className="relative w-11 h-11 rounded-full shrink-0 flex items-center justify-center overflow-hidden" style={{ background: `${cor}22`, border: `1.5px solid ${cor}88` }}>
                {a.outro_avatar ? <img src={a.outro_avatar} alt="" className="w-full h-full object-cover" /> : (caiu ? <TrendingDown className="w-5 h-5" style={{ color: cor }} strokeWidth={2.4} /> : <TrendingUp className="w-5 h-5" style={{ color: cor }} strokeWidth={2.4} />)}
              </span>
              <button type="button" onClick={() => { void dispensar(a.id); navigate("/ranking"); }} className="flex-1 min-w-0 text-left">
                <span className="block text-[10px] font-extrabold tracking-[.16em] uppercase" style={{ color: cor }}>{caiu ? "Ranking · te passaram" : "Ranking · você subiu"}</span>
                <b className="block text-[14.5px] font-extrabold leading-tight mt-0.5 text-white truncate">{titulo}</b>
                <small className="block text-[12px] mt-0.5 leading-snug" style={{ color: "rgba(255,255,255,.72)" }}>{corpo}</small>
              </button>
              <button type="button" onClick={() => { void dispensar(a.id); navigate("/ranking"); }} aria-label="Ver ranking" className="shrink-0 h-9 px-2.5 rounded-[11px] inline-flex items-center gap-0.5 text-[11.5px] font-extrabold" style={{ background: cor, color: caiu ? "#fff" : "#1A1200" }}>
                Ver <ChevronRight className="w-3.5 h-3.5" strokeWidth={3} />
              </button>
              <button type="button" onClick={() => void dispensar(a.id)} aria-label="Fechar" className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center" style={{ color: "rgba(255,255,255,.55)" }}><X className="w-4 h-4" /></button>
            </div>
          );
        })}
        {alertas.length > 2 && (
          <button type="button" onClick={() => void dispensarTodos()} className="pointer-events-auto mx-auto block text-[11px] font-bold rounded-full px-3 h-7" style={{ background: "rgba(0,0,0,.7)", color: "rgba(255,255,255,.7)", border: "1px solid rgba(255,255,255,.12)" }}>
            +{alertas.length - 2} · limpar todos
          </button>
        )}
      </div>
    </div>
  );
}
