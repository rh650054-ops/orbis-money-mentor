/* Aba Estoque (25/11/2026, Rick, refined): four areas only, in this order —
   A · Produtos prontos, B · O que precisa de atenção?, C · O que preciso comprar?, D · Ingredientes.
   Prices stay on Produtos, purchases (and their history) in Mercado, producing in Produção.
   Everything here only reads, except the ingredient count ("Ajustar estoque", with reason and history)
   and "Chegou mercadoria" for resale products (the existing flow). */
import type { ProdutoComFaixas } from "../types";
import { useCatalogoProducaoQuery } from "../api/use-catalogo-producao-query";
import { useSaboresDeVariosQuery } from "../api/use-sabores";
import { itensDeProducao, linhasDoItem } from "../lib/producao";
import { levasPossiveis } from "../lib/receitas";
import { alertasDoEstoque, nomeDoItem, situacaoDosIngredientes } from "../lib/estoque";
import { estoqueBaixo } from "./produto-card";
import { EstoqueProntos } from "./estoque-prontos";
import { EstoqueAtencao } from "./estoque-atencao";
import { EstoqueIngredientes } from "./estoque-ingredientes";
import { ListaCompras } from "./lista-compras";

const Titulo = ({ t, sub }: { t: string; sub?: string }) => (
  <div className="flex flex-col mt-2 px-0.5">
    <h3 className="text-[16px] font-extrabold">{t}</h3>
    {sub && <span className="text-[12px] font-semibold" style={{ color: "#8f897e" }}>{sub}</span>}
  </div>
);

export function AbaEstoque({ produtos, userId, onRepor }: {
  produtos: ProdutoComFaixas[]; userId: string | undefined; onRepor: (id: string) => void;
}) {
  const catalogo = useCatalogoProducaoQuery(userId);
  const c = catalogo.data;
  const faz = (p: ProdutoComFaixas) => p.origem === "faz" || p.recipe_mode === "batch";
  const controlados = produtos.filter((p) => p.controla_estoque !== false || faz(p));
  const sabores = useSaboresDeVariosQuery(controlados.filter(faz).map((p) => p.id));
  const ordem = [...controlados].sort((a, b) => Number(estoqueBaixo(b)) - Number(estoqueBaixo(a)) || a.stock_quantity - b.stock_quantity);
  const alertas = c ? alertasDoEstoque(c) : [];
  const itens = c ? itensDeProducao(c).flatMap((g) => g.itens) : [];
  const usadoEm = (id: string) => (c ? itens.filter((it) => linhasDoItem(c, it.produto, it.sabor).some((r) => r.ingredient_id === id)).map(nomeDoItem) : []);
  const idDoProduto = (nome: string) => itens.find((it) => nomeDoItem(it) === nome)?.produto.id;
  // units the stored ingredients still make for the product's best item (product or flavour) —
  // null when there is no complete recipe to count: "Produzir" is only offered when it is > 0
  const daPraMais = (p: ProdutoComFaixas) => {
    if (!c) return null;
    const dele = itens.filter((it) => it.produto.id === p.id && it.situacao === "pronta" && it.rende > 0);
    if (dele.length === 0) return null;
    return Math.max(...dele.map((it) => levasPossiveis(linhasDoItem(c, it.produto, it.sabor).filter((r) => r.quantity > 0)
      .map((r) => ({ qtd: r.quantity, estoque: c.ingredientes.find((g) => g.id === r.ingredient_id)?.stock_quantity ?? 0 }))) * it.rende));
  };
  return (
    <div className="flex flex-col gap-2.5">
      <Titulo t="Produtos prontos" sub="Unidades prontas para vender" />
      <EstoqueProntos produtos={ordem} sabores={sabores.data} faz={faz} daPraMais={daPraMais} onChegou={onRepor} />

      {c && <>
        <Titulo t="O que precisa de atenção?" />
        <EstoqueAtencao alertas={alertas} idDoProduto={idDoProduto} />

        <Titulo t="O que preciso comprar?" sub="Diga quanto quer produzir; a VANT faz a lista" />
        <ListaCompras c={c} />

        <Titulo t="Ingredientes" />
        <EstoqueIngredientes c={c} situacao={situacaoDosIngredientes(c)} usadoEm={usadoEm} />
      </>}
    </div>
  );
}
