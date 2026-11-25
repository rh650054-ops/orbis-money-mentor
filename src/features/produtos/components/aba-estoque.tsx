/* Aba Estoque — gerente de estoque (25/11/2026, Rick): what I have, what is running out and what I
   need to buy for the next production. A · summary, B · ready products (with "Produzi" / "+ chegou"
   as before), C · what needs attention, D · ingredients, "O que preciso comprar?", E · purchases.
   Read-only except the actions it already had (Produzi, + chegou, which use the existing flows). */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { ProdutoComFaixas } from "../types";
import { useAProduzirQuery } from "../api/use-producao-mutations";
import { useCatalogoProducaoQuery } from "../api/use-catalogo-producao-query";
import { useSaboresDeVariosQuery } from "../api/use-sabores";
import { itensDeProducao, linhasDoItem, usaProducaoNova } from "../lib/producao";
import { levasPossiveis } from "../lib/receitas";
import { alertasDoEstoque, nomeDoItem, receitasComAtencao, situacaoDosIngredientes } from "../lib/estoque";
import { ComprasRecentes } from "./compras-recentes";
import { CompraDetalhe } from "./compra-detalhe";
import { Produzi } from "./produzi";
import { estoqueBaixo } from "./produto-card";
import { EstoqueResumo } from "./estoque-resumo";
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
  const navigate = useNavigate();
  const [produzindo, setProduzindo] = useState<ProdutoComFaixas | null>(null);
  const [compraAberta, setCompraAberta] = useState<string | null>(null);
  const { data: aProduzir = [] } = useAProduzirQuery(true);
  const catalogo = useCatalogoProducaoQuery(userId);
  const c = catalogo.data;
  const faz = (p: ProdutoComFaixas) => p.origem === "faz" || p.recipe_mode === "batch";
  const pendenteDe = (id: string) => aProduzir.find((a) => a.produto_id === id);
  const produzir = (p: ProdutoComFaixas) => {
    if (!pendenteDe(p.id) && c && usaProducaoNova(c, p.id)) navigate(`/products/produzir?p=${p.id}`);
    else setProduzindo(p);
  };
  const controlados = produtos.filter((p) => p.controla_estoque !== false || faz(p));
  // products.stock_quantity already includes its flavours: counted once
  const prontos = controlados.reduce((s, p) => s + Math.max(0, p.stock_quantity), 0);
  const valor = controlados.reduce((s, p) => s + Math.max(0, p.stock_quantity) * Math.max(0, p.cost), 0);
  const sabores = useSaboresDeVariosQuery(controlados.filter(faz).map((p) => p.id));
  const ordem = [...controlados].sort((a, b) => Number(estoqueBaixo(b)) - Number(estoqueBaixo(a)) || a.stock_quantity - b.stock_quantity);
  const alertas = c ? alertasDoEstoque(c) : [];
  const itens = c ? itensDeProducao(c).flatMap((g) => g.itens) : [];
  const usadoEm = (id: string) => (c ? itens.filter((it) => linhasDoItem(c, it.produto, it.sabor).some((r) => r.ingredient_id === id)).map(nomeDoItem) : []);
  const idDoProduto = (nome: string) => itens.find((it) => nomeDoItem(it) === nome)?.produto.id;
  // kept from the old "Ingredientes guardados": how many more units the stored ingredients make
  const daPraMais = (p: ProdutoComFaixas) => {
    if (!c || !(p.batch_yield > 0)) return null;
    const rec = c.receitas.filter((r) => r.product_id === p.id && r.variant_id === null && r.quantity > 0);
    if (rec.length === 0) return null;
    return levasPossiveis(rec.map((r) => ({ qtd: r.quantity, estoque: c.ingredientes.find((g) => g.id === r.ingredient_id)?.stock_quantity ?? 0 }))) * p.batch_yield;
  };
  return (
    <div className="flex flex-col gap-2.5">
      <EstoqueResumo prontos={prontos} valor={valor} atencao={receitasComAtencao(alertas)} />

      <Titulo t="Produtos prontos" sub="Unidades prontas para vender" />
      <EstoqueProntos produtos={ordem} sabores={sabores.data} faz={faz} daPraMais={daPraMais} destaque={(p) => !!pendenteDe(p.id) || estoqueBaixo(p)}
        onAcao={(p) => (faz(p) ? produzir(p) : onRepor(p.id))} />
      {controlados.some(faz) && (
        <button type="button" onClick={() => navigate("/products/produzir")} className="rounded-[14px] px-3.5 py-2.5 flex items-center justify-between text-left"
          style={{ background: "#0f0d08", border: "1px solid rgba(245,184,0,.6)" }}>
          <span className="flex flex-col"><span className="text-[13.5px] font-extrabold">Produzir</span>
            <span className="text-[11.5px] font-semibold" style={{ color: "#8f897e" }}>vários produtos e sabores de uma vez</span></span>
          <span className="font-black" style={{ color: "#F5B800" }}>›</span>
        </button>
      )}

      {c && <>
        <Titulo t="O que precisa de atenção?" sub="O que impede a próxima receita de cada produto" />
        <EstoqueAtencao alertas={alertas} idDoProduto={idDoProduto} />

        <Titulo t="O que preciso comprar?" sub="Diga quanto quer produzir" />
        <ListaCompras c={c} />

        <Titulo t="Ingredientes" />
        <EstoqueIngredientes c={c} situacao={situacaoDosIngredientes(c)} usadoEm={usadoEm} />
      </>}

      <ComprasRecentes userId={userId} onAbrir={setCompraAberta} />
      <CompraDetalhe id={compraAberta} onFechar={() => setCompraAberta(null)} onEditar={(id) => navigate(`/products/mercado?editar=${id}`)} />
      <Produzi key={produzindo?.id ?? "x"} produto={produzindo} pendente={produzindo ? pendenteDe(produzindo.id) : undefined}
        incompleta={!!produzindo && !!c && c.receitas.some((r) => r.product_id === produzindo.id && (r.quantity <= 0 || r.aprender))}
        onFechar={() => setProduzindo(null)} />
    </div>
  );
}
