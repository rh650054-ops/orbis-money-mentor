import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/utils";
import { getBrazilDate } from "@/lib/dateUtils";
import { Sparkles, Wallet, CheckCircle2, Info, Settings2, AlertTriangle } from "lucide-react";

interface GoalRow {
  id: string;
  name: string;
  icon: string | null;
  target_amount: number;
  current_amount: number;
  percentual_distribuicao: number;
  status: string;
}

interface DistributionRow {
  goal_id: string;
  amount: number;
  percentual: number;
  liquido_base: number;
}

interface Props {
  userId: string;
  onChanged?: () => void;
}

export default function AutoDistribution({ userId, onChanged }: Props) {
  const { toast } = useToast();
  const [goals, setGoals] = useState<GoalRow[]>([]);
  const [liquidoHoje, setLiquidoHoje] = useState(0);
  const [grossHoje, setGrossHoje] = useState(0);
  const [despesasHoje, setDespesasHoje] = useState(0);
  const [costHoje, setCostHoje] = useState(0);
  const [caloteHoje, setCaloteHoje] = useState(0);
  const [todayDistribution, setTodayDistribution] = useState<DistributionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [draft, setDraft] = useState<Record<string, number>>({});

  const today = getBrazilDate();

  const loadAll = async () => {
    setLoading(true);
    try {
      // Goals ativas
      const { data: goalsData } = await supabase
        .from("financial_goals")
        .select("id,name,icon,target_amount,current_amount,percentual_distribuicao,status")
        .eq("user_id", userId)
        .eq("status", "active")
        .order("created_at", { ascending: true });

      const gs = (goalsData || []) as GoalRow[];
      setGoals(gs);

      // Vendas do dia
      const { data: salesData } = await supabase
        .from("daily_sales")
        .select("total_profit, cost, total_debt, cash_sales, pix_sales, card_sales")
        .eq("user_id", userId)
        .eq("date", today)
        .maybeSingle();

      const gross =
        Number(salesData?.cash_sales || 0) +
        Number(salesData?.pix_sales || 0) +
        Number(salesData?.card_sales || 0);
      const cost = Number(salesData?.cost || 0);
      const calote = Number(salesData?.total_debt || 0);
      const lucroBruto = Math.max(0, gross - cost - calote);

      setGrossHoje(gross);
      setCostHoje(cost);
      setCaloteHoje(calote);

      // Despesas pessoais do dia
      const { data: expensesData } = await supabase
        .from("personal_expenses")
        .select("amount")
        .eq("user_id", userId)
        .eq("date", today);

      const despesas = (expensesData || []).reduce(
        (sum, e: any) => sum + (Number(e.amount) || 0),
        0
      );
      setDespesasHoje(despesas);

      const liquido = Math.max(0, lucroBruto - despesas);
      setLiquidoHoje(liquido);

      // Distribuição já registrada hoje
      const { data: distData } = await supabase
        .from("daily_distributions")
        .select("goal_id, amount, percentual, liquido_base")
        .eq("user_id", userId)
        .eq("date", today);

      setTodayDistribution((distData || []) as DistributionRow[]);

      // Inicializa draft com percentuais atuais
      const initialDraft: Record<string, number> = {};
      gs.forEach((g) => {
        initialDraft[g.id] = Number(g.percentual_distribuicao) || 0;
      });
      setDraft(initialDraft);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userId) loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const totalPercent = useMemo(
    () => goals.reduce((s, g) => s + (Number(g.percentual_distribuicao) || 0), 0),
    [goals]
  );

  const draftTotal = useMemo(
    () => Object.values(draft).reduce((s, v) => s + (Number(v) || 0), 0),
    [draft]
  );

  const alreadyDistributed = todayDistribution.length > 0;
  const distributedTotal = todayDistribution.reduce((s, d) => s + Number(d.amount), 0);

  const preview = goals
    .filter((g) => Number(g.percentual_distribuicao) > 0)
    .map((g) => ({
      goal: g,
      amount: (liquidoHoje * Number(g.percentual_distribuicao)) / 100,
    }));

  const handleSavePercentages = async () => {
    if (draftTotal > 100) {
      toast({
        title: "Passou de 100%",
        description: `Atualmente: ${draftTotal.toFixed(0)}%. Reduza pra no máximo 100%.`,
        variant: "destructive",
      });
      return;
    }
    setSaving(true);
    try {
      await Promise.all(
        Object.entries(draft).map(([goalId, pct]) =>
          supabase
            .from("financial_goals")
            .update({ percentual_distribuicao: Number(pct) || 0 })
            .eq("id", goalId)
        )
      );
      toast({ title: "✅ Percentuais salvos", description: "Sua divisão foi atualizada." });
      setEditOpen(false);
      await loadAll();
      onChanged?.();
    } catch (e) {
      toast({ title: "Erro ao salvar", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleApplyToday = async () => {
    if (alreadyDistributed) {
      toast({ title: "Hoje já foi distribuído", description: "Você já separou o líquido de hoje." });
      return;
    }
    if (liquidoHoje <= 0) {
      toast({
        title: "Sem líquido pra distribuir",
        description: "Registre vendas e despesas do dia primeiro.",
        variant: "destructive",
      });
      return;
    }
    if (totalPercent <= 0) {
      toast({
        title: "Configure os percentuais",
        description: "Defina pelo menos 1 meta com % maior que 0.",
        variant: "destructive",
      });
      return;
    }
    if (totalPercent > 100) {
      toast({
        title: "Passou de 100%",
        description: `Soma atual: ${totalPercent.toFixed(0)}%. Ajuste antes de distribuir.`,
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const rows = preview.map((p) => ({
        user_id: userId,
        date: today,
        goal_id: p.goal.id,
        goal_name: p.goal.name,
        percentual: Number(p.goal.percentual_distribuicao),
        liquido_base: liquidoHoje,
        amount: Number(p.amount.toFixed(2)),
      }));

      const { error: insErr } = await supabase.from("daily_distributions").insert(rows);
      if (insErr) throw insErr;

      // Atualiza current_amount de cada meta
      await Promise.all(
        preview.map((p) => {
          const newAmount = Number(p.goal.current_amount) + Number(p.amount.toFixed(2));
          const newStatus = newAmount >= p.goal.target_amount ? "completed" : "active";
          return supabase
            .from("financial_goals")
            .update({ current_amount: newAmount, status: newStatus })
            .eq("id", p.goal.id);
        })
      );

      toast({
        title: "💰 Distribuição feita!",
        description: `${formatCurrency(liquidoHoje)} dividido entre ${preview.length} caixinha${preview.length > 1 ? "s" : ""}.`,
      });
      await loadAll();
      onChanged?.();
    } catch (e) {
      console.error(e);
      toast({ title: "Erro ao distribuir", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return null;

  return (
    <Card className="card-gradient-border bg-gradient-to-br from-primary/5 to-secondary/5">
      <CardHeader>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              Distribuição Automática
            </CardTitle>
            <CardDescription className="mt-1">
              Divida seu lucro líquido do dia em caixinhas (ex: 50% custo de vida, 30% moto, 20% reinvestir).
            </CardDescription>
          </div>
          <Dialog open={editOpen} onOpenChange={setEditOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Settings2 className="w-4 h-4 mr-2" />
                Configurar %
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Defina sua divisão</DialogTitle>
                <DialogDescription>
                  Quanto % do líquido de cada dia vai pra cada meta. A soma precisa fechar 100%.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-5 pt-2 max-h-[60vh] overflow-y-auto">
                {goals.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    Crie metas primeiro na aba "Metas" pra distribuir o lucro entre elas.
                  </p>
                )}
                {goals.map((g) => (
                  <div key={g.id} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="flex items-center gap-2">
                        <span className="text-lg">{g.icon || "🎯"}</span>
                        <span className="font-semibold">{g.name}</span>
                      </Label>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          value={draft[g.id] ?? 0}
                          onChange={(e) =>
                            setDraft((prev) => ({
                              ...prev,
                              [g.id]: Math.max(0, Math.min(100, Number(e.target.value) || 0)),
                            }))
                          }
                          className="w-20 text-right"
                        />
                        <span className="text-sm text-muted-foreground">%</span>
                      </div>
                    </div>
                    <Slider
                      value={[draft[g.id] ?? 0]}
                      onValueChange={(v) =>
                        setDraft((prev) => ({ ...prev, [g.id]: v[0] }))
                      }
                      min={0}
                      max={100}
                      step={1}
                    />
                  </div>
                ))}
                {goals.length > 0 && (
                  <div
                    className={`flex items-center justify-between p-3 rounded-lg border ${
                      Math.round(draftTotal) === 100
                        ? "bg-green-500/10 border-green-500/30"
                        : "bg-yellow-500/10 border-yellow-500/30"
                    }`}
                  >
                    <span className="text-sm font-medium">Soma total</span>
                    <span
                      className={`font-bold ${
                        Math.round(draftTotal) === 100 ? "text-green-500" : "text-yellow-500"
                      }`}
                    >
                      {draftTotal.toFixed(0)}% / 100%
                    </span>
                  </div>
                )}
              </div>
              <Button
                onClick={handleSavePercentages}
                disabled={saving || goals.length === 0}
                className="w-full mt-2"
              >
                Salvar divisão
              </Button>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Como funciona */}
        <div className="flex items-start gap-2 p-3 bg-muted/40 border border-border/40 rounded-lg">
          <Info className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
          <p className="text-xs text-muted-foreground leading-relaxed">
            <b>Como funciona:</b> Pegamos suas vendas do dia, tiramos custo de mercadoria, calotes e despesas pessoais — esse é o seu <b>líquido</b>. Aí dividimos esse líquido nas caixinhas que você definiu. Cada valor mostrado é o quanto você deve guardar em cada banco/caixinha hoje.
          </p>
        </div>

        {/* Resumo do líquido de hoje */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className="p-3 rounded-lg bg-card border border-border/50">
            <p className="text-[11px] text-muted-foreground">Bruto hoje</p>
            <p className="text-base font-bold">{formatCurrency(grossHoje)}</p>
          </div>
          <div className="p-3 rounded-lg bg-card border border-border/50">
            <p className="text-[11px] text-muted-foreground">Custo + calotes</p>
            <p className="text-base font-bold text-red-500">
              -{formatCurrency(costHoje + caloteHoje)}
            </p>
          </div>
          <div className="p-3 rounded-lg bg-card border border-border/50">
            <p className="text-[11px] text-muted-foreground">Despesas pessoais</p>
            <p className="text-base font-bold text-red-500">
              -{formatCurrency(despesasHoje)}
            </p>
          </div>
          <div className="p-3 rounded-lg bg-primary/10 border border-primary/30">
            <p className="text-[11px] text-muted-foreground">💎 Líquido</p>
            <p className="text-base font-bold text-primary">{formatCurrency(liquidoHoje)}</p>
          </div>
        </div>

        {/* Estado: sem metas */}
        {goals.length === 0 && (
          <div className="p-4 text-center text-sm text-muted-foreground border border-dashed rounded-lg">
            Crie ao menos uma meta na aba "Metas" pra começar a distribuir.
          </div>
        )}

        {/* Estado: metas sem percentual */}
        {goals.length > 0 && Math.round(totalPercent) !== 100 && !alreadyDistributed && (
          <div className="flex items-start gap-2 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
            <AlertTriangle className="w-4 h-4 text-yellow-500 mt-0.5 flex-shrink-0" />
            <div className="text-xs">
              <p className="font-semibold text-yellow-600 dark:text-yellow-400">
                Configure os percentuais
              </p>
              <p className="text-muted-foreground mt-1">
                A soma dos % precisa fechar 100% pra ativar a distribuição. Atual: {totalPercent.toFixed(0)}%.
              </p>
            </div>
          </div>
        )}

        {/* Preview do dia */}
        {goals.length > 0 && Math.round(totalPercent) === 100 && !alreadyDistributed && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              📦 Caixinhas de hoje
            </p>
            {preview.map(({ goal, amount }) => (
              <div
                key={goal.id}
                className="flex items-center justify-between p-3 rounded-lg bg-card border border-border/50"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{goal.icon || "🎯"}</span>
                  <div>
                    <p className="font-semibold text-sm">{goal.name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {Number(goal.percentual_distribuicao).toFixed(0)}% do líquido
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-primary whitespace-nowrap">
                    {formatCurrency(amount)}
                  </p>
                  <p className="text-[10px] text-muted-foreground">guardar hoje</p>
                </div>
              </div>
            ))}
            <Button
              onClick={handleApplyToday}
              disabled={saving || liquidoHoje <= 0}
              className="w-full mt-2"
            >
              <Wallet className="w-4 h-4 mr-2" />
              Separar líquido de hoje nas caixinhas
            </Button>
          </div>
        )}

        {/* Já distribuído */}
        {alreadyDistributed && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              <p className="text-sm">
                <b className="text-green-600 dark:text-green-400">Distribuído hoje:</b>{" "}
                {formatCurrency(distributedTotal)}
              </p>
            </div>
            {todayDistribution.map((d) => {
              const goal = goals.find((g) => g.id === d.goal_id);
              return (
                <div
                  key={d.goal_id}
                  className="flex items-center justify-between p-3 rounded-lg bg-card border border-border/50"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{goal?.icon || "🎯"}</span>
                    <div>
                      <p className="font-semibold text-sm">{goal?.name || "Meta"}</p>
                      <Badge variant="secondary" className="text-[10px] mt-1">
                        {Number(d.percentual).toFixed(0)}%
                      </Badge>
                    </div>
                  </div>
                  <p className="font-bold text-primary whitespace-nowrap">
                    {formatCurrency(Number(d.amount))}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
