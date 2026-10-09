/* /products — a tela de Produtos que substitui a antiga (Rick, 07/10):
   o lucro de cada produto, o mais lucrativo no topo, e "Chegou mercadoria".
   Sem produto ainda → a introdução que chama o quiz. */
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/shared/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { useProdutosQuery } from "../api/use-produtos-query";
import { useApagarProdutoMutation } from "../api/use-produto-mutations";
import { lucroDe, ordenarPorLucro } from "../lib/conta";
import type { ProdutoComFaixas } from "../types";
import { AbaEstoque } from "../components/aba-estoque";
import { ChegouMercadoria } from "../components/chegou-mercadoria";
import { CarregandoProdutos } from "../components/carregando-produtos";
import { IntroProdutos } from "../components/intro-produtos";
import { estoqueBaixo, ProdutoCard } from "../components/produto-card";
import { DuasAbas, reais } from "../components/campos";
import { OURO } from "../components/quiz-casca";

export default function ProdutosPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data, isLoading, isError, refetch } = useProdutosQuery(user?.id);
  const apagar = useApagarProdutoMutation();
  const [aba, setAba] = useState<"produtos" | "estoque">("produtos");
  const [chegou, setChegou] = useState<{ aberto: boolean; id?: string }>({ aberto: false });
  const [acoes, setAcoes] = useState<ProdutoComFaixas | null>(null);
  const lista = useMemo(() => ordenarPorLucro(data ?? []), [data]);

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

  const comLucro = lista.filter((p) => !p.open_price && p.sale_price > 0 && p.cost > 0);
  const melhor = comLucro[0];
  const pior = comLucro.length > 1 ? comLucro[comLucro.length - 1] : undefined;
  const algumBaixo = lista.some(estoqueBaixo);

  return (
    <div className="text-[#F4F1EA] max-w-md mx-auto flex flex-col gap-3 pt-2 pb-28">
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => navigate(-1)} aria-label="Voltar" className="-ml-1 p-1" style={{ color: "#7b766e" }}><ChevronLeft className="w-6 h-6" /></button>
        <h1 className="text-xl font-black">Produtos</h1>
        <button type="button" onClick={() => navigate("/products/novo")} className="ml-auto rounded-full px-3.5 py-2 text-[12.5px] font-black" style={{ background: OURO, color: "#1A1200" }}>+ Produto</button>
      </div>
      <DuasAbas valor={aba} onChange={setAba} opcoes={[["produtos", "Produtos"], ["estoque", algumBaixo ? "Estoque •" : "Estoque"]]} />

      {aba === "produtos" ? (
        <>
          {melhor && (
            <div className="rounded-[18px] px-4 py-3.5 flex flex-col gap-1" style={{ background: "linear-gradient(170deg, #12200f, #0e0e10 70%)", border: "1px solid rgba(61,214,140,.35)" }}>
              <span className="text-[10.5px] font-black tracking-[.14em]" style={{ color: "#3DD68C" }}>SEU PRODUTO QUE MAIS DÁ LUCRO</span>
              <span className="text-[17px] font-black">{melhor.name} · sobra {reais(lucroDe(melhor.sale_price, melhor.cost).sobra)} em cada</span>
              {pior && <span className="text-xs" style={{ color: "#b9b3a6" }}>{pior.name} é o que menos dá lucro: {reais(lucroDe(pior.sale_price, pior.cost).sobra)}.</span>}
            </div>
          )}
          {lista.map((p, i) => <ProdutoCard key={p.id} p={p} i={i} onClick={() => setAcoes(p)} />)}
        </>
      ) : (
        <AbaEstoque produtos={lista} onRepor={(id) => setChegou({ aberto: true, id })} onFicha={() => navigate("/products/ficha")} />
      )}

      <div className="fixed left-0 right-0 z-40 px-4 max-w-md mx-auto" style={{ bottom: "calc(max(env(safe-area-inset-bottom), 0.5rem) + 74px)" }}>
        <button type="button" onClick={() => setChegou({ aberto: true })} className="w-full rounded-2xl p-3.5 flex items-center gap-2.5 text-left"
          style={{ border: "1px solid transparent", background: "linear-gradient(#171206,#0f0d08) padding-box, linear-gradient(135deg,#FFE27A,#B88E00 60%,#FFC800) border-box" }}>
          <span className="text-xl">📦</span>
          <span className="flex-1 flex flex-col"><span className="text-sm font-black">Chegou mercadoria</span><span className="text-[11.5px] font-bold" style={{ color: "#7b766e" }}>soma no estoque e acerta o custo</span></span>
          <span className="font-black" style={{ color: "#F5B800" }}>›</span>
        </button>
      </div>

      <ChegouMercadoria key={chegou.id ?? "todos"} aberto={chegou.aberto} inicial={chegou.id} produtos={lista} userId={user?.id} onFechar={() => setChegou({ aberto: false })} />
      <Dialog open={!!acoes} onOpenChange={(v) => { if (!v) setAcoes(null); }}>
        <DialogContent className="max-w-sm bg-black border-[#26241f] text-[#F4F1EA]">
          <DialogHeader><DialogTitle>{acoes?.emoji} {acoes?.name}</DialogTitle></DialogHeader>
          <button type="button" className="w-full h-12 rounded-xl font-black" style={{ background: OURO, color: "#1A1200" }} onClick={() => { const id = acoes?.id; setAcoes(null); if (id) navigate(`/products/${id}`); }}>Editar</button>
          <button type="button" className="w-full h-12 rounded-xl font-extrabold" style={{ background: "#121211", border: "1px solid #26241f" }} onClick={() => { const id = acoes?.id; setAcoes(null); setChegou({ aberto: true, id }); }}>Chegou mercadoria</button>
          <button type="button" className="w-full h-11 rounded-xl text-sm font-extrabold" style={{ color: "#ff7a6b" }}
            onClick={() => { const p = acoes; setAcoes(null); if (p) apagar.mutate(p.id, { onSuccess: () => toast({ title: `${p.name} saiu da lista` }) }); }}>
            Tirar da lista
          </button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
