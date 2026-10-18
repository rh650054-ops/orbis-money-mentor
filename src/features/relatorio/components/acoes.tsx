import { useState } from "react";
import { DefconShareCarousel } from "@/components/defcon/DefconShareCarousel";
import { RelatorioShareCard } from "@/components/relatorio/RelatorioShareCard";
import { fmtHorasCurto, type RecapStats } from "@/components/relatorio/recapCanvas";
import { generateAndDownloadReport, type ReportFormat } from "@/utils/reportExport";
import { toast } from "@/shared/hooks/use-toast";
import type { Resumo } from "../lib/derivar";
import { ddmm, diasEntre, rotuloPeriodo, semanaCurta } from "../lib/periodo";

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const MESES_LONGO = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

/** Data for the RECAP art (post + story) that already exists; same fields as before. */
function recapDe(r: Resumo): RecapStats {
  const { de, ate, preset } = r.periodo;
  const m0 = +de.slice(5, 7) - 1, m1 = +ate.slice(5, 7) - 1;
  const titulo = preset === "mes" || preset === "30d" ? `${MESES_LONGO[m1]} ${ate.slice(0, 4)}`
    : preset === "semana" || preset === "7d"
      ? (m0 === m1 ? `Semana ${+de.slice(8, 10)} – ${+ate.slice(8, 10)} ${MESES[m1]}` : `Semana ${+de.slice(8, 10)} ${MESES[m0]} – ${+ate.slice(8, 10)} ${MESES[m1]}`)
      : rotuloPeriodo(r.periodo);
  const subtitulo = preset === "30d" ? "últimos 30 dias" : preset === "7d" ? "últimos 7 dias" : preset === "mes" ? "o mês até hoje" : `${diasEntre(de, ate)} dias`;
  const melhor = r.dias.melhor;
  return {
    titulo, subtitulo,
    faturamento: r.dinheiro.vendeu, lucro: r.dinheiro.sobrou,
    dias: r.dias.lista.map((d) => ({ label: r.dias.lista.length <= 7 ? semanaCurta(d.dia)[0]!.toUpperCase() : String(+d.dia.slice(8, 10)), valor: d.vendido, iso: d.dia })),
    diasTrabalhados: r.diasNaRua,
    melhorDia: melhor ? { label: `${semanaCurta(melhor.dia)} ${ddmm(melhor.dia)}`, valor: melhor.vendido } : null,
    vendas: r.vendas.vendas, ticketMedio: r.vendas.ticket ?? 0, horasMin: r.tempo.worked,
    caiuPct: r.dinheiro.vendeu > 0 ? r.dinheiro.pctCaiu : null,
  };
}

/** Compartilhar (the DEFCON art for one day, the RECAP art for a period) + Exportar
 *  the period on screen as PDF / CSV / Excel. */
export function Acoes({ r, userId }: { r: Resumo; userId: string }) {
  const [exportando, setExportando] = useState<ReportFormat | null>(null);
  const [menu, setMenu] = useState(false);

  async function exportar(format: ReportFormat) {
    if (exportando) return;
    setExportando(format); setMenu(false);
    try {
      const n = await generateAndDownloadReport({ userId, startISO: r.periodo.de, endISO: r.periodo.ate, format });
      toast({ title: "Relatório baixado", description: n > 0 ? `${n} ${n === 1 ? "dia incluído" : "dias incluídos"} no arquivo.` : "Nenhum registro no período — arquivo gerado vazio." });
    } catch {
      toast({ title: "Erro ao gerar relatório", description: "Tente novamente em instantes.", variant: "destructive" });
    } finally {
      setExportando(null);
    }
  }

  const rotuloDia = r.periodo.preset === "hoje" ? `HOJE · ${ddmm(r.periodo.de)}` : r.periodo.preset === "ontem" ? `ONTEM · ${ddmm(r.periodo.de)}` : `DIA ${ddmm(r.periodo.de)}`;

  return (
    <div className="space-y-3">
      {r.dinheiro.vendeu > 0 && (
        r.umDia
          ? <DefconShareCarousel stats={{ faturamento: r.dinheiro.vendeu, vendas: r.vendas.vendas, conversao: r.vendas.conv ?? 0, horas: fmtHorasCurto(r.tempo.worked), periodo: rotuloDia }} />
          : <RelatorioShareCard stats={recapDe(r)} />
      )}
      <div className="relative">
        <button className="orbis-press w-full rounded-2xl border border-border bg-card py-3 text-[14px] font-bold" onClick={() => setMenu((v) => !v)} disabled={!!exportando} aria-expanded={menu}>
          {exportando ? "Gerando arquivo…" : `Exportar ${rotuloPeriodo(r.periodo)}`}
        </button>
        {menu && (
          <div className="mt-2 grid grid-cols-3 gap-2">
            {(["pdf", "csv", "xls"] as ReportFormat[]).map((f) => (
              <button key={f} className="orbis-press rounded-xl bg-secondary py-2.5 text-sm font-semibold" onClick={() => exportar(f)}>{f === "xls" ? "Excel" : f.toUpperCase()}</button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
