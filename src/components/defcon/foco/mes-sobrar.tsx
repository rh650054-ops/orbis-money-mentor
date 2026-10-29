/* SOBRAR · no bolso (Rick, 29/10/2026): "a meta do mês continua faturamento, mas o objetivo
   é ter o lucro no bolso". Under the VENDER block of the month card: what stayed with him,
   per unit, and the mission's progress (or the way to define one). Plus the quick tips
   when the month is off pace — each one opens the replanning with that choice. */
import { ChevronRight, HelpCircle, Wallet } from "lucide-react";
import type { MetaDoDia } from "@/shared/lib/meta-viavel";
import type { TipoReplanejar } from "@/components/metas/ReplanejarMes";
import { nomeUnidade, type SobrarMes } from "@/features/objetivo-lucro";
import { brl0, PRESS } from "./foco-tipos";

const OURO = "var(--orbis-gold)";
const brl2 = (n: number) => "R$ " + n.toFixed(2).replace(".", ",");

/** Pocket money the month ends with, if he keeps the pace (the VENDER projection in units). */
export function levaPraCasa(s: SobrarMes, fecha: number): number | null {
  if (s.fonte_custo === "sem_custo" || s.ticket <= 0) return null;
  const unidADiante = Math.max(0, fecha - s.vendas_mes) / s.ticket;
  return s.lucro_mes + unidADiante * s.lucro_unid;
}

export function SobrarLinha({ s, fecha, bate, onDefinirLucro, onProduto }: {
  s: SobrarMes; fecha: number; bate: boolean; onDefinirLucro: () => void; onProduto: () => void;
}) {
  const semCusto = s.fonte_custo === "sem_custo";
  const un = nomeUnidade(s.produto_nome, 1);
  const leva = levaPraCasa(s, fecha);
  const missao = s.missao;
  const pct = missao && missao.alvo > 0 ? Math.min(100, Math.round((missao.lucro / missao.alvo) * 100)) : null;
  return (
    <div className="rounded-[14px] mt-3 px-3 py-2.5" style={{ background: "rgba(245,184,0,.06)", border: "1px solid rgba(245,184,0,.22)" }} aria-label="Sobrar">
      <div className="flex items-center justify-between gap-2">
        <p className="inline-flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-[.14em]" style={{ color: OURO }}><Wallet className="w-3.5 h-3.5" /> Sobrar · no bolso</p>
        {missao && pct !== null
          ? <span className="rounded-full px-2 py-[3px] text-[9.5px] font-black tracking-[.04em]" style={{ color: OURO, background: "rgba(245,184,0,.14)" }}>missão {pct}%</span>
          : <button type="button" onClick={semCusto ? onProduto : onDefinirLucro} className={`inline-flex items-center gap-0.5 text-[11.5px] font-extrabold ${PRESS}`} style={{ color: OURO }}>
              {semCusto ? "cadastrar" : "definir lucro"} <ChevronRight className="w-3.5 h-3.5" strokeWidth={3} />
            </button>}
      </div>
      {semCusto ? (
        <p className="text-[12.5px] mt-1.5 leading-snug" style={{ color: "var(--orbis-fg-2)" }}>
          <HelpCircle className="inline w-3.5 h-3.5 -mt-0.5 mr-1" style={{ color: OURO }} />
          Vendeu <b className="text-foreground">{brl0(s.vendas_mes)}</b>. Quanto é seu? Me diz o que custa a {un} e eu te mostro.
        </p>
      ) : (
        <>
          <p className="orbis-num text-[17px] font-extrabold leading-none mt-1.5"><span className="text-foreground">{brl0(s.lucro_mes)}</span><span className="text-[12px] font-bold" style={{ color: "var(--orbis-fg-3)" }}> limpos · {brl2(s.lucro_unid)} por {un}</span></p>
          <p className="text-[11.5px] mt-1.5 leading-snug" style={{ color: "var(--orbis-fg-2)" }}>
            {missao
              ? <>Missão: <b className="text-foreground">{brl0(missao.lucro)}</b> de {brl0(missao.alvo)} · dia {missao.dia}/{missao.dias}</>
              : leva !== null
                ? <>No seu ritmo, {bate ? "bate a meta e leva" : "fecha o mês com"} <b style={{ color: OURO }}>≈ {brl0(leva)}</b> pra casa.</>
                : null}
          </p>
        </>
      )}
    </div>
  );
}

/** Quick ways to close the gap, as chips. Each opens the replanning on that choice. */
export function DicasMes({ m, onDica }: { m: MetaDoDia; onDica: (t: TipoReplanejar) => void }) {
  const mx = m.maximo;
  const ticket = m.ticket ?? 0;
  const unidFaltam = ticket > 0 ? Math.ceil(Math.max(0, m.precisaDia - m.ritmo) / ticket) : 0;
  const dicas: { t: TipoReplanejar; rotulo: string }[] = [];
  if (mx && mx.diasExtra.length > 0) dicas.push({ t: "dias", rotulo: `+${mx.diasExtra.length} dia${mx.diasExtra.length > 1 ? "s" : ""}` });
  if (mx && mx.blocos > 0) dicas.push({ t: "blocos", rotulo: `${mx.blocos} blocos/dia` });
  if (unidFaltam > 0) dicas.push({ t: "manter", rotulo: `+${unidFaltam}/dia` });
  if (dicas.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
      <span className="text-[10.5px] font-bold" style={{ color: "var(--orbis-fg-3)" }}>Pra bater:</span>
      {dicas.map((d) => (
        <button key={d.t} type="button" onClick={() => onDica(d.t)} className={`h-7 px-2.5 rounded-full text-[11.5px] font-black ${PRESS}`}
          style={{ color: OURO, background: "rgba(245,184,0,.12)", border: "1px solid rgba(245,184,0,.35)" }}>{d.rotulo}</button>
      ))}
    </div>
  );
}
