/* /products/novo e /products/:id — cadastro do produto em perguntas (quiz). */
import { useMemo } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/shared/hooks/use-toast";
import { mapSupabaseError } from "@/shared/api";
import { useProdutosQuery } from "../api/use-produtos-query";
import { useSalvarProdutoMutation } from "../api/use-produto-mutations";
import { useSubirFotoMutation } from "../api/use-subir-foto-mutation";
import { rascunhoDe, TOTAL_PASSOS, useQuizProduto } from "../hooks/use-quiz-produto";
import type { RascunhoProduto } from "../types";
import { PassoNome } from "../components/passo-nome";
import { PassoOrigem } from "../components/passo-origem";
import { PassoCustoCompra } from "../components/passo-custo-compra";
import { PassoCustoFaz } from "../components/passo-custo-faz";
import { PassoPreco } from "../components/passo-preco";
import { PassoEstoque } from "../components/passo-estoque";
import { QuizPronto } from "../components/quiz-pronto";
import { CarregandoProdutos } from "../components/carregando-produtos";

export default function QuizProdutoPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const lista = useProdutosQuery(user?.id, { sempreFresco: !!id });
  const existente = useMemo(() => (id ? lista.data?.find((p) => p.id === id) : undefined), [id, lista.data]);
  // edição: espera a lista fresca (estoque e custo mudam com o Foco e as compras)
  if (id && !lista.isFetchedAfterMount && !lista.isError) return <CarregandoProdutos />;
  if (id && !existente) return <Navigate to="/products" replace />;
  return <Quiz key={existente?.id ?? "novo"} inicial={existente ? rascunhoDe(existente) : undefined} userId={user?.id} />;
}

function Quiz({ inicial, userId }: { inicial?: RascunhoProduto; userId?: string }) {
  const navigate = useNavigate();
  const q = useQuizProduto(inicial);
  const salvar = useSalvarProdutoMutation(userId, inicial);
  const foto = useSubirFotoMutation(userId);
  const sair = () => navigate("/products");
  const voltar = () => { if (!q.voltar()) sair(); };
  const r = q.r;

  const gravar = (rascunho: RascunhoProduto) => {
    salvar.mutate(rascunho, {
      onSuccess: () => q.ir("pronto"),
      onError: (e) => toast({ title: "Não consegui salvar o produto", description: mapSupabaseError(e).message, variant: "destructive" }),
    });
  };

  switch (q.passo) {
    case "nome":
      return <PassoNome total={TOTAL_PASSOS} nome={r.nome} foto={r.foto} enviandoFoto={foto.isPending} onNome={q.setNome} onVoltar={voltar}
        onFoto={(f) => foto.mutate(f, {
          onSuccess: q.setFoto,
          onError: () => toast({ title: "Não consegui enviar a foto", description: "Tenta outra foto (até 5 MB).", variant: "destructive" }),
        })}
        onContinuar={q.avancar} />;
    case "origem":
      return <PassoOrigem total={TOTAL_PASSOS} onEscolher={q.setOrigem} onVoltar={voltar} />;
    case "custo":
      return r.origem === "faz"
        ? <PassoCustoFaz total={TOTAL_PASSOS} nome={r.nome} custo={r.custo} onCusto={q.setCusto} onRende={(n) => q.setPacote(n)} onContinuar={q.avancar} onVoltar={voltar} />
        : <PassoCustoCompra total={TOTAL_PASSOS} nome={r.nome} custo={r.custo} onCusto={q.setCusto} onPacote={(n) => q.setPacote(n)}
            onFaco={() => q.setOrigem("faz")} onContinuar={q.avancar} onVoltar={voltar} />;
    case "preco":
      return <PassoPreco total={TOTAL_PASSOS} nome={r.nome} custo={r.custo} preco={r.preco} combo={r.combo}
        onPreco={q.setPreco} onCombo={q.setCombo} onPrecoLivre={q.setPrecoLivre} onContinuar={q.avancar} onVoltar={voltar} />;
    case "estoque":
      return <PassoEstoque total={TOTAL_PASSOS} nome={r.nome} estoque={r.estoque} custo={r.custo} pacote={q.pacote} salvando={salvar.isPending}
        onEstoque={q.setEstoque} onSalvar={() => gravar(r)} onVoltar={voltar}
        onSemEstoque={() => { q.semEstoque(); gravar({ ...r, controlaEstoque: false, estoque: 0 }); }} />;
    case "pronto":
      return <QuizPronto r={r} onComecarDia={() => navigate("/daily-goals")} onOutro={q.recomecar} onLista={sair} />;
  }
}
