/* 1 · Header: title, active month, horizontal month picker, search/filters. */
import { useEffect, useRef } from "react";
import { Search } from "lucide-react";
import { COR, haptic } from "@/components/financas/planejar/ui";
import { mesCurto } from "../lib/raiox";

const nomeMes = (iso: string) => new Date(`${iso.slice(0, 7)}-15T12:00:00Z`).toLocaleDateString("pt-BR", { month: "long", timeZone: "UTC" });
const rotulo = (iso: string, atual: string) => (iso.slice(0, 4) === atual.slice(0, 4) ? mesCurto(iso) : `${mesCurto(iso)}/${iso.slice(2, 4)}`);

export function Cabecalho({ mes, atual, meses, onMes, onBuscar }: {
  mes: string; atual: string; meses: string[]; onMes: (m: string) => void; onBuscar: () => void;
}) {
  const ativo = useRef<HTMLButtonElement | null>(null);
  useEffect(() => { ativo.current?.scrollIntoView({ inline: "center", block: "nearest" }); }, [mes]);
  return (
    <header className="flex flex-col gap-2">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-black leading-tight" style={{ color: COR.texto }}>Raio-X financeiro</h1>
          <p className="text-[14px] font-semibold capitalize" style={{ color: COR.sub }}>{nomeMes(mes)}</p>
        </div>
        <button type="button" onClick={() => { haptic(); onBuscar(); }} aria-label="Buscar movimentação e filtrar"
          className="h-11 px-3 rounded-[12px] border inline-flex items-center gap-1.5 text-[14px] font-bold transition-transform duration-100 active:scale-[0.97]"
          style={{ background: COR.surface2, borderColor: COR.borda, color: COR.texto }}>
          <Search className="w-4 h-4" /> Buscar
        </button>
      </div>
      {meses.length > 1 && (
        <div className="flex gap-1.5 overflow-x-auto -mx-1 px-1 pb-1" role="tablist" aria-label="Mês">
          {meses.map((m) => {
            const on = m === mes;
            return (
              <button key={m} ref={on ? ativo : undefined} type="button" role="tab" aria-selected={on} onClick={() => { haptic(); onMes(m); }}
                className="shrink-0 min-h-9 px-3 rounded-full text-[13px] font-bold transition-colors duration-150"
                style={on ? { background: COR.ouro, color: "#141005" } : { background: COR.surface2, color: m === atual ? COR.texto : COR.sub }}>
                {rotulo(m, atual)}
              </button>
            );
          })}
        </div>
      )}
    </header>
  );
}
