/* ============================================================
   RAIO-X (aba do Financeiro) — Rick, 27/10/2026. Juntou a antiga aba Análise
   com a tela Raio-X: as duas respondiam "pra onde foi o dinheiro".
   Ordem: período → resumo → o que mais pesou → Vant percebeu → para onde foi →
   precisa de revisão → transferências → suas contas → trabalho x pessoal → dinheiro.
   ============================================================ */
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus } from "lucide-react";
import { SkeletonCard } from "@/shared/components/skeletons";
import { getBrazilMonthStart } from "@/shared/lib/date-utils";
import { COR } from "@/components/financas/planejar/ui";
import { ConviteBanco } from "@/components/financas/FinancasAbas";
import { TetosGastos } from "@/components/financas/TetosGastos";
import { MaisOpcoes } from "./mais-opcoes";
import { RevisarFolha } from "@/components/financas/analise/RevisarFolha";
import { VantPercebeu } from "@/components/financas/analise/VantPercebeu";
import { useAnalise, useCategoriasSaida, useRevisao } from "@/components/financas/analise/use-analise";
import { useLancamentosQuery } from "../api/use-lancamentos-query";
import { useMesesQuery, useResumoQuery } from "../api/use-resumo-query";
import { mesAnterior } from "../lib/raiox";
import { FILTROS_VAZIOS, type CategoriaRX, type Filtros } from "../types";
import { Cabecalho } from "./cabecalho";
import { ResumoMes } from "./resumo-mes";
import { OQueMaisPesou } from "./o-que-pesou";
import { ParaOndeFoi } from "./para-onde-foi";
import { PrecisaRevisao } from "./precisa-revisao";
import { SuasContas, TrabalhoPessoal, Transferencias } from "./blocos-contas";
import { CategoriaDetalhe } from "./categoria-detalhe";
import { BuscaFolha } from "./busca-folha";

export function RaioXAba({ userId, temBanco, onImportar }: { userId?: string; temBanco: boolean; onImportar: () => void }) {
  const navigate = useNavigate();
  const atual = getBrazilMonthStart();
  const [mes, setMes] = useState(atual);
  const [cat, setCat] = useState<CategoriaRX | null>(null);
  const [busca, setBusca] = useState<Filtros | null>(null);
  const [revisar, setRevisar] = useState(false);
  const [tetos, setTetos] = useState(false);
  const ativo = !!userId;
  const mesAnt = mesAnterior(mes);

  const resumo = useResumoQuery(mes, ativo);
  const anterior = useResumoQuery(mesAnt, ativo);
  const analise = useAnalise(mes, ativo);
  const revisao = useRevisao(mes, ativo);
  const meses = useMesesQuery(ativo);
  const lancs = useLancamentosQuery(mes, ativo && (!!cat || !!busca));
  const defs = useCategoriasSaida();

  const refs = useMemo(() => Object.fromEntries((analise.data?.categorias ?? []).map((c) => [c.categoria, c])), [analise.data]);
  const rotulos = useMemo(() => ({
    ...Object.fromEntries((defs.data ?? []).map((c) => [c.slug, c.rotulo])),
    ...Object.fromEntries((resumo.data?.categorias ?? []).map((c) => [c.categoria, c.rotulo])),
    nao_identificado: "Não identificado", transferencia_propria: "Entre minhas contas",
  }), [defs.data, resumo.data]);
  const listaMeses = useMemo(() => [...new Set([...(meses.data ?? []), atual])].sort(), [meses.data, atual]);

  const r = resumo.data;
  if (resumo.isLoading) return <div className="flex flex-col gap-4">{[0, 1, 2].map((i) => <SkeletonCard key={i} className="h-32" />)}</div>;
  const cabecalho = <Cabecalho mes={mes} atual={atual} meses={listaMeses} onMes={setMes} onBuscar={() => setBusca({ ...FILTROS_VAZIOS })} />;
  if (!r || r.lancamentos === 0) {
    return (
      <div className="flex flex-col gap-4">
        {cabecalho}
        <p className="text-[14px]" style={{ color: COR.sub }}>Nada lido nesse mês ainda.</p>
        {!temBanco && <ConviteBanco onLigar={() => navigate("/verificar")} texto="Ligue seu banco e o Raio-X mostra pra onde foi cada real, sozinho." />}
        <MaisOpcoes onImportar={onImportar} />
      </div>
    );
  }

  const corrente = mes === atual;
  const alertas = (analise.data?.alertas ?? []).slice(0, 2);
  const pend = revisao.data?.pendentes ?? [];
  const abrirCat = (slug: string) => { const c = r.categorias.find((x) => x.categoria === slug); if (c) setCat(c); };
  const extrato = (v: string) => navigate(`/financas/extrato?mes=${mes}&v=${v}`);

  return (
    <div className="flex flex-col gap-5 transition-opacity duration-200" style={{ opacity: resumo.isPlaceholderData ? 0.55 : 1 }}>
      {cabecalho}
      <ResumoMes r={r} anterior={anterior.data} mesAnt={mesAnt} analise={analise.data} />
      <OQueMaisPesou cats={r.categorias} refs={refs} corrente={corrente} mesAnt={mesAnt} onAbrir={setCat} />
      {alertas.length > 0 && (
        <section aria-label="Vant percebeu" className="flex flex-col gap-2">
          <h2 className="text-[15px] font-black uppercase tracking-[.08em]" style={{ color: COR.texto }}>Vant percebeu</h2>
          {alertas.map((a) => (
            <VantPercebeu key={a.categoria} alerta={a} corrente={corrente} temTeto={!!refs[a.categoria]?.tem_teto} onVer={() => abrirCat(a.categoria)} />
          ))}
        </section>
      )}
      <ParaOndeFoi cats={r.categorias} refs={refs} corrente={corrente} mesAnt={mesAnt} onAbrir={setCat} onTetos={() => setTetos(true)} />
      <PrecisaRevisao qtd={pend.length} total={pend.reduce((s, p) => s + p.valor, 0)} perguntas={revisao.data?.perguntas ?? r.perguntas}
        onRevisar={() => setRevisar(true)} onPerguntas={() => extrato("perguntas")} />
      <Transferencias r={r} onVer={() => setBusca({ ...FILTROS_VAZIOS, transferencias: true })} />
      <SuasContas r={r} />
      <TrabalhoPessoal r={r} onVer={() => setBusca({ ...FILTROS_VAZIOS, esfera: "corre", tipo: "saida" })} />
      <button type="button" onClick={() => extrato("manual")}
        className="self-start min-h-11 inline-flex items-center gap-1.5 text-[14px] font-bold rounded-[12px] px-1 transition-colors active:bg-white/[.05]" style={{ color: COR.sub }}>
        <Plus className="w-4 h-4" /> Lançar gasto em dinheiro
      </button>
      <MaisOpcoes onImportar={onImportar} />

      <CategoriaDetalhe cat={cat} lista={lancs.data ?? []} carregando={lancs.isLoading} rotulos={rotulos} mesAnt={mesAnt} onFechar={() => setCat(null)} />
      <BuscaFolha aberta={!!busca} inicial={busca ?? FILTROS_VAZIOS} lista={lancs.data ?? []} bancos={r.bancos} rotulos={rotulos} onFechar={() => setBusca(null)} />
      <RevisarFolha aberta={revisar} pendentes={pend} onFechar={() => setRevisar(false)} />
      {tetos && <TetosGastos historico={Object.fromEntries((analise.data?.categorias ?? []).map((c) => [c.categoria, c.historico]))} onFechar={() => setTetos(false)} onSalvo={() => void analise.refetch()} />}
    </div>
  );
}
