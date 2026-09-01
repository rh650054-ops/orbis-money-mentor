import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { useToast } from "@/shared/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useDailyGoalPlan } from "@/hooks/useDailyGoalPlan";
import { supabase } from "@/integrations/supabase/client";
import AntiProcrastination from "@/components/AntiProcrastination";
import QuickExpenseButton from "@/components/QuickExpenseButton";
import { formatCurrency } from "@/shared/lib/utils";
import { getBrazilDate, getBrazilMonthStart, getBrazilDateDaysAgo } from "@/shared/lib/date-utils";
import { useRefetchOnFocus } from "@/shared/hooks/use-refetch-on-focus";
import CardRegistrationModal from "@/components/CardRegistrationModal";
import { TrialNudge } from "@/components/TrialNudge";
import { EditPlanningModal } from "@/components/EditPlanningModal";
import { emitMissionEvent } from "@/shared/lib/missionEvents";
import { DayStartPopup } from "@/components/DayStartPopup";
import { WeeklyChallengeDashboardCard } from "@/components/competitions/WeeklyChallenge";
import { isWeeklyTicketPending, WEEKLY_TICKET_DONE_EVENT } from "@/shared/lib/weeklyChallenge";
import { useMonthlyGoalRequired } from "@/hooks/useMonthlyGoalRequired";
// Orbis 2.0 (set/2026): blocos do dashboard novo + onboarding
import RankingCard from "@/components/RankingCard";
import { CompeticaoRow } from "@/components/dashboard/DashboardV8";
import { HeaderV9, SemanaRow, HeroCard, Bloco, FinanceiroFlat, PatenteLinha } from "@/components/dashboard/DashboardV9";
import PrimeirosPassos from "@/components/onboarding/PrimeirosPassos";
import CobrancaDoCorre from "@/components/CobrancaDoCorre";
import FirstTimeCard from "@/components/FirstTimeCard";
import { lembrarMetaDia } from "@/shared/lib/offline-day";

const REWARD_TIERS = [
  { name: "Semente", emoji: "🌱", threshold: 10_000, accent: "140 70% 45%", rarity: "Comum" },
  { name: "Brasa", emoji: "🔥", threshold: 50_000, accent: "25 95% 55%", rarity: "Incomum" },
  { name: "Forja", emoji: "⚒️", threshold: 100_000, accent: "45 95% 55%", rarity: "Raro" },
  { name: "Lenda", emoji: "⭐", threshold: 1_000_000, accent: "200 90% 60%", rarity: "Lendário" },
] as const;

