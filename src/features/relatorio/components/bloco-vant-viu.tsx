import { useState } from "react";
import { supabase } from "@/shared/api";
import type { Insight, Resumo } from "../lib/derivar";
import { rotuloPeriodo } from "../lib/periodo";
import { COR, Cartao, Secao } from "./ui-bits";

const TOM: Record<Insight["tom"], string> = { gold: COR.gold, ok: COR.ok, bad: COR.calote };

/** Body the `generate-insights` edge function already understands (type report_analysis). */
function corpoAnalise(r: Resumo) {
  return {
    type: "report_analysis",
    periodo: rotuloPeriodo(r.periodo),
    rangeLabel: rotuloPeriodo(r.periodo),
    faturamento: r.dinheiro.caiu,
    lucro: r.dinheiro.sobrou,
    ticketMedio: r.vendas.ticket ?? 0,
    conversao: r.vendas.conv ?? 0,
    totalAbordagens: r.vendas.abordagens,
    totalVendas: r.vendas.vendas,
    abordagensPorVenda: r.vendas.abordPorVenda ?? 0,
    mediaDiaria: r.diasNaRua > 0 ? r.dinheiro.caiu / r.diasNaRua : 0,
    custoMercadoria: r.gastos.linhas.find((l) => l.chave === "mercadoria")?.valor ?? 0,
    custoOperacao: r.gastos.linhas.filter((l) => l.chave === "transporte" || l.chave === "alimentacao").reduce((s, l) => s + l.valor, 0),
    custosOperacionais: r.gastos.total,
    calotes: r.calote.total,
    caloteUnidades: r.calote.unidades,
    comparePct: r.dinheiro.delta?.valor ?? 0,
    gastos: r.gastos.linhas.map((l) => ({ category: l.nome, total: l.valor, count: 0 })),
    melhoresHorarios: r.horas.periodos.filter((p) => p.vendas > 0).sort((a, b) => b.valor - a.valor).slice(0, 3).map((p) => ({ label: `${p.nome} ${p.faixa}`, avg: p.valor })),
  };
}

/** "O que a Vant viu": 1–3 sentences born from the period's numbers (no empty
 *  "analyse with AI" button). The full AI analysis stays one tap away, as before. */
export function BlocoVantViu({ r }: { r: Resumo }) {
  const [analise, setAnalise] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  if (r.insights.length === 0 && !analise) return null;

  async function analisar() {
    setCarregando(true); setErro(null);
    try {
      const { data, error } = await supabase.functions.invoke("generate-insights", { body: corpoAnalise(r) });
      if (error) throw error;
      const d = data as { analise?: string; error?: string } | null;
      if (d?.error) throw new Error(d.error);
      setAnalise(d?.analise ?? "A Vant não achou nada a mais pra dizer desse período.");
    } catch {
      setErro("Não deu pra gerar a análise agora. Tenta de novo em instantes.");
    } finally {
      setCarregando(false);
    }
  }

  return (
    <Secao kicker="O que a Vant viu" right={!analise ? <button className="font-semibold text-primary" onClick={analisar} disabled={carregando}>{carregando ? "Analisando…" : "Ver análise completa ›"}</button> : null}>
      <Cartao>
        <div className="grid gap-2.5">
          {r.insights.map((i, k) => (
            <div key={k} className="grid grid-cols-[4px_1fr] gap-2.5">
              <i className="block rounded-sm" style={{ background: TOM[i.tom] }} />
              <p className="text-[14px] leading-snug"><b className="font-bold">{i.titulo}</b> {i.texto}</p>
            </div>
          ))}
        </div>
        {erro && <p className="mt-3 text-xs text-[var(--orbis-calote)]">{erro}</p>}
        {analise && <p className="mt-3 whitespace-pre-line border-t border-border/60 pt-3 text-[13.5px] leading-relaxed text-foreground/90">{analise}</p>}
      </Cartao>
    </Secao>
  );
}
