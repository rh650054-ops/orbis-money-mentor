/* Trilha dos blocos (Rick, 10/09): cada hora é um degrau — feito, agora, a fazer.
   Só aparece com o DEFCON rodando ou encerrado. */
import { Check } from "lucide-react";
import { brl0 } from "./foco-tipos";

export interface Bloco { i: number; vendido: number; vendas: number; rodando: boolean; feito: boolean }

export function BlocosDeHoje({ blocos, total, dailyGoal, rodandoAgora }: { blocos: Bloco[]; total: number; dailyGoal: number; rodandoAgora: boolean }) {
  if (blocos.length === 0) return null;
  const tot = Math.max(blocos.length, total);
  const metaBloco = dailyGoal / Math.max(1, tot);
  const porIndice = new Map(blocos.map((b) => [b.i, b]));
  const linhas: Bloco[] = Array.from({ length: tot }, (_, i) => porIndice.get(i) ?? { i, vendido: 0, vendas: 0, rodando: false, feito: false });
  return (
    <section className="mt-6 px-0.5" aria-label="Blocos de hoje">
      <p className="orbis-mini">Blocos de hoje</p>
      <div className="mt-2.5 flex flex-col">
        {linhas.map((b, idx) => {
          const pct = metaBloco > 0 ? Math.min(100, (b.vendido / metaBloco) * 100) : 0;
          const agora = b.rodando && rodandoAgora;
          const pendente = !b.feito && !b.rodando;
          return (
            <div key={b.i} className="flex items-stretch gap-3">
              <div className="flex flex-col items-center w-8 shrink-0">
                <span className="w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-black shrink-0"
                  style={b.feito
                    ? { background: "rgba(61,214,140,.16)", border: "1px solid rgba(61,214,140,.5)", color: "var(--orbis-ok)" }
                    : agora ? { background: "rgba(245,184,0,.18)", border: "1px solid rgba(245,184,0,.6)", color: "var(--orbis-gold)" }
                    : { background: "rgba(255,255,255,.04)", border: "1px dashed rgba(255,255,255,.18)", color: "var(--orbis-fg-3)" }}>
                  {b.feito ? <Check className="w-4 h-4" strokeWidth={3} /> : b.i + 1}
                </span>
                {idx < linhas.length - 1 && <span className="flex-1 w-px my-1" style={{ background: b.feito ? "rgba(61,214,140,.45)" : "rgba(255,255,255,.12)", minHeight: 14 }} />}
              </div>
              <div className="flex-1 min-w-0 pb-2.5">
                <div className="rounded-[14px] px-3.5 py-2.5" style={agora ? { border: "1px solid rgba(245,184,0,.34)", background: "linear-gradient(180deg,#171203, var(--orbis-surface, #111))" } : { border: "1px solid var(--orbis-line)", background: "var(--orbis-surf)" }}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[13px] font-extrabold" style={pendente ? { color: "var(--orbis-fg-3)" } : undefined}>
                      Bloco {b.i + 1}{agora && <span className="ml-2 text-[10px] font-black tracking-[.14em] uppercase" style={{ color: "var(--orbis-gold)" }}>agora</span>}
                    </span>
                    <span className="orbis-num text-[14px] font-extrabold" style={{ color: b.feito ? "var(--orbis-ok)" : agora ? "var(--orbis-gold)" : "var(--orbis-fg-3)" }}>
                      {pendente ? `${brl0(metaBloco)} a fazer` : `${brl0(b.vendido)}${metaBloco > 0 ? ` de ${brl0(metaBloco)}` : ""}`}
                    </span>
                  </div>
                  {!pendente && (
                    <div className="h-1.5 rounded-full mt-2 overflow-hidden" style={{ background: "rgba(255,255,255,.08)" }}>
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: b.feito ? "#3DD68C" : "#F5B800", transition: "width 600ms cubic-bezier(.2,0,0,1)" }} />
                    </div>
                  )}
                  {!pendente && b.vendas > 0 && <p className="text-[11px] mt-1.5" style={{ color: "var(--orbis-fg-3)" }}>{b.vendas} {b.vendas === 1 ? "venda" : "vendas"} · {Math.round(pct)}% do bloco</p>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