export default function Index() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { hasPlanToday, loading: planLoading } = useDailyGoalPlan(user?.id);
  const { toast } = useToast();

  // Avisa o splash de abertura que a tela inicial já montou, pra ele sair só
  // quando o app estiver pronto (evita a barra de baixo "piscar" antes).
  useEffect(() => {
    const id = requestAnimationFrame(() => window.dispatchEvent(new Event("orbis:ready")));
    return () => cancelAnimationFrame(id);
  }, []);
  const [todaySales, setTodaySales] = useState<any>(null);
  const [weeklyData, setWeeklyData] = useState<any[]>([]);
  const [monthlyStats, setMonthlyStats] = useState({
    totalIncome: 0,
    totalExpenses: 0,
    totalCost: 0,
    totalTransport: 0,
    totalFood: 0,
    balance: 0,
    variation: 0
  });
  const [monthlyGoal, setMonthlyGoal] = useState(4200);
  const [dailyGoalPlan, setDailyGoalPlan] = useState(0); // meta do dia definida pelo usuário (mesma do DEFCON / daily_goal_plans)
  const [nickname, setNickname] = useState<string>("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isFiltering, setIsFiltering] = useState(false);
  const [filterType, setFilterType] = useState<"day" | "week" | "month" | "all" | "custom">("month");
  const [salesCountToday, setSalesCountToday] = useState(0);
  const [monthExpensesTotal, setMonthExpensesTotal] = useState(0);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(true);
  // Tem cache do dashboard? Sem cache (1º acesso), mostrar a tela real durante o load
  // fazia os números PULAREM de R$0 pro valor real (layout shift feio). Com cache, a
  // tela abre direto com os últimos valores conhecidos.
  const [hasDashCache] = useState(() => {
    try { return Boolean(localStorage.getItem("orbis_dashboard_cache")); } catch { return false; }
  });
  const [dailyAverage, setDailyAverage] = useState(0);
  const [activeDaysCount, setActiveDaysCount] = useState(0);
  const [showCardModal, setShowCardModal] = useState(false);
  // Gerenciador de custos aberto pelo card "Custos". Sem ele, um custo lançado
  // (ex.: CMV vindo do DEFCON) ficava INAPAGÁVEL fora do DEFCON: o vendedor
  // apagava as vendas, o custo sobrava na linha do dia e o lucro ficava errado
  // pra sempre — caso real do Emerson em 13/08/2026 (R$ 2.225 fantasmas).
  const [showCustos, setShowCustos] = useState(false);
  const [showEditPlanning, setShowEditPlanning] = useState(false);
  const [isRestDay, setIsRestDay] = useState(false);
  // Segura o modal de "meta do mês" enquanto o bilhete do dia 1 não terminou.
  const [ticketPending, setTicketPending] = useState(() => isWeeklyTicketPending());
  // Conta NOVA (passou pelo onboarding 2.0 → tem linha em onboarding_planos):
  // vê o checklist "Seus primeiros passos". Contas antigas nunca veem.
  const [contaNova, setContaNova] = useState(false);
  const [temDefcon, setTemDefcon] = useState(false);
  const [visitouRanking, setVisitouRanking] = useState(false);
  // v9: faixa da semana (constância) — dias que ele trabalha + dias com venda
  const [workingDays, setWorkingDays] = useState<string[] | null>(null);
  // Dias TRABALHADOS = teve venda no DEFCON (não vale lançamento manual nem Pix
  // atrasado). É a fonte da constância — regra do Rick (01/09).
  const [diasTrabalhados, setDiasTrabalhados] = useState<string[]>([]);
  useEffect(() => {
    if (!user) return;
    let cancel = false;
    (async () => {
      const { data: plano } = await supabase.from("onboarding_planos").select("user_id").eq("user_id", user.id).maybeSingle();
      if (cancel) return;
      setContaNova(Boolean(plano));
      // Passo 3 = fez o TREINO GUIADO do DEFCON (/defcon?treino=1), não "tem algum plano
      // no banco" — era isso que marcava o passo sozinho sem o usuário nunca ter entrado.
      try {
        setTemDefcon(localStorage.getItem(`orbis_defcon_tour_ok_${user.id}`) === "1");
        setVisitouRanking(localStorage.getItem(`orbis_visitou_ranking_${user.id}`) === "1");
      } catch { /* nada */ }
    })();
    return () => { cancel = true; };
  }, [user]);

  // Fim do bilhete → libera e abre a tela de meta do mês (o "final do bilhete leva à meta").
  useEffect(() => {
    const onTicketDone = () => {
      // Libera o modal de meta (se ainda for necessário). Se o usuário JÁ configurou
      // a meta uma vez, nada abre — a meta é só uma vez.
      setTicketPending(false);
    };
    window.addEventListener(WEEKLY_TICKET_DONE_EVENT, onTicketDone);
    return () => window.removeEventListener(WEEKLY_TICKET_DONE_EVENT, onTicketDone);
  }, []);
  
  // Hook for required monthly goal check
  const { isRequired: isMonthlyGoalRequired, reason: monthlyGoalReason, onCompleted: onMonthlyGoalCompleted, isLoading: isCheckingGoal } = useMonthlyGoalRequired(user?.id);
  
  // Check if today is a rest day
  useEffect(() => {
    if (!user) return;
    
    const checkRestDay = async () => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("working_days")
        .eq("user_id", user.id)
        .maybeSingle();

      if (profile?.working_days) {
        setWorkingDays(profile.working_days as string[]);
        const dayOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][new Date().getDay()]!;
        const isRest = !profile.working_days.includes(dayOfWeek);
        setIsRestDay(isRest);
      }
    };

    checkRestDay();
  }, [user]);
  
  // Load cached data on mount
  useEffect(() => {
    const cachedData = localStorage.getItem("orbis_dashboard_cache");
    if (cachedData) {
      try {
        const parsed = JSON.parse(cachedData);
        setMonthlyStats(parsed.monthlyStats || monthlyStats);
        setDailyAverage(parsed.dailyAverage || 0);
        setActiveDaysCount(parsed.activeDaysCount || 0);
      } catch (e) {
        console.error("Error parsing cache:", e);
      }
    }
  }, []);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
      return;
    }
    
    if (user) {
      loadDashboardData();
    }
  }, [user, loading, navigate]);

  // Recarrega ao voltar o foco (ex.: retorno do DEFCON 4) para nunca mostrar dado antigo
  useRefetchOnFocus(() => {
    if (user) loadDashboardData();
  });

  // Mostra a escolha (assinar agora / testar 3 dias) logo no 1º acesso, por usuário.
  useEffect(() => {
    if (!user) return;

    const checkCardModal = async () => {
      const seenKey = `orbis_card_modal_seen_${user.id}`;
      if (localStorage.getItem(seenKey)) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("plan_status, is_demo, billing_exempt")
        .eq("user_id", user.id)
        .maybeSingle();

      // Só mostra se ainda não é assinante
      const isSubscribed = (profile?.is_demo && profile?.billing_exempt) || profile?.plan_status === "active";
      if (!isSubscribed) {
        setShowCardModal(true);
        localStorage.setItem(seenKey, 'true');
      }
    };

    checkCardModal();
  }, [user]);
  const loadDashboardData = async (customStartDate?: string, customEndDate?: string) => {
    if (!user) return;

    setIsLoadingData(true);

    const today = getBrazilDate();
    const sevenDaysAgo = getBrazilDateDaysAgo(7);
    const sessentaDiasAtras = getBrazilDateDaysAgo(60); // constância: precisa olhar pra trás do mês

    let dateStart: string;
    let dateEnd: string;
    if (customStartDate && customEndDate) {
      dateStart = customStartDate;
      dateEnd = customEndDate;
    } else {
      dateStart = getBrazilMonthStart();
      dateEnd = today;
    }

    // Fan-out: profile + today + week + month in parallel (was 4 serial awaits).
    const [
      { data: profile },
      { data: todayData },
      { data: weekData },
      { data: monthData },
      { data: todayChallenge },
      { data: monthExpenses },
      { data: todayGoalPlan },
      { data: defconSales },
    ] = await Promise.all([
      supabase.from("profiles").select("monthly_goal, nickname").eq("user_id", user.id).maybeSingle(),
      supabase.from("daily_sales").select("*").eq("user_id", user.id).eq("date", today),
      supabase.from("daily_sales").select("*").eq("user_id", user.id).gte("date", sessentaDiasAtras).order("date", { ascending: true }),
      supabase.from("daily_sales").select("*").eq("user_id", user.id).gte("date", dateStart).lte("date", dateEnd).order("date", { ascending: false }).limit(30),
      supabase.from("challenge_blocks").select("sales_count,created_at").eq("user_id", user.id).gte("created_at", today),
      supabase.from("personal_expenses").select("amount,date").eq("user_id", user.id).gte("date", dateStart).lte("date", dateEnd),
      supabase.from("daily_goal_plans").select("daily_goal").eq("user_id", user.id).eq("date", today).maybeSingle(),
      supabase.from("defcon_sales").select("created_at").eq("user_id", user.id).gte("created_at", `${sessentaDiasAtras}T00:00:00`).limit(3000),
    ]);

    /* ---- DIA TRABALHADO (constância) ----
       Precisa das DUAS coisas ao mesmo tempo:
       (1) teve venda no DEFCON naquele dia  → não vale lançamento manual
           nem Pix atrasado; e
       (2) o dinheiro AINDA está de pé no fechamento do dia (daily_sales
           > 0) → se ele reiniciou/limpou o DEFCON (teste, engano), os
           blocos zeram, o daily_sales zera e o dia SAI da conta sozinho.
       Um dia conta UMA vez, tendo 1 ou 40 vendas. */
    const diasComDinheiro = new Set(
      ((weekData as { date: string; total_profit: number | null }[]) || [])
        .filter((d) => (d.total_profit ?? 0) > 0)
        .map((d) => String(d.date)),
    );
    const diasDefcon = Array.from(new Set(((defconSales as { created_at: string }[]) || [])
      .map((v) => new Date(v.created_at).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }))))
      .filter((dia) => diasComDinheiro.has(dia));
    setDiasTrabalhados(diasDefcon);

    if (profile?.monthly_goal) {
      setMonthlyGoal(profile.monthly_goal);
    }
    if (profile?.nickname) {
      setNickname(profile.nickname);
    }

    const aggregatedToday = todayData && todayData.length > 0 ? {
      total_profit: todayData.reduce((sum, entry) => sum + (entry.total_profit || 0), 0),
      total_debt: todayData.reduce((sum, entry) => sum + (entry.total_debt || 0), 0),
      cash_sales: todayData.reduce((sum, entry) => sum + (entry.cash_sales || 0), 0),
      pix_sales: todayData.reduce((sum, entry) => sum + (entry.pix_sales || 0), 0),
      card_sales: todayData.reduce((sum, entry) => sum + (entry.card_sales || 0), 0),
      entry_count: todayData.length
    } : null;
    setTodaySales(aggregatedToday);
    setSalesCountToday(((todayChallenge as any[]) || []).reduce((s, b) => s + (b.sales_count || 0), 0));
    setMonthExpensesTotal(((monthExpenses as any[]) || []).reduce((s, e) => s + Number(e.amount || 0), 0));
    setDailyGoalPlan(Number((todayGoalPlan as any)?.daily_goal) || 0);

    if (weekData) {
      const formattedWeekData = weekData.filter((d) => String(d.date) >= sevenDaysAgo).map(day => ({
        name: new Date(day.date).toLocaleDateString("pt-BR", {
          weekday: "short"
        }),
        value: day.total_profit || 0
      }));
      setWeeklyData(formattedWeekData);
    }

    if (monthData) {
      const totalIncome = monthData.reduce((sum, day) => sum + (day.total_profit || 0), 0);
      const totalExpenses = monthData.reduce((sum, day) => sum + (day.total_debt || 0), 0); // fiado: mostrado à parte, NÃO entra no líquido
      const totalCost = monthData.reduce((sum, day) => sum + (day.cost || 0), 0);
      const totalTransport = monthData.reduce((sum, day) => sum + (Number((day as any).transport_cost) || 0), 0);
      const totalFood = monthData.reduce((sum, day) => sum + (Number((day as any).food_cost) || 0), 0);
      // Custos lançados no botão "Custos do dia" (personal_expenses) também abatem do líquido.
      const custosLancados = ((monthExpenses as any[]) || []).reduce((s, e) => s + Number(e.amount || 0), 0);
      // Líquido = vendido − mercadoria − transporte − alimentação − custos lançados (fiado NÃO entra)
      const balance = totalIncome - totalCost - totalTransport - totalFood - custosLancados;
      
      // Calculate real daily average from NET PROFIT (lucro líquido)
      const activeDays = monthData.filter(day => (day.total_profit ?? 0) > 0).length;
      const netProfitPerDay = activeDays > 0 ? balance / activeDays : 0;
      
      setActiveDaysCount(activeDays);
      setDailyAverage(netProfitPerDay);
      
      const stats = {
        totalIncome,
        totalExpenses,
        totalCost,
        totalTransport,
        totalFood,
        balance,
        variation: totalIncome > 0 ? balance / totalIncome * 100 : 0
      };
      
      setMonthlyStats(stats);
      
      // Cache data
      localStorage.setItem("orbis_dashboard_cache", JSON.stringify({
        monthlyStats: stats,
        dailyAverage: netProfitPerDay,
        activeDaysCount: activeDays,
        lastUpdate: new Date().toISOString()
      }));
    }
    
    setIsLoadingData(false);
  };

  const handleApplyFilter = () => {
    if (!startDate || !endDate) {
      toast({
        title: "Erro",
        description: "Selecione as datas de início e fim.",
        variant: "destructive"
      });
      return;
    }

    if (new Date(startDate) > new Date(endDate)) {
      toast({
        title: "Erro",
        description: "A data de início deve ser anterior à data de fim.",
        variant: "destructive"
      });
      return;
    }

    setIsFiltering(true);
    loadDashboardData(startDate, endDate);
    toast({
      title: "Filtro aplicado",
      description: `Mostrando dados de ${new Date(startDate).toLocaleDateString('pt-BR')} até ${new Date(endDate).toLocaleDateString('pt-BR')}`
    });
  };

  const handleQuickFilter = (type: "day" | "week" | "month" | "all") => {
    const end: string = getBrazilDate();
    let start: string;

    switch (type) {
      case "day":
        start = end;
        break;
      case "week": {
        start = getBrazilDateDaysAgo(7);
        break;
      }
      case "month": {
        start = getBrazilMonthStart();
        break;
      }
      case "all":
        start = "2020-01-01";
        break;
    }

    setFilterType(type);
    setStartDate(start);
    setEndDate(end);
    setIsFiltering(type !== "month");
    loadDashboardData(start, end);

    const labels = {
      day: "Hoje",
      week: "Últimos 7 dias",
      month: "Mês atual",
      all: "Todo período"
    };

    toast({
      title: "Filtro aplicado",
      description: labels[type]
    });
  };

  const handleClearFilter = () => {
    setStartDate("");
    setEndDate("");
    setIsFiltering(false);
    setFilterType("month");
    loadDashboardData();
    toast({
      title: "Filtro removido",
      description: "Mostrando dados do mês atual"
    });
  };
  const calculateGoalProgress = () => {
    const progress = monthlyStats.balance / monthlyGoal * 100;
    return Math.min(progress, 100);
  };

  // Placar offline: guarda a meta do dia no celular enquanto há sinal.
  // (Hook ANTES de qualquer return — regra dos hooks.)
  useEffect(() => {
    if (!user?.id) return;
    const meta = dailyGoalPlan > 0 ? dailyGoalPlan : (monthlyGoal > 0 ? Math.round(monthlyGoal / 26) : 0);
    if (meta > 0) lembrarMetaDia(user.id, meta);
  }, [user?.id, dailyGoalPlan, monthlyGoal]);

  // Dia 1 (01/09): depois do card de novidades, abre o planejamento pra ele
  // revisar metas e marcar os dias de folga. A flag é setada pelo NovidadesOrbis2.
  useEffect(() => {
    if (!user?.id) return;
    const k = `orbis_abrir_planejamento_${user.id}`;
    const tick = () => {
      try {
        if (localStorage.getItem(k) === "1") { localStorage.removeItem(k); setShowEditPlanning(true); }
      } catch { /* nada */ }
    };
    tick();
    const id = window.setInterval(tick, 800); // o card fecha sem re-render do Index — sonda leve
    return () => window.clearInterval(id);
  }, [user?.id]);

  if (loading || !user || (isLoadingData && !hasDashCache)) {
    // Esqueleto com o formato do dashboard — evita a tela "pular" do vazio pro design
    return (
      <div className="space-y-4 pb-8 animate-pulse">
        <div className="flex items-center gap-3 pt-2">
          <div className="w-10 h-10 rounded-full bg-muted" />
          <div className="space-y-2">
            <div className="h-4 w-40 rounded bg-muted" />
            <div className="h-3 w-28 rounded bg-muted" />
          </div>
        </div>
        <div className="h-56 rounded-2xl bg-muted" />
        <div className="grid grid-cols-2 gap-3">
          <div className="h-24 rounded-2xl bg-muted" />
          <div className="h-24 rounded-2xl bg-muted" />
        </div>
        <div className="h-20 rounded-2xl bg-muted" />
        <div className="h-20 rounded-2xl bg-muted" />
      </div>
    );
  }
  const dailyProfit = todaySales?.total_profit || 0;
  const faturamentoMes = monthlyStats.totalIncome;
  const lucroLiquido = monthlyStats.totalIncome - monthlyStats.totalCost - monthlyStats.totalTransport - monthlyStats.totalFood - monthExpensesTotal;
  const progressoMeta = calculateGoalProgress();

  // Daily goal calc
  // Meta do dia = a MESMA que o usuário define no DEFCON (daily_goal_plans). Só
  // cai pra meta mensal ÷ 26 quando ainda não há meta do dia definida.
  const dailyGoal = dailyGoalPlan > 0 ? dailyGoalPlan : (monthlyGoal > 0 ? Math.round(monthlyGoal / 26) : 200);
  const faltaDia = Math.max(dailyGoal - dailyProfit, 0);
  const totalSalesToday = salesCountToday;
  const custosTotal = monthlyStats.totalCost + monthlyStats.totalTransport + monthlyStats.totalFood + monthExpensesTotal;
  // O que aparece ao lado da meta do mês é a DIÁRIA DO PLANO dele (a mesma do
  // "Editar Planejamento": meta ÷ 4 ÷ dias por semana). Antes era "o que falta ÷
  // dias restantes" — no dia 31 isso dava "R$ 20.348/dia", número que não ajuda.
  const ritmoDia = dailyGoal;

  const nextIdx = REWARD_TIERS.findIndex((t) => faturamentoMes < t.threshold);
  const nextTier = (nextIdx === -1 ? REWARD_TIERS[REWARD_TIERS.length - 1] : REWARD_TIERS[nextIdx])!;
  const prevThreshold = nextIdx <= 0 ? 0 : REWARD_TIERS[nextIdx - 1]!.threshold;
  const tierProgress = nextIdx === -1
    ? 100
    : Math.min(((faturamentoMes - prevThreshold) / (nextTier.threshold - prevThreshold)) * 100, 100);
  const tierRestante = Math.max(nextTier.threshold - faturamentoMes, 0);

  // Saudação dinâmica baseada no fuso horário (Brasília UTC-3)
  const getGreeting = () => {
    const hourBrasilia = Number(
      new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo", hour: "2-digit", hour12: false })
    );
    if (hourBrasilia >= 5 && hourBrasilia < 12) return "Bom dia";
    if (hourBrasilia >= 12 && hourBrasilia < 18) return "Boa tarde";
    return "Boa noite";
  };
  const greeting = getGreeting();

  /* Respiro (pedido do Rick, 01/09 — "tá tudo muito junto"):
     o ritmo vertical da Home agora tem UMA régua só — 28px entre blocos
     (space-y-7). Saudação e constância viram um bloco só, com 14px entre
     elas, porque são a mesma ideia ("quem é você / como está sua semana");
     assim o olho lê 5 blocos separados em vez de 8 linhas grudadas. */
  const diasNoMes = diasTrabalhados.filter((d) => d.slice(0, 7) === getBrazilDate().slice(0, 7)).length;

  /* v9.1 "padrão Opal" (Rick, 01/09):
     - topo enxuto (data 10px, saudação 15px) com a CHAMA e o avatar à direita;
     - a semana colada no card da meta, POR FORA dele;
     - todo assunto num Bloco com a mesma borda — é a borda que dá contexto;
     - régua: 28px entre blocos (space-y-7). */
  return <div className="orbis-stagger bg-background px-1 pt-3 pb-10 space-y-7 overflow-x-hidden max-w-2xl mx-auto">
      <HeaderV9
        nome={nickname || "vendedor"}
        diasTrabalhados={diasNoMes}
        userId={user.id}
        onPerfil={() => navigate("/profile")}
      />

      {/* Conta nova: trilha dos primeiros passos (some quando completa) */}
      {contaNova && (
        <PrimeirosPassos
          userId={user.id}
          passos={[
            { id: "conta", titulo: "Criar sua conta", feito: true },
            { id: "metas", titulo: "Definir sua meta mensal e diária",
              dica: "Confere os valores do seu planejamento",
              feito: monthlyGoal > 0 && dailyGoal > 0, onIr: () => setShowEditPlanning(true) },
            { id: "defcon", titulo: "Iniciar um DEFCON 4 de teste",
              dica: "Treino guiado — nada conta no ranking",
              feito: temDefcon, onIr: () => navigate("/defcon?treino=1") },
            { id: "ranking", titulo: "Conhecer o ranking",
              dica: "Vê as patentes e onde você entra",
              feito: visitouRanking, onIr: () => navigate("/ranking") },
          ]}
          onDispensar={() => setContaNova(false)}
        />
      )}

      {/* Cobrança do horário combinado (só aparece se ele marcou hora e não vendeu) */}
      <CobrancaDoCorre userId={user.id} vendidoHoje={dailyProfit} onComecar={() => navigate("/daily-goals")} />

      {/* A semana encosta no card da meta, por fora dele (pedido do Rick) —
          por isso os dois moram no MESMO filho do stagger, sem o gap de 28px. */}
      <div>
      <SemanaRow workingDays={workingDays} diasTrabalhados={diasTrabalhados} />
      <HeroCard
        faturamento={faturamentoMes}
        meta={monthlyGoal}
        diaria={ritmoDia}
        vendidoHoje={dailyProfit}
        metaHoje={dailyGoal}
        descanso={isRestDay}
        onEditMeta={() => setShowEditPlanning(true)}
        onFoco={() => navigate("/daily-goals")}
      />
      </div>

      {/* Financeiro: bloco com borda própria — "Ver detalhes" abre os custos */}
      <Bloco titulo="Financeiro" acao="Ver detalhes" onAcao={() => setShowCustos(true)}>
        <FinanceiroFlat lucro={lucroLiquido} custos={custosTotal} />
      </Bloco>

      {/* Gerenciador de custos (mesmo do DEFCON): lista custos manuais E o CMV de
          cada dia, com apagar/zerar. Ao fechar, recarrega o painel — o lucro muda
          na frente do vendedor, sem F5. */}
      {showCustos && (
        <QuickExpenseButton
          open={showCustos}
          hideFab
          onOpenChange={(o) => {
            setShowCustos(o);
            if (!o) loadDashboardData();
          }}
        />
      )}

      {/* Bilhete Dourado — reabre o bilhete do desafio (só aparece com desafio ativo) */}
      <WeeklyChallengeDashboardCard />

      {/* Seu jogo: lista neutra (patente, ranking, competições) — a identidade forte
          fica dentro de cada tela, a Home só aponta */}
      <Bloco titulo="Seu jogo">
        <PatenteLinha nome={nextTier.name} pct={tierProgress} faltam={tierRestante} onClick={() => navigate('/rewards')} />
      </Bloco>

      {/* Ranking + Competição: formato ATUAL (decisão do Rick 01/09) — card com a
          imagem da liga + pulso ao subir, e o quadrado dourado das espadas.
          O RankingCard já desenha o próprio título "Ranking" — não pode ter outro
          por fora (aparecia duas vezes). */}
      <RankingCard userId={user.id} onClick={() => navigate('/ranking')} />
      <CompeticaoRow onClick={() => navigate('/competitions')} />

      {user && faltaDia <= 0 && dailyProfit > 0 && (
        <TrialNudge
          userId={user.id}
          momentKey="meta_dia"
          title="Meta do dia batida!"
          benefit="Quem usa o Orbis todo dia bate meta com ritmo. Não perca essa régua quando o teste acabar."
        />
      )}

      <AntiProcrastination visible={!isRestDay && !hasPlanToday} />

      <CardRegistrationModal isOpen={showCardModal} onClose={() => setShowCardModal(false)} />

      {user && (() => {
        // O modal abre SEMPRE que o usuário pede (showEditPlanning) — inclusive no
        // passo de metas do onboarding. O "obrigatório" (forçado, sem fechar) só
        // vale DEPOIS que a missão terminou; durante o onboarding ele nunca força,
        // senão o usuário não consegue definir a meta e fica preso (tinha que pular).
        const missionDone = localStorage.getItem(`orbis_mission_completed_${user.id}`) === 'true';
        // Não força a meta enquanto o bilhete do dia 1 ainda não terminou (evita 2 telas juntas).
        const forced = isMonthlyGoalRequired && missionDone && !ticketPending;
        const open = showEditPlanning || forced;
        if (!open) return null;
        return (
          <EditPlanningModal
            userId={user.id}
            isOpen={open}
            onClose={() => {
              if (forced) onMonthlyGoalCompleted();
              setShowEditPlanning(false);
              loadDashboardData();
              // Fluxo do desafio: depois de definir a meta de julho, vai pro DEFCON 4.
              if (sessionStorage.getItem("orbis_desafio_passo") === "meta") {
                sessionStorage.removeItem("orbis_desafio_passo");
                navigate("/defcon");
              }
            }}
            isRequired={forced}
            requiredReason={monthlyGoalReason}
          />
        );
      })()}

      {user && !isRestDay && !isMonthlyGoalRequired && localStorage.getItem(`orbis_mission_completed_${user.id}`) === 'true' && (
        <DayStartPopup
          userId={user.id}
          onStart={() => navigate('/daily-goals')}
          onEditPlanning={() => setShowEditPlanning(true)}
        />
      )}

      {/* Direcionamento inicial: card de 1ª vez no dashboard (uma vez por usuário) */}
      <FirstTimeCard tela="dashboard" userId={user.id} />
    </div>;
}