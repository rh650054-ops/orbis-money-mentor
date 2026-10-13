/* /products/mercado — "Tô no mercado" (Rick, 12/10): o vendedor anota o que
   está comprando, vê ao vivo quantas receitas aquilo vira e, ao concluir, o
   estoque sobe na hora (ingrediente vira produto pronto). */
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/shared/hooks/use-toast";
import { useMercadoQuery } from "../api/use-mercado-query";
import { useConcluirCompraMutation, type ResultadoCompra } from "../api/use-concluir-compra-mutation";
import { useMercado, type ModoPreco } from "../hooks/use-mercado";
import { produtosDoIngrediente, type PreviaMercado } from "../lib/mercado";
import { CarregandoProdutos } from "../components/carregando-produtos";
import { CampoDinheiro, DuasAbas } from "../components/campos";
import { BotaoOuro } from "../components/quiz-casca";
import { MercadoCasca } from "../components/mercado-casca";
import { MercadoChips } from "../components/mercado-chips";
import { MercadoLinha, type OpcaoPara } from "../components/mercado-linha";
import { MercadoPrevia } from "../components/mercado-previa";
import { MercadoPronto } from "../components/mercado-pronto";

export default function MercadoPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: base, isLoading, isError, refetch } = useMercadoQuery(user?.id);
  const m = useMercado(base);
  const concluir = useConcluirCompraMutation();
  const [feito, setFeito] = useState<{ r: ResultadoCompra; prontos: PreviaMercado["prontos"] } | null>(null);

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
    return <MercadoPronto resultado={feito.r} prontos={feito.prontos} onProdutos={voltar} onDia={() => navigate("/daily-goals")} />;
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
  const fechar = () => {
    const prontos = m.previa.prontos;
    concluir.mutate({ itens: m.itens(), porItem, total: porItem ? null : m.total || null }, {
      onSuccess: (r) => setFeito({ r, prontos }),
      onError: () => toast({ title: "Não consegui concluir a compra", description: "Tenta de novo.", variant: "destructive" }),
    });
  };
  const ingDe = (id: string | null) => base.ingredientes.find((i) => i.id === id);
  const unidadeDe = (id: string | null) => {
    const i = ingDe(id);
    if (!i) return undefined;
    const pac = i.pacote_qtd ?? 1;
    return pac > 1 ? `pacote de ${pac.toLocaleString("pt-BR")} ${i.unit}` : i.unit;
  };

  return (
    <MercadoCasca titulo="Tô no mercado" sub="Anota o que você tá comprando. O estoque sobe sozinho." onVoltar={voltar}
      rodape={(
        <>
          {!porItem && <CampoDinheiro rotulo="Quanto deu a compra? (opcional)" valor={m.total} onChange={m.setTotal} />}
          {pendente && <span className="text-[12px] font-bold text-center" style={{ color: "#F5B800" }}>Falta escolher pra qual produto vai.</span>}
          <BotaoOuro onClick={fechar} disabled={!m.podeConcluir || concluir.isPending}>
            {concluir.isPending ? "CONCLUINDO…" : "CONCLUIR COMPRA"}
          </BotaoOuro>
        </>
      )}>
      <DuasAbas<ModoPreco> valor={m.modo} onChange={m.setModo} opcoes={[["item", "Item por item"], ["total", "Só o total"]]} />
      <MercadoChips base={base} onAdicionar={m.adicionar} />
      {m.linhas.map((l, i) => (
        <MercadoLinha key={l.key} linha={l} porItem={porItem} subtotal={m.subtotais[i] ?? 0}
          opcoesPara={l.tipo === "ingrediente" ? opcoesDe(l.id) : []}
          unidade={l.tipo === "ingrediente" ? unidadeDe(l.id) : undefined}
          emPacote={l.tipo === "ingrediente" && (ingDe(l.id)?.pacote_qtd ?? 1) > 1}
          onMudar={(patch) => m.mudar(l.key, patch)} onTirar={() => m.tirar(l.key)} />
      ))}
      {m.temItem && <MercadoPrevia previa={m.previa} totalItens={porItem ? m.totalItens : undefined} />}
    </MercadoCasca>
  );
}
