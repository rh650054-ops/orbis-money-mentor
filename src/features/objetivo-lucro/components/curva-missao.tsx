/* Big chart: cumulative profit of the plan (gold) vs his average pace (grey) vs the
   target line (dashed). One glance shows the gap the mission closes. */
import type { Cronograma } from "../lib/cronograma";
import { brl0 } from "../lib/formato";
import { COR } from "./ui";

const W = 340; const H = 190; const PAD = { l: 8, r: 8, t: 26, b: 24 };

export function CurvaMissao({ c, alvo }: { c: Cronograma; alvo: number }) {
  const n = c.dias.length;
  const max = Math.max(alvo, c.dias[n - 1]?.acumulado ?? 0) * 1.08;
  const x = (i: number) => PAD.l + (i / Math.max(1, n - 1)) * (W - PAD.l - PAD.r);
  const y = (v: number) => H - PAD.b - (v / max) * (H - PAD.t - PAD.b);
  const linha = (f: (d: Cronograma["dias"][number]) => number) => c.dias.map((d, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(f(d)).toFixed(1)}`).join(" ");
  const plano = linha((d) => d.acumulado);
  const media = linha((d) => d.acumuladoMedia);
  const area = `${plano} L${x(n - 1).toFixed(1)},${(H - PAD.b).toFixed(1)} L${x(0).toFixed(1)},${(H - PAD.b).toFixed(1)} Z`;
  const fimMedia = c.dias[n - 1]?.acumuladoMedia ?? 0;
  const yAlvo = y(alvo);
  const marcos = [0, Math.floor((n - 1) / 2), n - 1];
  const dia = (i: number) => { const d = c.dias[i]; return d ? d.data.slice(8, 10) + "/" + d.data.slice(5, 7) : ""; };

  return (
    <section className="vant-hud mt-3 rounded-[22px] px-4 pt-4 pb-3 overflow-hidden" style={{ border: "1px solid rgba(245,184,0,.3)" }}>
      <span className="vant-canto" />
      <div className="flex items-center justify-between gap-2">
        <p className="orbis-section inline-flex items-center gap-2" style={{ color: COR.ouro }}><span className="w-4 h-px" style={{ background: COR.ouro }} /> Curva da missão</p>
        <p className="orbis-num text-[10.5px] font-bold" style={{ color: COR.mute }}>lucro acumulado · {n} dias</p>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full mt-2" role="img" aria-label={`Plano chega a ${brl0(alvo)}; na média chegaria a ${brl0(fimMedia)}`}>
        <defs>
          <linearGradient id="vantArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={COR.ouro} stopOpacity=".35" />
            <stop offset="100%" stopColor={COR.ouro} stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((f) => <line key={f} x1={PAD.l} x2={W - PAD.r} y1={y(max * f)} y2={y(max * f)} stroke="rgba(255,255,255,.06)" />)}
        <line x1={PAD.l} x2={W - PAD.r} y1={yAlvo} y2={yAlvo} stroke={COR.verde} strokeDasharray="5 5" strokeWidth="1.5" />
        <text x={W - PAD.r} y={yAlvo - 6} textAnchor="end" fontSize="11" fontWeight="800" fill={COR.verde}>ALVO {brl0(alvo)}</text>
        <path d={area} fill="url(#vantArea)" />
        <path d={media} fill="none" stroke="rgba(255,255,255,.35)" strokeWidth="2" strokeDasharray="3 4" />
        <path d={plano} fill="none" stroke={COR.ouro} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ filter: `drop-shadow(0 0 6px ${COR.ouro}88)` }} />
        {c.dias.map((d, i) => d.trabalha ? <circle key={d.data} cx={x(i)} cy={y(d.acumulado)} r="3" fill="#0b0b0d" stroke={COR.ouro} strokeWidth="2" /> : null)}
        <text x={x(n - 1)} y={y(fimMedia) + 14} textAnchor="end" fontSize="10.5" fontWeight="700" fill="rgba(255,255,255,.55)">na média {brl0(fimMedia)}</text>
        {marcos.map((i) => <text key={i} x={x(i)} y={H - 6} textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"} fontSize="10.5" fontWeight="700" fill={COR.mute}>{dia(i)}</text>)}
      </svg>
      <div className="flex items-center gap-4 mt-1 text-[11px] font-bold" style={{ color: COR.sub }}>
        <span className="inline-flex items-center gap-1.5"><span className="w-4 h-[3px] rounded-full" style={{ background: COR.ouro }} /> plano da missão</span>
        <span className="inline-flex items-center gap-1.5"><span className="w-4 h-[2px] rounded-full" style={{ background: "rgba(255,255,255,.4)" }} /> seu ritmo atual</span>
      </div>
    </section>
  );
}
