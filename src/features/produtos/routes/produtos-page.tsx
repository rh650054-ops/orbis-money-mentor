/* /products — Produtos e Estoque (24/11/2026, redesign of the 07/10 screen): summary numbers, the area
   navigation, the product cards with the recipe / stock status and "Registrar compra" at the end of the
   list. Same data, same rules: costs that depend on an incomplete recipe are never shown as exact.
   Sem produto ainda → a introdução que chama o quiz. */
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useProdutosQuery } from "../api/use-produtos-query";
import { useCatalogoProducaoQuery } from "../api/use-catalogo-producao-query";
import { lucroDe, ordenarPorLucro } from "../lib/conta";
import { painelDoProduto, resumoDoPainel } from "../lib/painel";
import { AbaEstoque } from "../components/aba-estoque";
import { ChegouMercadoria } from "../components/chegou-mercadoria";
import { CarregandoProdutos } from "../components/carregando-produtos";
import { IntroProdutos } from "../components/intro-produtos";
import { estoqueBaixo, ProdutoCard } from "../components/produto-card";
import { NavPainel, RegistrarCompra, ResumoPainel, type Aba } from "../components/painel-produtos";
import { reais } from "../components/campos";
import { OURO } from "../components/quiz-casca";

export default function ProdutosPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data, isLoading, isError, refetch } = useProdutosQuery(user?.id);
  const catalogo = useCatalogoProducaoQuery(user?.id);
  const [aba, setAba] = useState<Aba>("produtos");
  const [chegou, setChegou] = useState<{ aberto: boolean; id?: string }>({ aberto: false });
  const lista = useMemo(() => ordenarPorLucro(data ?? []), [data]);
  const painel = useMemo(() => new Map(lista.map((p) => [p.id, painelDoProduto(catalogo.data, p)])), [lista, catalogo.data]);

  if (isLoading) return <CarregandoProdutos />;
  if (isError) {
    return (
      <div className="min-h-[100dvh] bg-black text-[#F4F1EA] flex flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="font-bold">Não consegui carregar seus produtos.</p>
        <button type="button" onClick={() => refetch()} className="underline font-extrabold" style={{ color: "#F5B800" }}>Tentar de novo</button>
      </div>
    );
  }
  if (lista.length === 0) return <IntroProdutos onComecar={() => navigate("/products/novo")} onVoltar={() => navigate(-1)} />;

  // "the one that makes the most" only among products whose cost is reliable (complete recipe or typed cost)
  const comLucro = lista.filter((p) => !p.open_price && p.sale_price > 0 && p.cost > 0 && painel.get(p.id)?.custoConfiavel);
  const melhor = comLucro[0];
  const pior = comLucro.length > 1 ? comLucro[comLucro.length - 1] : undefined;
  const resumo = resumoDoPainel(lista, [...painel.values()]);

  return (
    <div className="text-[#F4F1EA] max-w-md md:max-w-2xl mx-auto flex flex-col gap-4 pt-2 pb-36">
      <div className="flex flex-col gap-1.5">
        <div className="flex items-start gap-2">
          <button type="button" onClick={() => navigate(-1)} aria-label="Voltar" className="-ml-1 p-1 mt-0.5" style={{ color: "#7b766e" }}><ChevronLeft className="w-6 h-6" /></button>
          <h1 className="flex-1 min-w-0 text-[24px] font-black leading-[1.15] tracking-tight">Produtos e Estoque</h1>
          <button type="button" onClick={() => navigate("/products/novo")} className="shrink-0 rounded-full px-3.5 h-10 text-[13.5px] font-black whitespace-nowrap" style={{ background: OURO, color: "#1A1200" }}>+ Novo produto</button>
        </div>
        <p className="text-[13px] font-bold leading-snug pl-8" style={{ color: "#9a958b" }}>Cadastre, acompanhe e produza com controle.</p>
      </div>

      <ResumoPainel produtos={resumo.produtos} unidades={resumo.unidades} podeProduzir={resumo.podeProduzir} calculando={catalogo.isLoading} />
      <NavPainel aba={aba} alerta={lista.some(estoqueBaixo)} onAba={setAba} />

      {aba === "produtos" ? (
        <>
          {melhor && (
            <div className="rounded-[18px] px-4 py-3.5 flex items-center gap-3" style={{ background: "linear-gradient(110deg, rgba(61,214,140,.13), #121211 65%)", border: "1px solid rgba(61,214,140,.3)" }}>
              <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                <span className="text-[11px] font-black tracking-[.12em]" style={{ color: "#3DD68C" }}>SEU PRODUTO QUE MAIS DÁ LUCRO</span>
                <span className="text-[17px] font-black truncate">{melhor.name}</span>
                <span className="text-[12.5px] font-bold" style={{ color: "#9a958b" }}><span className="whitespace-nowrap">{reais(melhor.sale_price)} de venda</span> · <span className="whitespace-nowrap">{reais(melhor.cost)} de custo</span></span>
                {pior && <span className="text-[12px] font-bold" style={{ color: "#8a857b" }}>{pior.name} é o que menos dá lucro: <span className="whitespace-nowrap">{reais(lucroDe(pior.sale_price, pior.cost).sobra)}.</span></span>}
              </div>
              <div className="flex flex-col items-end shrink-0">
                <span className="text-[22px] font-black tabular-nums whitespace-nowrap" style={{ color: "#3DD68C" }}>+{reais(lucroDe(melhor.sale_price, melhor.cost).sobra)}</span>
                <span className="text-[11.5px] font-extrabold whitespace-nowrap" style={{ color: "#9a958b" }}>sobra por unidade</span>
              </div>
            </div>
          )}
          <h2 className="text-[20px] font-black mt-1 -mb-1">Seus produtos</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {lista.map((p, i) => <ProdutoCard key={p.id} p={p} i={i} painel={painel.get(p.id)} onClick={() => navigate(`/products/${p.id}`)} />)}
          </div>
        </>
      ) : (
        <AbaEstoque produtos={lista} userId={user?.id} onRepor={(id) => setChegou({ aberto: true, id })} />
      )}

      <RegistrarCompra />
      <ChegouMercadoria key={chegou.id ?? "todos"} aberto={chegou.aberto} inicial={chegou.id} produtos={lista} userId={user?.id} onFechar={() => setChegou({ aberto: false })} />
    </div>
  );
}
