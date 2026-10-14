/* /products/mercado — "Tô no mercado" (Rick, 12/10 e 14/10): escolhe pra qual
   produto está comprando (a receita já traz os ingredientes), anota quantidade e
   preço, vê o custo de cada unidade e se pagou mais caro, e ao concluir o
   estoque sobe na hora e a VANT confere a compra no banco. */
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/shared/hooks/use-toast";
import { useMercadoQuery } from "../api/use-mercado-query";
import { useConcluirCompraMutation, type ResultadoCompra } from "../api/use-concluir-compra-mutation";
import { useMercado, type ModoPreco } from "../hooks/use-mercado";
import { produtosDoIngrediente, type PreviaMercado } from "../lib/mercado";
import { compararPreco } from "../lib/mercado-produto";
import { CarregandoProdutos } from "../components/carregando-produtos";
import { CampoDinheiro, DuasAbas } from "../components/campos";
import { BotaoOuro } from "../components/quiz-casca";
import { MercadoCasca } from "../components/mercado-casca";
import { MercadoChips } from "../components/mercado-chips";
import { MercadoLinha, type OpcaoPara } from "../components/mercado-linha";
import { MercadoPrevia, PrimeiraCompra } from "../components/mercado-previa";
import { MercadoPronto, type ResumoCompra } from "../components/mercado-pronto";
import { MercadoProdutoEscolha } from "../components/mercado-produto-escolha";
import { MercadoTotal } from "../components/mercado-total";

