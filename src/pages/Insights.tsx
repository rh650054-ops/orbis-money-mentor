import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Sparkles,
  ChevronRight,
  Loader2,
  ArrowUpRight,
  ArrowDownRight,
  CalendarIcon,
  Download,
  FileText,
  FileSpreadsheet,
  FileDown,
} from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Calendar } from "@/shared/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/shared/ui/dialog";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useRefetchOnFocus } from "@/shared/hooks/use-refetch-on-focus";
import { useToast } from "@/shared/hooks/use-toast";
import { formatBrazilDate } from "@/shared/lib/date-utils";
import {
  generateAndDownloadReport,
  type ReportFormat,
} from "@/utils/reportExport";

import { formatCurrency, cn } from "@/shared/lib/utils";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

type Period = "today" | "7d" | "30d" | "custom";

interface DailySale {
  date: string;
  total_profit: number | null;
  total_debt: number | null;
  cost: number | null;
  unpaid_units?: number | null;
}

interface HourBlock {
  hour_index: number;
  hour_label: string;
  achieved_amount: number;
  approaches_count: number;
  created_at: string;
}

const PERIOD_LABELS: Record<Period, string> = {
  today: "Hoje",
  "7d": "7 dias",
  "30d": "30 dias",
  custom: "Personalizado",
};

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function isoDate(d: Date): string {
  return d.toISOString().split("T")[0]!;
}

