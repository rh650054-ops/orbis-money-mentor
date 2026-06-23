import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/shared/ui/card";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/shared/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/tabs";
import { useToast } from "@/shared/hooks/use-toast";
import { Skeleton } from "@/shared/ui/skeleton";
import { Progress } from "@/shared/ui/progress";
import AutoDistribution from "@/components/AutoDistribution";
import FeatureErrorBoundary from "@/shared/components/feature-error-boundary";
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  Plus,
  Trash2,
  Target,
  AlertCircle,
  Calendar,
  Check,
  ImagePlus,
  BarChart3
} from "lucide-react";
import { formatCurrency } from "@/shared/lib/utils";
import { getBrazilDate } from "@/shared/lib/date-utils";
import { useRefetchOnFocus } from "@/shared/hooks/use-refetch-on-focus";

interface PlannedBill {
  id: string;
  name: string;
  amount: number;
  due_date: string | null;
  saved_amount: number;
  paid: boolean;
}

interface Goal {
  id: string;
  name: string;
  target_amount: number;
  current_amount: number;
  deadline?: string;
  status: string;
  icon: string;
}

interface FinancialSummary {
  totalProfit: number;
  totalReinvestment: number;
  // Hoje
  grossToday: number;
  costToday: number;
  transportToday: number;
  foodToday: number;
  debtToday: number;
  netToday: number;
  // Mês
  monthlyNetProfit: number;
}

