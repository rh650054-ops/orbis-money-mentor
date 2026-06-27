import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { getBrazilDate, formatBrazilDate } from "@/shared/lib/date-utils";
import { formatCurrency } from "@/shared/lib/utils";
import { MoneyInput } from "@/shared/ui/money-input";
import { Zap, FileDown, Pencil, Plus, Banknote, CreditCard, Smartphone, TrendingDown, Coins, Sparkles } from "lucide-react";
import { useToast } from "@/shared/hooks/use-toast";
import { generateDefconDayPDF } from "@/utils/generateDefconDayPDF";
import { syncBlocksToDailySales } from "@/utils/syncDailySales";
import { Check, X } from "lucide-react";
import { DefconLoadoutManager } from "@/components/defcon/DefconLoadoutManager";
import HourlyBreakdown from "@/components/history/HourlyBreakdown";
import { EditPlanningModal } from "@/components/EditPlanningModal";
import { BRAND_COLORS, readThemeColor } from "@/shared/lib/theme-colors";

// "Pix que caiu depois" — pagamento que entrou tarde, lançado num dia anterior
// (padrão: ontem). Atualiza o daily_sales daquele dia (total_profit + pix_sales).
function LatePixSection() {
  const { user } = useAuth();
  const { toast } = useToast();
  const yesterday = formatBrazilDate(new Date(Date.now() - 86400000));
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(yesterday);
  const [saving, setSaving] = useState(false);

  const prettyDate = (iso: string) => {
    const [, m, d] = iso.split("-");
    return d && m ? `${d}/${m}` : iso;
  };

  const handleSubmit = async () => {
    if (!user) return;
    const value = parseFloat(amount) || 0;
    if (value <= 0 || !date) return;
    setSaving(true);
    try {
      const { data: existing, error: selErr } = await supabase
        .from("daily_sales")
        .select("id, total_profit, pix_sales")
        .eq("user_id", user.id)
        .eq("date", date)
        .maybeSingle();
      if (selErr) throw selErr;

      if (existing) {
        const { error: updErr } = await supabase
          .from("daily_sales")
          .update({
            total_profit: (Number(existing.total_profit) || 0) + value,
            pix_sales: (Number(existing.pix_sales) || 0) + value,
          })
          .eq("id", existing.id);
        if (updErr) throw updErr;
      } else {
        const { error: insErr } = await supabase
          .from("daily_sales")
          .insert({ user_id: user.id, date, total_profit: value, pix_sales: value });
        if (insErr) throw insErr;
      }

      toast({ title: "Pix lançado", description: `Pix de ${formatCurrency(value)} lançado em ${prettyDate(date)}` });
      setAmount("");
    } catch (e) {
      toast({ title: "Erro ao lançar o Pix", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-2xl bg-card border border-border p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Smartphone className="w-4 h-4" style={{ color: BRAND_COLORS.PIX }} />
        <h3 className="text-sm font-semibold text-foreground">Pix que caiu depois</h3>
      </div>
      <p className="text-xs text-muted-foreground -mt-1">
        Pagamento que entrou atrasado. Lança no dia em que a venda aconteceu.
      </p>
      <div className="space-y-2">
        <div className="flex gap-2">
          <div className="relative flex-1 min-w-0">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-medium">R$</span>
            <input
              type="number"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Quanto caiu"
              aria-label="Quanto caiu (R$)"
              className="w-full h-11 bg-background border border-border rounded-xl pl-9 pr-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary placeholder:text-muted-foreground"
            />
          </div>
          <input
            type="date"
            value={date}
            max={yesterday}
            onChange={(e) => setDate(e.target.value)}
            aria-label="De que dia?"
            className="shrink-0 h-11 bg-background border border-border rounded-xl px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          />
        </div>
        <button
          onClick={handleSubmit}
          disabled={saving || !amount || parseFloat(amount) <= 0 || !date}
          style={{ backgroundColor: BRAND_COLORS.PIX }}
          className="w-full h-11 rounded-xl text-white font-bold text-sm flex items-center justify-center gap-1.5 disabled:opacity-40 active:scale-[0.98] transition-transform"
        >
          <Plus className="w-4 h-4" strokeWidth={3} />
          {saving ? "Lançando..." : "Lançar Pix"}
        </button>
      </div>
    </div>
  );
}

interface DayTotals {
  cash: number; card: number; pix: number; debt: number; profit: number; cost: number; tips: number;
  transport: number; food: number;
}

export default function DefconHub() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { toast } = useToast();
  const [dailyGoal, setDailyGoal] = useState(0);
  const [planId, setPlanId] = useState<string | null>(null);
  const [totals, setTotals] = useState<DayTotals>({ cash: 0, card: 0, pix: 0, debt: 0, profit: 0, cost: 0, tips: 0, transport: 0, food: 0 });
  const [hasSession, setHasSession] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [quickCost, setQuickCost] = useState("");
  const [quickCostCat, setQuickCostCat] = useState<"mercadoria" | "transporte" | "alimentacao">("mercadoria");
  const [showEdit, setShowEdit] = useState(false);
  // Edição manual de "Como você recebeu" (dinheiro/cartão/pix) — p/ corrigir e lançar pagamentos tardios (ex.: Pix do outro dia)
  const [editingPay, setEditingPay] = useState(false);
  const [payCash, setPayCash] = useState("");
  const [payCard, setPayCard] = useState("");
  const [payPix, setPayPix] = useState("");
  const [savingPay, setSavingPay] = useState(false);
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
        .select("cash_sales, card_sales, pix_sales, total_debt, total_profit, cost, tip_sales, transport_cost, food_cost")
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
        .maybeSingle();
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
      transport: Number((sales as any)?.transport_cost || 0),
      food: Number((sales as any)?.food_cost || 0),
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
    // Cada categoria vai pra coluna certa do daily_sales — e TODAS entram no relatório
    // e ABATEM do líquido: mercadoria -> "Custo de mercadoria"; transporte/almoço ->
    // "Transporte e alimentação". (Antes ia pra personal_expenses e sumia do relatório.)
    const col = quickCostCat === "transporte" ? "transport_cost"
      : quickCostCat === "alimentacao" ? "food_cost"
      : "cost";
    const { data: rows } = await supabase
      .from("daily_sales")
      .select("id, cost, transport_cost, food_cost")
      .eq("user_id", user.id)
      .eq("date", today)
      .order("created_at", { ascending: true })
      .limit(1);
    if (rows && rows.length > 0) {
      const prev = Number((rows[0] as any)[col]) || 0;
      await supabase
        .from("daily_sales")
        .update({ [col]: prev + amount } as any)
        .eq("id", (rows[0] as any).id);
    } else {
      await supabase
        .from("daily_sales")
        .insert({ user_id: user.id, date: today, [col]: amount } as any);
    }
    setQuickCost("");
    const catLabel = quickCostCat === "transporte" ? "Transporte" : quickCostCat === "alimentacao" ? "Almoço" : "Mercadoria";
    toast({ title: `${catLabel} registrado`, description: formatCurrency(amount) });
    loadAll();
  };

  const openPayEditor = () => {
    setPayCash(totals.cash ? String(totals.cash) : "");
    setPayCard(totals.card ? String(totals.card) : "");
    setPayPix(totals.pix ? String(totals.pix) : "");
    setEditingPay(true);
  };

  // Salva a edição manual: redistribui os valores informados pelos blocos da hora
  // (proporcional ao que cada bloco vendeu) e ressincroniza o daily_sales.
  // O que faltar pro total vira "não recebido" (calote) — cobre o caso do Pix que cai depois.
  const savePayEdit = async () => {
    if (!user || !planId) return;
    setSavingPay(true);
    try {
      const d = parseFloat(payCash) || 0;
      const c = parseFloat(payCard) || 0;
      const p = parseFloat(payPix) || 0;

      const { data: blocks } = await supabase
        .from("hourly_goal_blocks")
        .select("id, valor_dinheiro, valor_cartao, valor_pix, valor_calote")
        .eq("plan_id", planId);

      const totalFromBlocks = (blocks || []).reduce(
        (s, b) => s + (b.valor_dinheiro || 0) + (b.valor_cartao || 0) + (b.valor_pix || 0) + (b.valor_calote || 0),
        0
      );

      if (totalFromBlocks > 0) {
        for (const b of blocks || []) {
          const blockTotal = (b.valor_dinheiro || 0) + (b.valor_cartao || 0) + (b.valor_pix || 0) + (b.valor_calote || 0);
          if (blockTotal <= 0) continue;
          const ratio = blockTotal / totalFromBlocks;
          const bd = Math.round(d * ratio * 100) / 100;
          const bc = Math.round(c * ratio * 100) / 100;
          const bp = Math.round(p * ratio * 100) / 100;
          const bcal = Math.max(0, Math.round((blockTotal - (bd + bc + bp)) * 100) / 100);
          await supabase
            .from("hourly_goal_blocks")
            .update({ valor_dinheiro: bd, valor_cartao: bc, valor_pix: bp, valor_calote: bcal, achieved_amount: bd + bc + bp + bcal })
            .eq("id", b.id);
        }
      }

      await syncBlocksToDailySales(user.id);
      setEditingPay(false);
      toast({ title: "Recebimentos atualizados", description: "Dinheiro, cartão e Pix corrigidos." });
      loadAll();
    } catch {
      toast({ title: "Erro ao salvar", variant: "destructive" });
    } finally {
      setSavingPay(false);
    }
  };

  if (loading || !user) return null;

  return (
    <div className="space-y-4 pb-8 max-w-2xl mx-auto px-1">
      {/* HEADER discreto */}
      <div className="pt-1 pb-1">
        <p className="text-xs text-destructive/80 tracking-[0.25em] uppercase">⚡ Modo desafio</p>
        <h1 className="text-2xl font-bold text-foreground tracking-tight mt-0.5">DEFCON 4</h1>
      </div>

      {/* BLOCO UNIFICADO — Meta + Botão */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-card via-card to-background border border-border p-5 space-y-5 shadow-[0_8px_30px_-12px_hsl(var(--primary)/0.25)]">
        {/* glow sutil */}
        <div className="absolute -top-20 -right-20 w-56 h-56 bg-primary/10 blur-3xl rounded-full pointer-events-none" />

        <div className="relative flex items-start justify-between">
          <div>
            <p className="text-xs text-muted-foreground tracking-wider uppercase mb-1">Meta do dia</p>
            <p className="text-3xl font-bold text-foreground tracking-tight tabular-nums">
              {formatCurrency(dailyGoal)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {goalReached ? (
                <span className="text-success">🎉 Meta batida!</span>
              ) : (
                <>Vendido <span className="text-foreground font-medium">{formatCurrency(totalVendido)}</span> · falta <span className="text-primary">{formatCurrency(falta)}</span></>
              )}
            </p>
          </div>
          <button
            onClick={() => setShowEdit(true)}
            className="w-8 h-8 rounded-lg bg-foreground/5 hover:bg-foreground/10 border border-border flex items-center justify-center text-muted-foreground active:scale-95 transition"
            aria-label="Editar meta"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Progress fino */}
        <div className="relative h-1.5 bg-foreground/5 rounded-full overflow-hidden">
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
          <span className="absolute inset-0 bg-foreground/10 opacity-0 group-active:opacity-100 transition" />
          <Zap className="w-5 h-5 fill-white" />
          {hasSession ? "Continuar DEFCON 4" : "Iniciar DEFCON 4"}
        </button>
      </div>

      {/* LOADOUT */}
      <DefconLoadoutManager userId={user.id} />

      {/* RESUMO POR PAGAMENTO — visual rico */}
      {totalVendido > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-foreground">Como você recebeu</h3>
              {!editingPay && (
                <button
                  onClick={openPayEditor}
                  className="w-6 h-6 rounded-md bg-foreground/5 hover:bg-foreground/10 border border-border flex items-center justify-center text-muted-foreground active:scale-95 transition"
                  aria-label="Editar recebimentos"
                >
                  <Pencil className="w-3 h-3" />
                </button>
              )}
            </div>
            <span className="text-xs text-muted-foreground tabular-nums">
              Total <span className="text-primary font-bold">{formatCurrency(totalVendido)}</span>
            </span>
          </div>

          {editingPay ? (
            <div className="rounded-xl bg-card border border-primary/30 p-3 space-y-2.5">
              <p className="text-xs text-muted-foreground">
                Ajuste o que entrou em cada forma. O que faltar pro total vira <span className="text-destructive">não recebido</span>.
              </p>
              <PayEditRow icon={<Banknote className="w-4 h-4 text-success" />} label="Dinheiro" value={payCash} onChange={setPayCash} />
              <PayEditRow icon={<CreditCard className="w-4 h-4" style={{ color: readThemeColor("--violet-soft") }} />} label="Cartão" value={payCard} onChange={setPayCard} />
              <PayEditRow icon={<Smartphone className="w-4 h-4" style={{ color: BRAND_COLORS.PIX }} />} label="Pix" value={payPix} onChange={setPayPix} />
              <div className="flex items-center justify-between pt-1">
                <span className="text-xs text-muted-foreground tabular-nums">
                  Somado <span className="text-foreground font-semibold">{formatCurrency((parseFloat(payCash) || 0) + (parseFloat(payCard) || 0) + (parseFloat(payPix) || 0))}</span> / {formatCurrency(totalVendido)}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setEditingPay(false)}
                    disabled={savingPay}
                    className="h-9 px-3 rounded-lg bg-muted text-foreground text-xs font-semibold flex items-center gap-1 active:scale-95 disabled:opacity-50"
                  >
                    <X className="w-3.5 h-3.5" /> Cancelar
                  </button>
                  <button
                    onClick={savePayEdit}
                    disabled={savingPay}
                    className="h-9 px-3 rounded-lg bg-primary text-primary-foreground text-xs font-bold flex items-center gap-1 active:scale-95 disabled:opacity-50"
                  >
                    <Check className="w-3.5 h-3.5" /> {savingPay ? "Salvando..." : "Salvar"}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              <PayCard icon={<Banknote className="w-4 h-4" />} label="Dinheiro" value={totals.cash} total={totalVendido} color={readThemeColor("--success")} />
              <PayCard icon={<CreditCard className="w-4 h-4" />} label="Cartão" value={totals.card} total={totalVendido} color={readThemeColor("--violet-soft")} />
              <PayCard icon={<Smartphone className="w-4 h-4" />} label="Pix" value={totals.pix} total={totalVendido} color={BRAND_COLORS.PIX} />
            </div>
          )}

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
                <p className="text-xs text-muted-foreground">Já incluso no dinheiro recebido</p>
              </div>
              <p className="text-lg font-bold text-primary tabular-nums">+{formatCurrency(totals.tips)}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <MiniStat label="Lucro" value={formatCurrency(totals.profit)} highlight />
            {totals.debt > 0 && <MiniStat label="Calotes" value={formatCurrency(totals.debt)} danger />}
            {(totals.cost + totals.transport + totals.food) > 0 && <MiniStat label="Custos" value={formatCurrency(totals.cost + totals.transport + totals.food)} />}
          </div>
        </div>
      )}

      {/* VENDAS POR HORA */}
      {planId && totalVendido > 0 && (
        <div className="rounded-2xl bg-card border border-border p-4">
          <HourlyBreakdown userId={user.id} date={today} />
        </div>
      )}

      {/* CUSTO RÁPIDO — responsivo */}
      <div className="rounded-2xl bg-card border border-border p-4 space-y-3">
        <div className="flex items-center gap-2">
          <TrendingDown className="w-4 h-4 text-destructive" />
          <h3 className="text-sm font-semibold text-foreground">Custo rápido</h3>
        </div>
        <p className="text-xs text-muted-foreground -mt-1">
          Escolha o tipo, digite o valor. Entra no relatório e abate do líquido.
        </p>
        <div className="space-y-2">
          <div className="grid grid-cols-3 gap-2">
            {([
              { id: "mercadoria", label: "Mercadoria", emoji: "📦" },
              { id: "transporte", label: "Transporte", emoji: "🚌" },
              { id: "alimentacao", label: "Almoço", emoji: "🍽️" },
            ] as const).map((c) => {
              const active = quickCostCat === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setQuickCostCat(c.id)}
                  className={`flex flex-col items-center justify-center gap-0.5 h-14 rounded-xl border text-xs font-medium transition active:scale-95 ${
                    active
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border/60 bg-background text-muted-foreground hover:bg-muted/40"
                  }`}
                >
                  <span className="text-base leading-none">{c.emoji}</span>
                  <span>{c.label}</span>
                </button>
              );
            })}
          </div>
          <div className="flex gap-2">
            <MoneyInput
              value={parseFloat(quickCost) || 0}
              onChange={(n) => setQuickCost(n ? String(n) : "")}
              placeholder="R$ 0,00"
              className="flex-1 min-w-0 h-11 bg-background border border-border rounded-xl px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary placeholder:text-muted-foreground"
            />
            <button
              onClick={handleAddCost}
              disabled={!quickCost || parseFloat(quickCost) <= 0}
              className="shrink-0 h-11 px-4 rounded-xl bg-primary text-primary-foreground font-bold text-sm flex items-center gap-1.5 disabled:opacity-40 active:scale-95"
            >
              <Plus className="w-4 h-4" />
              Adicionar
            </button>
          </div>
        </div>
      </div>

      {/* Pix que caiu depois — lançar num dia anterior */}
      <LatePixSection />

      {/* PDF do dia */}
      <button
        onClick={handlePDF}
        disabled={exporting}
        className="w-full h-12 rounded-xl bg-card border border-primary/30 hover:border-primary/60 text-primary text-sm font-semibold flex items-center justify-center gap-2 active:scale-[0.98] transition disabled:opacity-50"
      >
        <FileDown className="w-4 h-4" />
        {exporting ? "Gerando..." : "Baixar PDF do dia"}
      </button>

      <p className="text-center text-xs text-muted-foreground">
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
      <p className="relative text-base font-bold text-foreground tabular-nums truncate leading-tight">
        {formatCurrency(value)}
      </p>
      {/* mini barra com % do total */}
      <div className="relative h-0.5 bg-foreground/5 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-[colors,transform,opacity] duration-500"
          style={{
            width: `${pct}%`,
            background: active ? color : "transparent",
            boxShadow: active ? `0 0 8px ${color}99` : undefined,
          }}
        />
      </div>
      <p className="relative text-xs text-muted-foreground tabular-nums">{pct}% do total</p>
    </div>
  );
}

function PayEditRow({ icon, label, value, onChange }: { icon: React.ReactNode; label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="relative h-11 rounded-lg bg-background border border-border focus-within:border-primary/60 transition-colors flex items-center">
      <span className="absolute left-3">{icon}</span>
      <span className="absolute left-10 text-xs font-medium text-muted-foreground">{label}</span>
      <span className="absolute right-[68px] text-xs text-muted-foreground">R$</span>
      <input
        type="number"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="0"
        className="w-full h-full bg-transparent text-right text-sm font-bold text-foreground pr-3 pl-28 focus-visible:outline-none rounded-lg placeholder:text-muted-foreground"
      />
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
          : "bg-card border-border"
      }`}
    >
      <p className={`text-xs font-medium ${danger ? "text-destructive" : highlight ? "text-primary" : "text-muted-foreground"}`}>
        {label}
      </p>
      <p className="text-base font-bold text-foreground tabular-nums mt-0.5">{value}</p>
    </div>
  );
}
