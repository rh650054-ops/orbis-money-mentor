/* Aba Estoque: quanto tem em mercadoria, o que precisa repor e a ficha técnica. */
import { ChevronRight } from "lucide-react";
import type { ProdutoComFaixas } from "../types";
import { reais } from "./campos";
import { estoqueBaixo } from "./produto-card";

export function AbaEstoque({ produtos, onRepor, onFicha }: {
  produtos: ProdutoComFaixas[]; onRepor: (id: string) => void; onFicha: () => void;
}) {
  const controlados = produtos.filter((p) => p.controla_estoque !== false);
  const valor = controlados.reduce((s, p) => s + Math.max(0, p.stock_quantity) * Math.max(0, p.cost), 0);
  const ordem = [...controlados].sort((a, b) => Number(estoqueBaixo(b)) - Number(estoqueBaixo(a)) || a.stock_quantity - b.stock_quantity);
  return (
    <div className="flex flex-col gap-2.5">
      <div className="rounded-[18px] px-4 py-3.5 flex justify-between items-center" style={{ background: "#0f0f10", border: "1px solid #26241f" }}>
        <span className="text-[13px] font-extrabold" style={{ color: "#b9b3a6" }}>Você tem em mercadoria</span>
        <span className="text-xl font-black">{reais(valor)}</span>
      </div>
      {ordem.map((p) => {
        const baixo = estoqueBaixo(p);
        return (
          <div key={p.id} className="rounded-2xl px-3.5 py-3 flex items-center gap-3"
            style={{ background: "#0f0f10", border: `1px solid ${baixo ? "rgba(255,154,77,.45)" : "#26241f"}` }}>
            <span className="text-xl">{p.emoji ?? "📦"}</span>
            <span className="flex-1 min-w-0 flex flex-col">
              <span className="text-sm font-black truncate">{p.name}</span>
              <span className="text-xs font-bold" style={{ color: baixo ? "#ff9a4d" : "#7b766e" }}>
                {p.stock_quantity} un{p.cost > 0 ? ` · ${reais(p.stock_quantity * p.cost)}` : ""}
              </span>
            </span>
            <button type="button" onClick={() => onRepor(p.id)} className="rounded-full px-3 py-1.5 text-xs font-black"
              style={baixo ? { background: "#F5B800", color: "#1A1200" } : { background: "#121211", border: "1px solid #26241f" }}>
              + chegou
            </button>
          </div>
        );
      })}
      {controlados.length === 0 && (
        <p className="text-sm text-center py-6" style={{ color: "#7b766e" }}>Nenhum produto com controle de estoque.</p>
      )}
      <button type="button" onClick={onFicha} className="rounded-2xl px-3.5 py-3 flex items-center gap-2.5 text-left mt-2" style={{ background: "#0f0f10", border: "1px dashed #3a3833" }}>
        <span className="text-lg">👩‍🍳</span>
        <span className="flex-1 flex flex-col">
          <span className="text-[13px] font-extrabold">Ficha técnica e ingredientes</span>
          <span className="text-[11.5px] font-bold" style={{ color: "#7b766e" }}>receita de cada produto e estoque dos ingredientes</span>
        </span>
        <ChevronRight className="w-4 h-4" style={{ color: "#7b766e" }} />
      </button>
    </div>
  );
}
