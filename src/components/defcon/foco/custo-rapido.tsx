/* Custo rápido: abas Mercadoria / Transporte / Almoço, um campo, um botão, e o
   atalho "Repetir R$ X de ontem" (Kyte: duplicar a saída é o jeito mais rápido de
   lançar o custo que se repete). Histórico discreto embaixo. */
import { Bus, Package, Plus, RotateCcw, Utensils } from "lucide-react";
import { MoneyInput } from "@/shared/ui/money-input";
import { CustoRapidoHistorico } from "./custo-rapido-historico";
import { brl0, CATEGORIAS_CUSTO, PRESS, type CategoriaCusto, type EstadoFoco } from "./foco-tipos";

const ICONE: Record<CategoriaCusto, typeof Package> = { mercadoria: Package, transporte: Bus, alimentacao: Utensils };

export interface CustosDia { mercadoria: number; transporte: number; alimentacao: number }

interface Props {
  estado: EstadoFoco;
  categoria: CategoriaCusto;
  valor: string;
  hoje: CustosDia;
  ontem: CustosDia;
  onCategoria: (c: CategoriaCusto) => void;
  onValor: (v: string) => void;
  onLancar: () => void;
  onRepetir: (c: CategoriaCusto, v: number) => void;
  onChanged: () => void;
}

export function CustoRapido({ estado, categoria, valor, hoje, ontem, onCategoria, onValor, onLancar, onRepetir, onChanged }: Props) {
  const totalHoje = hoje.mercadoria + hoje.transporte + hoje.alimentacao;
  const deOntem = ontem[categoria];
  const cat = CATEGORIAS_CUSTO.find((c) => c.id === categoria)!;
  const lancados = CATEGORIAS_CUSTO.filter((c) => hoje[c.id] > 0);
  return (
    <div className="rounded-[20px] border px-4 py-3.5" style={{ borderColor: "var(--orbis-line)", background: "var(--orbis-surf)" }}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[14.5px] font-extrabold">Custo rápido</p>
        {estado === "encerrado" && <p className="text-[11.5px]" style={{ color: "var(--orbis-fg-3)" }}>esqueceu algum custo?</p>}
      </div>
      <div className="grid grid-cols-3 gap-1.5 mt-3 p-1 rounded-[14px]" style={{ background: "rgba(0,0,0,.4)", border: "1px solid var(--orbis-line)" }} role="tablist" aria-label="Tipo de custo">
        {CATEGORIAS_CUSTO.map((c) => {
          const Icon = ICONE[c.id];
          const on = categoria === c.id;
          return (
            <button key={c.id} type="button" role="tab" aria-selected={on} onClick={() => onCategoria(c.id)}
              className="h-[38px] rounded-[11px] inline-flex items-center justify-center gap-1.5 text-[12.5px] font-bold transition-colors duration-150"
              style={on ? { background: "#1f1a0a", color: "var(--orbis-fg)", border: "1px solid rgba(245,184,0,.45)" } : { color: "var(--orbis-fg-3)", border: "1px solid transparent" }}>
              <Icon className="w-3.5 h-3.5" style={on ? { color: "var(--orbis-gold)" } : undefined} />{c.label}
            </button>
          );
        })}
      </div>
      <div className="flex gap-2 mt-2.5">
        <MoneyInput value={parseFloat(valor) || 0} onChange={(n) => onValor(n ? String(n) : "")} placeholder={cat.placeholder}
          className="flex-1 min-w-0 h-12 bg-background border border-border rounded-[14px] px-3.5 text-[15px] font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary placeholder:text-muted-foreground placeholder:font-medium placeholder:text-[13px]" />
        <button type="button" onClick={onLancar} disabled={!valor || parseFloat(valor) <= 0} className={`shrink-0 h-12 px-4 rounded-[14px] font-extrabold text-[13.5px] inline-flex items-center gap-1.5 disabled:opacity-40 ${PRESS}`} style={{ background: "linear-gradient(180deg,var(--orbis-gold-light),var(--orbis-gold))", color: "#1a1200" }}>
          <Plus className="w-4 h-4" strokeWidth={3} /> Lançar
        </button>
      </div>
      {deOntem > 0 && (
        <button type="button" onClick={() => onRepetir(categoria, deOntem)} className={`mt-2.5 inline-flex items-center gap-1.5 h-[30px] px-2.5 rounded-full text-[12px] font-bold ${PRESS}`} style={{ border: "1px solid rgba(245,184,0,.35)", background: "rgba(245,184,0,.1)", color: "var(--orbis-gold)" }}>
          <RotateCcw className="w-3 h-3" strokeWidth={2.6} /> Repetir {brl0(deOntem)} de ontem
        </button>
      )}
      <div className="flex items-center justify-between gap-2 mt-3 text-[12px]" style={{ color: "var(--orbis-fg-3)" }}>
        <span className="truncate">{lancados.length ? <>Hoje: {lancados.map((c, i) => <span key={c.id}>{i ? " · " : ""}<b style={{ color: "var(--orbis-fg-2)" }}>{c.label} {brl0(hoje[c.id])}</b></span>)}</> : "Nenhum custo lançado hoje"}</span>
        {totalHoje > 0 && lancados.length > 1 && <b className="orbis-num shrink-0" style={{ color: "var(--orbis-custo)" }}>{brl0(totalHoje)}</b>}
      </div>
      <div className="mt-2"><CustoRapidoHistorico onChanged={onChanged} /></div>
    </div>
  );
}
