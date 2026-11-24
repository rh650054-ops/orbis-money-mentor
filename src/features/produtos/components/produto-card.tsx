/* Produtos e Estoque (24/11/2026): one product as a panel card. Photo (or an elegant placeholder), name,
   flavours, price, cost, what is left per unit, real stock and the recipe / stock status. The whole card
   opens the product sheet (edit). A cost that depends on an incomplete recipe is never shown as exact. */
import { ChevronRight } from "lucide-react";
import { lucroDe } from "../lib/conta";
import { situacaoDoEstoque, type PainelDoProduto } from "../lib/painel";
import type { ProdutoComFaixas } from "../types";
import { reais } from "./campos";
import { FotoOuMarca } from "./foto-produto";

/** kept for the "Estoque •" tab dot */
export function estoqueBaixo(p: ProdutoComFaixas): boolean {
  const s = situacaoDoEstoque(p);
  return s === "baixo" || s === "sem";
}

const VERDE = "#3DD68C", OURO = "#F5B800", VERM = "#FF6B5E", CINZA = "#8a857b";
function Selo({ cor, children }: { cor: string; children: string }) {
  return <span className="rounded-full px-2 py-[3px] text-[10.5px] font-extrabold whitespace-nowrap" style={{ color: cor, background: `${cor}1f` }}>{children}</span>;
}
function Dado({ rotulo, valor, cor }: { rotulo: string; valor: string; cor?: string }) {
  return (
    <span className="flex flex-col gap-0.5 min-w-0">
      <span className="text-[10px] font-extrabold tracking-[.08em] uppercase" style={{ color: CINZA }}>{rotulo}</span>
      <span className="text-[14px] font-black tabular-nums truncate" style={{ color: cor ?? "#F4F1EA" }}>{valor}</span>
    </span>
  );
}

export function ProdutoCard({ p, i, painel, onClick }: { p: ProdutoComFaixas; i: number; painel?: PainelDoProduto; onClick: () => void }) {
  const est = situacaoDoEstoque(p);
  const combo = p.faixas[0];
  const confiavel = painel ? painel.custoConfiavel : p.cost > 0;
  const l = lucroDe(p.sale_price, p.cost);
  const temPreco = !p.open_price && p.sale_price > 0;
  const preco = p.open_price ? "na hora" : temPreco ? reais(p.sale_price) : "—";
  const custo = p.cost > 0 ? (confiavel ? reais(p.cost) : "parcial") : "—";
  const sobra = temPreco && confiavel ? `${l.sobra > 0 ? "+" : ""}${reais(l.sobra)}` : temPreco && p.cost > 0 ? "parcial" : "—";
  const sabores = painel?.sabores ?? [];
  const estoqueTxt = est === "sem_controle" ? (p.origem === "faz" ? "feito na hora" : "sem controle") : `${p.stock_quantity} un`;
  return (
    <button type="button" onClick={onClick} aria-label={`Abrir ${p.name}`}
      className="w-full rounded-[20px] p-3.5 flex flex-col gap-3 text-left transition-colors hover:border-[#3a3630] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#F5B800]"
      style={{ background: "#151515", border: `1px solid ${est === "sem" ? "rgba(255,107,94,.4)" : est === "baixo" ? "rgba(245,184,0,.35)" : "#24221e"}` }}>
      <span className="flex items-start gap-3">
        <FotoOuMarca foto={p.photo_url} emoji={p.emoji} i={i} tamanho={60} />
        <span className="flex-1 min-w-0 flex flex-col gap-1">
          <span className="flex items-center gap-2">
            <span className="text-[16px] font-black truncate">{p.name}</span>
            <ChevronRight className="w-4 h-4 ml-auto shrink-0" style={{ color: "#5c5850" }} />
          </span>
          {(sabores.length > 0 || combo) && (
            <span className="text-[11.5px] font-bold truncate" style={{ color: "#b9b3a6" }}>
              {sabores.length > 0 ? `${sabores.length} ${sabores.length === 1 ? "sabor" : "sabores"}: ${sabores.join(", ")}` : ""}
              {sabores.length > 0 && combo ? " · " : ""}{combo ? `${combo.qty} por ${reais(combo.price).replace(",00", "")}` : ""}
            </span>
          )}
          <span className="flex flex-wrap gap-1.5 pt-0.5">
            {painel?.receita === "completa" && <Selo cor={VERDE}>Receita completa</Selo>}
            {painel?.receita === "incompleta" && <Selo cor={OURO}>Receita incompleta</Selo>}
            {painel?.receita === "sem_receita" && p.origem === "faz" && <Selo cor={CINZA}>Sem receita</Selo>}
            {est === "baixo" && <Selo cor={OURO}>Estoque baixo</Selo>}
            {est === "sem" && <Selo cor={VERM}>Sem estoque</Selo>}
          </span>
        </span>
      </span>
      <span className="grid grid-cols-4 gap-2 pt-2.5" style={{ borderTop: "1px solid #211f1b" }}>
        <Dado rotulo="Preço" valor={preco} />
        <Dado rotulo="Custo" valor={custo} cor={custo === "parcial" ? OURO : undefined} />
        <Dado rotulo="Sobra" valor={sobra} cor={sobra.startsWith("+") ? VERDE : sobra === "parcial" ? OURO : sobra.startsWith("-") || (temPreco && confiavel && l.sobra <= 0) ? VERM : undefined} />
        <Dado rotulo="Estoque" valor={estoqueTxt} cor={est === "sem" ? VERM : est === "baixo" ? OURO : undefined} />
      </span>
    </button>
  );
}
