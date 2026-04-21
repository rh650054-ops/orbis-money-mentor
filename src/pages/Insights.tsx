import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Sparkles,
  TrendingUp,
  TrendingDown,
  Trophy,
  ChevronRight,
  Loader2,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useLeaderboard } from "@/hooks/useLeaderboard";
import { formatCurrency } from "@/lib/utils";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

type Period = "today" | "7d" | "month";

interface DailySale {
  date: string;
  total_profit: number | null;
  total_debt: number | null;
  cost: number | null;
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
  month: "Mês",
};

function startOfPeriod(period: Period): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  if (period === "today") return d;
  if (period === "7d") {
    d.setDate(d.getDate() - 6);
    return d;
  }
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function isoDate(d: Date): string {
  return d.toISOString().split("T")[0];
}

export default function Insights() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { currentUserStats, hasParticipated } = useLeaderboard(user?.id);

  const [period, setPeriod] = useState<Period>("7d");
  const [loading, setLoading] = useState(true);
  const [sales, setSales] = useState<DailySale[]>([]);
  const [blocks, setBlocks] = useState<HourBlock[]>([]);
  const [yesterdayProfit, setYesterdayProfit] = useState(0);
  const [prevWeekProfit, setPrevWeekProfit] = useState(0);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
      return;
    }
    if (user) loadData();
  }, [user, authLoading, period]);

  async function loadData() {
    if (!user) return;
    setLoading(true);
    try {
      const start = startOfPeriod(period);
      const startISO = isoDate(start);

      // Range needed for blocks (last 30 days for hour analysis)
      const blocksStart = new Date();
      blocksStart.setDate(blocksStart.getDate() - 29);

      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayISO = isoDate(yesterday);

      const prevWeekStart = new Date();
      prevWeekStart.setDate(prevWeekStart.getDate() - 13);
      const prevWeekEnd = new Date();
      prevWeekEnd.setDate(prevWeekEnd.getDate() - 7);

      const [salesRes, blocksRes, ydRes, prevWkRes] = await Promise.all([
        supabase
          .from("daily_sales")
          .select("date,total_profit,total_debt,cost")
          .eq("user_id", user.id)
          .gte("date", startISO)
          .order("date", { ascending: true }),
        supabase
          .from("hourly_goal_blocks")
          .select("hour_index,hour_label,achieved_amount,approaches_count,created_at")
          .eq("user_id", user.id)
          .gte("created_at", blocksStart.toISOString()),
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
          .gte("date", isoDate(prevWeekStart))
          .lte("date", isoDate(prevWeekEnd)),
      ]);

      setSales(salesRes.data || []);
      setBlocks(blocksRes.data || []);
      setYesterdayProfit(ydRes.data?.total_profit || 0);
      setPrevWeekProfit(
        (prevWkRes.data || []).reduce((s, d: any) => s + (d.total_profit || 0), 0),
      );
    } finally {
      setLoading(false);
    }
  }

  const summary = useMemo(() => {
    const faturamento = sales.reduce((s, d) => s + (d.total_profit || 0), 0);
    const calotes = sales.reduce((s, d) => s + (d.total_debt || 0), 0);
    const custos = sales.reduce((s, d) => s + (d.cost || 0), 0);
    const lucro = faturamento - calotes - custos;

    const periodBlocks = blocks.filter((b) => {
      const created = new Date(b.created_at);
      return created >= startOfPeriod(period);
    });
    const totalAbordagens = periodBlocks.reduce(
      (s, b) => s + (b.approaches_count || 0),
      0,
    );
    const totalVendas = periodBlocks.filter((b) => (b.achieved_amount || 0) > 0).length;
    const conversao = totalAbordagens > 0 ? (totalVendas / totalAbordagens) * 100 : 0;
    const ticketMedio = totalVendas > 0 ? faturamento / totalVendas : 0;
    const abordagensPorVenda = totalVendas > 0 ? totalAbordagens / totalVendas : 0;

    return {
      faturamento,
      lucro,
      ticketMedio,
      conversao,
      totalAbordagens,
      totalVendas,
      abordagensPorVenda,
    };
  }, [sales, blocks, period]);

  const chartData = useMemo(() => {
    const days = period === "today" ? 1 : period === "7d" ? 7 : 30;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const map = new Map(sales.map((d) => [d.date, d.total_profit || 0]));
    const result: { label: string; valor: number }[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const iso = isoDate(d);
      result.push({
        label: d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
        valor: map.get(iso) || 0,
      });
    }
    return result;
  }, [sales, period]);

  const compareYesterday = useMemo(() => {
    const todayProfit =
      sales.find((d) => d.date === isoDate(new Date()))?.total_profit || 0;
    if (!yesterdayProfit) return { pct: 0, valid: false, todayProfit };
    const pct = ((todayProfit - yesterdayProfit) / yesterdayProfit) * 100;
    return { pct, valid: true, todayProfit };
  }, [sales, yesterdayProfit]);

  const compareWeek = useMemo(() => {
    const weekProfit = sales
      .filter((d) => {
        const dt = new Date(d.date);
        const start = new Date();
        start.setDate(start.getDate() - 6);
        start.setHours(0, 0, 0, 0);
        return dt >= start;
      })
      .reduce((s, d) => s + (d.total_profit || 0), 0);
    if (!prevWeekProfit) return { pct: 0, valid: false, weekProfit };
    const pct = ((weekProfit - prevWeekProfit) / prevWeekProfit) * 100;
    return { pct, valid: true, weekProfit };
  }, [sales, prevWeekProfit]);

  const bestHours = useMemo(() => {
    const byHour: Record<number, { total: number; count: number; label: string }> = {};
    for (const b of blocks) {
      if (!byHour[b.hour_index]) {
        byHour[b.hour_index] = { total: 0, count: 0, label: b.hour_label };
      }
      byHour[b.hour_index].total += b.achieved_amount || 0;
      byHour[b.hour_index].count += 1;
    }
    const arr = Object.entries(byHour)
      .map(([h, v]) => ({
        hour: parseInt(h),
        label: v.label,
        avg: v.count > 0 ? v.total / v.count : 0,
      }))
      .filter((h) => h.avg > 0)
      .sort((a, b) => b.avg - a.avg);
    return arr;
  }, [blocks]);

  const aiInsights = useMemo(() => {
    const tips: string[] = [];
    if (summary.abordagensPorVenda > 0) {
      tips.push(
        `Você precisa de ${summary.abordagensPorVenda.toFixed(1)} abordagens para gerar 1 venda.`,
      );
    }
    if (compareYesterday.valid) {
      if (compareYesterday.pct > 10)
        tips.push(`Hoje você está vendendo ${compareYesterday.pct.toFixed(0)}% mais que ontem.`);
      else if (compareYesterday.pct < -10)
        tips.push(
          `Atenção: hoje você está vendendo ${Math.abs(compareYesterday.pct).toFixed(0)}% menos que ontem.`,
        );
    }
    if (bestHours.length >= 2) {
      tips.push(`Você vende mais no horário de ${bestHours[0].label}.`);
      const worst = bestHours[bestHours.length - 1];
      if (worst.avg < bestHours[0].avg * 0.5) {
        tips.push(`Seu pior horário é ${worst.label} — evite gastar energia ali.`);
      }
    }
    if (summary.conversao > 0 && summary.conversao < 15) {
      tips.push(
        `Sua conversão está em ${summary.conversao.toFixed(0)}%. Reveja a abordagem para melhorar.`,
      );
    }
    if (tips.length === 0) {
      tips.push("Registre mais vendas para destravar insights personalizados.");
    }
    return tips;
  }, [summary, compareYesterday, bestHours]);

  if (authLoading || !user) return null;

  const maxHourAvg = bestHours[0]?.avg || 1;

  return (
    <div className="space-y-6 pb-20 md:pb-8 text-foreground">
      {/* Header + period filter */}
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Dados</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Decisões claras a partir do seu desempenho
          </p>
        </div>
        <div className="inline-flex rounded-full border border-border/60 bg-card/40 p-1">
          {(["today", "7d", "month"] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 text-xs rounded-full transition-colors ${
                period === p
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : (
        <>
          {/* 1. Resumo do período */}
          <section className="grid grid-cols-2 gap-3">
            <MetricCell label="Faturamento" value={formatCurrency(summary.faturamento)} />
            <MetricCell
              label="Lucro líquido"
              value={formatCurrency(summary.lucro)}
              valueClassName={summary.lucro >= 0 ? "text-emerald-400" : "text-red-400"}
            />
            <MetricCell label="Ticket médio" value={formatCurrency(summary.ticketMedio)} />
            <MetricCell
              label="Conversão"
              value={`${summary.conversao.toFixed(1)}%`}
              valueClassName="text-primary"
            />
          </section>

          {/* 2. Gráfico principal */}
          <SectionTitle>Faturamento</SectionTitle>
          <div className="rounded-2xl border border-border/40 bg-card/30 p-4">
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 8, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="goldFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.45} />
                      <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="hsl(var(--border))" strokeOpacity={0.15} vertical={false} />
                  <XAxis
                    dataKey="label"
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
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
                      background: "hsl(var(--background))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 12,
                      fontSize: 12,
                    }}
                    formatter={(v: number) => [formatCurrency(v), "Faturamento"]}
                  />
                  <Area
                    type="monotone"
                    dataKey="valor"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    fill="url(#goldFill)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 3. Performance de vendas */}
          <SectionTitle>Performance</SectionTitle>
          <div className="rounded-2xl border border-border/40 bg-card/30 p-4 space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <MiniStat label="Abordagens" value={summary.totalAbordagens.toString()} />
              <MiniStat label="Vendas" value={summary.totalVendas.toString()} />
              <MiniStat label="Conversão" value={`${summary.conversao.toFixed(0)}%`} />
            </div>
            <div className="text-sm text-muted-foreground border-t border-border/40 pt-3">
              {summary.abordagensPorVenda > 0 ? (
                <>
                  Você precisa de{" "}
                  <span className="text-primary font-semibold">
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

          {/* 4. Comparação de desempenho */}
          <SectionTitle>Comparação</SectionTitle>
          <div className="grid grid-cols-2 gap-3">
            <ComparisonCell
              label="Hoje vs ontem"
              pct={compareYesterday.pct}
              valid={compareYesterday.valid}
            />
            <ComparisonCell
              label="Semana vs anterior"
              pct={compareWeek.pct}
              valid={compareWeek.valid}
            />
          </div>

          {/* 5. Melhores horários */}
          <SectionTitle>Melhores horários</SectionTitle>
          <div className="rounded-2xl border border-border/40 bg-card/30 p-4">
            {bestHours.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Sem dados de horários ainda. Trabalhe alguns blocos no Ritmo.
              </p>
            ) : (
              <div className="space-y-2.5">
                {bestHours.slice(0, 5).map((h, i) => (
                  <div key={h.hour} className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground w-16 shrink-0">
                      {h.label}
                    </span>
                    <div className="flex-1 h-2 rounded-full bg-muted/30 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          i === 0 ? "bg-emerald-400" : i === bestHours.length - 1 ? "bg-red-400/70" : "bg-primary/70"
                        }`}
                        style={{ width: `${(h.avg / maxHourAvg) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs text-foreground font-medium w-20 text-right">
                      {formatCurrency(h.avg)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 6. Ranking */}
          <SectionTitle>Ranking</SectionTitle>
          <button
            onClick={() => navigate("/ranking")}
            className="w-full rounded-2xl border border-border/40 bg-card/30 p-4 flex items-center gap-4 hover:bg-card/50 transition-colors text-left"
          >
            <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
              <Trophy className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              {hasParticipated && currentUserStats ? (
                <>
                  <p className="text-sm font-semibold">
                    Faturamento: #{currentUserStats.posicao_faturamento ?? "-"} · Constância: #
                    {currentUserStats.posicao_constancia ?? "-"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Veja sua posição na sua cidade, estado e global
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm font-semibold">Você ainda não está no ranking</p>
                  <p className="text-xs text-muted-foreground">Registre vendas para entrar</p>
                </>
              )}
            </div>
            <span className="text-xs text-primary inline-flex items-center">
              Ver ranking completo <ChevronRight className="w-4 h-4 ml-0.5" />
            </span>
          </button>

          {/* 7. Insights da IA */}
          <SectionTitle>Insights da IA</SectionTitle>
          <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 space-y-2.5">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-4 h-4 text-primary" />
              <p className="text-xs font-semibold text-primary uppercase tracking-wider">
                Análise inteligente
              </p>
            </div>
            {aiInsights.map((tip, i) => (
              <p key={i} className="text-sm text-foreground/90 leading-relaxed">
                • {tip}
              </p>
            ))}
            <Button
              variant="ghost"
              size="sm"
              className="mt-2 text-primary hover:text-primary"
              onClick={() => navigate("/chat")}
            >
              Conversar com a IA <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </>
      )}
    </div>
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
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="rounded-2xl border border-border/40 bg-card/30 p-4">
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`mt-1.5 text-xl font-semibold ${valueClassName}`}>{value}</p>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
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
  const color = !valid
    ? "text-muted-foreground"
    : positive
      ? "text-emerald-400"
      : "text-red-400";
  return (
    <div className="rounded-2xl border border-border/40 bg-card/30 p-4">
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
      {valid ? (
        <div className={`mt-1.5 flex items-center gap-1 text-lg font-semibold ${color}`}>
          <Icon className="w-4 h-4" />
          {positive ? "+" : ""}
          {pct.toFixed(0)}%
        </div>
      ) : (
        <p className="mt-1.5 text-sm text-muted-foreground">Sem dados</p>
      )}
    </div>
  );
}
