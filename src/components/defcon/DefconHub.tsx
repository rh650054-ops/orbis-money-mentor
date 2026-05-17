import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { getBrazilDate } from "@/lib/dateUtils";
import { formatCurrency } from "@/lib/utils";
import { Zap, FileDown, Pencil, Plus, Banknote, CreditCard, Smartphone, TrendingDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { generateDefconDayPDF } from "@/utils/generateDefconDayPDF";
import { DefconLoadoutManager } from "@/components/defcon/DefconLoadoutManager";
import HourlyBreakdown from "@/components/history/HourlyBreakdown";
import { EditPlanningModal } from "@/components/EditPlanningModal";

interface DayTotals {
  cash: number; card: number; pix: number; debt: number; profit: number; cost: number; tips: number;
}

export default function DefconHub() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { toast } = useToast();
  const [dailyGoal, setDailyGoal] = useState(0);
  const [planId, setPlanId] = useState<string | null>(null);
  const [totals, setTotals] = useState<DayTotals>({ cash: 0, card: 0, pix: 0, debt: 0, profit: 0, cost: 0, tips: 0 });
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
        .select("cash_sales, card_sales, pix_sales, total_debt, total_profit, cost, tip_sales")
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
      cash: Number((sales as any)?.cash_sales || 0),
      card: Number((sales as any)?.card_sales || 0),
      pix: Number((sales as any)?.pix_sales || 0),
      debt: Number((sales as any)?.total_debt || 0),
      profit: Number((sales as any)?.total_profit || 0),
      cost: Number((sales as any)?.cost || 0),
      tips: Number((sales as any)?.tip_sales || 0),
    });
    setHasSession(!!session);
  };

  useEffect(() => {
    if (user) loadAll();
  }, [user, today]);

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
    <div className="space-y-4 pb-8 max-w-2xl mx-auto px-1">
      {/* HEADER discreto */}
      <div className="pt-1 pb-1">
        <p className="text-[11px] text-red-500/80 tracking-[0.25em] uppercase">⚡ Modo desafio</p>
        <h1 className="text-2xl font-bold text-white tracking-tight mt-0.5">DEFCON 4</h1>
      </div>

      {/* BLOCO UNIFICADO — Meta + Botão */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#1A1A1A] via-[#141414] to-[#0D0D0D] border border-white/10 p-5 space-y-5 shadow-[0_8px_30px_-12px_rgba(244,161,0,0.25)]">
        {/* glow sutil */}
        <div className="absolute -top-20 -right-20 w-56 h-56 bg-[#F4A100]/10 blur-3xl rounded-full pointer-events-none" />

        <div className="relative flex items-start justify-between">
          <div>
            <p className="text-[11px] text-neutral-500 tracking-wider uppercase mb-1">Meta do dia</p>
            <p className="text-3xl font-bold text-white tracking-tight tabular-nums">
              {formatCurrency(dailyGoal)}
            </p>
            <p className="text-xs text-neutral-500 mt-1">
              {goalReached ? (
                <span className="text-green-400">🎉 Meta batida!</span>
              ) : (
                <>Vendido <span className="text-white font-medium">{formatCurrency(totalVendido)}</span> · falta <span className="text-[#F4A100]">{formatCurrency(falta)}</span></>
              )}
            </p>
          </div>
          <button
            onClick={() => setShowEdit(true)}
            className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-neutral-400 active:scale-95 transition"
            aria-label="Editar meta"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Progress fino */}
        <div className="relative h-1.5 bg-white/5 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-700 rounded-full ${
              goalReached
                ? "bg-gradient-to-r from-green-500 to-emerald-400 shadow-[0_0_12px_rgba(34,197,94,0.6)]"
                : "bg-gradient-to-r from-[#F4A100] to-[#FFB733] shadow-[0_0_12px_rgba(244,161,0,0.5)]"
            }`}
            style={{ width: `${progresso}%` }}
          />
        </div>

        {/* CTA — botão grande mas refinado */}
        <button
          onClick={() => navigate("/defcon")}
          data-tour="defcon-banner"
          className="relative w-full h-14 rounded-xl bg-gradient-to-r from-red-600 to-red-500 text-white font-bold text-base tracking-wide flex items-center justify-center gap-2.5 active:scale-[0.98] transition-transform shadow-[0_8px_24px_-6px_rgba(239,68,68,0.55)] overflow-hidden group"
        >
          <span className="absolute inset-0 bg-white/10 opacity-0 group-active:opacity-100 transition" />
          <Zap className="w-5 h-5 fill-white" />
          {hasSession ? "Continuar DEFCON 4" : "Iniciar DEFCON 4"}
        </button>
      </div>

      {/* LOADOUT */}
      <DefconLoadoutManager userId={user.id} />

      {/* RESUMO POR PAGAMENTO */}
      {totalVendido > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs text-neutral-400 font-medium px-1">Como você recebeu</h3>
          <div className="grid grid-cols-3 gap-2">
            <PayCard icon={<Banknote className="w-3.5 h-3.5" />} label="Dinheiro" value={totals.cash} color="#22C55E" />
            <PayCard icon={<CreditCard className="w-3.5 h-3.5" />} label="Cartão" value={totals.card} color="#A78BFA" />
            <PayCard icon={<Smartphone className="w-3.5 h-3.5" />} label="Pix" value={totals.pix} color="#32BCAD" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <MiniStat label="Lucro" value={formatCurrency(totals.profit)} highlight />
            {totals.debt > 0 && <MiniStat label="Calotes" value={formatCurrency(totals.debt)} danger />}
            {totals.cost > 0 && <MiniStat label="Custos" value={formatCurrency(totals.cost)} />}
          </div>
        </div>
      )}

      {/* VENDAS POR HORA */}
      {planId && totalVendido > 0 && (
        <div className="rounded-2xl bg-[#0F0F0F] border border-white/10 p-4">
          <HourlyBreakdown userId={user.id} date={today} />
        </div>
      )}

      {/* CUSTO RÁPIDO — responsivo */}
      <div className="rounded-2xl bg-[#0F0F0F] border border-white/10 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <TrendingDown className="w-4 h-4 text-red-400" />
          <h3 className="text-sm font-semibold text-white">Custo rápido</h3>
        </div>
        <p className="text-xs text-neutral-500 -mt-1">
          Mercadoria, transporte, lanche. Vai entrar no lucro do dia.
        </p>
        <div className="space-y-2">
          <input
            value={quickCostLabel}
            onChange={(e) => setQuickCostLabel(e.target.value)}
            placeholder="Descrição (opcional)"
            className="w-full h-11 bg-black border border-white/10 rounded-xl px-3 text-sm text-white focus:outline-none focus:border-[#F4A100] placeholder:text-neutral-600"
          />
          <div className="flex gap-2">
            <input
              type="number"
              inputMode="decimal"
              value={quickCost}
              onChange={(e) => setQuickCost(e.target.value)}
              placeholder="R$ 0,00"
              className="flex-1 min-w-0 h-11 bg-black border border-white/10 rounded-xl px-3 text-sm text-white focus:outline-none focus:border-[#F4A100] placeholder:text-neutral-600"
            />
            <button
              onClick={handleAddCost}
              disabled={!quickCost || parseFloat(quickCost) <= 0}
              className="shrink-0 h-11 px-4 rounded-xl bg-[#F4A100] text-black font-bold text-sm flex items-center gap-1.5 disabled:opacity-40 active:scale-95"
            >
              <Plus className="w-4 h-4" />
              Adicionar
            </button>
          </div>
        </div>
      </div>

      {/* PDF do dia */}
      <button
        onClick={handlePDF}
        disabled={exporting}
        className="w-full h-12 rounded-xl bg-[#0F0F0F] border border-[#F4A100]/30 hover:border-[#F4A100]/60 text-[#F4A100] text-sm font-semibold flex items-center justify-center gap-2 active:scale-[0.98] transition disabled:opacity-50"
      >
        <FileDown className="w-4 h-4" />
        {exporting ? "Gerando..." : "Baixar PDF do dia"}
      </button>

      <p className="text-center text-[11px] text-neutral-600">
        Os relatórios completos e filtros do DEFCON 4 estão na aba <span className="text-[#F4A100]">Relatório</span>.
      </p>

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
      className="rounded-xl bg-[#0F0F0F] border border-white/10 p-2.5 space-y-1"
      style={{ boxShadow: value > 0 ? `0 4px 14px -6px ${color}44` : undefined }}
    >
      <div className="flex items-center gap-1" style={{ color }}>
        {icon}
        <span className="text-[10px] font-medium">{label}</span>
      </div>
      <p className="text-sm font-bold text-white tabular-nums truncate">{formatCurrency(value)}</p>
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
          ? "bg-[#F4A100]/10 border-[#F4A100]/25"
          : "bg-[#0F0F0F] border-white/10"
      }`}
    >
      <p className={`text-[10px] font-medium ${danger ? "text-red-400" : highlight ? "text-[#F4A100]" : "text-neutral-500"}`}>
        {label}
      </p>
      <p className="text-base font-bold text-white tabular-nums mt-0.5">{value}</p>
    </div>
  );
}
