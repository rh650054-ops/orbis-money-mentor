/* One line of the production screen: a product (or one of its flavours) and how many were made.
   A line that cannot produce says why and where to fix it, instead of a counter. */
import { Link } from "react-router-dom";
import type { ItemProducao } from "../lib/producao";
import { VANT } from "../lib/visual";
import { Contador } from "./campos";

const MOTIVO: Record<Exclude<ItemProducao["situacao"], "pronta">, string> = {
  incompleta: "Receita incompleta: tem ingrediente sem quantidade.",
  sem_rendimento: "Falta dizer quantas unidades a receita rende.",
  sem_receita: "Sem receita: produto comprado pronto entra pelo Mercado.",
};

export function ProducaoItem({ item, valor, onMudar }: { item: ItemProducao; valor: number; onMudar: (n: number) => void }) {
  const nome = item.sabor ? `${item.sabor.emoji} ${item.sabor.name}` : `${item.produto.emoji ?? "📦"} ${item.produto.name}`;
  const estoque = item.sabor ? item.sabor.stock_quantity : item.produto.stock_quantity;
  if (item.situacao !== "pronta") {
    return (
      <div className="rounded-[14px] px-3 py-2.5 flex flex-col gap-1" style={{ background: VANT.cartao, border: `1px solid ${VANT.borda}` }}>
        <span className="text-[14px] font-black">{nome}</span>
        <span className="text-[12px] font-bold" style={{ color: VANT.cinza }}>{MOTIVO[item.situacao]}</span>
        <Link to={`/products/${item.produto.id}`} className="text-[12.5px] font-black self-start" style={{ color: VANT.ouro }}>
          {item.situacao === "sem_receita" ? "Abrir produto" : "Completar receita"} ›
        </Link>
      </div>
    );
  }
  return (
    <div className="rounded-[14px] px-3 py-2.5 flex flex-col gap-1.5" style={{ background: VANT.cartao, border: `1px solid ${valor > 0 ? VANT.ouro : VANT.borda}` }}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[14px] font-black">{nome}</span>
        <span className="text-[11.5px] font-bold" style={{ color: VANT.cinza }}>tem {estoque} · rende {item.rende.toLocaleString("pt-BR")} por leva</span>
      </div>
      <Contador valor={valor} onChange={onMudar} unidade="un" />
    </div>
  );
}
