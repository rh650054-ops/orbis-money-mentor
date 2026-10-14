/* Total da compra no rodapé (Rick, 14/10: "tem que ser mais chamativo"). */
import { reais } from "./campos";

export function MercadoTotal({ total, itens, porItem }: { total: number; itens: number; porItem: boolean }) {
  return (
    <div className="flex items-end justify-between gap-3 rounded-[16px] px-4 py-3"
      style={{ background: "linear-gradient(120deg, #1d1606, #0e0e10 75%)", border: "1px solid rgba(245,184,0,.45)" }}>
      <div className="flex flex-col">
        <span className="text-[10.5px] font-black tracking-[.14em]" style={{ color: "#F5B800" }}>TOTAL DA COMPRA</span>
        <span className="text-[12px] font-bold" style={{ color: "#7b766e" }}>
          {itens} {itens === 1 ? "item" : "itens"}{porItem && total === 0 && itens > 0 ? " · põe o preço pra somar" : ""}
        </span>
      </div>
      <span className="text-[30px] leading-none font-black tabular-nums tracking-tight" style={{ color: total > 0 ? "#F5B800" : "#4a463f" }}>
        {reais(total)}
      </span>
    </div>
  );
}
