import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { getBrazilDate } from "@/shared/lib/date-utils";
import { formatCurrency } from "@/shared/lib/utils";
import { Zap, FileDown, Pencil, Plus, Banknote, CreditCard, Smartphone, TrendingDown, Coins, Sparkles } from "lucide-react";
import { useToast } from "@/shared/hooks/use-toast";
import { generateDefconDayPDF } from "@/utils/generateDefconDayPDF";
import { DefconLoadoutManager } from "@/components/defcon/DefconLoadoutManager";
import HourlyBreakdown from "@/components/history/HourlyBreakdown";
import { EditPlanningModal } from "@/components/EditPlanningModal";
import { BRAND_COLORS, readThemeColor } from "@/shared/lib/theme-colors";

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
        <p className="text-xs text-destructive/80 tracking-[0.25em] uppercase">⚡ Modo desafio</p>
        <h1 className="text-2xl font-bold text-white tracking-tight mt-0.5">DEFCON 4</h1>
      </div>

      {/* BLOCO UNIFICADO — Meta + Botão */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-card via-card to-background border border-white/10 p-5 space-y-5 shadow-[0_8px_30px_-12px_hsl(var(--primary)/0.25)]">
        {/* glow sutil */}
        <div className="absolute -top-20 -right-20 w-56 h-56 bg-primary/10 blur-3xl rounded-full pointer-events-none" />

        <div className="relative flex items-start justify-between">
          <div>
            <p className="text-xs text-neutral-500 tracking-wider uppercase mb-1">Meta do dia</p>
            <p className="text-3xl font-bold text-white tracking-tight tabular-nums">
              {formatCurrency(dailyGoal)}
            </p>
            <p className="text-xs text-neutral-500 mt-1">
              {goalReached ? (
                <span className="text-success">🎉 Meta batida!</span>
              ) : (
                <>Vendido <span className="text-white font-medium">{formatCurrency(totalVendido)}</span> · falta <span className="text-primary">{formatCurrency(falta)}</span></>
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
            className={`h-full transition-[colors,transform,opacity] duration-700 rounded-full ${
              goalReached
                ? "bg-gradient-to-r from-success to-success/80 shadow-[0_0_12px_hsl(var(--success)/0.6)]"
                : "bg-gradient-to-r from-primary to-primary shadow-[0_0_12px_hsl(var(--primary)/0.5)]"
            }`}
            style={{ width: `${progresso}%` }}
          />
        </div>

        {/* CTA — botão grande mas refinado */}
        <button
          onClick={() => navigate("/defcon")}
          data-tour="defcon-banner"
          className="relative w-full h-14 rounded-xl bg-gradient-to-r from-destructive to-destructive/85 text-destructive-foreground font-bold text-base tracking-wide flex items-center justify-center gap-2.5 active:scale-[0.98] transition-transform shadow-[0_8px_24px_-6px_hsl(var(--destructive)/0.55)] overflow-hidden group"
        >
          <span className="absolute inset-0 bg-white/10 opacity-0 group-active:opacity-100 transition" />
          <Zap className="w-5 h-5 fill-white" />
          {hasSession ? "Continuar DEFCON 4" : "Iniciar DEFCON 4"}
        </button>
      </div>

      {/* LOADOUT */}
      <DefconLoadoutManager userId={user.id} />

      {/* RESUMO POR PAGAMENTO — visual rico */}
      {totalVendido > 0 && (
        <div className="space-y-3">
          <div className="flex items-end justify-between px-1">
            <h3 className="text-sm font-semibold text-white">Como você recebeu</h3>
            <span className="text-xs text-neutral-500 tabular-nums">
              Total <span className="text-primary font-bold">{formatCurrency(totalVendido)}</span>
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <PayCard icon={<Banknote className="w-4 h-4" />} label="Dinheiro" value={totals.cash} total={totalVendido} color={readThemeColor("--success")} />
            <PayCard icon={<CreditCard className="w-4 h-4" />} label="Cartão" value={totals.card} total={totalVendido} color={readThemeColor("--violet-soft")} />
            <PayCard icon={<Smartphone className="w-4 h-4" />} label="Pix" value={totals.pix} total={totalVendido} color={BRAND_COLORS.PIX} />
          </div>

          {/* Gorjeta — destaque dourado quando > 0 */}
          {totals.tips > 0 && (
            <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-primary/15 via-primary/8 to-transparent border border-primary/30 px-4 py-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-primary/20 flex items-center justify-center shrink-0">
                <Coins className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-xs uppercase tracking-wider text-primary font-semibold">Gorjetas</p>
                  <Sparkles className="w-3 h-3 text-primary" />
                </div>
                <p className="text-xs text-neutral-500">Já incluso no dinheiro recebido</p>
              </div>
              <p className="text-lg font-bold text-primary tabular-nums">+{formatCurrency(totals.tips)}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <MiniStat label="Lucro" value={formatCurrency(totals.profit)} highlight />
            {totals.debt > 0 && <MiniStat label="Calotes" value={formatCurrency(totals.debt)} danger />}
            {totals.cost > 0 && <MiniStat label="Custos" value={formatCurrency(totals.cost)} />}
          </div>
        </div>
      )}

      {/* VENDAS POR HORA */}
      {planId && totalVendido > 0 && (
        <div className="rounded-2xl bg-card border border-white/10 p-4">
          <HourlyBreakdown userId={user.id} date={today} />
        </div>
      )}

      {/* CUSTO RÁPIDO — responsivo */}
      <div className="rounded-2xl bg-card border border-white/10 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <TrendingDown className="w-4 h-4 text-destructive" />
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
            className="w-full h-11 bg-black border border-white/10 rounded-xl px-3 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary placeholder:text-neutral-600"
          />
          <div className="flex gap-2">
            <input
              type="number"
              inputMode="decimal"
              value={quickCost}
              onChange={(e) => setQuickCost(e.target.value)}
              placeholder="R$ 0,00"
              className="flex-1 min-w-0 h-11 bg-black border border-white/10 rounded-xl px-3 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary placeholder:text-neutral-600"
            />
            <button
              onClick={handleAddCost}
              disabled={!quickCost || parseFloat(quickCost) <= 0}
              className="shrink-0 h-11 px-4 rounded-xl bg-primary text-black font-bold text-sm flex items-center gap-1.5 disabled:opacity-40 active:scale-95"
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
        className="w-full h-12 rounded-xl bg-card border border-primary/30 hover:border-primary/60 text-primary text-sm font-semibold flex items-center justify-center gap-2 active:scale-[0.98] transition disabled:opacity-50"
      >
        <FileDown className="w-4 h-4" />
        {exporting ? "Gerando..." : "Baixar PDF do dia"}
      </button>

      <p className="text-center text-xs text-neutral-600">
        Os relatórios completos e filtros do DEFCON 4 estão na aba <span className="text-primary">Relatório</span>.
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

function PayCard({
  icon,
  label,
  value,
  total,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  total: number;
  color: string;
}) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  const active = value > 0;
  return (
    <div
      className="relative overflow-hidden rounded-xl bg-gradient-to-br from-card to-background border p-2.5 space-y-1.5 transition-[colors,transform,opacity]"
      style={{
        borderColor: active ? `${color}55` : "rgba(255,255,255,0.06)",
        boxShadow: active ? `0 6px 18px -8px ${color}66, inset 0 1px 0 0 ${color}15` : undefined,
      }}
    >
      {/* glow corner sutil */}
      {active && (
        <div
          className="absolute -top-6 -right-6 w-14 h-14 rounded-full blur-2xl opacity-40 pointer-events-none"
          style={{ background: color }}
        />
      )}
      <div className="relative flex items-center gap-1.5 text-muted-foreground" style={active ? { color } : undefined}>
        {icon}
        <span className="text-xs font-semibold tracking-wide uppercase">{label}</span>
      </div>
      <p className="relative text-base font-bold text-white tabular-nums truncate leading-tight">
        {formatCurrency(value)}
      </p>
      {/* mini barra com % do total */}
      <div className="relative h-0.5 bg-white/5 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-[colors,transform,opacity] duration-500"
          style={{
            width: `${pct}%`,
            background: active ? color : "transparent",
            boxShadow: active ? `0 0 8px ${color}99` : undefined,
          }}
        />
      </div>
      <p className="relative text-xs text-neutral-500 tabular-nums">{pct}% do total</p>
    </div>
  );
}

function MiniStat({ label, value, highlight, danger }: { label: string; value: string; highlight?: boolean; danger?: boolean }) {
  return (
    <div
      className={`rounded-xl border p-3 ${
        danger
          ? "bg-destructive/10 border-destructive/30"
          : highlight
          ? "bg-primary/10 border-primary/25"
          : "bg-card border-white/10"
      }`}
    >
      <p className={`text-xs font-medium ${danger ? "text-destructive" : highlight ? "text-primary" : "text-neutral-500"}`}>
        {label}
      </p>
      <p className="text-base font-bold text-white tabular-nums mt-0.5">{value}</p>
    </div>
  );
}
