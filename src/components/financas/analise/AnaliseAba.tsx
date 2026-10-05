/* ============================================================
   ABA ANÁLISE (Finanças) — redesenho 05/10/2026 (prompt do Mohamed + ajustes de UX).
   Ordem: gastos do mês → Vant percebeu → onde você gastou → para revisar →
   Raio-X → ferramentas → mais opções. Resumo → anormal → categorias → revisão → investigação.
   ============================================================ */
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { SkeletonCard } from "@/shared/components/skeletons";
import { getBrazilMonthStart } from "@/shared/lib/date-utils";
import { ConviteBanco } from "../FinancasAbas";
import { TetosGastos } from "../TetosGastos";
import { CategoriaFolha } from "./CategoriaFolha";
import { Ferramentas, MaisOpcoes, RaioXCard } from "./Extras";
import { GastosMes } from "./GastosMes";
import { OndeGastou } from "./OndeGastou";
import { ParaRevisar } from "./ParaRevisar";
import { RevisarFolha } from "./RevisarFolha";
import { VantPercebeu } from "./VantPercebeu";
import { escolherAlerta, somaMes, type Aberta } from "./tipos";
import { useAnalise, useRevisao } from "./use-analise";

const MESES_ATRAS = 12;

export function AnaliseAba({ userId, temBanco, onImportar }: { userId?: string; temBanco: boolean; onImportar: () => void }) {
  const navigate = useNavigate();
  const atual = getBrazilMonthStart();
  const [mes, setMes] = useState(atual);
  const [aberta, setAberta] = useState<Aberta | null>(null);
  const [tetos, setTetos] = useState(false);
  const [revisar, setRevisar] = useState(false);
  const analise = useAnalise(mes, !!userId);
  const revisao = useRevisao(mes, !!userId);
  const a = analise.data;

  const cats = useMemo(() => a?.categorias ?? [], [a]);
  const historico = useMemo(() => Object.fromEntries(cats.map((c) => [c.categoria, c.historico])), [cats]);
  const pendentesPorCat = useMemo(() => {
    const m: Record<string, number> = {};
    for (const p of revisao.data?.pendentes ?? []) m[p.categoria] = (m[p.categoria] ?? 0) + 1;
    return m;
  }, [revisao.data]);

  if (!a) {
    return <div className="flex flex-col gap-4">{[0, 1, 2].map((i) => <SkeletonCard key={i} className="h-32" />)}</div>;
  }

  const alerta = escolherAlerta(a.alertas ?? [], cats.find((c) => c.total > 0)?.categoria);
  const r = revisao.data;
  const trocando = analise.isPlaceholderData;
  const abrirRaioX = (extra = "") => navigate(`/financas/extrato?mes=${a.mes}${extra}`);

  return (
    <div className="flex flex-col gap-6 transition-opacity duration-[180ms]" style={{ opacity: trocando ? 0.55 : 1 }}>
      <GastosMes a={a} negocio={a.negocio?.total ?? 0} podeVoltar={mes > somaMes(atual, -MESES_ATRAS)}
        onMes={(p) => setMes((m) => (p > 0 && m >= atual ? m : somaMes(m, p)))} />

      {alerta && (
        <VantPercebeu alerta={alerta} corrente={a.corrente}
          temTeto={!!cats.find((c) => c.categoria === alerta.categoria)?.tem_teto}
          onVer={() => { const c = cats.find((x) => x.categoria === alerta.categoria); if (c) setAberta({ tipo: "categoria", cat: c }); }} />
      )}

      <OndeGastou cats={cats} gasto={a.gasto ?? 0} corrente={a.corrente} negocio={a.negocio} pendentesPorCat={pendentesPorCat}
        onAbrir={(c) => setAberta({ tipo: "categoria", cat: c })}
        onNegocio={() => a.negocio && setAberta({ tipo: "negocio", negocio: a.negocio })}
        onTetos={() => setTetos(true)} />

      {r && (r.total_pendentes > 0 || r.organizados > 0) && (
        <ParaRevisar r={r} onRevisar={() => setRevisar(true)} onPerguntas={() => abrirRaioX("&v=perguntas")} />
      )}

      {temBanco ? <RaioXCard onAbrir={() => abrirRaioX()} />
        : <ConviteBanco onLigar={() => navigate("/verificar")} texto="Liga seu banco e a Vant organiza cada gasto sozinha, sem você lançar." />}

      <Ferramentas onCusto={() => navigate("/custo-produto")} />
      <MaisOpcoes onImportar={onImportar} />

      <CategoriaFolha aberta={aberta} mes={a.mes} corrente={a.corrente} dia={a.dia} onFechar={() => setAberta(null)} />
      <RevisarFolha aberta={revisar} pendentes={r?.pendentes ?? []} onFechar={() => setRevisar(false)} />
      {tetos && <TetosGastos historico={historico} onFechar={() => setTetos(false)} onSalvo={() => void analise.refetch()} />}
    </div>
  );
}
