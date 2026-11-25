/* /products/novo — cadastro do produto em perguntas (quiz). 22/11 (Etapa 2): 6 perguntas — o que vende,
   como consegue (produz / revende / configurar depois), receita ou custo, sabores, preço e revisão. */
import { useMemo, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/shared/hooks/use-toast";
import { mapSupabaseError } from "@/shared/api";
import { useProdutosQuery } from "../api/use-produtos-query";
import { useSalvarProdutoMutation } from "../api/use-produto-mutations";
import { useSubirFotoMutation } from "../api/use-subir-foto-mutation";
import { apagarFotosOrfas } from "../api/fotos";
import { rascunhoDe, TOTAL_PASSOS, useQuizProduto } from "../hooks/use-quiz-produto";
import type { RascunhoProduto } from "../types";
import { rascunhoDaReceita, resumoDoCusto } from "../lib/receitas";
import { PassoNome } from "../components/passo-nome";
import { PassoOrigem } from "../components/passo-origem";
import { PassoCustoCompra } from "../components/passo-custo-compra";
import { PassoCustoFaz } from "../components/passo-custo-faz";
import { PassoPreco } from "../components/passo-preco";
import { PassoSabores } from "../components/passo-sabores";
import { PassoRevisao } from "../components/passo-revisao";
import { useSalvarSaboresMutation } from "../api/use-salvar-sabores-mutation";
import { QuizPronto } from "../components/quiz-pronto";
import { CarregandoProdutos } from "../components/carregando-produtos";

/** 23/11: ready units typed per flavour: the product total is their sum. */
function comEstoqueDosSabores(r: RascunhoProduto): RascunhoProduto {
  const porSabor = r.sabores.reduce((t, x) => t + (x.nome.trim() ? x.estoque ?? 0 : 0), 0);
  return porSabor > 0 && r.controlaEstoque ? { ...r, estoque: porSabor } : r;
}

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
  const q = useQuizProduto(inicial, userId);
  const salvarSabores = useSalvarSaboresMutation();
  const salvar = useSalvarProdutoMutation(userId, inicial);
  const foto = useSubirFotoMutation(userId);
  const [enviadas, setEnviadas] = useState<string[]>([]);
  const sair = () => navigate("/products");
  const voltar = () => { if (!q.voltar()) sair(); };
  const r = q.r;

  const [salvo, setSalvo] = useState<string | null>(null);
  const [falha, setFalha] = useState<string | null>(null);
  /* 23/11: "Produto cadastrado!" only after the product AND its flavours are saved. On any failure the
     draft stays (with the product id chosen by the phone), so "tentar de novo" updates the same
     product — never a second one — and saves the flavours again (matched by name: idempotent). */
  const gravar = async (inicial: RascunhoProduto) => {
    setFalha(null);
    const rascunho = comEstoqueDosSabores(inicial);
    try {
      const id = await salvar.mutateAsync(rascunho);
      if (!rascunho.id && rascunho.sabores.some((x) => x.nome.trim())) {
        await salvarSabores.mutateAsync({ produtoId: id, sabores: rascunho.sabores });
      }
      void apagarFotosOrfas([...enviadas, inicial?.foto].filter((u) => u && u !== rascunho.foto), userId);
      q.terminou(); setSalvo(id); q.ir("pronto");
    } catch (e) {
      const msg = mapSupabaseError(e).message;
      setFalha(msg);
      toast({ title: "Não consegui salvar tudo", description: `${msg} Seus dados continuam aqui: tente de novo.`, variant: "destructive" });
    }
  };

  switch (q.passo) {
    case "nome":
      return <PassoNome total={TOTAL_PASSOS} nome={r.nome} foto={r.foto} enviandoFoto={foto.isPending} onNome={q.setNome} onVoltar={voltar} onRemoverFoto={() => q.setFoto(null)}
        onFoto={(f) => foto.mutate(f, {
          onSuccess: (url) => { setEnviadas((x) => [...x, url]); q.setFoto(url); },
          onError: () => toast({ title: "Não consegui enviar a foto", description: "Tenta outra foto (até 5 MB).", variant: "destructive" }),
        })}
        onContinuar={q.avancar} />;
    case "origem":
      return <PassoOrigem total={TOTAL_PASSOS} onEscolher={q.setOrigem} onVoltar={voltar} />;
    case "custo":
      return r.origem === "faz"
        ? <PassoCustoFaz total={TOTAL_PASSOS} nome={r.nome} custo={r.custo} receitaInicial={r.receita ? rascunhoDaReceita(r.receita, r.rende) : null}
            rendeInicial={r.rende} extrasIniciais={r.extras ?? []} onCusto={q.setCusto} onRende={(n) => q.setPacote(n)} onReceita={q.setReceita} onContinuar={q.avancar} onVoltar={voltar} />
        : <PassoCustoCompra total={TOTAL_PASSOS} nome={r.nome} custo={r.custo} onCusto={q.setCusto} onPacote={(n) => q.setPacote(n)}
            onFaco={() => q.setOrigem("faz")} onContinuar={q.avancar} onVoltar={voltar} />;
    case "sabores":
      return <PassoSabores r={r} total={TOTAL_PASSOS} onSabores={q.setSabores} onContinuar={q.avancar} onVoltar={voltar} />;
    case "preco":
      return <PassoPreco total={TOTAL_PASSOS} parcial={!!r.receita && r.receita.length > 0 && !resumoDoCusto(rascunhoDaReceita(r.receita), r.rende, r.extras ?? []).completo} nome={r.nome} custo={r.custo} preco={r.preco} combo={r.combo}
        onPreco={q.setPreco} onCombo={q.setCombo} onPrecoLivre={q.setPrecoLivre} onContinuar={q.avancar} onVoltar={voltar} />;
    case "revisao":
      return <PassoRevisao r={comEstoqueDosSabores(r)} total={TOTAL_PASSOS} pacote={q.pacote} salvando={salvar.isPending || salvarSabores.isPending} falha={falha} onIr={q.ir}
        onEstoque={q.setEstoque} onSalvar={() => void gravar(r)} onVoltar={voltar}
        onSemEstoque={() => { q.semEstoque(); void gravar({ ...r, controlaEstoque: false, estoque: 0 }); }} />;
    case "pronto":
      return <QuizPronto r={r} onComecarDia={() => navigate("/daily-goals")} onOutro={q.recomecar} onLista={sair}
        onFicha={salvo ? () => navigate(`/products/${salvo}`) : undefined} />;
  }
}