export default function Finances() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { toast } = useToast();
  const [bills, setBills] = useState<PlannedBill[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [summary, setSummary] = useState<FinancialSummary>({
    totalProfit: 0,
    totalReinvestment: 0,
    grossToday: 0,
    costToday: 0,
    transportToday: 0,
    foodToday: 0,
    debtToday: 0,
    netToday: 0,
    monthlyNetProfit: 0,
  });
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isAddBillOpen, setIsAddBillOpen] = useState(false);
  const [isAddGoalOpen, setIsAddGoalOpen] = useState(false);

  // Form state for new planned bill (Contas a pagar)
  const [newBill, setNewBill] = useState({
    name: "",
    amount: "",
    due_date: "",
  });

  // Form states for new goal
  const [newGoal, setNewGoal] = useState({
    name: "",
    target_amount: "",
    deadline: "",
    icon: "🎯"
  });
  const [goalImage, setGoalImage] = useState<File | null>(null);
  const [goalImagePreview, setGoalImagePreview] = useState<string>("");

  // Deposit state for goals
  const [depositInputs, setDepositInputs] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
      return;
    }
    if (user) {
      loadFinancialData();
    }
  }, [user, loading, navigate]);

  // Recarrega ao voltar o foco pra tela (ex.: retorno do relatório/lançamento)
  // para nunca mostrar valores antigos.
  useRefetchOnFocus(() => {
    if (user) loadFinancialData();
  });

  const loadFinancialData = async () => {
    if (!user) return;

    setIsLoadingData(true);

    try {
      // Load planned bills (Contas a pagar): não pagas primeiro, depois por vencimento
      const { data: billsData, error: billsError } = await supabase
        .from("planned_bills")
        .select("id, name, amount, due_date, saved_amount, paid")
        .eq("user_id", user.id)
        .order("paid", { ascending: true })
        .order("due_date", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: true });

      if (billsError) throw billsError;
      setBills((billsData || []) as PlannedBill[]);

      // Load goals
      const { data: goalsData, error: goalsError } = await supabase
        .from("financial_goals")
        .select("*")
        .eq("user_id", user.id)
        .eq("status", "active")
        .order("created_at", { ascending: false });

      if (goalsError) throw goalsError;
      setGoals((goalsData || []) as Goal[]);

      // Calculate financial summary
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth() + 1;
      const lastDay = new Date(year, month, 0).getDate(); // Get last day of month
      const currentMonth = `${year}-${String(month).padStart(2, '0')}`;

      const { data: salesData, error: salesError } = await supabase
        .from("daily_sales")
        .select("date, total_profit, cost, reinvestment, cash_sales, pix_sales, card_sales, total_debt, transport_cost, food_cost")
        .eq("user_id", user.id)
        .gte("date", `${currentMonth}-01`)
        .lte("date", `${currentMonth}-${String(lastDay).padStart(2, '0')}`);

      if (salesError) throw salesError;

      // Bruto do mês com o MESMO fallback robusto por dia: Total Vendido,
      // ou soma dos métodos de pagamento quando o Total Vendido vier zerado.
      const totalProfit = salesData?.reduce((sum, s) => {
        const payments =
          (Number(s.cash_sales) || 0) +
          (Number(s.pix_sales) || 0) +
          (Number(s.card_sales) || 0);
        const dayGross = Number(s.total_profit) > 0 ? Number(s.total_profit) : payments;
        return sum + dayGross;
      }, 0) || 0;
      const totalCostMonth = salesData?.reduce((sum, s) => sum + (Number(s.cost) || 0), 0) || 0;
      const totalTransportMonth = salesData?.reduce((sum, s) => sum + (Number(s.transport_cost) || 0), 0) || 0;
      const totalFoodMonth = salesData?.reduce((sum, s) => sum + (Number(s.food_cost) || 0), 0) || 0;
      const totalReinvestment = salesData?.reduce((sum, s) => sum + (Number(s.reinvestment) || 0), 0) || 0;

      // Hoje (UTC-3)
      const today = getBrazilDate();
      const todaySale = salesData?.find((s) => s.date === today);
      // BRUTO robusto: usa "Total Vendido" (total_profit); se vier zerado, cai
      // pra soma dos métodos de pagamento. Corrige o bug em que lançar só o
      // Total Vendido deixava o bruto em R$0.
      const paymentsToday =
        Number(todaySale?.cash_sales || 0) +
        Number(todaySale?.pix_sales || 0) +
        Number(todaySale?.card_sales || 0);
      const grossToday =
        Number(todaySale?.total_profit) > 0 ? Number(todaySale?.total_profit) : paymentsToday;
      const costToday = Number(todaySale?.cost || 0);
      const transportToday = Number(todaySale?.transport_cost || 0);
      const foodToday = Number(todaySale?.food_cost || 0);
      const debtToday = Number(todaySale?.total_debt || 0);
      // LÍQUIDO = BRUTO − MERCADORIA − TRANSPORTE − ALIMENTAÇÃO (calote NÃO entra).
      // Pode ficar negativo (dia de prejuízo), igual à planilha.
      const netToday = grossToday - costToday - transportToday - foodToday;

      // Lucro líquido do mês = faturamento − mercadoria (CMV) − transporte − alimentação.
      // Calote NÃO entra; permite negativo.
      const monthlyNetProfit = totalProfit - totalCostMonth - totalTransportMonth - totalFoodMonth;

      setSummary({
        totalProfit,
        totalReinvestment,
        grossToday,
        costToday,
        transportToday,
        foodToday,
        debtToday,
        netToday,
        monthlyNetProfit,
      });

    } catch (error) {
      console.error("Error loading financial data:", error);
      toast({
        title: "Erro ao carregar dados",
        description: "Não foi possível carregar suas informações financeiras",
        variant: "destructive"
      });
    } finally {
      setIsLoadingData(false);
    }
  };

  const handleAddBill = async () => {
    if (!user || !newBill.name || !newBill.amount) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha o nome e o valor da conta",
        variant: "destructive"
      });
      return;
    }

    try {
      const { error } = await supabase
        .from("planned_bills")
        .insert({
          user_id: user.id,
          name: newBill.name,
          amount: parseFloat(newBill.amount),
          due_date: newBill.due_date || null,
          saved_amount: 0,
          paid: false,
        });

      if (error) throw error;

      toast({
        title: "Conta adicionada!",
        description: `${newBill.name} entrou no seu planejamento`,
      });

      setNewBill({ name: "", amount: "", due_date: "" });
      setIsAddBillOpen(false);
      loadFinancialData();
    } catch (error) {
      console.error("Error adding bill:", error);
      toast({
        title: "Erro ao adicionar conta",
        description: "Tente novamente mais tarde",
        variant: "destructive"
      });
    }
  };

  const handleDepositBill = async (bill: PlannedBill) => {
    const raw = prompt(`Quanto você guardou para "${bill.name}"? (R$)`);
    if (raw === null) return;
    const value = parseFloat(raw.replace(",", "."));
    if (isNaN(value) || value <= 0) {
      toast({
        title: "Valor inválido",
        description: "Digite um valor maior que zero",
        variant: "destructive"
      });
      return;
    }

    try {
      const newSaved = Number(bill.saved_amount) + value;
      const { error } = await supabase
        .from("planned_bills")
        .update({ saved_amount: newSaved })
        .eq("id", bill.id);

      if (error) throw error;

      toast({
        title: "Guardado!",
        description: `${formatCurrency(value)} reservado para ${bill.name}`,
      });
      loadFinancialData();
    } catch (error) {
      console.error("Error depositing into bill:", error);
      toast({ title: "Erro ao guardar", variant: "destructive" });
    }
  };

  const handleToggleBillPaid = async (bill: PlannedBill) => {
    try {
      const { error } = await supabase
        .from("planned_bills")
        .update({ paid: !bill.paid })
        .eq("id", bill.id);

      if (error) throw error;

      toast({
        title: bill.paid ? "Conta reaberta" : "Conta quitada ✓",
        description: bill.paid
          ? `${bill.name} voltou para as contas a pagar`
          : `${bill.name} marcada como paga`,
      });
      loadFinancialData();
    } catch (error) {
      console.error("Error toggling bill paid:", error);
      toast({ title: "Erro ao atualizar conta", variant: "destructive" });
    }
  };

  const handleDeleteBill = async (bill: PlannedBill) => {
    if (!confirm(`Tem certeza que deseja excluir a conta "${bill.name}"?`)) return;
    try {
      const { error } = await supabase
        .from("planned_bills")
        .delete()
        .eq("id", bill.id);

      if (error) throw error;

      toast({ title: "Conta removida", description: `"${bill.name}" foi excluída.` });
      loadFinancialData();
    } catch (error) {
      console.error("Error deleting bill:", error);
      toast({ title: "Erro ao remover conta", variant: "destructive" });
    }
  };

  const handleAddGoal = async () => {
    if (!user || !newGoal.name || !newGoal.target_amount) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha o nome e o valor da meta",
        variant: "destructive"
      });
      return;
    }

    try {
      let iconValue = newGoal.icon;
      if (goalImage) {
        const ext = goalImage.name.split(".").pop() || "jpg";
        const path = `${user.id}/goals/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("community-media")
          .upload(path, goalImage, { upsert: false });
        if (!upErr) {
          iconValue = supabase.storage.from("community-media").getPublicUrl(path).data.publicUrl;
        }
      }

      const { error } = await supabase
        .from("financial_goals")
        .insert({
          user_id: user.id,
          name: newGoal.name,
          target_amount: parseFloat(newGoal.target_amount),
          current_amount: 0,
          deadline: newGoal.deadline || null,
          icon: iconValue,
          status: "active"
        });

      if (error) throw error;

      toast({
        title: "Meta criada!",
        description: `${newGoal.name} adicionada com sucesso`,
      });

      setNewGoal({ name: "", target_amount: "", deadline: "", icon: "🎯" });
      setGoalImage(null);
      setGoalImagePreview("");
      setIsAddGoalOpen(false);
      loadFinancialData();
    } catch (error) {
      console.error("Error adding goal:", error);
      toast({
        title: "Erro ao criar meta",
        variant: "destructive"
      });
    }
  };

  const handleAddDeposit = async (goalId: string) => {
    const amount = depositInputs[goalId];
    if (!amount || parseFloat(amount) <= 0) {
      toast({
        title: "Valor inválido",
        description: "Digite um valor maior que zero",
        variant: "destructive"
      });
      return;
    }

    const goal = goals.find(g => g.id === goalId);
    if (!goal) return;

    try {
      const newAmount = goal.current_amount + parseFloat(amount);
      const newStatus = newAmount >= goal.target_amount ? "completed" : "active";

      const { error } = await supabase
        .from("financial_goals")
        .update({
          current_amount: newAmount,
          status: newStatus
        })
        .eq("id", goalId);

      if (error) throw error;

      if (newStatus === "completed") {
        toast({
          title: "🎉 Meta alcançada!",
          description: `Parabéns! Você completou a meta ${goal.name}!`,
        });
      } else {
        toast({
          title: "Depósito realizado!",
          description: `R$ ${parseFloat(amount).toFixed(2)} adicionado à meta`,
        });
      }

      setDepositInputs(prev => ({ ...prev, [goalId]: "" }));
      loadFinancialData();
    } catch (error) {
      console.error("Error adding deposit:", error);
      toast({
        title: "Erro ao adicionar depósito",
        variant: "destructive"
      });
    }
  };

  const handleDeleteGoal = async (goalId: string) => {
    if (!user) return;
    const goal = goals.find(g => g.id === goalId);
    if (!goal) return;
    if (!confirm(`Tem certeza que deseja excluir a meta "${goal.name}"?`)) return;
    try {
      const { error } = await supabase.from("financial_goals").delete().eq("id", goalId);
      if (error) throw error;
      toast({ title: "Meta excluída", description: `A meta "${goal.name}" foi removida com sucesso.` });
      loadFinancialData();
    } catch (error) {
      console.error("Error deleting goal:", error);
      toast({ title: "Erro ao excluir meta", description: "Não foi possível excluir a meta.", variant: "destructive" });
    }
  };

  if (loading || !user) {
    return null;
  }

  return (
    <div className="space-y-6 pb-4 md:pb-8">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
          <Wallet className="w-5 h-5 text-primary" />
        </div>
        <h1 className="text-3xl font-bold text-foreground tracking-tight">Minhas Finanças</h1>
      </div>

      {/* Resumo do dia */}
      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">Resumo de hoje</p>
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="card-gradient-border">
            <CardContent className="pt-6">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm text-muted-foreground">Vendido hoje</p>
                  <div className="text-2xl font-bold text-success whitespace-nowrap">
                    {isLoadingData ? <Skeleton className="h-8 w-24" /> : formatCurrency(summary.grossToday)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">dinheiro + pix + cartão</p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-success/10 border border-success/20 flex items-center justify-center shrink-0">
                  <TrendingUp className="w-5 h-5 text-success" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="card-gradient-border">
            <CardContent className="pt-6">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm text-muted-foreground">Custos do dia</p>
                  <div className="text-2xl font-bold text-destructive whitespace-nowrap">
                    {isLoadingData ? <Skeleton className="h-8 w-24" /> : `-${formatCurrency(summary.costToday + summary.transportToday + summary.foodToday)}`}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">mercadoria + transporte + alimentação</p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-destructive/10 border border-destructive/20 flex items-center justify-center shrink-0">
                  <TrendingDown className="w-5 h-5 text-destructive" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="card-gradient-border bg-gradient-to-br from-primary/10 to-primary/5">
            <CardContent className="pt-6">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm text-muted-foreground">Lucro líquido do dia</p>
                  <div className={`text-3xl font-bold whitespace-nowrap ${summary.netToday < 0 ? "text-destructive" : "text-primary"}`}>
                    {isLoadingData ? <Skeleton className="h-9 w-28" /> : formatCurrency(summary.netToday)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">bruto − mercadoria − transporte − alimentação</p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center shrink-0">
                  <Wallet className="w-5 h-5 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Fiado / não pago do dia — informativo, não entra no líquido */}
      {!isLoadingData && summary.debtToday > 0 && (
        <div className="flex items-center gap-2 rounded-xl border border-warning/20 bg-warning/5 px-3 py-2 -mt-2">
          <AlertCircle className="w-4 h-4 text-warning shrink-0" />
          <p className="text-sm text-muted-foreground">
            Fiado/não pago hoje: <span className="font-semibold text-warning">{formatCurrency(summary.debtToday)}</span>{" "}
            <span className="text-xs">· não entra no líquido</span>
          </p>
        </div>
      )}

      {/* Distribuição automática do líquido diário */}
      <FeatureErrorBoundary title="A distribuição automática deu uma travada">
        <AutoDistribution userId={user.id} onChanged={loadFinancialData} />
      </FeatureErrorBoundary>

      {/* Atalho pro relatório completo (gráficos, filtros e análise de período) */}
      <Button
        variant="outline"
        className="w-full"
        onClick={() => navigate("/insights")}
      >
        <BarChart3 className="w-4 h-4 mr-2" />
        Ver relatório completo
      </Button>

      <Tabs defaultValue="bills" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="bills">Contas a pagar</TabsTrigger>
          <TabsTrigger value="goals">Metas</TabsTrigger>
        </TabsList>

        {/* Contas a pagar — planejador (planned_bills) */}
        <TabsContent value="bills" className="space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <h2 className="text-xl font-semibold">Contas a pagar</h2>
              <p className="text-sm text-muted-foreground">
                Planeje quanto guardar por dia pra cada conta chegar paga.
              </p>
            </div>
            <Dialog open={isAddBillOpen} onOpenChange={setIsAddBillOpen}>
              <DialogTrigger asChild>
                <Button className="w-full sm:w-auto">
                  <Plus className="w-4 h-4 mr-2" />
                  Nova conta
                </Button>
              </DialogTrigger>
              <DialogContent className="w-[calc(100vw-2rem)] max-w-md p-4 sm:p-6">
                <DialogHeader>
                  <DialogTitle>Nova conta a pagar</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label>Nome da conta</Label>
                    <Input
                      value={newBill.name}
                      onChange={(e) => setNewBill({ ...newBill, name: e.target.value })}
                      placeholder="Ex: Aluguel, Luz, Internet..."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Valor (R$)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={newBill.amount}
                      onChange={(e) => setNewBill({ ...newBill, amount: e.target.value })}
                      placeholder="0,00"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Data de vencimento</Label>
                    <Input
                      type="date"
                      value={newBill.due_date}
                      onChange={(e) => setNewBill({ ...newBill, due_date: e.target.value })}
                    />
                  </div>
                  <div className="flex flex-col-reverse sm:flex-row gap-2 pt-2">
                    <Button variant="outline" onClick={() => setIsAddBillOpen(false)} className="w-full sm:flex-1">
                      Voltar
                    </Button>
                    <Button onClick={handleAddBill} className="w-full sm:flex-1">
                      Adicionar conta
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {isLoadingData ? (
            <div className="space-y-2">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : bills.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center text-muted-foreground">
                Nenhuma conta cadastrada ainda. Toque em "Nova conta" pra planejar seus pagamentos.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {bills.map((bill) => {
                const amount = Number(bill.amount) || 0;
                const saved = Number(bill.saved_amount) || 0;
                const remaining = Math.max(0, amount - saved);
                const progress = amount > 0 ? Math.min(100, (saved / amount) * 100) : 0;
                const quitada = bill.paid || saved >= amount;

                // Dias até o vencimento (parse ao meio-dia UTC evita erro de fuso/DST)
                let daysLeft: number | null = null;
                if (bill.due_date) {
                  const msPerDay = 1000 * 60 * 60 * 24;
                  const todayMs = new Date(getBrazilDate() + "T12:00:00Z").getTime();
                  const dueMs = new Date(bill.due_date + "T12:00:00Z").getTime();
                  daysLeft = Math.ceil((dueMs - todayMs) / msPerDay);
                }
                const perDay = remaining / Math.max(1, daysLeft ?? 1);

                return (
                  <Card key={bill.id} className={quitada ? "border-success/30" : "card-gradient-border"}>
                    <CardContent className="pt-6 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-semibold">{bill.name}</p>
                          <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-muted-foreground">
                            <span>Valor: <span className="font-medium text-foreground">{formatCurrency(amount)}</span></span>
                            {bill.due_date && (
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                Vence {new Date(bill.due_date + "T12:00:00Z").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
                              </span>
                            )}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteBill(bill)}
                          aria-label="Excluir conta"
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground whitespace-nowrap">
                            {formatCurrency(saved)} guardado
                          </span>
                          <span className="font-semibold text-primary">{progress.toFixed(0)}%</span>
                        </div>
                        <Progress value={progress} className="h-2" />
                      </div>

                      {quitada ? (
                        <div className="bg-success/10 border border-success/20 rounded-lg p-2.5 flex items-center justify-center gap-2">
                          <Check className="w-4 h-4 text-success" />
                          <p className="text-success font-semibold text-sm">Quitada ✓</p>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between gap-3 rounded-lg bg-primary/5 border border-primary/20 px-3 py-2">
                          <div className="min-w-0">
                            <p className="text-xs text-muted-foreground">Guardar por dia</p>
                            <p className="text-lg font-bold text-primary whitespace-nowrap">
                              {formatCurrency(perDay)}/dia
                            </p>
                          </div>
                          <p className="text-xs text-muted-foreground text-right whitespace-nowrap">
                            {daysLeft === null
                              ? "sem prazo"
                              : daysLeft > 0
                              ? `faltam ${daysLeft} ${daysLeft === 1 ? "dia" : "dias"}`
                              : daysLeft === 0
                              ? "vence hoje"
                              : `venceu há ${Math.abs(daysLeft)} ${Math.abs(daysLeft) === 1 ? "dia" : "dias"}`}
                          </p>
                        </div>
                      )}

                      <div className="flex flex-col sm:flex-row gap-2 pt-1">
                        {!quitada && (
                          <Button
                            variant="outline"
                            onClick={() => handleDepositBill(bill)}
                            className="w-full sm:flex-1"
                          >
                            <Plus className="w-4 h-4 mr-2" />
                            Guardei
                          </Button>
                        )}
                        <Button
                          variant={bill.paid ? "outline" : "default"}
                          onClick={() => handleToggleBillPaid(bill)}
                          className="w-full sm:flex-1"
                        >
                          <Check className="w-4 h-4 mr-2" />
                          {bill.paid ? "Reabrir" : "Marcar paga"}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* Goals Tab */}
        <TabsContent value="goals" className="space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <h2 className="text-xl font-semibold">Objetivos Financeiros</h2>
              <Dialog open={isAddGoalOpen} onOpenChange={setIsAddGoalOpen}>
                <DialogTrigger asChild>
                  <Button className="w-full sm:w-auto">
                    <Plus className="w-4 h-4 mr-2" />
                    Nova Meta
                  </Button>
                </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Criar Objetivo Financeiro</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  <div>
                    <Label>Nome da Meta</Label>
                    <Input
                      value={newGoal.name}
                      onChange={(e) => setNewGoal({ ...newGoal, name: e.target.value })}
                      placeholder="Ex: Comprar moto, Juntar R$5.000..."
                    />
                  </div>
                  <div>
                    <Label>Valor Alvo (R$)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={newGoal.target_amount}
                      onChange={(e) => setNewGoal({ ...newGoal, target_amount: e.target.value })}
                      placeholder="0,00"
                    />
                  </div>
                  <div>
                    <Label>Prazo (opcional)</Label>
                    <Input
                      type="date"
                      value={newGoal.deadline}
                      onChange={(e) => setNewGoal({ ...newGoal, deadline: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Imagem da meta (opcional)</Label>
                    <label className="mt-1.5 flex items-center gap-3 cursor-pointer">
                      {goalImagePreview ? (
                        <img src={goalImagePreview} alt="" className="w-16 h-16 rounded-xl object-cover border border-border shrink-0" />
                      ) : (
                        <div className="w-16 h-16 rounded-xl border border-dashed border-border flex items-center justify-center bg-muted/40 shrink-0">
                          <ImagePlus className="w-5 h-5 text-muted-foreground" />
                        </div>
                      )}
                      <span className="text-sm text-muted-foreground">
                        {goalImagePreview ? "Trocar imagem" : "Adicione uma foto do que quer alcançar"}
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        hidden
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) { setGoalImage(f); setGoalImagePreview(URL.createObjectURL(f)); }
                        }}
                      />
                    </label>
                  </div>
                  <Button onClick={handleAddGoal} className="w-full">
                    Criar Meta
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {isLoadingData ? (
            <Skeleton className="h-40 w-full" />
          ) : goals.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center text-muted-foreground">
                Nenhuma meta financeira criada. Defina seus objetivos e acompanhe seu progresso!
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {goals.map(goal => {
                const progress = (goal.current_amount / goal.target_amount) * 100;
                const remaining = goal.target_amount - goal.current_amount;

                return (
                  <Card key={goal.id} className="card-gradient-border">
                    <CardContent className="pt-6 space-y-4">
                      <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
                        <div className="flex items-center gap-3">
                          {goal.icon && goal.icon.startsWith("http") ? (
                            <img src={goal.icon} alt="" className="w-12 h-12 rounded-2xl object-cover border border-primary/30 shrink-0" />
                          ) : (
                            <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                              <Target className="w-6 h-6 text-primary" />
                            </div>
                          )}
                          <div>
                            <p className="font-semibold text-lg">{goal.name}</p>
                            {goal.deadline && (
                              <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                                <Calendar className="w-3 h-3" />
                                Prazo: {new Date(goal.deadline).toLocaleDateString('pt-BR')}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="text-left sm:text-right w-full sm:w-auto">
                          <p className="text-sm text-muted-foreground">Meta</p>
                          <p className="text-lg font-bold text-primary whitespace-nowrap">
                            {formatCurrency(goal.target_amount)}
                          </p>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground whitespace-nowrap">
                            {formatCurrency(goal.current_amount)} depositado
                          </span>
                          <span className="font-semibold text-primary">
                            {progress.toFixed(0)}%
                          </span>
                        </div>
                        <Progress value={progress} className="h-2" />
                        {remaining > 0 && (
                          <p className="text-sm text-muted-foreground">
                            Faltam {formatCurrency(remaining)} para atingir sua meta
                          </p>
                        )}
                      </div>

                      {/* Sistema de Depósito Diário */}
                      {goal.status === "active" && (
                        <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t">
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="Quanto quer depositar hoje?"
                            value={depositInputs[goal.id] || ""}
                            onChange={(e) => setDepositInputs(prev => ({ ...prev, [goal.id]: e.target.value }))}
                            className="flex-1"
                          />
                          <div className="flex gap-2">
                            <Button
                              onClick={() => handleAddDeposit(goal.id)}
                              disabled={!depositInputs[goal.id] || parseFloat(depositInputs[goal.id]!) <= 0}
                              className="flex-1 sm:flex-none"
                            >
                              Adicionar
                            </Button>
                            <Button
                              variant="destructive"
                              size="icon"
                              onClick={() => handleDeleteGoal(goal.id)}
                              className="flex-shrink-0"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      )}

                      {goal.status === "completed" && (
                        <div className="bg-success/10 border border-success/20 rounded-lg p-3 flex items-center justify-center gap-2">
                          <Check className="w-4 h-4 text-success" />
                          <p className="text-success font-semibold">Meta concluída</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
