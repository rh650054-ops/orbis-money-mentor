/* Quantas de cada sabor (26/10/2026): contadores por sabor com o total embaixo.
   Usado no "Produzi" e no fim do "Tô no mercado". Puro. */
import { Minus, Plus } from "lucide-react";
import type { Sabor } from "../api/use-sabores";
import { reais } from "./campos";

export function SaboresContadores({ sabores, valores, onMudar, maximo }: {
  sabores: Sabor[]; valores: Record<string, number>; onMudar: (id: string, n: number) => void;
  /** total que não pode passar (o que já está no estoque sem sabor) */
  maximo?: number;
}) {
  const total = sabores.reduce((s, x) => s + (valores[x.id] ?? 0), 0);
  const passou = maximo != null && total > maximo;
  return (
    <div className="flex flex-col">
      {sabores.map((s) => {
        const n = valores[s.id] ?? 0;
        return (
          <div key={s.id} className="flex items-center justify-between gap-2 py-2" style={{ borderTop: "1px solid #1c1a16" }}>
            <div className="min-w-0">
              <p className="text-[14px] font-black truncate">{s.emoji} {s.nome}</p>
              {s.custo > 0 && <p className="text-[11.5px]" style={{ color: "#7b766e" }}>{reais(s.custo)} cada</p>}
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button type="button" aria-label={`Menos ${s.nome}`} onClick={() => onMudar(s.id, Math.max(0, n - 1))}
                className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: "#171512" }}><Minus className="w-4 h-4" /></button>
              <input type="text" inputMode="numeric" aria-label={`Quantas ${s.nome}`} value={n}
                onFocus={(e) => e.currentTarget.select()}
                onChange={(e) => onMudar(s.id, Math.max(0, Math.min(1000000, Number(e.target.value.replace(/\D/g, "")) || 0)))}
                className="w-12 h-9 rounded-[10px] bg-[#1a1a19] text-center outline-none text-[17px] font-black tabular-nums text-[#F4F1EA]" />
              <button type="button" aria-label={`Mais ${s.nome}`} onClick={() => onMudar(s.id, n + 1)}
                className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: "#171512" }}><Plus className="w-4 h-4" /></button>
            </div>
          </div>
        );
      })}
      <p className="text-[12px] font-bold mt-1" style={{ color: passou ? "#FF7A6B" : "#b9b3a6" }}>
        Total: <b className="text-[#F4F1EA]">{total}</b>{maximo != null ? ` de ${maximo}` : ""}{passou ? " · passou do que tem" : ""}
      </p>
    </div>
  );
}
