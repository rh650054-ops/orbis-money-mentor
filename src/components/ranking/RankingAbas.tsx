/* DESAFIO AVANTE — o painel do prêmio no topo do Ranking (Rick, 29/10/2026).
   Um painel só, no visual do pódio: o prêmio da aba (R$ 500 no Mensal, R$ 50 no Semanal),
   o cronômetro até fechar, onde a pessoa está e quanto falta pro 1º, e as abas
   Mensal | Semanal dentro dele. Fora da janela do desafio vira só as abas. */
import { useEffect, useState } from "react";
import { Trophy, Zap } from "lucide-react";
import { premioDaAba, PREMIO_FIM, type Aba } from "./premiacao";

const OURO = "#F5B800";
const OURO_CLARO = "#F5D77A";
const brl0 = (n: number) => "R$ " + Math.round(n).toLocaleString("pt-BR");

/** ms until the period closes (23:59:59 Brasília of its last day). */
function msAteFechar(aba: Aba, fimSemana: string): number {
  const fim = aba === "mensal" ? PREMIO_FIM : fimSemana;
  return Date.parse(`${fim}T23:59:59-03:00`) - Date.now();
}

function Cronometro({ aba, fimSemana }: { aba: Aba; fimSemana: string }) {
  const [ms, setMs] = useState(() => msAteFechar(aba, fimSemana));
  useEffect(() => {
    setMs(msAteFechar(aba, fimSemana));
    const t = setInterval(() => setMs(msAteFechar(aba, fimSemana)), 1000);
    return () => clearInterval(t);
  }, [aba, fimSemana]);
  const s = Math.max(0, Math.floor(ms / 1000));
  const partes: [string, string][] = [
    [String(Math.floor(s / 86400)), "dias"], [String(Math.floor((s % 86400) / 3600)).padStart(2, "0"), "horas"],
    [String(Math.floor((s % 3600) / 60)).padStart(2, "0"), "min"], [String(s % 60).padStart(2, "0"), "seg"],
  ];
  return (
    <div className="grid grid-cols-4 gap-1.5" aria-label="Fecha em">
      {partes.map(([v, k]) => (
        <div key={k} className="rounded-[10px] py-1.5 text-center" style={{ background: "rgba(0,0,0,.45)", border: "1px solid rgba(245,184,0,.18)" }}>
          <p className="orbis-num text-[20px] font-black leading-none text-white tabular-nums">{v}</p>
          <p className="text-[9px] font-bold tracking-[.12em] uppercase mt-0.5" style={{ color: "#b9b3a6" }}>{k}</p>
        </div>
      ))}
    </div>
  );
}