function fmtBR(d: Date): string {
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

export default function Insights() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [exportOpen, setExportOpen] = useState(false);

  const [period, setPeriod] = useState<Period>("7d");
  const [customStart, setCustomStart] = useState<Date | undefined>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 6);
    return startOfDay(d);
  });
  const [customEnd, setCustomEnd] = useState<Date | undefined>(() => startOfDay(new Date()));

  const [loading, setLoading] = useState(true);
  const [sales, setSales] = useState<DailySale[]>([]);
  const [challengeBlocks, setChallengeBlocks] = useState<{ approaches_count: number; sales_count: number }[]>([]);
  const [blocks, setBlocks] = useState<HourBlock[]>([]);
  const [expenses, setExpenses] = useState<{ category: string; amount: number; icon: string | null; name: string }[]>([]);
  const [yesterdayProfit, setYesterdayProfit] = useState(0);
  const [prevRangeProfit, setPrevRangeProfit] = useState(0);
  const [latePix, setLatePix] = useState<{ amount: number | null }[]>([]);
  const [defconSales, setDefconSales] = useState<{ created_at: string }[]>([]);

  // Análise da IA (Gemini) — gerada sob demanda no botão
  const [aiReport, setAiReport] = useState<{ analise?: string } | null>(null);
  const [aiReportLoading, setAiReportLoading] = useState(false);
  const [aiReportError, setAiReportError] = useState<string | null>(null);
  const [aiExpanded, setAiExpanded] = useState(false);

  // Computed range
  const range = useMemo(() => {
    const today = startOfDay(new Date());
    if (period === "today") return { start: today, end: today };
    if (period === "7d") {
      const s = new Date(today);
      s.setDate(s.getDate() - 6);
      return { start: s, end: today };
    }
    if (period === "30d") {
      const s = new Date(today);
      s.setDate(s.getDate() - 29);
      return { start: s, end: today };
    }
    const s = customStart ? startOfDay(customStart) : today;
    const e = customEnd ? startOfDay(customEnd) : today;
    return s <= e ? { start: s, end: e } : { start: e, end: s };
  }, [period, customStart, customEnd]);

  const rangeDays = useMemo(() => {
    return Math.round((range.end.getTime() - range.start.getTime()) / 86400000) + 1;
  }, [range]);

  const isSingleDay = rangeDays === 1;

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
      return;
    }
    if (user) loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading, range.start.getTime(), range.end.getTime()]);

  // Recarrega ao voltar o foco (ex.: retorno do DEFCON 4)
  useRefetchOnFocus(() => {
    if (user) loadData();
  });

  async function loadData() {
    if (!user) return;
    setLoading(true);
    try {
      const startISO = isoDate(range.start);
      const endISO = isoDate(range.end);

      // Previous comparable range
      const prevEnd = new Date(range.start);
      prevEnd.setDate(prevEnd.getDate() - 1);
      const prevStart = new Date(prevEnd);
      prevStart.setDate(prevStart.getDate() - (rangeDays - 1));

      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayISO = isoDate(yesterday);

      const [salesRes, blocksRes, ydRes, prevRes, expensesRes, chBlocksRes, lateRes, defconRes] = await Promise.all([
        supabase
          .from("daily_sales")
          .select("date,total_profit,total_debt,cost,transport_cost,food_cost,unpaid_units,cash_sales,pix_sales,card_sales,tip_sales,units_carried")
          .eq("user_id", user.id)
          .gte("date", startISO)
          .lte("date", endISO)
          .order("date", { ascending: true }),
        supabase
          .from("hourly_goal_blocks")
          .select("hour_index,hour_label,achieved_amount,approaches_count,created_at")
          .eq("user_id", user.id)
          .gte("created_at", range.start.toISOString())
          .lte("created_at", new Date(range.end.getTime() + 86399999).toISOString()),
        supabase
          .from("daily_sales")
          .select("total_profit")
          .eq("user_id", user.id)
          .eq("date", yesterdayISO)
          .maybeSingle(),
        supabase
          .from("daily_sales")
          .select("total_profit")
          .eq("user_id", user.id)
          .gte("date", isoDate(prevStart))
          .lte("date", isoDate(prevEnd)),
        supabase
          .from("personal_expenses")
          .select("category,amount,icon,name")
          .eq("user_id", user.id)
          .gte("date", startISO)
          .lte("date", endISO),
        supabase
          .from("challenge_blocks")
          .select("approaches_count,sales_count,created_at")
          .eq("user_id", user.id)
          .gte("created_at", range.start.toISOString())
          .lte("created_at", new Date(range.end.getTime() + 86399999).toISOString()),
        supabase
          .from("late_pix_entries")
          .select("amount")
          .eq("user_id", user.id)
          .gte("created_at", range.start.toISOString())
          .lte("created_at", new Date(range.end.getTime() + 86399999).toISOString()),
        supabase
          .from("defcon_sales")
          .select("created_at")
          .eq("user_id", user.id)
          .gte("created_at", range.start.toISOString())
          .lte("created_at", new Date(range.end.getTime() + 86399999).toISOString())
          .order("created_at", { ascending: true }),
      ]);

      setSales(salesRes.data || []);
      setBlocks(blocksRes.data || []);
      setExpenses((expensesRes.data as { category: string; amount: number; icon: string | null; name: string }[]) || []);
      setChallengeBlocks((chBlocksRes.data as any) || []);
      setYesterdayProfit(ydRes.data?.total_profit || 0);
      setPrevRangeProfit(
        (prevRes.data || []).reduce((s, d) => s + (d.total_profit || 0), 0),
      );
      setLatePix((lateRes.data as any) || []);
      setDefconSales((defconRes.data as any) || []);
    } finally {
      setLoading(false);
    }
  }

  const summary = useMemo(() => {
    const faturamento = sales.reduce((s, d) => s + (d.total_profit || 0), 0);
    const calotes = sales.reduce((s, d) => s + (d.total_debt || 0), 0);
    const caloteUnidades = sales.reduce((s, d) => s + (Number((d as any).unpaid_units) || 0), 0);
    // Custos lançados no botão "Custos do dia" (personal_expenses) ENTRAM no líquido,
    // separados por categoria: mercadoria -> custo de mercadoria; transporte/almoço ->
    // transporte e alimentação; o resto -> outros custos. Inclui os lançamentos antigos,
    // então o histórico já aparece (não precisa migrar nada).
    let expMercadoria = 0, expTransporte = 0, expAlimentacao = 0, expOutros = 0;
    for (const e of expenses) {
      const cat = String((e as any).category || "").toLowerCase();
      const val = Number(e.amount || 0);
      if (cat.includes("mercadoria")) expMercadoria += val;
      else if (cat.includes("transporte") || cat.includes("combust")) expTransporte += val;
      else if (cat.includes("aliment") || cat.includes("almoc") || cat.includes("almoç") || cat.includes("lanche")) expAlimentacao += val;
      else expOutros += val;
    }

    const custoMercadoria = sales.reduce((s, d) => s + (d.cost || 0), 0) + expMercadoria;
    const custoTransporte = sales.reduce((s, d) => s + (Number((d as any).transport_cost) || 0), 0) + expTransporte;
    const custoAlimentacao = sales.reduce((s, d) => s + (Number((d as any).food_cost) || 0), 0) + expAlimentacao;
    const custoOperacao = custoTransporte + custoAlimentacao; // transporte + alimentação (do dia + lançamentos)
    const custoOutros = expOutros;
    const custosOperacionais = expenses.reduce((s, e) => s + Number(e.amount || 0), 0); // total dos lançamentos (detalhe por categoria)
    const custos = custoMercadoria + custoOperacao + custoOutros;
    // Lucro líquido = vendido − mercadoria − transporte − alimentação − outros (todo custo do dia abate)
    const lucro = faturamento - custoMercadoria - custoOperacao - custoOutros;
    const sobra = lucro;

    // Recebido por forma de pagamento + gorjeta (somados no período)
    const dinheiro = sales.reduce((s, d) => s + (Number((d as any).cash_sales) || 0), 0);
    const pix = sales.reduce((s, d) => s + (Number((d as any).pix_sales) || 0), 0);
    const cartao = sales.reduce((s, d) => s + (Number((d as any).card_sales) || 0), 0);
    const gorjetas = sales.reduce((s, d) => s + (Number((d as any).tip_sales) || 0), 0);

    const totalAbordagens = challengeBlocks.reduce((s, b) => s + (b.approaches_count || 0), 0);
    const totalVendas = challengeBlocks.reduce((s, b) => s + ((b as any).sales_count || 0), 0);
    const conversao = totalAbordagens > 0 ? (totalVendas / totalAbordagens) * 100 : 0;
    const ticketMedio = totalVendas > 0 ? faturamento / totalVendas : 0;
    const abordagensPorVenda = totalVendas > 0 ? totalAbordagens / totalVendas : 0;
    const mediaDiaria = rangeDays > 0 ? faturamento / rangeDays : 0;

    // Calote e recuperação
    const pixRecuperado = latePix.reduce((s, p) => s + (Number((p as any).amount) || 0), 0);
    const calotePct = totalVendas > 0 ? Math.min(100, (caloteUnidades / totalVendas) * 100) : 0;
    const caloteACada = caloteUnidades > 0 ? totalVendas / caloteUnidades : 0;
    const recuperadoPct = calotes > 0 ? Math.min(100, (pixRecuperado / calotes) * 100) : 0;
    const recuperadoUnid = ticketMedio > 0 ? pixRecuperado / ticketMedio : 0;
    const diasComRegistro = sales.length;
    const mediaCaloteDiaUnid = diasComRegistro > 0 ? caloteUnidades / diasComRegistro : 0;
    const sugestaoUnid = mediaCaloteDiaUnid > 0 ? Math.ceil(mediaCaloteDiaUnid) : 0;

    // Unidades levadas (estoque que saiu pra rua) e sobra estimada
    const unidLevadas = sales.reduce((s, d) => s + (Number((d as any).units_carried) || 0), 0);
    const unidSobrou = Math.max(0, unidLevadas - totalVendas);

    // Ritmo: minutos médios entre vendas (por dia, fuso de Brasília) — igual ao fim do DEFCON
    const brDay = (iso: string) => new Date(new Date(iso).getTime() - 3 * 3600000).toISOString().slice(0, 10);
    const salesByDay = new Map<string, number[]>();
    for (const s of defconSales) {
      const t = new Date((s as any).created_at).getTime();
      if (!Number.isFinite(t)) continue;
      const day = brDay((s as any).created_at);
      const arr = salesByDay.get(day) || [];
      arr.push(t);
      salesByDay.set(day, arr);
    }
    let gapSum = 0;
    let gapCount = 0;
    salesByDay.forEach((arr) => {
      arr.sort((a, b) => a - b);
      for (let i = 1; i < arr.length; i++) {
        gapSum += arr[i]! - arr[i - 1]!;
        gapCount++;
      }
    });
    const ritmoMin = gapCount > 0 ? gapSum / gapCount / 60000 : 0;

    return {
      faturamento,
      lucro,
      sobra,
      ticketMedio,
      conversao,
      totalAbordagens,
      totalVendas,
      abordagensPorVenda,
      mediaDiaria,
      custos,
      custoMercadoria,
      custoOperacao,
      custoTransporte,
      custoAlimentacao,
      custoOutros,
      custosOperacionais,
      calotes,
      caloteUnidades,
      dinheiro,
      pix,
      cartao,
      gorjetas,
      pixRecuperado,
      calotePct,
      caloteACada,
      recuperadoPct,
      recuperadoUnid,
      mediaCaloteDiaUnid,
      sugestaoUnid,
      ritmoMin,
      unidLevadas,
      unidSobrou,
    };
  }, [sales, blocks, expenses, challengeBlocks, rangeDays, latePix, defconSales]);

  const expensesByCategory = useMemo(() => {
    const map = new Map<string, { total: number; icon: string; count: number }>();
    for (const e of expenses) {
      const key = e.category || "Outros";
      const cur = map.get(key) || { total: 0, icon: e.icon || "💰", count: 0 };
      cur.total += Number(e.amount || 0);
      cur.count += 1;
      if (e.icon && !map.has(key)) cur.icon = e.icon;
      map.set(key, cur);
    }
    return Array.from(map.entries())
      .map(([cat, v]) => ({ category: cat, total: v.total, icon: v.icon, count: v.count }))
      .sort((a, b) => b.total - a.total);
  }, [expenses]);

  const chartData = useMemo(() => {
    const map = new Map(sales.map((d) => [d.date, d.total_profit || 0]));
    const result: { label: string; valor: number; iso: string }[] = [];
    for (let i = 0; i < rangeDays; i++) {
      const d = new Date(range.start);
      d.setDate(d.getDate() + i);
      const iso = isoDate(d);
      result.push({ label: fmtBR(d), valor: map.get(iso) || 0, iso });
    }
    return result;
  }, [sales, range.start, rangeDays]);

  const bestWorstDay = useMemo(() => {
    if (chartData.length < 2) return null;
    const withSales = chartData.filter((d) => d.valor > 0);
    if (withSales.length === 0) return null;
    const best = [...withSales].sort((a, b) => b.valor - a.valor)[0];
    const worst = [...withSales].sort((a, b) => a.valor - b.valor)[0];
    return { best, worst };
  }, [chartData]);

  const compareYesterday = useMemo(() => {
    const todayProfit =
      sales.find((d) => d.date === isoDate(new Date()))?.total_profit || 0;
    if (!yesterdayProfit) return { pct: 0, valid: false, todayProfit };
    const pct = ((todayProfit - yesterdayProfit) / yesterdayProfit) * 100;
    return { pct, valid: true, todayProfit };
  }, [sales, yesterdayProfit]);

  const comparePrev = useMemo(() => {
    if (!prevRangeProfit) return { pct: 0, valid: false };
    const pct = ((summary.faturamento - prevRangeProfit) / prevRangeProfit) * 100;
    return { pct, valid: true };
  }, [summary.faturamento, prevRangeProfit]);

  const bestHours = useMemo(() => {
    const byHour: Record<number, { total: number; count: number; label: string }> = {};
    for (const b of blocks) {
      const slot = byHour[b.hour_index] ?? (byHour[b.hour_index] = { total: 0, count: 0, label: b.hour_label });
      slot.total += b.achieved_amount || 0;
      slot.count += 1;
    }
    return Object.entries(byHour)
      .map(([h, v]) => ({
        hour: parseInt(h),
        label: v.label,
        avg: v.count > 0 ? v.total / v.count : 0,
      }))
      .filter((h) => h.avg > 0)
      .sort((a, b) => b.avg - a.avg);
  }, [blocks]);

  const aiInsights = useMemo(() => {
    const tips: string[] = [];
    if (summary.abordagensPorVenda > 0) {
      tips.push(
        `Você precisa de ${summary.abordagensPorVenda.toFixed(1)} abordagens para gerar 1 venda.`,
      );
    }
    if (isSingleDay) {
      if (compareYesterday.valid) {
        if (compareYesterday.pct > 10)
          tips.push(`Hoje está ${compareYesterday.pct.toFixed(0)}% melhor que ontem.`);
        else if (compareYesterday.pct < -10)
          tips.push(
            `Hoje está ${Math.abs(compareYesterday.pct).toFixed(0)}% abaixo de ontem.`,
          );
      }
    } else {
      tips.push(
        `Sua média diária no período foi ${formatCurrency(summary.mediaDiaria)}.`,
      );
      if (bestWorstDay?.best && bestWorstDay?.worst) {
        tips.push(
          `Melhor dia: ${bestWorstDay.best.label} (${formatCurrency(bestWorstDay.best.valor)}) · Pior: ${bestWorstDay.worst.label} (${formatCurrency(bestWorstDay.worst.valor)}).`,
        );
      }
      if (comparePrev.valid) {
        tips.push(
          comparePrev.pct >= 0
            ? `Tendência positiva: ${comparePrev.pct.toFixed(0)}% acima do período anterior.`
            : `Tendência de queda: ${Math.abs(comparePrev.pct).toFixed(0)}% abaixo do período anterior.`,
        );
      }
    }
    if (bestHours.length >= 1) {
      tips.push(`Melhor desempenho no horário ${bestHours[0]!.label}.`);
    }
    if (summary.conversao > 0 && summary.conversao < 15) {
      tips.push(
        `Sua conversão está em ${summary.conversao.toFixed(0)}%. Reveja a abordagem.`,
      );
    }
    if (tips.length === 0) {
      tips.push("Registre mais vendas para destravar insights personalizados.");
    }
    return tips;
  }, [summary, isSingleDay, compareYesterday, comparePrev, bestWorstDay, bestHours]);

  const periodoLabel =
    period === "today" ? "dia de hoje"
    : period === "7d" ? "semana (últimos 7 dias)"
    : period === "30d" ? "mês (últimos 30 dias)"
    : "período selecionado";
  const periodoShort =
    period === "today" ? "o dia" : period === "7d" ? "a semana" : period === "30d" ? "o mês" : "o período";

  // Limpa a análise quando muda o período (pra não mostrar análise de outro range)
  useEffect(() => {
    setAiReport(null);
    setAiReportError(null);
  }, [range.start.getTime(), range.end.getTime()]);

  async function generateReportAnalysis() {
    setAiReportLoading(true);
    setAiReportError(null);
    try {
      const { data, error } = await supabase.functions.invoke("generate-insights", {
        body: {
          type: "report_analysis",
          periodo: periodoLabel,
          rangeLabel: `${fmtBR(range.start)} a ${fmtBR(range.end)}`,
          faturamento: summary.faturamento,
          lucro: summary.lucro,
          ticketMedio: summary.ticketMedio,
          conversao: Number(summary.conversao.toFixed(1)),
          totalAbordagens: summary.totalAbordagens,
          totalVendas: summary.totalVendas,
          abordagensPorVenda: Number(summary.abordagensPorVenda.toFixed(1)),
          mediaDiaria: summary.mediaDiaria,
          custoMercadoria: summary.custoMercadoria,
          custoOperacao: summary.custoOperacao,
          custosOperacionais: summary.custosOperacionais,
          calotes: summary.calotes,
          caloteUnidades: summary.caloteUnidades,
          comparePct: comparePrev.valid ? Number(comparePrev.pct.toFixed(0)) : 0,
          gastos: expensesByCategory.map((c) => ({ category: c.category, total: c.total, count: c.count })),
          melhoresHorarios: bestHours.slice(0, 3).map((h) => ({ label: h.label, avg: h.avg })),
        },
      });
      if (error) {
        // tenta ler a mensagem REAL que o backend devolveu (fica no corpo da resposta)
        let msg = error.message || "Erro ao chamar a função.";
        try {
          const ctx = (error as { context?: Response }).context;
          if (ctx && typeof ctx.json === "function") {
            const j = await ctx.json();
            if (j?.error) msg = String(j.error);
          }
        } catch { /* mantém msg */ }
        throw new Error(msg);
      }
      const d = data as { analise?: string; error?: string } | null;
      if (d?.error) throw new Error(d.error);
      if (d && !d.analise) {
        throw new Error("A função respondeu, mas sem a análise. Confirma que o código novo (com report_analysis) foi colado na função 'generate-insights' e que deu Deploy.");
      }
      setAiReport(d as typeof aiReport);
    } catch (e) {
      setAiReportError(e instanceof Error ? e.message : "Não consegui analisar agora.");
    } finally {
      setAiReportLoading(false);
    }
  }

  if (authLoading || !user) return null;

  const maxHourAvg = bestHours[0]?.avg || 1;

  return (
    <div className="space-y-5 pb-4 md:pb-8 text-foreground">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Relatório</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Decisões claras a partir do seu desempenho
          </p>
        </div>
        <ExportReportDialog
          open={exportOpen}
          onOpenChange={setExportOpen}
          userId={user.id}
          onDone={(count) =>
            toast({
              title: "Relatório baixado",
              description:
                count > 0
                  ? `${count} ${count === 1 ? "dia" : "dias"} incluídos no arquivo.`
                  : "Nenhum registro no período — arquivo gerado vazio.",
            })
          }
          onError={() =>
            toast({
              title: "Erro ao gerar relatório",
              description: "Tente novamente em instantes.",
              variant: "destructive",
            })
          }
        />
      </div>

      {/* Period filter */}
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {(["today", "7d", "30d", "custom"] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={cn(
                "px-3.5 py-1.5 text-xs font-medium rounded-full border transition-[colors,transform,opacity]",
                period === p
                  ? "bg-primary text-primary-foreground border-primary shadow-[0_4px_14px_-2px_hsl(var(--primary)/0.5)]"
                  : "bg-card border-border/60 text-muted-foreground hover:text-foreground hover:border-border",
              )}
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>

        {period === "custom" && (
          <div className="flex flex-wrap items-center gap-2">
            <DateField label="De" date={customStart} onChange={setCustomStart} />
            <span className="text-muted-foreground text-xs">até</span>
            <DateField label="Até" date={customEnd} onChange={setCustomEnd} />
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          Período: <span className="text-foreground font-medium">
            {fmtBR(range.start)} → {fmtBR(range.end)}
          </span>{" "}
          · {rangeDays} {rangeDays === 1 ? "dia" : "dias"}
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : (
        <>
          {/* HERO - destaque principal */}
          <section className="relative overflow-hidden rounded-3xl border border-primary/30 p-5 bg-gradient-to-br from-primary/15 via-primary/5 to-transparent">
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-primary/20 rounded-full blur-3xl pointer-events-none" />
            <div className="relative space-y-1">
              <p className="text-xs uppercase tracking-wider text-primary font-bold">
                Faturamento do período
              </p>
              <p className="text-4xl font-bold tracking-tight text-foreground">
                {formatCurrency(summary.faturamento)}
              </p>
              <div className="flex items-center gap-3 flex-wrap pt-1">
                {(isSingleDay ? compareYesterday : comparePrev).valid && (
                  <div className={cn(
                    "inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full border",
                    (isSingleDay ? compareYesterday.pct : comparePrev.pct) >= 0
                      ? "bg-primary/20 text-primary border-primary/40"
                      : "bg-foreground/10 text-foreground/70 border-foreground/20"
                  )}>
                    {(isSingleDay ? compareYesterday.pct : comparePrev.pct) >= 0
                      ? <ArrowUpRight className="w-3 h-3" />
                      : <ArrowDownRight className="w-3 h-3" />}
                    {(isSingleDay ? compareYesterday.pct : comparePrev.pct) >= 0 ? "+" : ""}
                    {(isSingleDay ? compareYesterday.pct : comparePrev.pct).toFixed(0)}%{" "}
                    {isSingleDay ? "vs ontem" : "vs anterior"}
                  </div>
                )}
                <span className="text-xs text-muted-foreground">
                  Lucro líquido:{" "}
                  <span className="font-bold text-primary">
                    {formatCurrency(summary.lucro)}
                  </span>
                </span>
              </div>
            </div>
          </section>

          {/* Análise da IA (Gemini) — destaque no topo */}
          <div className="rounded-2xl border border-primary/40 bg-gradient-to-br from-primary/15 via-primary/5 to-transparent p-4 space-y-2.5 shadow-[0_10px_40px_-12px_hsl(var(--primary)/0.45)]">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-primary/20 border border-primary/40 flex items-center justify-center shrink-0">
                <Sparkles className="w-4 h-4 text-primary" />
              </div>
              <p className="text-sm font-bold text-primary tracking-tight">
                Análise da IA · Mentor Orbis
              </p>
            </div>

            {aiReport ? (
              <div className="space-y-2">
                <p
                  className={`text-sm text-foreground/90 leading-relaxed whitespace-pre-line ${
                    aiExpanded ? "" : "line-clamp-4"
                  }`}
                >
                  {aiReport.analise}
                </p>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setAiExpanded((v) => !v)}
                    className="text-xs font-semibold text-primary hover:underline"
                  >
                    {aiExpanded ? "ver menos" : "ver mais"}
                  </button>
                  <button
                    onClick={generateReportAnalysis}
                    disabled={aiReportLoading}
                    className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 disabled:opacity-60"
                  >
                    {aiReportLoading ? "Atualizando..." : "Atualizar análise"}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <p className="text-xs text-foreground/70 leading-relaxed">
                  Deixa a IA analisar {periodoShort}: o que tá indo bem e onde tá furando.
                </p>
                {aiInsights.length > 0 && (
                  <div className="space-y-1">
                    {aiInsights.slice(0, 2).map((tip, i) => (
                      <p key={i} className="text-xs text-muted-foreground leading-relaxed">• {tip}</p>
                    ))}
                  </div>
                )}
                <Button
                  onClick={generateReportAnalysis}
                  disabled={aiReportLoading}
                  className="w-full gap-2 bg-gradient-primary hover:opacity-90 h-10 text-sm"
                >
                  {aiReportLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  {aiReportLoading ? "Analisando seu corre..." : "Analisar com IA"}
                </Button>
              </>
            )}

            {aiReportError && (
              <p className="text-xs text-destructive whitespace-pre-line">{aiReportError}</p>
            )}

            <Button
              data-tour="conversar-ia"
              variant="ghost"
              size="sm"
              className="text-primary hover:text-primary px-0"
              onClick={() => navigate("/chat")}
            >
              Conversar com a IA <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>

          {/* KPIs principais - paleta dourada/branca */}
          <section className="grid grid-cols-2 gap-3">
            <MetricCell
              label="Ticket médio"
              value={formatCurrency(summary.ticketMedio)}
            />
            <MetricCell
              label="Conversão"
              value={`${summary.conversao.toFixed(1)}%`}
              accent="gold"
            />
            <MetricCell
              label="Abordagens"
              value={summary.totalAbordagens.toString()}
            />
            <MetricCell
              label="Vendas"
              value={summary.totalVendas.toString()}
              accent="gold"
            />
          </section>

          {/* Detalhamento financeiro */}
          <SectionTitle>Detalhamento financeiro</SectionTitle>
          <div className="rounded-2xl border border-border/60 bg-card divide-y divide-border/60 overflow-hidden">
            <FinanceRow label="Faturamento bruto" value={formatCurrency(summary.faturamento)} tone="white" />
            <FinanceRow label="Custo de mercadoria" value={`- ${formatCurrency(summary.custoMercadoria)}`} tone="muted" />
            <FinanceRow label="Transporte" value={`- ${formatCurrency(summary.custoTransporte)}`} tone="muted" />
            <FinanceRow label="Alimentação" value={`- ${formatCurrency(summary.custoAlimentacao)}`} tone="muted" />
            {summary.custoOutros > 0 && (
              <FinanceRow label="Outros custos" value={`- ${formatCurrency(summary.custoOutros)}`} tone="muted" />
            )}
            {summary.unidLevadas > 0 && (
              <FinanceRow
                label="Unidades levadas"
                value={`${summary.unidLevadas} ${summary.unidLevadas === 1 ? "unidade" : "unidades"}`}
                tone="muted"
              />
            )}
            <FinanceRow
              label="Unidades vendidas"
              value={`${summary.totalVendas} ${summary.totalVendas === 1 ? "unidade" : "unidades"}`}
              tone="muted"
            />
            {summary.unidLevadas > 0 && (
              <FinanceRow
                label="Sobrou (estoque)"
                value={`${summary.unidSobrou} ${summary.unidSobrou === 1 ? "unidade" : "unidades"}`}
                tone="muted"
              />
            )}
            <FinanceRow
              label="Unidades não pagas"
              value={`${summary.caloteUnidades} ${summary.caloteUnidades === 1 ? "unidade" : "unidades"}`}
              sub={summary.calotes > 0 ? `${formatCurrency(summary.calotes)} não recebido · já no custo` : "já no custo"}
              tone="muted"
            />
            <FinanceRow label="Média diária" value={formatCurrency(summary.mediaDiaria)} tone="muted" />
            <FinanceRow label="Lucro líquido" value={formatCurrency(summary.lucro)} tone="gold" bold />
          </div>

          {/* Recebido por forma de pagamento (somado no período) */}
          <SectionTitle>Recebido por forma de pagamento</SectionTitle>
          <div className="rounded-2xl border border-border/60 bg-card divide-y divide-border/60 overflow-hidden">
            <FinanceRow label="💵 Dinheiro" value={formatCurrency(summary.dinheiro)} tone="white" />
            <FinanceRow label="📱 Pix" value={formatCurrency(summary.pix)} tone="white" />
            <FinanceRow label="💳 Cartão" value={formatCurrency(summary.cartao)} tone="white" />
            {summary.gorjetas > 0 && (
              <FinanceRow label="🎁 Gorjetas" value={formatCurrency(summary.gorjetas)} tone="muted" />
            )}
          </div>

          {/* Calote e recuperação (período) */}
          <SectionTitle>Calote e recuperação</SectionTitle>
          <div className="rounded-2xl border border-border/60 bg-card divide-y divide-border/60 overflow-hidden">
            <FinanceRow
              label="Taxa de calote"
              value={`${summary.calotePct.toFixed(1)}%`}
              sub={`${summary.caloteUnidades} ${summary.caloteUnidades === 1 ? "unidade" : "unidades"} · ${formatCurrency(summary.calotes)} não recebido`}
              tone="white"
            />
            <FinanceRow
              label="1 calote a cada"
              value={summary.caloteACada > 0 ? `${summary.caloteACada.toFixed(0)} vendas` : "—"}
              tone="muted"
            />
            <FinanceRow
              label="Recuperado via Pix depois"
              value={formatCurrency(summary.pixRecuperado)}
              sub={
                summary.pixRecuperado > 0
                  ? summary.calotes > 0
                    ? `${summary.recuperadoPct.toFixed(0)}% do calote volta · ~${Math.round(summary.recuperadoUnid)} un`
                    : `~${Math.round(summary.recuperadoUnid)} un recuperadas`
                  : "ainda sem recuperação"
              }
              tone="white"
            />
            <FinanceRow
              label="Calote médio por dia"
              value={`${summary.mediaCaloteDiaUnid.toFixed(1)} un`}
              tone="muted"
            />
            <FinanceRow
              label="Ritmo de vendas"
              value={summary.ritmoMin > 0 ? `1 a cada ${summary.ritmoMin.toFixed(0)} min` : "—"}
              tone="muted"
            />
          </div>
          {summary.sugestaoUnid > 0 && (
            <div className="rounded-2xl border border-primary/30 bg-primary/10 p-3.5 flex items-start gap-2.5">
              <span className="text-lg leading-none mt-0.5">💡</span>
              <p className="text-sm text-foreground/90">
                Leve{" "}
                <span className="font-bold text-primary">
                  +{summary.sugestaoUnid} {summary.sugestaoUnid === 1 ? "unidade" : "unidades"} por dia
                </span>{" "}
                pra cobrir seu calote médio.
              </p>
            </div>
          )}

          {/* Breakdown de custos operacionais por categoria */}
          {expensesByCategory.length > 0 && (
            <>
              <SectionTitle>Custos operacionais por categoria</SectionTitle>
              <div className="rounded-2xl border border-border/60 bg-card p-4 space-y-2.5">
                {expensesByCategory.map((c) => {
                  const pct = summary.custosOperacionais > 0
                    ? (c.total / summary.custosOperacionais) * 100
                    : 0;
                  return (
                    <div key={c.category} className="space-y-1">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-base">{c.icon}</span>
                        <span className="flex-1 text-foreground/90 font-medium">{c.category}</span>
                        <span className="text-xs text-muted-foreground">
                          {c.count} {c.count === 1 ? "item" : "itens"}
                        </span>
                        <span className="font-bold text-primary w-24 text-right">
                          {formatCurrency(c.total)}
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted/40 overflow-hidden ml-7">
                        <div
                          className="h-full bg-primary/70 rounded-full"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* Análise narrativa */}
          <div className="rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 to-transparent p-4">
            <p className="text-xs uppercase tracking-wider text-primary font-bold mb-2">
              Análise do período
            </p>
            <p className="text-sm text-foreground/90 leading-relaxed">
              Entre <span className="font-semibold">{fmtBR(range.start)}</span> e{" "}
              <span className="font-semibold">{fmtBR(range.end)}</span>:{" "}
              {isSingleDay ? (
                <>
                  faturamento de{" "}
                  <span className="text-primary font-semibold">
                    {formatCurrency(summary.faturamento)}
                  </span>.
                </>
              ) : (
                <>
                  total de{" "}
                  <span className="text-primary font-semibold">
                    {formatCurrency(summary.faturamento)}
                  </span>, conversão{" "}
                  <span className="text-primary font-semibold">
                    {summary.conversao.toFixed(1)}%
                  </span>.
                  {bestWorstDay?.best && bestWorstDay?.worst && (
                    <>
                      {" "}Melhor dia:{" "}
                      <span className="text-primary font-semibold">{bestWorstDay.best.label}</span>
                      {" "}· Pior:{" "}
                      <span className="text-foreground/60 font-semibold">{bestWorstDay.worst.label}</span>.
                    </>
                  )}
                </>
              )}
            </p>
          </div>

          {/* Gráfico de faturamento */}
          <SectionTitle>Faturamento</SectionTitle>
          <div className="rounded-2xl border border-border/60 bg-card p-4">
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 8, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="goldFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.6} />
                      <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="hsl(var(--border))" strokeOpacity={0.2} vertical={false} />
                  <XAxis
                    dataKey="label"
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${v}`)}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--primary) / 0.4)",
                      borderRadius: 12,
                      fontSize: 12,
                      color: "hsl(var(--foreground))",
                    }}
                    formatter={(v: number) => [formatCurrency(v), "Faturamento"]}
                  />
                  <Area
                    type="monotone"
                    dataKey="valor"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2.5}
                    fill="url(#goldFill)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Performance */}
          <SectionTitle>Performance</SectionTitle>
          <div className="rounded-2xl border border-border/60 bg-card p-5 space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <MiniStat label="Abordagens" value={summary.totalAbordagens.toString()} />
              <MiniStat label="Vendas" value={summary.totalVendas.toString()} highlight />
              <MiniStat label="Conversão" value={`${summary.conversao.toFixed(0)}%`} highlight />
            </div>
            <div className="text-sm text-muted-foreground border-t border-border/60 pt-4 leading-relaxed">
              {summary.abordagensPorVenda > 0 ? (
                <>
                  Você precisa de{" "}
                  <span className="text-primary font-bold">
                    {summary.abordagensPorVenda.toFixed(1)}
                  </span>{" "}
                  abordagens para gerar 1 venda · ticket médio{" "}
                  <span className="text-foreground font-semibold">
                    {formatCurrency(summary.ticketMedio)}
                  </span>
                </>
              ) : (
                "Registre suas abordagens no Ritmo para ver sua taxa de conversão."
              )}
            </div>
          </div>

          {/* Comparação */}
          <SectionTitle>Comparação</SectionTitle>
          <div className="grid grid-cols-2 gap-3">
            {isSingleDay ? (
              <>
                <ComparisonCell
                  label="Hoje vs ontem"
                  pct={compareYesterday.pct}
                  valid={compareYesterday.valid}
                />
                <MetricCell label="Faturamento ontem" value={formatCurrency(yesterdayProfit)} />
              </>
            ) : (
              <>
                <ComparisonCell
                  label="Período vs anterior"
                  pct={comparePrev.pct}
                  valid={comparePrev.valid}
                />
                <MetricCell label="Média diária" value={formatCurrency(summary.mediaDiaria)} />
              </>
            )}
          </div>

          {/* Melhores horários */}
          <SectionTitle>Melhores horários</SectionTitle>
          <div className="rounded-2xl border border-border/60 bg-card p-5">
            {bestHours.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Sem dados de horários no período.
              </p>
            ) : (
              <div className="space-y-3">
                {bestHours.slice(0, 5).map((h, i) => (
                  <div key={h.hour} className="flex items-center gap-3">
                    <span className={cn(
                      "text-xs w-16 shrink-0 font-medium",
                      i === 0 ? "text-primary" : "text-muted-foreground"
                    )}>
                      {h.label}
                    </span>
                    <div className="flex-1 h-2.5 rounded-full bg-muted/40 overflow-hidden">
                      <div
                        className={cn(
                          "h-full rounded-full transition-[colors,transform,opacity]",
                          i === 0
                            ? "bg-primary shadow-[0_0_8px_hsl(var(--primary)/0.6)]"
                            : "bg-primary/40",
                        )}
                        style={{ width: `${(h.avg / maxHourAvg) * 100}%` }}
                      />
                    </div>
                    <span className={cn(
                      "text-xs font-semibold w-20 text-right",
                      i === 0 ? "text-primary" : "text-foreground/80"
                    )}>
                      {formatCurrency(h.avg)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

        </>
      )}
    </div>
  );
}

type ExportPreset = "7" | "15" | "30" | "custom";

function presetRangeISO(preset: ExportPreset): { start: string; end: string } {
  const end = startOfDay(new Date());
  const start = new Date(end);
  const days = preset === "7" ? 7 : preset === "15" ? 15 : 30;
  start.setDate(start.getDate() - (days - 1));
  return { start: formatBrazilDate(start), end: formatBrazilDate(end) };
}

function ExportReportDialog({
  open,
  onOpenChange,
  userId,
  onDone,
  onError,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  userId: string;
  onDone: (count: number) => void;
  onError: () => void;
}) {
  const [preset, setPreset] = useState<ExportPreset>("7");
  const [format, setFormat] = useState<ReportFormat>("pdf");
  const [customStart, setCustomStart] = useState(() => presetRangeISO("7").start);
  const [customEnd, setCustomEnd] = useState(() => presetRangeISO("7").end);
  const [busy, setBusy] = useState(false);

  const presets: { value: ExportPreset; label: string }[] = [
    { value: "7", label: "Últimos 7 dias" },
    { value: "15", label: "Últimos 15 dias" },
    { value: "30", label: "Últimos 30 dias" },
    { value: "custom", label: "Personalizado" },
  ];

  const formats: { value: ReportFormat; label: string; Icon: typeof FileText }[] = [
    { value: "pdf", label: "PDF", Icon: FileText },
    { value: "csv", label: "CSV", Icon: FileDown },
    { value: "xls", label: "Excel", Icon: FileSpreadsheet },
  ];

  async function handleDownload() {
    if (busy) return;
    let start: string;
    let end: string;
    if (preset === "custom") {
      if (!customStart || !customEnd) return;
      // Garante start <= end
      [start, end] =
        customStart <= customEnd ? [customStart, customEnd] : [customEnd, customStart];
    } else {
      const r = presetRangeISO(preset);
      start = r.start;
      end = r.end;
    }

    setBusy(true);
    try {
      const count = await generateAndDownloadReport({
        userId,
        startISO: start,
        endISO: end,
        format,
      });
      onOpenChange(false);
      onDone(count);
    } catch {
      onError();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-9 shrink-0 gap-1.5 border-primary/40 text-primary hover:text-primary hover:bg-primary/10"
        >
          <Download className="w-4 h-4" />
          Exportar
        </Button>
      </DialogTrigger>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-md p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>Baixar relatório</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 pt-1">
          {/* Período */}
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
              Período
            </Label>
            <div className="grid grid-cols-2 gap-2">
              {presets.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setPreset(p.value)}
                  className={cn(
                    "px-3 py-2 text-xs font-medium rounded-xl border transition-colors text-left",
                    preset === p.value
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-card border-border/60 text-muted-foreground hover:text-foreground hover:border-border",
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {preset === "custom" && (
              <div className="flex items-center gap-2 pt-1">
                <div className="flex-1 space-y-1">
                  <Label className="text-[11px] text-muted-foreground">De</Label>
                  <Input
                    type="date"
                    value={customStart}
                    max={customEnd || formatBrazilDate(new Date())}
                    onChange={(e) => setCustomStart(e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>
                <div className="flex-1 space-y-1">
                  <Label className="text-[11px] text-muted-foreground">Até</Label>
                  <Input
                    type="date"
                    value={customEnd}
                    min={customStart}
                    max={formatBrazilDate(new Date())}
                    onChange={(e) => setCustomEnd(e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Formato */}
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
              Formato
            </Label>
            <div className="grid grid-cols-3 gap-2">
              {formats.map(({ value, label, Icon }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setFormat(value)}
                  className={cn(
                    "flex flex-col items-center gap-1.5 px-2 py-3 rounded-xl border transition-colors",
                    format === value
                      ? "bg-primary/15 border-primary text-primary"
                      : "bg-card border-border/60 text-muted-foreground hover:text-foreground hover:border-border",
                  )}
                >
                  <Icon className="w-5 h-5" />
                  <span className="text-xs font-medium">{label}</span>
                </button>
              ))}
            </div>
          </div>

          <Button
            onClick={handleDownload}
            disabled={busy}
            className="w-full gap-2"
          >
            {busy ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            {busy ? "Gerando..." : "Baixar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DateField({
  label,
  date,
  onChange,
}: {
  label: string;
  date: Date | undefined;
  onChange: (d: Date | undefined) => void;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "h-9 px-3 text-xs justify-start font-normal bg-card/40 border-border/60",
            !date && "text-muted-foreground",
          )}
        >
          <CalendarIcon className="mr-2 h-3.5 w-3.5" />
          {date ? `${label}: ${fmtBR(date)}` : label}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={date}
          onSelect={onChange}
          disabled={(d) => d > new Date()}
          initialFocus
          className={cn("p-3 pointer-events-auto")}
        />
      </PopoverContent>
    </Popover>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mt-2">
      {children}
    </h2>
  );
}

function MetricCell({
  label,
  value,
  valueClassName = "",
  accent,
}: {
  label: string;
  value: string;
  valueClassName?: string;
  accent?: "gold";
}) {
  return (
    <div className={cn(
      "rounded-2xl border p-4 transition-colors",
      accent === "gold"
        ? "border-primary/40 bg-gradient-to-br from-primary/15 to-primary/5"
        : "border-border/60 bg-card"
    )}>
      <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">{label}</p>
      <p className={cn(
        "mt-1.5 text-xl font-bold tracking-tight",
        accent === "gold" && !valueClassName && "text-primary",
        valueClassName
      )}>{value}</p>
    </div>
  );
}

function FinanceRow({
  label,
  value,
  sub,
  tone = "muted",
  bold = false,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "white" | "gold" | "muted";
  bold?: boolean;
}) {
  const valueColor =
    tone === "gold" ? "text-primary" : tone === "white" ? "text-foreground" : "text-foreground/70";
  return (
    <div className={cn(
      "flex items-center justify-between px-4 py-3",
      tone === "gold" && "bg-primary/5"
    )}>
      <span className={cn(
        "text-sm",
        tone === "gold" ? "text-foreground font-semibold" : "text-muted-foreground"
      )}>
        {label}
      </span>
      <div className="flex flex-col items-end leading-tight">
        <span className={cn(
          bold ? "text-base font-bold" : "text-sm font-semibold",
          valueColor
        )}>
          {value}
        </span>
        {sub && <span className="text-[11px] text-muted-foreground/70 mt-0.5">{sub}</span>}
      </div>
    </div>
  );
}

function MiniStat({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="text-center">
      <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">{label}</p>
      <p className={cn(
        "mt-1.5 text-2xl font-bold tracking-tight",
        highlight ? "text-primary" : "text-foreground"
      )}>{value}</p>
    </div>
  );
}

function ComparisonCell({
  label,
  pct,
  valid,
}: {
  label: string;
  pct: number;
  valid: boolean;
}) {
  const positive = pct >= 0;
  const Icon = positive ? ArrowUpRight : ArrowDownRight;
  return (
    <div className={cn(
      "rounded-2xl border p-4",
      valid && positive
        ? "border-primary/40 bg-gradient-to-br from-primary/15 to-primary/5"
        : "border-border/60 bg-card"
    )}>
      <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">{label}</p>
      {valid ? (
        <div className={cn(
          "mt-1.5 flex items-center gap-1 text-xl font-bold",
          positive ? "text-primary" : "text-foreground/60"
        )}>
          <Icon className="w-5 h-5" />
          {positive ? "+" : ""}
          {pct.toFixed(0)}%
        </div>
      ) : (
        <p className="mt-1.5 text-sm text-muted-foreground">Sem dados</p>
      )}
    </div>
  );
}
