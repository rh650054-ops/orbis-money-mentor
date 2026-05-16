import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { getBrazilDate } from "@/lib/dateUtils";
import { formatCurrency } from "@/lib/utils";
import { Zap, FileDown, History, Pencil, Plus, Banknote, CreditCard, Smartphone, TrendingDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { generateDefconDayPDF } from "@/utils/generateDefconDayPDF";
import { DefconLoadoutManager } from "@/components/defcon/DefconLoadoutManager";
import HourlyBreakdown from "@/components/history/HourlyBreakdown";
import { EditPlanningModal } from "@/components/EditPlanningModal";

interface DayTotals {
  cash: number; card: number; pix: number; debt: number; profit: number; cost: number;
}

export default function DefconHub() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { toast } = useToast();
  const [dailyGoal, setDailyGoal] = useState(0);
  const [planId, setPlanId] = useState<string | null>(null);
  const [totals, setTotals] = useState<DayTotals>({ cash: 0, card: 0, pix: 0, debt: 0, profit: 0, cost: 0 });
  const [hasSession, setHasSession] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [quickCost, setQuickCost] = useState("");
  const [quickCostLabel, setQuickCostLabel] = useState("");
  const [showEdit, setShowEdit] = useState(false);
  const today = getBrazilDate();

  useEffect(() => {
    if (!loading && !user) navigate("/auth");
  }, [user, loading, navigate]);

  const loadAll = async () => {
    if (!user) return;
    const [{ data: plan }, { data: sales }, { data: session }] = await Promise.all([
      supabase
        .from("daily_goal_plans")
        .select("id, daily_goal, work_hours")
        .eq("user_id", user.id)
        .eq("date", today)
        .maybeSingle(),
      supabase
        .from("daily_sales")
        .select("cash_sales, card_sales, pix_sales, total_debt, total_profit, cost")
        .eq("user_id", user.id)
        .eq("date", today)
        .maybeSingle(),
      supabase
        .from("challenge_sessions")
        .select("status")
        .eq("user_id", user.id)
        .eq("date", today)
        .maybeSingle(),
    ]);

    // Cria plano automático se não houver
    if (!plan) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("base_daily_goal, goal_hours")
        .eq("user_id", user.id)
        .single();
      const dg = profile?.base_daily_goal || 200;
      const wh = profile?.goal_hours || 8;
      const { data: newPlan } = await supabase
        .from("daily_goal_plans")
        .insert({
          user_id: user.id, date: today,
          daily_goal: dg, work_hours: wh, mood: "normal", hourly_goal: dg / wh,
        })
        .select()
        .single();
      if (newPlan) {
        const blocks = Array.from({ length: wh }, (_, i) => ({
          plan_id: newPlan.id, user_id: user.id, hour_index: i,
          hour_label: `H${i + 1}`, target_amount: dg / wh,
          valor_dinheiro: 0, valor_cartao: 0, valor_pix: 0, valor_calote: 0,
          timer_status: "idle",
        }));
        await supabase.from("hourly_goal_blocks").insert(blocks);
        setDailyGoal(dg);
        setPlanId(newPlan.id);
      }
    } else {
      setDailyGoal(Number(plan.daily_goal));
      setPlanId(plan.id);
    }

    setTotals({
      cash: Number(sales?.cash_sales || 0),
      card: Number(sales?.card_sales || 0),
      pix: Number(sales?.pix_sales || 0),
      debt: Number(sales?.total_debt || 0),
      profit: Number(sales?.total_profit || 0),
      cost: Number(sales?.cost || 0),
    });
    setHasSession(!!session);
  };

  useEffect(() => {
    if (user) loadAll();
  }, [user, today]);

  // Realtime: atualiza resumo quando vendas mudam
  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel("hub-daily-sales")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "daily_sales", filter: `user_id=eq.${user.id}` },
        () => loadAll()
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user]);

  const totalVendido = totals.cash + totals.card + totals.pix;
  const progresso = dailyGoal > 0 ? Math.min(100, (totalVendido / dailyGoal) * 100) : 0;
  const goalReached = totalVendido >= dailyGoal && dailyGoal > 0;
  const falta = Math.max(0, dailyGoal - totalVendido);

  const handlePDF = async () => {
    if (!user) return;
    setExporting(true);
    try {
      await generateDefconDayPDF(user.id);
      toast({ title: "PDF gerado", description: "Relatório do dia baixado com sucesso." });
    } catch (e) {
      toast({ title: "Erro ao gerar PDF", variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  const handleAddCost = async () => {
    if (!user) return;
    const amount = parseFloat(quickCost);
    if (!amount || amount <= 0) return;
    await supabase.from("personal_expenses").insert({
      user_id: user.id,
      name: quickCostLabel || "Custo do dia",
      category: "mercadoria",
      amount,
      type: "variable",
      date: today,
    });
    setQuickCost("");
    setQuickCostLabel("");
    toast({ title: "Custo registrado", description: formatCurrency(amount) });
    loadAll();
  };

  if (loading || !user) return null;

  return (
    <div className="space-y-5 pb-8 max-w-2xl mx-auto">
      {/* HEADER */}
      <div className="text-center pt-2">
        <div className="text-[10px] font-mono text-red-500 tracking-[0.4em] uppercase mb-1">
          ⚡ MODO DESAFIO
        </div>
        <h1 className="text-4xl md:text-5xl font-black text-white tracking-tighter">
          DEFCON 4
        </h1>
        <p className="text-xs text-neutral-500 mt-2 font-mono">
          Foco total. Blocos de 60 min. Apenas vendas.
        </p>
      </div>

      {/* META DO DIA — Card dourado */}
      <div className="rounded-2xl bg-gradient-to-br from-[#F4A100]/15 via-[#1A1A1A] to-[#0D0D0D] border border-[#F4A100]/25 p-6 space-y-4 shadow-[0_8px_40px_-12px_rgba(244,161,0,0.3)]">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[10px] font-mono text-[#F4A100] tracking-[0.3em] uppercase mb-1">Meta do dia</p>
            <p className="text-5xl font-black text-white tracking-tighter">
              {formatCurrency(dailyGoal)}
            </p>
          </div>
          <button
            onClick={() => setShowEdit(true)}
            className="w-9 h-9 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-neutral-400 active:scale-95"
            aria-label="Editar meta"
          >
            <Pencil className="w-4 h-4" />
          </button>
        </div>

        {/* Progress */}
        <div className="space-y-2">
          <div className="h-2 bg-black/40 rounded-full overflow-hidden border border-white/5">
            <div
              className={`h-full transition-all duration-500 rounded-full ${
                goalReached ? "bg-green-500 shadow-[0_0_18px_rgba(34,197,94,0.7)]" : "bg-[#F4A100] shadow-[0_0_18px_rgba(244,161,0,0.6)]"
              }`}
              style={{ width: `${progresso}%` }}
            />
          </div>
          <div className="flex justify-between text-[11px] font-mono">
            <span className={goalReached ? "text-green-500" : "text-neutral-400"}>
              {formatCurrency(totalVendido)} vendido
            </span>
            <span className="text-neutral-500">
              {goalReached ? "🎉 Meta batida!" : `Falta ${formatCurrency(falta)}`}
            </span>
          </div>
        </div>
      </div>

      {/* BOTÃO INICIAR DEFCON — GIGANTE */}
      <button
        onClick={() => navigate("/defcon")}
        data-tour="defcon-banner"
        className="w-full relative overflow-hidden h-20 rounded-2xl bg-gradient-to-r from-red-700 via-red-600 to-red-700 text-white font-black text-2xl tracking-wide flex items-center justify-center gap-3 active:scale-[0.98] transition-transform shadow-[0_12px_50px_-10px_rgba(239,68,68,0.7)] animate-pulse-slow"
        style={{ animation: "pulse 2.5s ease-in-out infinite" }}
      >
        <Zap className="w-7 h-7 fill-white" />
        {hasSession ? "CONTINUAR DEFCON 4" : "INICIAR DEFCON 4"}
      </button>

      {/* LOADOUT — Produtos de hoje */}
      <DefconLoadoutManager userId={user.id} />

      {/* RESUMO POR PAGAMENTO — Cards bonitos */}
      {totalVendido > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-sm font-mono text-neutral-400 tracking-[0.2em] uppercase">
              Como você recebeu
            </h3>
          </div>
          <div className="grid grid-cols-3 gap-2.5">
            <PayCard icon={<Banknote className="w-4 h-4" />} label="Dinheiro" value={totals.cash} color="#22C55E" />
            <PayCard icon={<CreditCard className="w-4 h-4" />} label="Cartão" value={totals.card} color="#A78BFA" />
            <PayCard icon={<Smartphone className="w-4 h-4" />} label="Pix" value={totals.pix} color="#32BCAD" />
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <MiniStat label="Lucro" value={formatCurrency(totals.profit)} highlight />
            {totals.debt > 0 && <MiniStat label="Calotes" value={formatCurrency(totals.debt)} danger />}
            {totals.cost > 0 && <MiniStat label="Custos" value={formatCurrency(totals.cost)} />}
          </div>
        </div>
      )}

      {/* VENDAS POR HORA — collapse */}
      {planId && totalVendido > 0 && (
        <div className="rounded-2xl bg-[#0F0F0F] border border-white/10 p-4">
          <HourlyBreakdown userId={user.id} date={today} />
        </div>
      )}

      {/* CUSTOS RÁPIDOS */}
      <div className="rounded-2xl bg-[#0F0F0F] border border-white/10 p-5 space-y-3">
        <div className="flex items-center gap-2">
          <TrendingDown className="w-4 h-4 text-red-400" />
          <h3 className="text-sm font-mono text-neutral-300 tracking-[0.2em] uppercase">
            Custo rápido
          </h3>
        </div>
        <p className="text-[11px] text-neutral-500">
          Mercadoria, transporte, lanche. Soma no lucro do dia.
        </p>
        <div className="flex gap-2">
          <input
            value={quickCostLabel}
            onChange={(e) => setQuickCostLabel(e.target.value)}
            placeholder="Descrição (opcional)"
            className="flex-1 h-11 bg-black border border-white/10 rounded-xl px-3 text-sm text-white focus:outline-none focus:border-[#F4A100] placeholder:text-neutral-600"
          />
          <input
            type="number"
            inputMode="decimal"
            value={quickCost}
            onChange={(e) => setQuickCost(e.target.value)}
            placeholder="R$"
            className="w-24 h-11 bg-black border border-white/10 rounded-xl px-3 text-sm text-white text-center focus:outline-none focus:border-[#F4A100] placeholder:text-neutral-600"
          />
          <button
            onClick={handleAddCost}
            disabled={!quickCost || parseFloat(quickCost) <= 0}
            className="h-11 px-4 rounded-xl bg-[#F4A100] text-black font-bold text-sm disabled:opacity-40 active:scale-95"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
        <button
          onClick={() => navigate("/history")}
          className="text-[11px] text-[#F4A100] underline"
        >
          Ver custos de 3 / 7 / 30 dias →
        </button>
      </div>

      {/* AÇÕES — PDF / Histórico */}
      <div className="grid grid-cols-2 gap-2.5">
        <button
          onClick={handlePDF}
          disabled={exporting}
          className="h-12 rounded-xl bg-[#0F0F0F] border border-[#F4A100]/40 text-[#F4A100] text-xs font-bold uppercase tracking-wide flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
        >
          <FileDown className="w-4 h-4" />
          {exporting ? "Gerando..." : "PDF do dia"}
        </button>
        <button
          onClick={() => navigate("/history")}
          className="h-12 rounded-xl bg-[#0F0F0F] border border-white/10 text-neutral-300 text-xs font-bold uppercase tracking-wide flex items-center justify-center gap-2 active:scale-95"
        >
          <History className="w-4 h-4" />
          Histórico
        </button>
      </div>

      {user && (
        <EditPlanningModal
          userId={user.id}
          isOpen={showEdit}
          onClose={() => { setShowEdit(false); loadAll(); }}
        />
      )}
    </div>
  );
}

function PayCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
  return (
    <div
      className="rounded-xl bg-[#0F0F0F] border border-white/10 p-3 space-y-1.5"
      style={{ boxShadow: value > 0 ? `0 4px 18px -6px ${color}55` : undefined }}
    >
      <div className="flex items-center gap-1.5" style={{ color }}>
        {icon}
        <span className="text-[9px] font-mono tracking-[0.15em] uppercase font-bold">{label}</span>
      </div>
      <p className="text-base font-black text-white tabular-nums">{formatCurrency(value)}</p>
    </div>
  );
}

function MiniStat({ label, value, highlight, danger }: { label: string; value: string; highlight?: boolean; danger?: boolean }) {
  return (
    <div
      className={`rounded-xl border p-3 ${
        danger
          ? "bg-red-950/20 border-red-900/40"
          : highlight
          ? "bg-[#F4A100]/10 border-[#F4A100]/30"
          : "bg-[#0F0F0F] border-white/10"
      }`}
    >
      <p className={`text-[9px] font-mono tracking-[0.15em] uppercase ${danger ? "text-red-400" : highlight ? "text-[#F4A100]" : "text-neutral-500"}`}>
        {label}
      </p>
      <p className="text-base font-black text-white tabular-nums mt-1">{value}</p>
    </div>
  );
}
