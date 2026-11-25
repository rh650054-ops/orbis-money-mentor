/* /products — Produtos e Estoque (24/11/2026, redesign of the 07/10 screen): summary numbers, the area
   navigation, the product cards with the recipe / stock status and "Registrar compra" at the end of the
   list. Same data, same rules: costs that depend on an incomplete recipe are never shown as exact.
   Sem produto ainda → a introdução que chama o quiz. */
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useProdutosQuery } from "../api/use-produtos-query";
import { useCatalogoProducaoQuery } from "../api/use-catalogo-producao-query";
import { ordenarPorLucro } from "../lib/conta";
import { painelDoProduto, resumoDoPainel } from "../lib/painel";
import { AbaEstoque } from "../components/aba-estoque";
import { ChegouMercadoria } from "../components/chegou-mercadoria";
import { CarregandoProdutos } from "../components/carregando-produtos";
import { IntroProdutos } from "../components/intro-produtos";
import { estoqueBaixo, ProdutoCard } from "../components/produto-card";
import { NavPainel, RegistrarCompra, ResumoPainel, type Aba } from "../components/painel-produtos";
import { OURO } from "../components/quiz-casca";

export default function ProdutosPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data, isLoading, isError, refetch } = useProdutosQuery(user?.id);
  const catalogo = useCatalogoProducaoQuery(user?.id);
  const [aba, setAba] = useState<Aba>("produtos");
  // 25/11 (Rick, iPhone): after saving a product sheet the list opened at the sheet's scroll position,
  // with the cards under the status bar. The list always opens at the top.
  useEffect(() => { window.scrollTo(0, 0); }, []);
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

  const resumo = resumoDoPainel(lista, [...painel.values()]);

  return (
    <div className="text-[#F4F1EA] max-w-md md:max-w-2xl mx-auto flex flex-col gap-3 pt-2 pb-28">
      {/* iPhone status bar is translucent: scrolled cards no longer show under the clock */}
      <div aria-hidden className="fixed top-0 inset-x-0 z-40 pointer-events-none" style={{ height: "env(safe-area-inset-top)", background: "#000" }} />
      <div className="flex flex-col gap-0.5">
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={() => navigate(-1)} aria-label="Voltar" className="-ml-1.5 p-0.5" style={{ color: "#7b766e" }}><ChevronLeft className="w-5 h-5" /></button>
          <h1 className="flex-1 min-w-0 text-[21px] min-[380px]:text-[22px] font-extrabold leading-tight tracking-tight">Produtos e Estoque</h1>
          <button type="button" onClick={() => navigate("/products/novo")} className="shrink-0 rounded-full px-3 h-[34px] text-[12.5px] font-extrabold whitespace-nowrap" style={{ background: OURO, color: "#1A1200" }}>+ Novo<span className="max-[379px]:hidden"> produto</span></button>
        </div>
        <p className="text-[12px] font-medium leading-snug pl-[22px]" style={{ color: "#a19b90" }}>Controle sua operação em um só lugar.</p>
      </div>

      <ResumoPainel produtos={resumo.produtos} unidades={resumo.unidades} podeProduzir={resumo.podeProduzir} calculando={catalogo.isLoading} />
      <NavPainel aba={aba} alerta={lista.some(estoqueBaixo)} onAba={setAba} />

      {aba === "produtos" ? (
        <>
          <h2 className="text-[18px] font-extrabold mt-1 -mb-0.5">Seus produtos</h2>
          <div className="grid gap-2.5 md:grid-cols-2">
            {lista.map((p, i) => <ProdutoCard key={p.id} p={p} i={i} painel={painel.get(p.id)} onClick={() => navigate(`/products/${p.id}`)} />)}
          </div>
          {/* 25/11 (Rick, approved mockup): only on this tab, in the page flow (never floating over cards,
              the assistant or the bottom bar), centred and compact */}
          <div className="w-full max-w-[360px] mx-auto mt-1"><RegistrarCompra /></div>
        </>
      ) : (
        <AbaEstoque produtos={lista} userId={user?.id} onRepor={(id) => setChegou({ aberto: true, id })} />
      )}

      <ChegouMercadoria key={chegou.id ?? "todos"} aberto={chegou.aberto} inicial={chegou.id} produtos={lista} userId={user?.id} onFechar={() => setChegou({ aberto: false })} />
    </div>
  );
}
