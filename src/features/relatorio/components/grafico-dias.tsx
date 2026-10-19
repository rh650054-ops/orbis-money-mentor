import { useEffect, useMemo, useState } from "react";
import type { Resumo } from "../lib/derivar";
import { addDias, brl, ddmm, diasEntre, fmtMin, semanaCurta } from "../lib/periodo";
import { Cartao, Secao } from "./ui-bits";

const cap = (s: string) => s[0]!.toUpperCase() + s.slice(1);
const curto = (v: number) => (v >= 10000 ? `R$ ${(v / 1000).toFixed(1).replace(".", ",")}k` : brl(v));

/** Gráfico dia a dia (voltou, Rick 19/10): uma barra por dia do período, do tamanho de
 *  antes. Tocar num dia acende a barra e mostra o dia logo abaixo, com o atalho pra
 *  abrir o relatório só daquele dia. Sem toque, o destaque é o melhor dia. */
export function GraficoDias({ r, onAbrirDia }: { r: Resumo; onAbrirDia: (dia: string) => void }) {
  const { de, ate } = r.periodo;
  const n = diasEntre(de, ate);
  const dias = useMemo(() => {
    const porDia = new Map(r.dias.lista.map((d) => [d.dia, d]));
    return Array.from({ length: Math.min(n, 62) }, (_, i) => { const dia = addDias(de, i); return { dia, row: porDia.get(dia) ?? null }; });
  }, [r.dias.lista, de, n]);
  const [tocado, setTocado] = useState<string | null>(null);
  const [cresceu, setCresceu] = useState(false);
  useEffect(() => { const id = requestAnimationFrame(() => setCresceu(true)); return () => cancelAnimationFrame(id); }, []);
  useEffect(() => { setTocado(null); }, [de, ate]);

  if (n < 2 || n > 62 || !dias.some((d) => (d.row?.vendido ?? 0) > 0)) return null;
  const max = Math.max(1, ...dias.map((d) => d.row?.vendido ?? 0));
  const destaque = tocado ?? r.dias.melhor?.dia ?? null;
  const sel = dias.find((d) => d.dia === destaque)?.row ?? null;
  const rotulo = (dia: string, i: number) => (n <= 7 ? cap(semanaCurta(dia)).slice(0, 3) : n <= 14 || i === 0 || i === n - 1 || i % 5 === 0 ? String(+dia.slice(8, 10)) : "");

  return (
    <Secao kicker="Dia a dia" right={`${r.diasNaRua} ${r.diasNaRua === 1 ? "dia" : "dias"} na rua`}>
      <Cartao className="orbis-num">
        <div className="flex items-end gap-[5px]" style={{ height: 168 }}>
          {dias.map((d) => {
            const v = d.row?.vendido ?? 0;
            const aceso = d.dia === destaque;
            return (
              <button key={d.dia} type="button" onClick={() => setTocado(tocado === d.dia ? null : d.dia)}
                aria-label={`${ddmm(d.dia)}: ${brl(v)}`} aria-pressed={aceso}
                className="orbis-press flex h-full min-w-0 flex-1 flex-col items-center justify-end">
                {aceso && <span className="mb-1 whitespace-nowrap text-[11px] font-bold leading-tight" style={{ color: "var(--orbis-gold)" }}>{curto(v)}</span>}
                <span className="block w-full rounded-t-md" style={{
                  height: cresceu ? `${v > 0 ? Math.max(8, (v / max) * 100) : 4}%` : "4%",
                  transition: "height 600ms cubic-bezier(0.2,0,0,1), background 200ms",
                  background: aceso ? "linear-gradient(180deg,var(--orbis-gold),var(--orbis-gold-deep,#B88700))" : v > 0 ? "rgba(255,255,255,.22)" : "rgba(255,255,255,.08)",
                  boxShadow: aceso ? "0 0 16px -4px rgba(245,184,0,.6)" : undefined,
                }} />
              </button>
            );
          })}
        </div>
        <div className="mt-1.5 flex gap-[5px]">
          {dias.map((d, i) => (
            <span key={d.dia} className="flex-1 text-center text-[10.5px] font-semibold" style={{ color: d.dia === destaque ? "var(--orbis-gold)" : "hsl(var(--muted-foreground))" }}>{rotulo(d.dia, i)}</span>
          ))}
        </div>

        {destaque && (
          <div className="mt-3 rounded-2xl bg-secondary p-3.5">
            <div className="flex items-baseline justify-between gap-2">
              <b className="text-[15px]">{cap(semanaCurta(destaque))} {ddmm(destaque)}{!tocado ? " · seu melhor dia" : ""}</b>
              <b className="text-[20px]" style={{ color: "var(--orbis-gold)" }}>{brl(sel?.vendido ?? 0)}</b>
            </div>
            {sel ? (
              <p className="mt-1 text-[13px] text-muted-foreground">
                caiu <b className="text-[var(--orbis-ok)]">{brl(sel.caiu)}</b>
                {sel.faltou > 0 ? <> · calote <b className="text-[var(--orbis-calote)]">{brl(sel.faltou)}</b></> : null}
                {" · "}{sel.vendas} vendas{sel.abordagens > 0 ? ` em ${sel.abordagens} abordagens (${sel.conv ?? 0}%)` : ""}
                {sel.worked_min > 0 ? ` · ${fmtMin(sel.worked_min)} na rua` : ""}
              </p>
            ) : <p className="mt-1 text-[13px] text-muted-foreground">Sem venda nesse dia.</p>}
            {sel && (
              <button type="button" onClick={() => onAbrirDia(destaque)} className="orbis-press mt-2.5 text-[13px] font-bold text-primary">
                Ver o relatório desse dia ›
              </button>
            )}
          </div>
        )}
        <p className="mt-2 text-center text-[10.5px] text-muted-foreground">toque em um dia pra ver quanto você fez</p>
      </Cartao>
    </Secao>
  );
}
