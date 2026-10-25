/* "Contas em Dia" example: the daily amount (ring), bills filling up, the goal and
   a coin dropping into the month's savings. Illustrative values, labeled as such. */
import { useState } from "react";
import { COR } from "@/shared/components/vant-ui";
import { reaisInteiros, useApareceu, useContador, useIntervalo } from "./use-vitrine-motion";

const CONTAS = [
  { e: "🏠", nome: "Aluguel · R$ 900", sub: "vence dia 10 · faltam 9 dias", pct: 72, tag: "no ritmo" },
  { e: "💡", nome: "Luz e água · R$ 180", sub: "vence dia 15", pct: 55, tag: "no ritmo" },
  { e: "📱", nome: "Celular · R$ 60", sub: "vence dia 20", pct: 100, tag: "separado ✓" },
  { e: "🏍️", nome: "Moto · R$ 6.000", sub: "objetivo · previsão: agosto", pct: 38, tag: "38%", meta: true },
];
const C = 2 * Math.PI * 40; // ring circumference

export function VitrineContas() {
  const [ref, visto] = useApareceu<HTMLDivElement>();
  const dia = useContador(86, visto, 1400);
  const cofre = useContador(1240, visto, 1800);
  const [moeda, setMoeda] = useState(0);
  useIntervalo(() => setMoeda((m) => m + 1), 5200, visto);
  const arco = (v: number, atraso: string) => ({ strokeDasharray: `${visto ? v : 0} ${C}`, transition: `stroke-dasharray 1.4s cubic-bezier(.2,.8,.2,1) ${atraso}` });

  return (
    <div ref={ref} className="rounded-[20px] p-3.5" style={{ background: "linear-gradient(170deg,#141008,#0b0b0c 75%)", border: "1px solid rgba(245,184,0,.35)" }}>
      <div className="grid grid-cols-[96px_1fr] gap-3.5 items-center">
        <div className="relative w-24 h-24">
          <svg viewBox="0 0 96 96" className="w-24 h-24 -rotate-90" aria-hidden>
            <circle cx="48" cy="48" r="40" fill="none" strokeWidth="10" stroke="#1d1b16" />
            <circle cx="48" cy="48" r="40" fill="none" strokeWidth="10" strokeLinecap="round" stroke="#FFC800" style={arco(C * 0.7, "0s")} />
            <circle cx="48" cy="48" r="40" fill="none" strokeWidth="10" strokeLinecap="round" stroke="#4FB3FF" strokeDashoffset={-C * 0.7} style={arco(C * 0.3, ".25s")} />
          </svg>
          <span className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-[22px] font-black tabular-nums leading-none" style={{ color: "#FFC800" }}>{reaisInteiros(dia)}</span>
            <span className="text-[9px] font-extrabold tracking-[.08em] mt-0.5" style={{ color: COR.apagado }}>SUA DIÁRIA</span>
          </span>
        </div>
        <div>
          <b className="block text-[15px] font-black">Guarde isso hoje e o mês fecha.</b>
          <p className="text-[11.5px] mt-1 leading-snug" style={{ color: COR.suave }}>A VANT divide suas contas e seu objetivo pelos dias que faltam, com base no que você vende.</p>
          <p className="flex gap-2.5 mt-2 text-[11px] font-extrabold">
            <span className="inline-flex items-center gap-1"><i className="w-2 h-2 rounded-[2px]" style={{ background: "#FFC800" }} />R$ 60 contas</span>
            <span className="inline-flex items-center gap-1"><i className="w-2 h-2 rounded-[2px]" style={{ background: "#4FB3FF" }} />R$ 26 moto</span>
          </p>
        </div>
      </div>
      <div className="grid gap-2 mt-3.5">
        {CONTAS.map((c, i) => (
          <div key={c.nome} className="grid grid-cols-[30px_1fr_auto] gap-2.5 items-center rounded-[14px] px-2.5 py-2 transition-all duration-500"
            style={{ background: "#0a0a0a", border: `1px solid ${COR.borda}`, opacity: visto ? 1 : 0, transform: visto ? "none" : "translateX(-12px)", transitionDelay: `${400 + i * 260}ms` }}>
            <span className="w-[30px] h-[30px] rounded-[9px] grid place-items-center text-[15px]" style={{ background: "#16140f" }}>{c.e}</span>
            <span className="min-w-0">
              <span className="block text-[12.5px] font-extrabold">{c.nome}</span>
              <span className="block text-[10.5px] font-bold" style={{ color: COR.apagado }}>{c.sub}</span>
              <span className="block h-[5px] rounded-full mt-1 overflow-hidden" style={{ background: "#1d1b16" }}>
                <i className="block h-full rounded-full transition-[width] duration-[1400ms]" style={{ width: visto ? `${c.pct}%` : 0, transitionDelay: `${550 + i * 260}ms`, background: c.meta ? "linear-gradient(90deg,#0095F6,#4FB3FF)" : "linear-gradient(90deg,#d9a800,#FFC800)" }} />
              </span>
            </span>
            <span className="text-[10px] font-black rounded-full px-2 py-[3px] whitespace-nowrap" style={c.meta ? { background: "rgba(79,179,255,.14)", color: "#4FB3FF" } : { background: "rgba(61,214,140,.14)", color: COR.ok }}>{c.tag}</span>
          </div>
        ))}
      </div>
      <div className="relative mt-3 flex items-center justify-between rounded-[14px] px-3 py-2.5" style={{ background: "rgba(255,200,0,.07)", border: "1px dashed rgba(255,200,0,.4)" }}>
        <b className="text-[12px] font-extrabold" style={{ color: COR.suave }}>Separado este mês</b>
        <span className="text-[22px] font-black tabular-nums" style={{ color: "#FFC800" }}>{reaisInteiros(cofre)}</span>
        {moeda > 0 && <span key={`m${moeda}`} aria-hidden className="vv-moeda absolute right-[58px] -top-[26px] w-5 h-5 rounded-full" style={{ background: "radial-gradient(circle at 35% 30%,#FFF4C2,#FFC800 55%,#a37b00)", boxShadow: "0 0 10px rgba(255,200,0,.7)" }} />}
        {moeda > 0 && <span key={`p${moeda}`} aria-hidden className="vv-sobe absolute right-3 -top-[18px] text-[11px] font-black opacity-0" style={{ color: COR.ok }}>+ R$ 86 hoje</span>}
      </div>
      <p className="text-[10.5px] mt-2" style={{ color: COR.apagado }}>Exemplo. Se o ritmo não der pra conta, a VANT mostra a diferença e ajuda a ajustar o plano.</p>
    </div>
  );
}
