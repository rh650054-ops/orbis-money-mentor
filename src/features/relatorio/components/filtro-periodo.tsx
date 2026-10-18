import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
import { cn } from "@/shared/lib/utils";
import type { Periodo, Preset } from "../types";
import { hojeBR, periodoDoPreset, rotuloAnterior, rotuloPeriodo } from "../lib/periodo";

const CHIPS: { preset: Preset; rotulo: string }[] = [
  { preset: "hoje", rotulo: "Hoje" },
  { preset: "ontem", rotulo: "Ontem" },
  { preset: "semana", rotulo: "Semana" },
  { preset: "mes", rotulo: "Mês" },
];
const OUTROS: { preset: Preset; rotulo: string }[] = [
  { preset: "7d", rotulo: "Últimos 7 dias" },
  { preset: "30d", rotulo: "Últimos 30 dias" },
];
const ehOutro = (p: Preset) => p === "7d" || p === "30d" || p === "custom";

/** Hoje · Ontem · Semana · Mês · Outro ▾ (7 dias, 30 dias, personalizado). */
export function FiltroPeriodo({ periodo, onChange, diasNaRua }: { periodo: Periodo; onChange: (p: Periodo) => void; diasNaRua: number }) {
  const [aberto, setAberto] = useState(false);
  const [de, setDe] = useState(periodo.de);
  const [ate, setAte] = useState(periodo.ate);
  const hoje = hojeBR();
  const chip = "orbis-press shrink-0 rounded-full border px-3.5 py-2 text-[13px] font-semibold transition-colors";
  const on = "border-primary bg-primary text-primary-foreground shadow-[0_2px_0_var(--orbis-gold-deep)]";
  const off = "border-border text-muted-foreground";

  return (
    <div className="space-y-2.5">
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none]" role="tablist">
        {CHIPS.map((c) => (
          <button key={c.preset} role="tab" aria-selected={periodo.preset === c.preset} className={cn(chip, periodo.preset === c.preset ? on : off)}
            onClick={() => onChange(periodoDoPreset(c.preset, hoje))}>
            {c.rotulo}
          </button>
        ))}
        <Popover open={aberto} onOpenChange={setAberto}>
          <PopoverTrigger asChild>
            <button role="tab" aria-selected={ehOutro(periodo.preset)} className={cn(chip, ehOutro(periodo.preset) ? on : off)}>
              {periodo.preset === "7d" ? "7 dias ▾" : periodo.preset === "30d" ? "30 dias ▾" : periodo.preset === "custom" ? "Período ▾" : "Outro ▾"}
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-64 space-y-2 p-3">
            {OUTROS.map((o) => (
              <button key={o.preset} className={cn("w-full rounded-xl px-3 py-2.5 text-left text-sm font-semibold", periodo.preset === o.preset ? "bg-primary text-primary-foreground" : "bg-secondary")}
                onClick={() => { onChange(periodoDoPreset(o.preset, hoje)); setAberto(false); }}>
                {o.rotulo}
              </button>
            ))}
            <div className="rounded-xl bg-secondary p-3">
              <p className="mb-2 text-xs font-semibold text-muted-foreground">Personalizado</p>
              <div className="grid grid-cols-2 gap-2">
                <label className="text-[11px] text-muted-foreground">De
                  <input id="relatorio-de" type="date" max={hoje} value={de} onChange={(e) => setDe(e.target.value)} className="mt-1 block w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-foreground" />
                </label>
                <label className="text-[11px] text-muted-foreground">Até
                  <input id="relatorio-ate" type="date" max={hoje} value={ate} onChange={(e) => setAte(e.target.value)} className="mt-1 block w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-foreground" />
                </label>
              </div>
              <button className="orbis-press mt-2 w-full rounded-xl bg-primary py-2 text-sm font-bold text-primary-foreground"
                disabled={!de || !ate}
                onClick={() => { onChange(periodoDoPreset("custom", hoje, { de, ate })); setAberto(false); }}>
                Aplicar
              </button>
            </div>
          </PopoverContent>
        </Popover>
      </div>
      <div className="flex items-center justify-between gap-2 text-[12.5px] text-muted-foreground">
        <span><b className="orbis-num font-semibold text-foreground">{rotuloPeriodo(periodo)}</b>{diasNaRua > 0 && periodo.de !== periodo.ate ? ` · ${diasNaRua} ${diasNaRua === 1 ? "dia" : "dias"} na rua` : ""}</span>
        <span className="rounded-full border border-border bg-secondary px-2.5 py-1 text-xs font-semibold text-foreground">vs <span className="text-primary">{rotuloAnterior(periodo)}</span></span>
      </div>
    </div>
  );
}
