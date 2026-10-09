/* Linha da lista de Produtos: preço, combo, estoque e o lucro em cada venda. */
import { lucroDe } from "../lib/conta";
import type { ProdutoComFaixas } from "../types";
import { reais } from "./campos";

const FUNDOS = ["#3a2a0a,#161005", "#3a1420,#170a0e", "#2a0a3a,#100516", "#2a1a0e,#120b06", "#0a2a3a,#05101a"];

export function estoqueBaixo(p: ProdutoComFaixas): boolean {
  if (p.controla_estoque === false) return false;
  return p.stock_quantity <= Math.max(3, p.stock_min || 0);
}

export function ProdutoCard({ p, i, onClick }: { p: ProdutoComFaixas; i: number; onClick: () => void }) {
  const l = lucroDe(p.sale_price, p.cost);
  const combo = p.faixas[0];
  const baixo = estoqueBaixo(p);
  const preco = p.open_price ? "preço na hora" : reais(p.sale_price) + (combo ? ` · ${combo.qty} por ${reais(combo.price).replace(",00", "")}` : "");
  const linhaEstoque = p.controla_estoque === false ? (p.origem === "faz" ? "feito na hora" : "sem controle de estoque")
    : baixo ? (p.stock_quantity > 0 ? `só ${p.stock_quantity} un · repor` : "acabou · repor") : `${p.stock_quantity} un`;
  return (
    <button type="button" onClick={onClick} className="w-full rounded-[18px] px-3.5 py-3 flex items-center gap-3 text-left"
      style={{ background: "#0f0f10", border: `1px solid ${baixo ? "rgba(255,154,77,.45)" : "#26241f"}` }}>
      {p.photo_url ? <img src={p.photo_url} alt="" className="w-[46px] h-[46px] rounded-xl object-cover shrink-0" />
        : <span className="w-[46px] h-[46px] rounded-xl shrink-0 flex items-center justify-center text-[22px]" style={{ background: `linear-gradient(160deg,${FUNDOS[i % FUNDOS.length]})` }}>{p.emoji ?? "📦"}</span>}
      <span className="flex-1 min-w-0 flex flex-col gap-[3px]">
        <span className="text-[15px] font-black truncate">{p.name}</span>
        <span className="text-xs font-bold truncate" style={{ color: "#b9b3a6" }}>{preco}</span>
        <span className="text-[11.5px] font-extrabold" style={{ color: baixo ? "#ff9a4d" : "#7b766e" }}>{linhaEstoque}</span>
      </span>
      {!p.open_price && p.sale_price > 0 && (
        <span className="flex flex-col items-end gap-0.5 shrink-0">
          {p.cost > 0 ? (
            <>
              <span className="text-[15px] font-black" style={{ color: l.sobra > 0 ? "#3DD68C" : "#ff7a6b" }}>{l.sobra > 0 ? "+" : ""}{reais(l.sobra)}</span>
              <span className="text-[10.5px] font-extrabold" style={{ color: "#7b766e" }}>lucro · {l.pct}%</span>
            </>
          ) : (
            <span className="text-[11px] font-extrabold" style={{ color: "#F5B800" }}>falta o custo</span>
          )}
        </span>
      )}
    </button>
  );
}
