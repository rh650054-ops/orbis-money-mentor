/* "Ver o dia a dia" (Rick, 01/11/2026): "eu só faço uma vez, mas queria poder ir acompanhando".
   The accepted plan as a calendar: each work day shows units, revenue and profit planned;
   days gone show what he really sold (green when the day's target was hit); today is outlined;
   rest days say "folga". Same look as the planning calendar. */
import { Check } from "lucide-react";
import type { Desafio } from "../types";
import { nomeUnidade } from "../lib/plano";
import { brl0 } from "../lib/formato";
import { COR } from "./ui";

const DOW = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];
const hojeIso = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });

export function DiaADia({ d }: { d: Desafio }) {
  const un = nomeUnidade(d.analise.produto_nome);
  const preco = d.custo_unid + d.lucro_unid;
  const feito = new Map(d.dias.map((x) => [x.dia, x]));
  const hoje = hojeIso();
  return (
    <div className="grid grid-cols-3 gap-2" aria-label="Plano dia a dia">
      {d.plano.map((p) => {
        const [y, m, dd] = p.d.split("-").map(Number);
        const dow = DOW[new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, dd ?? 1)).getUTCDay()];
        const real = feito.get(p.d);
        const passou = p.d < hoje;
        const ehHoje = p.d === hoje;
        const bateu = real !== undefined && p.t && real.unid >= p.u;
        const borda = ehHoje ? COR.texto : bateu ? "rgba(61,214,140,.6)" : p.t ? "rgba(245,184,0,.45)" : COR.linha;
        return (
          <div key={p.d} className="rounded-[14px] px-2.5 py-2 min-h-[96px] flex flex-col"
            style={{ background: p.t ? "linear-gradient(180deg,rgba(245,184,0,.09),#0b0b0d 70%)" : "#0b0b0d", border: `1.5px solid ${borda}`, opacity: passou && !real && p.t ? 0.6 : 1 }}>
            <p className="text-[10.5px] font-black tracking-[.08em] flex items-center justify-between" style={{ color: ehHoje ? COR.texto : COR.mute }}>
              <span>{dow} {String(dd).padStart(2, "0")}</span>
              {ehHoje ? <span style={{ color: COR.ouro }}>HOJE</span> : bateu ? <Check className="w-3.5 h-3.5" style={{ color: COR.verde }} strokeWidth={3} /> : null}
            </p>
            {!p.t ? (
              <p className="m-auto text-[13px] font-bold" style={{ color: COR.mute }}>folga{real ? ` · +${real.unid}` : ""}</p>
            ) : (
              <>
                <p className="vant-missao-num text-[26px] leading-none mt-1" style={{ color: bateu ? COR.verde : COR.ouro }}>
                  {real ? real.unid : p.u}<span className="text-[11px] font-bold ml-1" style={{ color: COR.sub }}>{real ? `/${p.u}` : un}</span>
                </p>
                <p className="orbis-num text-[11.5px] font-bold mt-auto" style={{ color: COR.texto }}>{brl0(p.u * preco)}</p>
                <p className="orbis-num text-[11px] font-bold" style={{ color: COR.verde }}>+{brl0(real ? real.lucro : p.u * d.lucro_unid)} lucro</p>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
