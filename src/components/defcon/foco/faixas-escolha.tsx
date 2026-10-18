/* As três faixas do dia como ESCOLHA (antes de começar): Mínimo · Meta · Turbo.
   Padrão Uber Quest (o motorista escolhe a faixa e vê a semana passada) e Duolingo
   (meta escolhida vira compromisso). Depois que o DEFCON começa, a faixa trava e a
   barra vira a FaixasDaMeta de sempre. Puro: recebe tudo por props. */
import { Loader2 } from "lucide-react";
import type { MetaDoDia } from "@/shared/lib/meta-viavel";
import type { FaixaDoDia } from "@/shared/lib/faixa-do-dia";
import { brl0, PRESS } from "./foco-tipos";

const OPCOES: { k: FaixaDoDia; rotulo: string; v: (m: Pick<MetaDoDia, "minimo" | "meta" | "turbo">) => number }[] = [
  { k: "minimo", rotulo: "Mínimo", v: (m) => m.minimo },
  { k: "normal", rotulo: "Meta", v: (m) => m.meta },
  { k: "turbo", rotulo: "Turbo", v: (m) => m.turbo },
];

interface Props {
  m: Pick<MetaDoDia, "minimo" | "meta" | "turbo">;
  escolhida: FaixaDoDia;
  salvando: boolean;
  oculto: boolean;
  onEscolher: (f: FaixaDoDia) => void;
}

export function FaixasEscolha({ m, escolhida, salvando, oculto, onEscolher }: Props) {
  const fim = Math.max(1, m.turbo);
  return (
    <div>
      {/* trilho com as 3 marcas — a mesma régua que o vendedor vai ver rodando */}
      <div className="relative h-[8px] rounded-full" style={{ background: "rgba(255,255,255,.08)" }}>
        {OPCOES.map((o) => (
          <span key={o.k} className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 rounded-[2px]"
            style={{ left: `${Math.min(100, (o.v(m) / fim) * 100)}%`, width: 3, height: 16, background: o.k === escolhida ? "#fff" : "rgba(255,255,255,.35)" }} />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-1.5 mt-3" role="radiogroup" aria-label="Faixa de hoje">
        {OPCOES.map((o) => {
          const on = o.k === escolhida;
          return (
            <button key={o.k} type="button" role="radio" aria-checked={on} disabled={salvando} onClick={() => !on && onEscolher(o.k)}
              className={`h-[46px] rounded-[12px] flex flex-col items-center justify-center ${PRESS} disabled:opacity-70`}
              style={on
                ? { border: "1px solid rgba(245,184,0,.6)", background: "rgba(245,184,0,.1)" }
                : { border: "1px solid rgba(255,255,255,.1)", background: "rgba(0,0,0,.3)" }}>
              <span className="text-[10.5px] font-bold tracking-[.08em] uppercase" style={{ color: on ? "var(--orbis-gold)" : "var(--orbis-fg-3)" }}>
                {salvando && on ? <Loader2 className="w-3 h-3 animate-spin inline" /> : o.rotulo}
              </span>
              <span className="orbis-num text-[13.5px] font-extrabold mt-0.5" style={{ color: on ? "var(--orbis-gold)" : "var(--orbis-fg)" }}>
                {oculto ? "R$ •••" : brl0(o.v(m))}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
