/* /products/mercado — "Tô no mercado" (Rick, 12/10 e 14/10): escolhe pra qual
   produto está comprando (a receita já traz os ingredientes), anota quantidade e
   preço, vê o custo de cada unidade e se pagou mais caro, e ao concluir o
   estoque sobe na hora e a VANT confere a compra no banco. */
import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/shared/hooks/use-toast";
import { useMercadoQuery } from "../api/use-mercado-query";
import { useConcluirCompraMutation, type ResultadoCompra } from "../api/use-concluir-compra-mutation";
import { useMercado, type ModoPreco } from "../hooks/use-mercado";
import { produtosDoIngrediente, type PreviaMercado } from "../lib/mercado";
import { aplicarDesconto, compararPreco, sugestaoPorReceita } from "../lib/mercado-produto";
import { reais } from "../components/campos";
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
  // veio do "Tô no mercado" do Foco: voltar e concluir devolvem pro Foco (Rick, 19/10)
  const [params] = useSearchParams();
  const doFoco = params.get("de") === "foco";
  const { user } = useAuth();
  const { data: base, isLoading, isError, refetch } = useMercadoQuery(user?.id);
  const m = useMercado(base);
  const concluir = useConcluirCompraMutation();
  // desconto no caixa (clube, cupom) — só no fim da compra
  const [desconto, setDesconto] = useState(0);
  const [comDesconto, setComDesconto] = useState(false);
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

  const voltar = () => navigate(doFoco ? "/daily-goals" : "/products");
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
    const desc = comDesconto ? Math.min(desconto, m.totalCompra) : 0;
    const itens = porItem ? aplicarDesconto(m.itens(), m.totalCompra, desc) : m.itens();
    const total = porItem ? null : (m.total - desc) || null;
    concluir.mutate({ itens, porItem, total, novaReceita: nova }, {
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
          {m.totalCompra > 0 && (comDesconto ? (
            <div className="flex flex-col gap-1.5">
              <CampoDinheiro rotulo="Quanto foi o desconto? (clube, cupom…)" valor={desconto} onChange={setDesconto} />
              {desconto > 0 && (
                <span className="text-[13px] font-bold text-center" style={{ color: "#b9b3a6" }}>
                  Você pagou <b style={{ color: "#4ADE80" }}>{reais(Math.max(0, m.totalCompra - desconto))}</b>
                  <button type="button" onClick={() => { setComDesconto(false); setDesconto(0); }} className="ml-2 underline" style={{ color: "#7b766e" }}>tirar</button>
                </span>
              )}
            </div>
          ) : (
            <button type="button" onClick={() => setComDesconto(true)} className="text-[13px] font-extrabold" style={{ color: "#F5B800" }}>
              Teve desconto no caixa?
            </button>
          ))}
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
        <PrimeiraCompra nome={nomeFoco} unidades={m.unidades} rende={m.rende} total={m.totalCompra}
          onUnidades={m.setUnidades} onRende={m.setRende} onItem={m.mudarPorReceita}
          itens={m.emUn.filter((l) => l.qtd > 0 && (l.tipo === "ingrediente" || l.tipo === "novo")).map((l) => ({
            key: l.key, nome: l.nome,
            unidade: l.tipo === "ingrediente" ? ingDe(l.id)?.unit ?? "" : "",
            sugestao: sugestaoPorReceita(l.qtd, m.unidades, m.rende),
            valor: m.porReceita[l.key],
          }))} />
      )}
      {!m.primeiraVez && m.temItem && <MercadoPrevia previa={m.previa} custos={m.custos} />}
    </MercadoCasca>
  );
}

