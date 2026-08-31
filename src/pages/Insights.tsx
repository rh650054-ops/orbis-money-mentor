import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Sparkles,
  TrendingUp,
  AlertTriangle,
  ChevronRight,
  Loader2,
  ArrowUpRight,
  ArrowDownRight,
  CalendarIcon,
  Download,
  FileText,
  FileSpreadsheet,
  FileDown,
  Clock,
  Wallet,
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
import { FechamentoDoDia } from "@/components/relatorio/FechamentoDoDia";
import { AnimatedCurrency, AnimatedNumber, FillBar } from "@/shared/motion";
import FirstTimeCard from "@/components/FirstTimeCard";
import { DefconShareCarousel } from "@/components/defcon/DefconShareCarousel";
import { RelatorioShareCard } from "@/components/relatorio/RelatorioShareCard";
import { fmtHorasCurto, type RecapStats } from "@/components/relatorio/recapCanvas";

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

// "day" = escolher UM dia específico no calendário (ex.: "como foi o dia 30?")
type Period = "today" | "day" | "7d" | "30d" | "custom";

interface DailySale {
  date: string;
  total_profit: number | null;
  total_debt: number | null;
  cost: number | null;
  unpaid_units?: number | null;
  cash_sales?: number | null;
  pix_sales?: number | null;
  card_sales?: number | null;
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
  day: "Escolher dia",
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
  // Dia único escolhido no calendário (padrão: ontem — o dia que a pessoa mais quer rever)
  const [dayDate, setDayDate] = useState<Date | undefined>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return startOfDay(d);
  });

  const [loading, setLoading] = useState(true);
  const [sales, setSales] = useState<DailySale[]>([]);
  const [challengeBlocks, setChallengeBlocks] = useState<{ approaches_count: number; sales_count: number }[]>([]);
  const [blocks, setBlocks] = useState<HourBlock[]>([]);
  const [expenses, setExpenses] = useState<{ category: string; amount: number; icon: string | null; name: string }[]>([]);
  const [yesterdayProfit, setYesterdayProfit] = useState(0);
  const [prevRangeProfit, setPrevRangeProfit] = useState(0);
  const [latePix, setLatePix] = useState<{ amount: number | null }[]>([]);
  const [defconSales, setDefconSales] = useState<{ created_at: string; amount?: number }[]>([]);
  // 2a fonte de hora real: quem vende pelo catálogo de produtos não passa pelo DEFCON.
  const [prodSales, setProdSales] = useState<{ created_at: string; total_amount: number | null }[]>([]);
  const [sessions, setSessions] = useState<{ started_at: string | null; ended_at: string | null; worked_minutes?: number | null; current_block_index?: number | null; distance_meters?: number | null; paused_seconds?: number | null }[]>([]);

  // Análise da IA (Gemini) — gerada sob demanda no botão
  const [aiReport, setAiReport] = useState<{ analise?: string } | null>(null);
  const [aiReportLoading, setAiReportLoading] = useState(false);
  const [aiReportError, setAiReportError] = useState<string | null>(null);
  const [aiExpanded, setAiExpanded] = useState(false);

  // Computed range
  const range = useMemo(() => {
    const today = startOfDay(new Date());
    if (period === "today") return { start: today, end: today };
    if (period === "day") {
      const d = dayDate ? startOfDay(dayDate) : today;
      return { start: d, end: d };
    }
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
  }, [period, customStart, customEnd, dayDate]);

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

      const [salesRes, blocksRes, ydRes, prevRes, expensesRes, chBlocksRes, lateRes, defconRes, sessionsRes, prodRes] = await Promise.all([
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
        // "Caiu depois": conta pelo DIA DA VENDA (sale_date), não pelo dia em que foi
        // lançado — assim o recuperado casa com o calote do mesmo período.
        supabase
          .from("late_pix_entries")
          .select("amount")
          .eq("user_id", user.id)
          .gte("sale_date", startISO)
          .lte("sale_date", endISO),
        supabase
          .from("defcon_sales")
          .select("created_at,amount")
          .eq("user_id", user.id)
          .gte("created_at", range.start.toISOString())
          .lte("created_at", new Date(range.end.getTime() + 86399999).toISOString())
          .order("created_at", { ascending: true }),
        supabase
          .from("challenge_sessions")
          .select("started_at,ended_at,worked_minutes,current_block_index,distance_meters,paused_seconds")
          .eq("user_id", user.id)
          .gte("date", startISO)
          .lte("date", endISO),
        supabase
          .from("product_sales_log")
          .select("created_at,total_amount")
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
      setProdSales((prodRes.data as any) || []);
      setSessions((sessionsRes.data as any) || []);
    } finally {
      setLoading(false);
    }
  }

  const summary = useMemo(() => {
    const faturamento = sales.reduce((s, d) => s + (d.total_profit || 0), 0);
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
    // O que FALTOU cair = residuo do dia (vendido − recebido conferido). É o total_debt
    // que o DEFCON já grava. "Era pra cair" = recebido + esse residuo.
    const naoCaiu = sales.reduce((s, d) => s + (Number((d as any).total_debt) || 0), 0);
    const gorjetas = sales.reduce((s, d) => s + (Number((d as any).tip_sales) || 0), 0);

    const totalAbordagens = challengeBlocks.reduce((s, b) => s + (b.approaches_count || 0), 0);
    const totalVendas = challengeBlocks.reduce((s, b) => s + ((b as any).sales_count || 0), 0);
    const conversao = totalAbordagens > 0 ? (totalVendas / totalAbordagens) * 100 : 0;
    const ticketMedio = totalVendas > 0 ? faturamento / totalVendas : 0;
    // "Não recebido" (calote) = SÓ as unidades marcadas como não pagas × ticket médio.
    // Antes vinha de total_debt, que era o RESÍDUO da conferência (vendido − o que foi
    // digitado em dinheiro/pix/cartão) — qualquer diferencinha virava "calote" sem ter calote.
    const calotes = Math.round(caloteUnidades * ticketMedio * 100) / 100;
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

    // Horas trabalhadas no período = soma do TEMPO REAL de trabalho de cada sessão
    // (worked_minutes, já sem almoço/intervalos). Fallback pra sessões antigas sem o
    // campo: wall-clock (fim − início) limitado a (blocos percorridos × 60min).
    let workedMin = 0;
    for (const s of sessions) {
      if (typeof s.worked_minutes === "number") {
        workedMin += Math.max(0, s.worked_minutes);
        continue;
      }
      if (!s.started_at || !s.ended_at) continue;
      const ini = new Date(s.started_at).getTime();
      const fim = new Date(s.ended_at).getTime();
      if (Number.isFinite(ini) && Number.isFinite(fim) && fim > ini) {
        const wall = (fim - ini) / 60000;
        const cap = ((s.current_block_index || 0) + 1) * 60;
        workedMin += Math.min(wall, cap);
      }
    }
    const horasTrabalhadasMin = Math.round(workedMin);

    // Km andado (GPS) e tempo OCIOSO (pausado) somados no período.
    const distanciaKm = sessions.reduce((s, x) => s + (Number(x.distance_meters) || 0), 0) / 1000;
    const tempoOciosoMin = Math.round(sessions.reduce((s, x) => s + (Number(x.paused_seconds) || 0), 0) / 60);

    return {
      horasTrabalhadasMin,
      distanciaKm,
      tempoOciosoMin,
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
      naoCaiu,
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
  }, [sales, blocks, expenses, challengeBlocks, rangeDays, latePix, defconSales, sessions]);

  // ESPERADO x RECEBIDO: "esperado" é o faturamento de TODA a mercadoria vendida
  // (o que era pra cair). "Recebido" é o que efetivamente entrou (dinheiro+pix+cartão).
  // A diferença é o calote — mostrado em R$ e em % do esperado.
  // CAIU = o que já entrou (dinheiro+pix+cartão, = total_profit). FALTOU CAIR = o que
  // ainda não caiu (total_debt do DEFCON). ERA PRA CAIR = os dois somados = o vendido.
  // Sem custo nenhum. Ex.: caiu 1277 + faltou 153 = era pra cair 1430.
  const recebidoDeFato = summary.dinheiro + summary.pix + summary.cartao;
  const naoRecebido = Math.max(0, summary.naoCaiu);
  const esperadoReceber = recebidoDeFato + naoRecebido;
  const pctRecebido = esperadoReceber > 0 ? (recebidoDeFato / esperadoReceber) * 100 : 0;
  const pctCalote = esperadoReceber > 0 ? (naoRecebido / esperadoReceber) * 100 : 0;

  // Formata minutos: "0h", "3h", "2h 30min" — reusado por horas trabalhadas e tempo ocioso.
  const fmtMin = (min: number) => {
    const m0 = Math.max(0, Math.round(min || 0));
    if (m0 <= 0) return "0min";
    const h = Math.floor(m0 / 60);
    const m = m0 % 60;
    if (h <= 0) return `${m}min`;
    return m > 0 ? `${h}h ${m}min` : `${h}h`;
  };
  const horasLabel = summary.horasTrabalhadasMin > 0 ? fmtMin(summary.horasTrabalhadasMin) : "0h";
  const ociosoLabel = fmtMin(summary.tempoOciosoMin);
  const kmLabel = summary.distanciaKm >= 0.01 ? `${summary.distanciaKm.toFixed(1)} km` : "—";

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

  // Custos por categoria COMPLETOS = CMV/transporte/alimentação do dia (daily_sales) +
  // os lançamentos manuais. É o mesmo total do "Detalhamento financeiro" — antes esse
  // bloco mostrava só os lançamentos manuais e ignorava o CMV (custo de mercadoria),
  // fazendo Mercadoria parecer bem menor do que é de verdade.
  const custosPorCategoria = useMemo(() => {
    return [
      { category: "Mercadoria", icon: "📦", total: summary.custoMercadoria },
      { category: "Transporte", icon: "🚌", total: summary.custoTransporte },
      { category: "Alimentação", icon: "🍽️", total: summary.custoAlimentacao },
      { category: "Outros", icon: "💰", total: summary.custoOutros },
    ]
      .filter((c) => c.total > 0.005)
      .sort((a, b) => b.total - a.total);
  }, [summary.custoMercadoria, summary.custoTransporte, summary.custoAlimentacao, summary.custoOutros]);
  const custosCategoriaTotal = custosPorCategoria.reduce((s, c) => s + c.total, 0);

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

  // Melhores horários = pela HORA REAL de cada venda (defcon_sales, fuso de Brasília).
  // Antes agrupava por hour_index (posição do bloco), que misturava horas diferentes.
  const bestHours = useMemo(() => {
    const byHour: Record<number, { total: number; count: number }> = {};
    for (const s of defconSales) {
      const t = new Date(s.created_at).getTime();
      if (!Number.isFinite(t)) continue;
      const h = new Date(t - 3 * 3600000).getUTCHours(); // hora de Brasília
      const amt = Number(s.amount) || 0;
      const slot = byHour[h] ?? (byHour[h] = { total: 0, count: 0 });
      slot.total += amt;
      slot.count += 1;
    }
    return Object.entries(byHour)
      .map(([h, v]) => ({
        hour: parseInt(h),
        label: `${String(parseInt(h)).padStart(2, "0")}h`,
        total: v.total,
        count: v.count,
        avg: v.count > 0 ? v.total / v.count : 0,
      }))
      .filter((h) => h.total > 0)
      .sort((a, b) => b.total - a.total);
  }, [defconSales]);

  // ===== HORA A HORA =====
  // Junta as vendas com carimbo de hora real (DEFCON + catálogo de produtos) e
  const periodoLabel =
    period === "today" ? "dia de hoje"
    : period === "day" ? `dia ${fmtBR(range.start)}`
    : period === "7d" ? "semana (últimos 7 dias)"
    : period === "30d" ? "mês (últimos 30 dias)"
    : "período selecionado";

  // Rótulo curto que vai impresso na arte diária (mesma arte do fim do DEFCON)
  const shareLabel = period === "today" ? `HOJE · ${fmtBR(range.start)}` : `DIA ${fmtBR(range.start)}`;

  // Dados da arte RECAP (semana / mês / intervalo) — barras dia a dia + grade de números
  const recapStats: RecapStats = useMemo(() => {
    const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
    const MESES_LONGO = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
    const DIAS_SEM = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
    const s = range.start, e = range.end;
    let titulo: string;
    let subtitulo: string | undefined;
    if (period === "7d") {
      titulo = s.getMonth() === e.getMonth()
        ? `Semana ${s.getDate()} – ${e.getDate()} ${MESES[e.getMonth()]}`
        : `Semana ${s.getDate()} ${MESES[s.getMonth()]} – ${e.getDate()} ${MESES[e.getMonth()]}`;
      subtitulo = "últimos 7 dias";
    } else if (period === "30d") {
      titulo = `${MESES_LONGO[e.getMonth()]} ${e.getFullYear()}`;
      subtitulo = "últimos 30 dias";
    } else {
      titulo = `${fmtBR(s)} → ${fmtBR(e)}`;
      subtitulo = `${rangeDays} dias`;
    }
    const dias = chartData.map((d) => {
      const dt = new Date(d.iso + "T12:00:00");
      return {
        label: chartData.length <= 7 ? DIAS_SEM[dt.getDay()]![0]!.toUpperCase() : String(dt.getDate()),
        valor: d.valor,
        iso: d.iso,
      };
    });
    const best = bestWorstDay?.best;
    const bestDt = best ? new Date(best.iso + "T12:00:00") : null;
    return {
      titulo,
      subtitulo,
      faturamento: summary.faturamento,
      lucro: summary.lucro,
      dias,
      diasTrabalhados: sales.filter((d) => (d.total_profit || 0) > 0).length,
      melhorDia: best && bestDt ? { label: `${DIAS_SEM[bestDt.getDay()]} ${fmtBR(bestDt)}`, valor: best.valor } : null,
      vendas: summary.totalVendas,
      ticketMedio: summary.ticketMedio,
      horasMin: summary.horasTrabalhadasMin,
      caiuPct: esperadoReceber > 0 ? pctRecebido : null,
    };
  }, [period, range.start, range.end, rangeDays, chartData, bestWorstDay, summary, sales, esperadoReceber, pctRecebido]);

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


  return (
    <div className="space-y-4 pb-4 md:pb-8 text-foreground">
      <FirstTimeCard tela="relatorio" userId={user?.id} />
      {/* Header — Relatório v2 (design system Orbis: Manrope, preto absoluto) */}
      <div className="flex items-start justify-between gap-3">
        <h1 className="font-display text-2xl font-extrabold tracking-tight">Relatório</h1>
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

      {/* Filtro de período — pílulas, dourado no ativo */}
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {(["today", "day", "7d", "30d", "custom"] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={cn(
                "orbis-press px-3.5 py-2 text-xs font-semibold rounded-full border transition-[colors]",
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

        {period === "day" && (
          <div className="flex flex-wrap items-center gap-2">
            <DateField label="Dia" date={dayDate} onChange={(d) => d && setDayDate(d)} />
            <span className="text-[11px] text-muted-foreground">toque pra escolher o dia que quer rever</span>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : (
        <>
          {/* HERÓI — faturamento do período (número conta, anel de contexto no chip) */}
          <section
            className="orbis-card-in rounded-[22px] border p-[17px]"
            style={{
              borderColor: "rgba(245,184,0,.28)",
              background: "linear-gradient(160deg,#1C1608 0%, hsl(var(--card)) 60%)",
              boxShadow: "0 20px 50px -30px rgba(245,184,0,.45)",
            }}
          >
            <p className="orbis-label">
              Faturamento · {fmtBR(range.start)}{isSingleDay ? "" : ` → ${fmtBR(range.end)}`}
            </p>
            <p className="font-display text-[34px] font-extrabold leading-none mt-2">
              <AnimatedCurrency value={summary.faturamento} />
            </p>
            <div className="flex items-center gap-x-3 gap-y-1.5 flex-wrap mt-2.5 text-[12.5px] text-muted-foreground">
              {(isSingleDay ? compareYesterday : comparePrev).valid && (
                <span
                  className="inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11.5px] font-bold"
                  style={
                    (isSingleDay ? compareYesterday.pct : comparePrev.pct) >= 0
                      ? { color: "var(--orbis-gold,#F5B800)", background: "rgba(245,184,0,.12)", borderColor: "rgba(245,184,0,.4)" }
                      : { color: "hsl(var(--muted-foreground))", background: "rgba(255,255,255,.06)", borderColor: "rgba(255,255,255,.15)" }
                  }
                >
                  {(isSingleDay ? compareYesterday.pct : comparePrev.pct) >= 0 ? (
                    <ArrowUpRight className="w-3 h-3" />
                  ) : (
                    <ArrowDownRight className="w-3 h-3" />
                  )}
                  {(isSingleDay ? compareYesterday.pct : comparePrev.pct) >= 0 ? "+" : ""}
                  {(isSingleDay ? compareYesterday.pct : comparePrev.pct).toFixed(0)}%{" "}
                  {isSingleDay ? "vs ontem" : "vs anterior"}
                </span>
              )}
              <span className="whitespace-nowrap">
                Lucro <b className="text-foreground">{formatCurrency(summary.lucro)}</b>
              </span>
              {summary.horasTrabalhadasMin > 0 && (
                <span className="whitespace-nowrap">
                  <b className="text-foreground">{fmtHorasCurto(summary.horasTrabalhadasMin)}</b> na rua
                </span>
              )}
            </div>
          </section>

          {/* Compartilhar (arte diária do DEFCON pra 1 dia; recap pra períodos) */}
          {summary.faturamento > 0 && (
            isSingleDay ? (
              <DefconShareCarousel
                stats={{
                  faturamento: summary.faturamento,
                  vendas: summary.totalVendas,
                  conversao: summary.conversao,
                  horas: fmtHorasCurto(summary.horasTrabalhadasMin),
                  periodo: shareLabel,
                }}
              />
            ) : (
              <RelatorioShareCard stats={recapStats} />
            )
          )}

          {/* CAIU NO BOLSO — verde herói, barra que enche, calote em vermelho vivo */}
          <section className="orbis-card-in rounded-2xl border border-border/60 bg-card p-4 space-y-3">
            <p className="orbis-label" style={{ color: "var(--orbis-ok,#3DD68C)" }}>Caiu no bolso</p>
            <p className="font-display text-[30px] font-extrabold leading-none" style={{ color: "var(--orbis-ok,#3DD68C)" }}>
              <AnimatedCurrency value={recebidoDeFato} />
            </p>
            <p className="text-[12.5px] text-muted-foreground -mt-1">
              {pctRecebido.toFixed(0)}% de tudo que você vendeu já entrou
            </p>
            <div className="flex h-2 w-full rounded-full overflow-hidden bg-white/10">
              <div
                className="orbis-fill h-full"
                style={{ width: `${Math.min(100, Math.max(0, pctRecebido))}%`, background: "var(--orbis-ok,#3DD68C)" }}
              />
              <div className="h-full flex-1" style={{ background: naoRecebido > 0 ? "var(--orbis-calote,#FF5C5C)" : "transparent" }} />
            </div>
            <div className="flex items-center justify-between text-[12px]">
              <span className="text-muted-foreground">Vendido {formatCurrency(esperadoReceber)}</span>
              <span className="font-bold" style={{ color: naoRecebido > 0 ? "var(--orbis-calote,#FF5C5C)" : "hsl(var(--muted-foreground))" }}>
                {naoRecebido > 0 ? `Faltou cair ${formatCurrency(naoRecebido)}` : "caiu tudo 🎉"}
              </span>
            </div>
          </section>

          {/* FECHAMENTO DO DIA — só com um dia filtrado */}
          {isSingleDay && (
            <FechamentoDoDia
              userId={user.id}
              date={isoDate(range.start)}
              dia={sales.find((d) => d.date === isoDate(range.start)) ?? null}
              onChanged={loadData}
            />
          )}

          {/* 4 números — cards gêmeos */}
          <section className="grid grid-cols-2 gap-2.5">
            <StatTile label="Ticket médio" sub={`${summary.totalVendas} ${summary.totalVendas === 1 ? "venda" : "vendas"}`}>
              <AnimatedCurrency value={summary.ticketMedio} />
            </StatTile>
            <StatTile label="Conversão" sub={`${summary.totalAbordagens} abordagens`}>
              <AnimatedNumber value={summary.conversao} format={(n) => `${Math.round(n)}%`} />
            </StatTile>
            <StatTile
              label="Melhor dia"
              sub={bestWorstDay?.best ? bestWorstDay.best.label : "—"}
            >
              <AnimatedCurrency value={bestWorstDay?.best?.valor ?? 0} />
            </StatTile>
            <StatTile label="Média por dia" sub={`${sales.length} ${sales.length === 1 ? "dia" : "dias"} na rua`}>
              <AnimatedCurrency value={summary.mediaDiaria} />
            </StatTile>
          </section>

          {/* DIA A DIA — barras, melhor dia dourado com o valor em cima */}
          {rangeDays > 1 && chartData.some((d) => d.valor > 0) && (
            <section className="orbis-card-in rounded-2xl border border-border/60 bg-card p-4">
              <p className="orbis-section mb-3">Dia a dia</p>
              <BarsDiaADia data={chartData} />
            </section>
          )}

          {/* DETALHES — o resto mora recolhido (Miller: 5 blocos na tela) */}
          <div className="space-y-2.5">
            <Collapse
              icon={<TrendingUp className="w-[18px] h-[18px]" style={{ color: "var(--orbis-gold,#F5B800)" }} />}
              title="Detalhamento financeiro"
              sub="custos e unidades"
            >
              <div className="divide-y divide-border/60">
                <FinanceRow label="Faturamento bruto" value={formatCurrency(summary.faturamento)} tone="white" />
                <FinanceRow label="Custo de mercadoria" value={`- ${formatCurrency(summary.custoMercadoria)}`} tone="muted" />
                <FinanceRow label="Transporte" value={`- ${formatCurrency(summary.custoTransporte)}`} tone="muted" />
                <FinanceRow label="Alimentação" value={`- ${formatCurrency(summary.custoAlimentacao)}`} tone="muted" />
                {summary.custoOutros > 0 && (
                  <FinanceRow label="Outros custos" value={`- ${formatCurrency(summary.custoOutros)}`} tone="muted" />
                )}
                {summary.unidLevadas > 0 && (
                  <FinanceRow label="Unidades levadas" value={`${summary.unidLevadas}`} tone="muted" />
                )}
                <FinanceRow label="Unidades vendidas" value={`${summary.totalVendas}`} tone="muted" />
                {summary.unidLevadas > 0 && (
                  <FinanceRow label="Sobrou (estoque)" value={`${summary.unidSobrou}`} tone="muted" />
                )}
                {summary.gorjetas > 0 && (
                  <FinanceRow label="Gorjetas" value={formatCurrency(summary.gorjetas)} tone="muted" />
                )}
                <FinanceRow label="Recebido em dinheiro" value={formatCurrency(summary.dinheiro)} tone="muted" />
                <FinanceRow label="Recebido no Pix" value={formatCurrency(summary.pix)} tone="muted" />
                <FinanceRow label="Recebido no cartão" value={formatCurrency(summary.cartao)} tone="muted" />
                <FinanceRow label="Lucro líquido" value={formatCurrency(summary.lucro)} tone="gold" bold />
              </div>
              {custosPorCategoria.length > 0 && (
                <div className="px-4 py-3 space-y-2.5 border-t border-border/60">
                  {custosPorCategoria.map((c) => {
                    const pct = custosCategoriaTotal > 0 ? (c.total / custosCategoriaTotal) * 100 : 0;
                    return (
                      <div key={c.category} className="space-y-1">
                        <div className="flex items-center gap-2 text-sm">
                          <span className="flex-1 text-foreground/90 font-medium">{c.category}</span>
                          <span className="text-xs text-muted-foreground">{pct.toFixed(0)}%</span>
                          <span className="font-semibold text-primary w-24 text-right orbis-num">{formatCurrency(c.total)}</span>
                        </div>
                        <FillBar pct={pct} height={5} />
                      </div>
                    );
                  })}
                </div>
              )}
            </Collapse>

            <Collapse
              icon={<AlertTriangle className="w-[18px] h-[18px]" style={{ color: "var(--orbis-calote,#FF5C5C)" }} />}
              title="Calote e recuperação"
              sub={summary.calotes > 0 ? `${formatCurrency(summary.calotes)} · ${summary.caloteUnidades} un` : "sem calote 🎉"}
            >
              <div className="divide-y divide-border/60">
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
                  label="Caiu depois (recuperado)"
                  value={formatCurrency(summary.pixRecuperado)}
                  sub={
                    summary.pixRecuperado > 0
                      ? summary.calotes > 0
                        ? `${summary.recuperadoPct.toFixed(0)}% do calote volta`
                        : `~${Math.round(summary.recuperadoUnid)} un recuperadas`
                      : "ainda sem recuperação"
                  }
                  tone="white"
                />
                <FinanceRow label="Calote médio por dia" value={`${summary.mediaCaloteDiaUnid.toFixed(1)} un`} tone="muted" />
              </div>
              {summary.sugestaoUnid > 0 && (
                <div className="mx-4 mb-3 rounded-xl border border-primary/30 bg-primary/10 p-3 text-sm text-foreground/90">
                  Leve <b className="text-primary">+{summary.sugestaoUnid} {summary.sugestaoUnid === 1 ? "unidade" : "unidades"} por dia</b> pra cobrir seu calote médio.
                </div>
              )}
            </Collapse>

            <Collapse
              icon={<Clock className="w-[18px] h-[18px] text-muted-foreground" />}
              title="Melhores horários"
              sub={bestHours.length > 0 ? bestHours.slice(0, 3).map((h) => h.label).join(" · ") : "sem dados"}
            >
              <div className="divide-y divide-border/60">
                {bestHours.slice(0, 6).map((h) => (
                  <FinanceRow
                    key={h.hour}
                    label={h.label}
                    value={formatCurrency(h.total)}
                    sub={`${h.count} ${h.count === 1 ? "venda" : "vendas"} · média ${formatCurrency(h.avg)}`}
                    tone="white"
                  />
                ))}
                {bestHours.length === 0 && (
                  <p className="px-4 py-3 text-sm text-muted-foreground">Use o Modo Foco pra registrar a hora real de cada venda.</p>
                )}
                {summary.ritmoMin > 0 && (
                  <FinanceRow label="Ritmo de vendas" value={`1 a cada ${summary.ritmoMin.toFixed(0)} min`} tone="muted" />
                )}
                {summary.tempoOciosoMin > 0 && (
                  <FinanceRow label="Tempo ocioso" value={ociosoLabel} tone="muted" />
                )}
                {summary.distanciaKm >= 0.01 && (
                  <FinanceRow label="Km andado" value={kmLabel} tone="muted" />
                )}
              </div>
            </Collapse>

            <Collapse
              icon={<Sparkles className="w-[18px] h-[18px]" style={{ color: "var(--orbis-gold,#F5B800)" }} />}
              title="Analisar com o mentor (IA)"
              sub={aiReport ? "análise pronta" : ""}
              onOpen={() => { if (!aiReport && !aiReportLoading) generateReportAnalysis(); }}
            >
              <div className="px-4 pb-3">
                {aiReportLoading && (
                  <p className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                    <Loader2 className="w-4 h-4 animate-spin" /> Analisando seu corre...
                  </p>
                )}
                {aiReport?.analise && (
                  <>
                    <p className={`text-sm text-foreground/90 leading-relaxed whitespace-pre-line ${aiExpanded ? "" : "line-clamp-6"}`}>
                      {aiReport.analise}
                    </p>
                    <div className="flex items-center gap-3 flex-wrap mt-2">
                      <button onClick={() => setAiExpanded((v) => !v)} className="text-xs font-semibold text-primary hover:underline">
                        {aiExpanded ? "ver menos" : "ver mais"}
                      </button>
                      <button onClick={generateReportAnalysis} disabled={aiReportLoading} className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 disabled:opacity-60">
                        Atualizar
                      </button>
                      <button onClick={() => navigate("/chat")} className="text-xs text-primary hover:underline inline-flex items-center gap-0.5 ml-auto">
                        Conversar <ChevronRight className="w-3 h-3" />
                      </button>
                    </div>
                  </>
                )}
                {aiReportError && <p className="text-xs text-destructive whitespace-pre-line mt-2">{aiReportError}</p>}
              </div>
            </Collapse>
          </div>
        </>
      )}
    </div>
  );
}

function StatTile({ label, sub, children }: { label: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card px-3.5 py-3">
      <p className="orbis-section">{label}</p>
      <p className="font-display mt-1.5 text-[21px] font-extrabold leading-none">{children}</p>
      {sub && <p className="text-[11px] text-muted-foreground mt-1">{sub}</p>}
    </div>
  );
}

/** Barras dia a dia — melhor dia dourado com o valor em cima; barras crescem na entrada. */
function BarsDiaADia({ data }: { data: { label: string; valor: number; iso: string }[] }) {
  const [grow, setGrow] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setGrow(true));
    return () => cancelAnimationFrame(id);
  }, []);
  const max = Math.max(1, ...data.map((d) => d.valor));
  const bestIdx = data.reduce((bi, d, i, arr) => (d.valor > (arr[bi]?.valor ?? -1) ? i : bi), 0);
  const n = data.length;
  const DIAS = ["D", "S", "T", "Q", "Q", "S", "S"];
  const short = (v: number) => (v >= 10000 ? `R$ ${(v / 1000).toFixed(1).replace(".", ",")}k` : formatCurrency(v).replace(",00", ""));
  return (
    <div>
      <div className="flex items-end gap-[6px]" style={{ height: 120 }}>
        {data.map((d, i) => {
          const isBest = i === bestIdx && d.valor > 0;
          const hPct = d.valor > 0 ? Math.max(8, (d.valor / max) * 100) : 4;
          return (
            <div key={d.iso} className="flex-1 flex flex-col items-center justify-end h-full min-w-0">
              {isBest && (
                <span className="orbis-num text-[11px] font-extrabold mb-1 whitespace-nowrap" style={{ color: "var(--orbis-gold,#F5B800)" }}>
                  {short(d.valor)}
                </span>
              )}
              <div
                className="w-full rounded-t-md"
                style={{
                  height: grow ? `${hPct}%` : "4%",
                  transition: "height 600ms cubic-bezier(0.2,0,0,1)",
                  background: isBest
                    ? "linear-gradient(180deg,var(--orbis-gold,#F5B800),var(--orbis-gold-deep,#B88700))"
                    : d.valor > 0
                      ? "rgba(255,255,255,.22)"
                      : "rgba(255,255,255,.08)",
                  boxShadow: isBest ? "0 0 16px -4px rgba(245,184,0,.6)" : undefined,
                }}
              />
            </div>
          );
        })}
      </div>
      <div className="flex gap-[6px] mt-1.5">
        {data.map((d, i) => {
          const isBest = i === bestIdx && d.valor > 0;
          const show = n <= 14 || i === 0 || i === n - 1 || i % 5 === 0;
          const lbl = n <= 7 ? DIAS[new Date(d.iso + "T12:00:00").getDay()] : String(new Date(d.iso + "T12:00:00").getDate());
          return (
            <span
              key={d.iso}
              className={`flex-1 text-center text-[10.5px] ${isBest ? "font-extrabold" : "font-semibold"}`}
              style={{ color: isBest ? "var(--orbis-gold,#F5B800)" : "hsl(var(--muted-foreground))" }}
            >
              {show ? lbl : ""}
            </span>
          );
        })}
      </div>
    </div>
  );
}

/** Seção recolhível — o "ver detalhes" do Relatório v2. */
function Collapse({ icon, title, sub, children, onOpen }: {
  icon: React.ReactNode;
  title: string;
  sub?: string;
  children: React.ReactNode;
  onOpen?: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
      <button
        type="button"
        className="orbis-press w-full flex items-center gap-3 px-4 py-3.5 text-left"
        onClick={() => {
          const v = !open;
          setOpen(v);
          if (v) onOpen?.();
        }}
      >
        <span className="shrink-0">{icon}</span>
        <span className="flex-1 min-w-0 text-sm font-bold whitespace-nowrap overflow-hidden text-ellipsis">{title}</span>
        {sub && !open && <span className="text-xs text-muted-foreground whitespace-nowrap">{sub}</span>}
        <ChevronRight className={`w-4 h-4 shrink-0 text-muted-foreground transition-transform duration-200 ${open ? "rotate-90" : ""}`} />
      </button>
      {open && <div className="orbis-card-in">{children}</div>}
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