export function RankingAbas({ aba, onAba, hoje, periodoSemana, fimSemana, posicao, faltaPro1, meuValor }: {
  aba: Aba; onAba: (a: Aba) => void; hoje: string; periodoSemana: string; fimSemana: string;
  /** the viewer's place, how much to the 1st and his own total — the hook that sends him back to the street */
  posicao?: number | null; faltaPro1?: number | null; meuValor?: number | null;
}) {
  const premio = premioDaAba(aba, hoje);
  const abas = (escuro: boolean) => (
    <div role="tablist" aria-label="Período do ranking" className="flex gap-1 p-1 rounded-[15px]" style={{ background: escuro ? "rgba(0,0,0,.45)" : "#121211", border: "1px solid rgba(255,255,255,.08)" }}>
      {(["mensal", "semanal"] as Aba[]).map((a) => {
        const on = aba === a;
        return (
          <button key={a} type="button" role="tab" aria-selected={on} onClick={() => onAba(a)}
            className="flex-1 h-10 rounded-[12px] text-[13.5px] font-black transition-colors"
            style={on ? { background: OURO, color: "#1a1305" } : { color: "#b9b3a6" }}>
            {a === "mensal" ? "Mensal" : "Semanal"}
          </button>
        );
      })}
    </div>
  );

  if (!premio) {
    return (
      <div className="space-y-2.5">
        {abas(false)}
        {aba === "semanal" && <p className="text-center text-[12px] font-bold" style={{ color: "#b9b3a6" }}>{periodoSemana} · fecha sábado 23:59</p>}
      </div>
    );
  }

  // "Semana 2 · 08/11 a 14/11" → título "SEMANA 2" e as datas numa linha menor
  const [semanaNome, semanaDatas] = periodoSemana.includes(" · ") ? periodoSemana.split(" · ") : [periodoSemana, ""];
  const topo = aba === "mensal" ? "NOVEMBRO" : (semanaNome ?? "").toUpperCase();
  const pct = posicao && posicao > 1 && faltaPro1 && meuValor != null && meuValor + faltaPro1 > 0 ? Math.max(4, Math.min(100, (meuValor / (meuValor + faltaPro1)) * 100)) : null;
  return (
    <section aria-label="Desafio Avante" className="relative overflow-hidden rounded-2xl border px-4 pt-3.5 pb-3"
      style={{ borderColor: "#3a2c0a", background: "radial-gradient(120% 90% at 50% 0%, rgba(245,181,68,0.30) 0%, #120d04 58%)", boxShadow: "0 0 0 1px rgba(245,184,0,.16), 0 16px 44px -20px rgba(245,184,0,.7)" }}>
      {/* raios atrás do prêmio, bem discretos */}
      <span aria-hidden="true" className="absolute pointer-events-none" style={{ left: "50%", top: -170, width: 420, height: 420, transform: "translateX(-50%)", borderRadius: "50%", background: "repeating-conic-gradient(rgba(245,184,0,.10) 0deg 6deg, transparent 6deg 18deg)", maskImage: "radial-gradient(circle, #000 20%, transparent 62%)", WebkitMaskImage: "radial-gradient(circle, #000 20%, transparent 62%)" }} />
      <span className="absolute inset-0 pointer-events-none orbis-shimmer" />

      <p className="relative text-center tracking-[0.3em] text-[11px]" style={{ color: OURO_CLARO }}>DESAFIO AVANTE · {topo}</p>
      {aba === "semanal" && semanaDatas && <p className="relative text-center text-[11px] font-bold mt-0.5" style={{ color: "#b9b3a6" }}>{semanaDatas} · fecha sábado 23:59</p>}

      <div className="relative flex flex-col items-center mt-2">
        <span className="orbis-float w-14 h-14 rounded-full flex items-center justify-center" style={{ background: "rgba(245,184,0,.14)", boxShadow: "0 0 26px rgba(245,184,0,.45), inset 0 0 0 1px rgba(245,184,0,.35)" }}>
          {aba === "mensal" ? <Trophy className="w-7 h-7" style={{ color: OURO }} /> : <Zap className="w-7 h-7" style={{ color: OURO }} fill={OURO} strokeWidth={0} />}
        </span>
        <p className="orbis-num font-black leading-none mt-2" style={{ fontSize: 48, color: OURO, textShadow: "0 0 22px rgba(245,184,0,.5)", letterSpacing: "-1px" }}>{brl0(premio.valor)}</p>
        <p className="text-[13.5px] font-bold mt-1 text-white">{premio.texto}</p>
      </div>

      <div className="relative mt-3">
        {premio.antes
          ? <p className="text-center text-[12px] font-bold py-1.5" style={{ color: "#b9b3a6" }}>Começa <b className="text-white">1º de novembro</b>. Até lá, o ranking continua valendo.</p>
          : <Cronometro aba={aba} fimSemana={fimSemana} />}
      </div>

      {!premio.antes && typeof posicao === "number" && posicao > 0 && (
        <div className="relative mt-3">
          <div className="flex items-center justify-between text-[12px]" style={{ color: "#b9b3a6" }}>
            <span>Você está em <b className="text-white">{posicao}º</b></span>
            {posicao === 1
              ? <span style={{ color: OURO }}><b>Segura até o fim: o prêmio é seu.</b></span>
              : faltaPro1 && faltaPro1 > 0 ? <span>faltam <b style={{ color: OURO }}>{brl0(faltaPro1)}</b> pro 1º</span> : null}
          </div>
          {pct !== null && (
            <div className="h-1.5 rounded-full mt-1.5 overflow-hidden" style={{ background: "rgba(255,255,255,.08)" }}>
              <div className="h-full rounded-full" style={{ width: `${pct}%`, background: `linear-gradient(90deg, #b39500, ${OURO})`, boxShadow: "0 0 10px rgba(245,184,0,.6)" }} />
            </div>
          )}
        </div>
      )}

      <div className="relative mt-3">{abas(true)}</div>
    </section>
  );
}
