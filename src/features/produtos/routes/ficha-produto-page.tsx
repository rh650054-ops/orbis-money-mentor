/* /products/:id — a ficha completa do produto numa tela só (Rick, 12/10/2026).
   Substitui a edição pelo quiz e a "Ficha técnica" escondida em /products/ficha. */
import { useMemo, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/shared/hooks/use-toast";
import { mapSupabaseError } from "@/shared/api";
import { useProdutosQuery } from "../api/use-produtos-query";
import { useReceitaQuery } from "../api/use-receita-query";
import { useApagarProdutoMutation } from "../api/use-produto-mutations";
import { useSalvarFichaMutation } from "../api/use-salvar-ficha-mutation";
import { useSubirFotoMutation } from "../api/use-subir-foto-mutation";
import { custoDaFicha, fichaDe, problemaDaFicha, type Ficha } from "../lib/ficha";
import { levasPossiveis } from "../lib/receitas";
import { CarregandoProdutos } from "../components/carregando-produtos";
import { FichaCabecalho } from "../components/ficha-cabecalho";
import { FichaPreco } from "../components/ficha-preco";
import { FichaOrigem } from "../components/ficha-origem";
import { FichaEstoque } from "../components/ficha-estoque";
import { CardLucro } from "../components/passo-preco";
import { BotaoOuro } from "../components/quiz-casca";

export default function FichaProdutoPage() {
  const { id = "" } = useParams<{ id: string }>();
  const { user } = useAuth();
  const lista = useProdutosQuery(user?.id, { sempreFresco: true });
  const receita = useReceitaQuery(id);
  const produto = useMemo(() => lista.data?.find((p) => p.id === id), [id, lista.data]);
  if (lista.isError || receita.isError) {
    return <p className="text-center font-bold py-16 text-[#F4F1EA]">Não consegui abrir o produto. Volta e tenta de novo.</p>;
  }
  if (!lista.isFetchedAfterMount || !receita.data) return <CarregandoProdutos />;
  if (!produto) return <Navigate to="/products" replace />;
  const inicial = fichaDe(produto, receita.data);
  const estoques = new Map(receita.data.map((i) => [i.nome.trim().toLowerCase(), i.estoque]));
  return <Tela key={produto.id} id={produto.id} inicial={inicial} estoques={estoques} userId={user?.id} />;
}

function Tela({ id, inicial, estoques, userId }: { id: string; inicial: Ficha; estoques: Map<string, number>; userId?: string }) {
  const navigate = useNavigate();
  const [f, setF] = useState<Ficha>(inicial);
  const mudar = (m: Partial<Ficha>) => setF((x) => ({ ...x, ...m }));
  const [confirmaTirar, setConfirmaTirar] = useState(false);
  const salvar = useSalvarFichaMutation(userId, id, inicial);
  const foto = useSubirFotoMutation(userId);
  const apagar = useApagarProdutoMutation();
  const problema = problemaDaFicha(f);
  const custo = custoDaFicha(f);
  const usados = f.itens.filter((i) => i.usa && i.qtd > 0);
  const levas = f.origem === "faz" && usados.length > 0
    ? levasPossiveis(usados.map((i) => ({ qtd: i.qtd, estoque: estoques.get(i.nome.trim().toLowerCase()) ?? 0 }))) : null;

  const gravar = () => salvar.mutate(f, {
    onSuccess: () => { toast({ title: `${f.nome.trim()} salvo` }); navigate("/products"); },
    onError: (e) => toast({ title: "Não consegui salvar", description: mapSupabaseError(e).message, variant: "destructive" }),
  });

  return (
    <div className="text-[#F4F1EA] max-w-md mx-auto flex flex-col gap-3 pt-2 pb-48">
      <FichaCabecalho nome={f.nome} foto={f.foto} emoji={f.emoji} enviandoFoto={foto.isPending} onVoltar={() => navigate("/products")}
        onNome={(nome, emoji) => mudar({ nome, emoji })}
        onFoto={(file) => foto.mutate(file, {
          onSuccess: (url) => mudar({ foto: url }),
          onError: () => toast({ title: "Não consegui enviar a foto", description: "Tenta outra foto (até 5 MB).", variant: "destructive" }),
        })} />
      <FichaPreco f={f} onMudar={mudar} />
      <FichaOrigem f={f} estoques={estoques} onMudar={mudar} />
      {!f.precoLivre && f.preco > 0 && custo.valor > 0 && <CardLucro preco={f.preco} custo={custo.valor} />}
      <FichaEstoque f={f} levas={levas} onMudar={mudar} />
      <button type="button" onClick={() => navigate("/products/mercado")} className="rounded-2xl px-3.5 py-3 text-left text-[13px] font-extrabold"
        style={{ background: "#0f0f10", border: "1px dashed #3a3833", color: "#d8d2c4" }}>
        🛒 Foi no mercado? Anota a compra e o estoque sobe sozinho ›
      </button>
      <button type="button" className="h-11 rounded-xl text-sm font-extrabold" style={{ color: "#ff7a6b" }}
        onClick={() => {
          if (!confirmaTirar) { setConfirmaTirar(true); return; }
          apagar.mutate(id, { onSuccess: () => { toast({ title: `${f.nome} saiu da lista` }); navigate("/products"); } });
        }}>
        {confirmaTirar ? "Toca de novo pra tirar (as vendas antigas continuam)" : "Tirar da lista"}
      </button>
      <div className="fixed left-0 right-0 z-40 px-4 max-w-md mx-auto flex flex-col gap-1.5" style={{ bottom: "calc(env(safe-area-inset-bottom) + 6rem)", paddingRight: 88 }}>
        {problema && <p className="text-center text-[12px] font-bold" style={{ color: "#F5B800" }}>{problema}</p>}
        <BotaoOuro onClick={gravar} disabled={!!problema || salvar.isPending}>{salvar.isPending ? "SALVANDO…" : "SALVAR"}</BotaoOuro>
      </div>
    </div>
  );
}