export default function MercadoPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: base, isLoading, isError, refetch } = useMercadoQuery(user?.id);
  const m = useMercado(base);
  const concluir = useConcluirCompraMutation();
  const [feito, setFeito] = useState<{ r: ResultadoCompra; prontos: PreviaMercado["prontos"]; resumo: ResumoCompra } | null>(null);

  const opcoesDe = useMemo(() => {
    const cache = new Map<string, OpcaoPara[]>();
    return (ingId: string | null): OpcaoPara[] => {
      if (!base || !ingId) return [];
      const ja = cache.get(ingId);
      if (ja) return ja;
      const ids = produtosDoIngrediente(ingId, base);
      const ops = base.produtos.filter((p) => ids.includes(p.id)).map((p) => ({ id: p.id, nome: p.name, emoji: p.emoji }));
      cache.set(ingId, ops);
      return ops;
    };
  }, [base]);

  const voltar = () => navigate("/products");
  if (isLoading) return <CarregandoProdutos />;
  if (isError || !base) {
    return (
      <div className="min-h-[100dvh] bg-black text-[#F4F1EA] flex flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="font-bold">Não consegui abrir o mercado.</p>
        <button type="button" onClick={() => refetch()} className="underline font-extrabold" style={{ color: "#F5B800" }}>Tentar de novo</button>
      </div>
    );
  }
  if (feito) {
    return <MercadoPronto resultado={feito.r} prontos={feito.prontos} resumo={feito.resumo} onProdutos={voltar}
      onDia={() => navigate("/daily-goals")} onLigarBanco={() => navigate("/verificar")} />;
  }
  if (base.produtos.length === 0) {
    return (
      <MercadoCasca titulo="Tô no mercado" onVoltar={voltar} rodape={<BotaoOuro onClick={() => navigate("/products/novo")}>CADASTRAR PRODUTO</BotaoOuro>}>
        <p className="text-[14px] font-bold" style={{ color: "#b9b3a6" }}>
          Você ainda não tem produto cadastrado. Cadastra o que você vende (e a receita, se você faz) que a VANT
          transforma cada compra do mercado em estoque pronto pra vender.
        </p>
      </MercadoCasca>
    );
  }

  const porItem = m.modo === "item";
  const pendente = m.previa.pendentes.length > 0;
  const ingDe = (id: string | null) => base.ingredientes.find((i) => i.id === id);
  const pacoteDe = (id: string | null) => Math.max(ingDe(id)?.pacote_qtd ?? 1, 1);
  const unidadeDe = (id: string | null) => {
    const i = ingDe(id);
    if (!i) return undefined;
    return pacoteDe(id) > 1 ? `pacote de ${pacoteDe(id).toLocaleString("pt-BR")} ${i.unit}` : i.unit;
  };
  const ultimoDe = (id: string | null) => {
    const porUn = id ? base.ultimos?.[id] ?? ingDe(id)?.cost_per_unit ?? 0 : 0;
    return porUn > 0 ? porUn * pacoteDe(id) : undefined;
  };
  const nomeFoco = base.produtos.find((p) => p.id === m.foco)?.name ?? "";
  const comValor = m.linhas.filter((l) => l.qtd > 0);

  const fechar = () => {
    const prontos = m.previa.prontos;
    const nova = m.novaReceita();
    const resumo: ResumoCompra = {
      quando: new Date(),
      itens: comValor.length,
      precos: porItem ? comValor.flatMap((l) => {
        const c = compararPreco(l, base);
        return c && l.precoUnit ? [{ nome: l.nome, antes: c.antes, agora: l.precoUnit, diferenca: c.diferenca, pct: c.pct }] : [];
      }) : [],
      vendas: Object.fromEntries(base.produtos.map((p) => [p.id, p.sale_price ?? 0])),
      receitaNova: nova ? { nome: nomeFoco, rende: nova.rende } : null,
    };
    concluir.mutate({ itens: m.itens(), porItem, total: porItem ? null : m.total || null, novaReceita: nova }, {
      onSuccess: (r) => setFeito({ r, prontos, resumo }),
      onError: () => toast({ title: "Não consegui concluir a compra", description: "Tenta de novo.", variant: "destructive" }),
    });
  };

  return (
    <MercadoCasca titulo="Tô no mercado" sub="Anota o que você tá comprando. O estoque sobe sozinho." onVoltar={voltar}
      rodape={(
        <>
          {porItem ? <MercadoTotal total={m.totalCompra} itens={comValor.length} porItem />
            : <CampoDinheiro rotulo="Quanto deu a compra?" valor={m.total} onChange={m.setTotal} />}
          {pendente && <span className="text-[12px] font-bold text-center" style={{ color: "#F5B800" }}>Falta escolher pra qual produto vai.</span>}
          <BotaoOuro onClick={fechar} disabled={!m.podeConcluir || concluir.isPending}>
            {concluir.isPending ? "CONCLUINDO…" : "CONCLUIR COMPRA"}
          </BotaoOuro>
        </>
      )}>
      <MercadoProdutoEscolha base={base} foco={m.foco} primeiraVez={m.primeiraVez} onEscolher={m.escolherProduto} />
      <DuasAbas<ModoPreco> valor={m.modo} onChange={m.setModo} opcoes={[["item", "Item por item"], ["total", "Só o total"]]} />
      {m.linhas.map((l, i) => (
        <MercadoLinha key={l.key} linha={l} porItem={porItem} subtotal={m.subtotais[i] ?? 0}
          opcoesPara={l.tipo === "ingrediente" ? opcoesDe(l.id) : []}
          unidade={l.tipo === "ingrediente" ? unidadeDe(l.id) : undefined}
          emPacote={l.tipo === "ingrediente" && pacoteDe(l.id) > 1}
          comparacao={compararPreco(l, base)} ultimoPreco={l.tipo === "ingrediente" ? ultimoDe(l.id) : undefined}
          onMudar={(patch) => m.mudar(l.key, patch)} onTirar={() => m.tirar(l.key)} />
      ))}
      <MercadoChips base={base} noCarrinho={m.linhas.flatMap((l) => (l.tipo === "ingrediente" && l.id ? [l.id] : []))} onAdicionar={m.adicionar} />
      {m.primeiraVez && m.temItem && (
        <PrimeiraCompra nome={nomeFoco} unidades={m.unidades} total={m.totalCompra} onUnidades={m.setUnidades} />
      )}
      {!m.primeiraVez && m.temItem && <MercadoPrevia previa={m.previa} custos={m.custos} />}
    </MercadoCasca>
  );
}

