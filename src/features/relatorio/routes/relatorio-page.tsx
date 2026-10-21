import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import FeatureErrorBoundary from "@/shared/components/feature-error-boundary";
import { useAuth } from "@/hooks/useAuth";
import FirstTimeCard from "@/components/FirstTimeCard";
import { useMarcarPasso } from "@/components/jornada/useJornada";
import { useConferenciaBanco } from "@/components/relatorio/ConferenciaBanco";
import { usePixDoBanco } from "@/components/conectar/banco-pix";
import { FechamentoDoDia } from "@/components/relatorio/FechamentoDoDia";
import { useCaloteBancoQuery, useGastosBancoQuery, useRelatorioQuery, relatorioKeys } from "../api/use-relatorio-query";
import { comGastosBanco } from "../lib/gastos-banco";
import { derivar } from "../lib/derivar";
import { hojeBR, periodoDoPreset, rotuloAnterior } from "../lib/periodo";
import type { Periodo } from "../types";
import { Acoes } from "../components/acoes";
import { BlocoCalote } from "../components/bloco-calote";
import { BlocoGastos } from "../components/bloco-gastos";
import { BlocoHoraAHora } from "../components/bloco-hora-a-hora";
import { BlocoRecebeu } from "../components/bloco-recebeu";
import { BlocoTempo } from "../components/bloco-tempo";
import { BlocoVantViu } from "../components/bloco-vant-viu";
import { CardDinheiro } from "../components/card-dinheiro";
import { CardVendas } from "../components/card-vendas";
import { GraficoDias } from "../components/grafico-dias";
import { FiltroPeriodo } from "../components/filtro-periodo";
import { RelatorioSkeleton } from "../components/relatorio-skeleton";

/**
 * Relatório (redesign 18/10/2026, mockup v10 approved by Rick).
 * Dashboard answers "quanto estou fazendo?"; this screen answers "como estou vendendo?".
 * Order: filtro → dinheiro (the card people screenshot) → gráfico dia a dia (tap a day,
 * Rick 19/10) → [fechamento do dia] → vendas → hora a hora → seu tempo → como recebeu →
 * seus gastos → calote → o que a Vant viu → compartilhar / exportar.
 * Rule of the whole page: every number appears once.
 */
function RelatorioConteudo() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [periodo, setPeriodo] = useState<Periodo>(() => periodoDoPreset("semana", hojeBR()));
  useMarcarPasso("relatorio");

  const rel = useRelatorioQuery(periodo.de, periodo.ate);
  const banco = useConferenciaBanco(periodo.de, periodo.ate);
  // "Conferido pelo banco" mora só na aba Vender (Rick, 18/10); aqui só sabemos se tem banco.
  const { pix: pixBanco } = usePixDoBanco(!!user, 10 * 60_000);
  const caiuDepois = useCaloteBancoQuery(periodo.de, periodo.ate, pixBanco.temBanco);
  // com banco, os gastos também vêm do banco (mercadoria, Uber/99, comida do dia de rua)
  const gastosAt = useGastosBancoQuery(periodo.de, periodo.ate, pixBanco.temBanco);
  const gastosAnt = useGastosBancoQuery(rel.data?.anterior.de ?? "", rel.data?.anterior.ate ?? "", pixBanco.temBanco && !!rel.data);
  const relFinal = useMemo(() => (rel.data ? comGastosBanco(rel.data, gastosAt.data, gastosAnt.data) : undefined), [rel.data, gastosAt.data, gastosAnt.data]);
  const resumo = useMemo(() => (relFinal ? derivar(relFinal, banco, periodo, rotuloAnterior(periodo),
    // com banco: "caiu depois" é o que o banco leu (quem tem banco não edita à mão)
    pixBanco.temBanco ? caiuDepois.data ?? { total: 0, n: 0 } : null) : null), [relFinal, banco, periodo, caiuDepois.data, pixBanco.temBanco]);

  const hoje = hojeBR();
  const bancoDoDia = resumo?.umDia ? banco.find((d) => d.dia === periodo.de) ?? null : null;

  return (
    <div className="orbis-stagger space-y-4 pb-4 text-foreground md:pb-8">
      <FirstTimeCard tela="relatorio" userId={user?.id} />
      <h1 className="font-display text-[22px] font-extrabold tracking-tight">Relatório</h1>
      <FiltroPeriodo periodo={periodo} onChange={setPeriodo} diasNaRua={resumo?.diasNaRua ?? 0} />

      {rel.isPending && <RelatorioSkeleton />}
      {rel.isError && (
        <div className="rounded-2xl border border-border bg-card p-4 text-sm">
          <p className="font-semibold">Não consegui montar o relatório.</p>
          <p className="mt-1 text-muted-foreground">{rel.error instanceof Error ? rel.error.message : "Tenta de novo em instantes."}</p>
          <button className="orbis-press mt-3 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground" onClick={() => rel.refetch()}>Tentar de novo</button>
        </div>
      )}

      {resumo && (
        <>
          {/* 21/10 (Mohamed): on a single day the closing (vendeu × caiu × faltou) comes first */}
          {resumo.umDia && user && (
            <FechamentoDoDia
              userId={user.id}
              date={periodo.de}
              dia={resumo.semDados ? null : { total_profit: rel.data!.atual.dinheiro.caiu, total_debt: rel.data!.atual.dinheiro.faltou, cash_sales: rel.data!.atual.dinheiro.dinheiro, pix_sales: rel.data!.atual.dinheiro.pix, card_sales: rel.data!.atual.dinheiro.cartao, unpaid_units: rel.data!.atual.calote.unidades }}
              travado={pixBanco.temBanco}
              banco={bancoDoDia ? { pix: bancoDoDia.caiu - bancoDoDia.maquininha, cartao: bancoDoDia.maquininha, hoje: periodo.de === hoje } : null}
              onChanged={() => { void qc.invalidateQueries({ queryKey: relatorioKeys.all }); void qc.invalidateQueries({ queryKey: ["relatorio", "banco-conferencia"] }); }}
            />
          )}
          <CardDinheiro r={resumo} />
          {!resumo.umDia && !resumo.semDados && (
            <GraficoDias r={resumo} onAbrirDia={(dia) => { setPeriodo(periodoDoPreset("custom", hoje, { de: dia, ate: dia })); window.scrollTo({ top: 0, behavior: "smooth" }); }} />
          )}

          {resumo.semDados ? (
            <div className="rounded-2xl border border-dashed border-border p-5 text-center text-sm text-muted-foreground">
              Nada registrado nesse período. Liga o <b className="font-semibold text-foreground">Modo Foco</b> no próximo dia de rua e o relatório se monta sozinho.
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2.5 pt-1 text-[11px] font-bold uppercase tracking-[.12em] text-primary">
                <span className="h-px flex-1 bg-[rgba(245,184,0,.25)]" />Como você vendeu<span className="h-px flex-1 bg-[rgba(245,184,0,.25)]" />
              </div>
              <CardVendas r={resumo} />
              <BlocoHoraAHora r={resumo} />
              <BlocoTempo r={resumo} />
              <BlocoRecebeu r={resumo} />
              <BlocoGastos r={resumo} peloBanco={!!gastosAt.data} />
              <BlocoCalote r={resumo} />
              <BlocoVantViu r={resumo} />
              {user && <Acoes r={resumo} userId={user.id} />}
            </>
          )}
        </>
      )}
    </div>
  );
}

export default function RelatorioPage() {
  return (
    <FeatureErrorBoundary title="Relatório">
      <RelatorioConteudo />
    </FeatureErrorBoundary>
  );
}
