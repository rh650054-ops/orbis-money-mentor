import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import NumericKeyboard from "@/components/NumericKeyboard";
import AutoDistribution from "@/components/AutoDistribution";
import FeatureErrorBoundary from "@/components/FeatureErrorBoundary";
import {
  PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend
} from "recharts";
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  Plus,
  Trash2,
  Target,
  AlertCircle,
  DollarSign,
  ShoppingCart,
  Home as HomeIcon,
  Utensils,
  GraduationCap,
  Car,
  Heart,
  Sparkles,
  Calendar
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { getBrazilDate } from "@/lib/dateUtils";

interface Expense {
  id: string;
  category: string;
  name: string;
  amount: number;
  type: "fixed" | "variable";
  icon: string;
  color: string;
  date: string;
  notes?: string;
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
  totalExpenses: number;
  totalReinvestment: number;
  personalBalance: number;
  monthlyBudget: number;
  budgetRemaining: number;
  // Hoje
  grossToday: number;
  costToday: number;
  debtToday: number;
  expensesToday: number;
  netToday: number;
  // Mês
  monthlyNetProfit: number;
}

const EXPENSE_CATEGORIES = [
  { value: "food", label: "Alimentação", icon: "🍕", color: "#F59E0B" },
  { value: "housing", label: "Moradia", icon: "🏠", color: "#3B82F6" },
  { value: "transport", label: "Transporte", icon: "🚗", color: "#10B981" },
  { value: "education", label: "Educação", icon: "🧠", color: "#8B5CF6" },
  { value: "health", label: "Saúde", icon: "❤️", color: "#EF4444" },
  { value: "leisure", label: "Lazer", icon: "🎮", color: "#EC4899" },
  { value: "merchandise", label: "Mercadoria", icon: "🧃", color: "#6366F1" },
  { value: "other", label: "Outros", icon: "💰", color: "#64748B" }
];

export default function Finances() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { toast } = useToast();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [summary, setSummary] = useState<FinancialSummary>({
    totalProfit: 0,
    totalExpenses: 0,
    totalReinvestment: 0,
    personalBalance: 0,
    monthlyBudget: 0,
    budgetRemaining: 0,
    grossToday: 0,
    costToday: 0,
    debtToday: 0,
    expensesToday: 0,
    netToday: 0,
    monthlyNetProfit: 0,
  });
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isAddExpenseOpen, setIsAddExpenseOpen] = useState(false);
  const [isAddGoalOpen, setIsAddGoalOpen] = useState(false);
  const [isEditBudgetOpen, setIsEditBudgetOpen] = useState(false);
  const [budgetInput, setBudgetInput] = useState("");

  // Form states for new expense
  const [newExpense, setNewExpense] = useState({
    category: "food",
    name: "",
    amount: "",
    type: "variable" as "fixed" | "variable",
    notes: ""
  });

  // Form states for new goal
  const [newGoal, setNewGoal] = useState({
    name: "",
    target_amount: "",
    deadline: "",
    icon: "🎯"
  });

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

  const loadFinancialData = async () => {
    if (!user) return;
    
    setIsLoadingData(true);
    
    try {
      // Load expenses
      const { data: expensesData, error: expensesError } = await supabase
        .from("personal_expenses")
        .select("*")
        .eq("user_id", user.id)
        .order("date", { ascending: false });

      if (expensesError) throw expensesError;
      setExpenses((expensesData || []) as Expense[]);

      // Load goals
      const { data: goalsData, error: goalsError } = await supabase
        .from("financial_goals")
        .select("*")
        .eq("user_id", user.id)
        .eq("status", "active")
        .order("created_at", { ascending: false });

      if (goalsError) throw goalsError;
      setGoals(goalsData || []);

      // Calculate financial summary
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth() + 1;
      const lastDay = new Date(year, month, 0).getDate(); // Get last day of month
      const currentMonth = `${year}-${String(month).padStart(2, '0')}`;
      
      const { data: salesData, error: salesError } = await supabase
        .from("daily_sales")
        .select("date, total_profit, cost, reinvestment, cash_sales, pix_sales, card_sales, total_debt")
        .eq("user_id", user.id)
        .gte("date", `${currentMonth}-01`)
        .lte("date", `${currentMonth}-${String(lastDay).padStart(2, '0')}`);

      if (salesError) throw salesError;

      // Load monthly budget from profile
      const { data: profileData } = await supabase
        .from("profiles")
        .select("monthly_goal")
        .eq("user_id", user.id)
        .single();

      const monthlyBudget = profileData?.monthly_goal || 0;

      const totalProfit = salesData?.reduce((sum, s) => sum + (Number(s.total_profit) || 0), 0) || 0;
      const totalReinvestment = salesData?.reduce((sum, s) => sum + (Number(s.reinvestment) || 0), 0) || 0;
      const totalExpenses = expensesData?.reduce((sum, e) => {
        if (e.date.startsWith(currentMonth)) {
          return sum + (Number(e.amount) || 0);
        }
        return sum;
      }, 0) || 0;

      // Hoje (UTC-3)
      const today = getBrazilDate();
      const todaySale = salesData?.find((s) => s.date === today);
      const grossToday =
        Number(todaySale?.cash_sales || 0) +
        Number(todaySale?.pix_sales || 0) +
        Number(todaySale?.card_sales || 0);
      const costToday = Number(todaySale?.cost || 0);
      const debtToday = Number(todaySale?.total_debt || 0);
      const expensesToday = (expensesData || []).reduce(
        (sum, e: any) => (e.date === today ? sum + (Number(e.amount) || 0) : sum),
        0
      );
      const netToday = Math.max(0, grossToday - costToday - debtToday - expensesToday);

      // Lucro líquido do mês (já desconta despesas pessoais do mês)
      const monthlyNetProfit = Math.max(0, totalProfit - totalExpenses);

      setSummary({
        totalProfit,
        totalExpenses,
        totalReinvestment,
        personalBalance: totalProfit - totalExpenses - totalReinvestment,
        monthlyBudget,
        budgetRemaining: monthlyBudget - totalExpenses,
        grossToday,
        costToday: costToday + debtToday,
        debtToday,
        expensesToday,
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

  const handleAddExpense = async () => {
    if (!user || !newExpense.name || !newExpense.amount) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha o nome e o valor da despesa",
        variant: "destructive"
      });
      return;
    }

    const selectedCategory = EXPENSE_CATEGORIES.find(c => c.value === newExpense.category);

    try {
      const { error } = await supabase
        .from("personal_expenses")
        .insert({
          user_id: user.id,
          category: newExpense.category,
          name: newExpense.name,
          amount: parseFloat(newExpense.amount),
          type: newExpense.type,
          icon: selectedCategory?.icon || "💰",
          color: selectedCategory?.color || "#3B82F6",
          notes: newExpense.notes || null
        });

      if (error) throw error;

      toast({
        title: "Despesa adicionada!",
        description: `${selectedCategory?.icon} ${newExpense.name} registrada com sucesso`,
      });

      setNewExpense({ category: "food", name: "", amount: "", type: "variable", notes: "" });
      setIsAddExpenseOpen(false);
      loadFinancialData();
    } catch (error) {
      console.error("Error adding expense:", error);
      toast({
        title: "Erro ao adicionar despesa",
        description: "Tente novamente mais tarde",
        variant: "destructive"
      });
    }
  };

  const handleDeleteExpense = async (id: string) => {
    try {
      const { error } = await supabase
        .from("personal_expenses")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Despesa removida",
        description: "A despesa foi excluída com sucesso",
      });

      loadFinancialData();
    } catch (error) {
      console.error("Error deleting expense:", error);
      toast({
        title: "Erro ao remover despesa",
        variant: "destructive"
      });
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
      const { error } = await supabase
        .from("financial_goals")
        .insert({
          user_id: user.id,
          name: newGoal.name,
          target_amount: parseFloat(newGoal.target_amount),
          current_amount: 0,
          deadline: newGoal.deadline || null,
          icon: newGoal.icon,
          status: "active"
        });

      if (error) throw error;

      toast({
        title: "Meta criada!",
        description: `${newGoal.icon} ${newGoal.name} adicionada com sucesso`,
      });

      setNewGoal({ name: "", target_amount: "", deadline: "", icon: "🎯" });
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

  const handleUpdateBudget = async () => {
    if (!user || !budgetInput) return;

    try {
      const { error } = await supabase
        .from("profiles")
        .update({ monthly_goal: parseFloat(budgetInput) })
        .eq("user_id", user.id);

      if (error) throw error;

      toast({
        title: "Orçamento atualizado!",
        description: `Seu orçamento mensal agora é ${formatCurrency(parseFloat(budgetInput))}`,
      });

      setBudgetInput("");
      setIsEditBudgetOpen(false);
      loadFinancialData();
    } catch (error) {
      console.error("Error updating budget:", error);
      toast({
        title: "Erro ao atualizar orçamento",
        variant: "destructive"
      });
    }
  };

  const handleNumberClick = (num: string) => {
    setNewExpense({ ...newExpense, amount: newExpense.amount + num });
  };

  const handleDelete = () => {
    setNewExpense({ ...newExpense, amount: newExpense.amount.slice(0, -1) });
  };

  const handleClear = () => {
    setNewExpense({ ...newExpense, amount: "" });
  };

  const handleBudgetNumberClick = (num: string) => {
    setBudgetInput(budgetInput + num);
  };

  const handleBudgetDelete = () => {
    setBudgetInput(budgetInput.slice(0, -1));
  };

  const handleBudgetClear = () => {
    setBudgetInput("");
  };

  const getCategoryData = () => {
    const categoryTotals: { [key: string]: number } = {};
    
    expenses.forEach(expense => {
      if (!categoryTotals[expense.category]) {
        categoryTotals[expense.category] = 0;
      }
      categoryTotals[expense.category] += Number(expense.amount);
    });

    return Object.entries(categoryTotals).map(([category, amount]) => {
      const cat = EXPENSE_CATEGORIES.find(c => c.value === category);
      return {
        name: cat?.label || category,
        value: amount,
        color: cat?.color || "#3B82F6"
      };
    });
  };

  if (loading || !user) {
    return null;
  }

  const categoryData = getCategoryData();
  const expensePercentage = summary.totalProfit > 0 
    ? (summary.totalExpenses / summary.totalProfit) * 100 
    : 0;
  
  const budgetPercentage = summary.monthlyBudget > 0
    ? (summary.totalExpenses / summary.monthlyBudget) * 100
    : 0;

  const getBudgetColor = () => {
    if (budgetPercentage < 60) return "text-green-500";
    if (budgetPercentage < 90) return "text-yellow-500";
    return "text-red-500";
  };

  return (
    <div className="space-y-6 pb-4 md:pb-8">
      <div>
        <h1 className="text-3xl font-bold gradient-text">💰 Minhas Finanças</h1>
        <p className="text-muted-foreground mt-1">
          Controle total do seu dinheiro — quanto ganhou, gastou e guardou
        </p>
      </div>

      {/* Resumo do dia */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="card-gradient-border">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Lucro do dia</p>
                <div className="text-2xl font-bold text-green-500 whitespace-nowrap">
                  {isLoadingData ? <Skeleton className="h-8 w-24" /> : formatCurrency(summary.grossToday)}
                </div>
              </div>
              <TrendingUp className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="card-gradient-border">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Custos do dia</p>
                <div className="text-2xl font-bold text-red-500 whitespace-nowrap">
                  {isLoadingData ? <Skeleton className="h-8 w-24" /> : `-${formatCurrency(summary.costToday + summary.expensesToday)}`}
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">
                  mercadoria + calotes + despesas
                </p>
              </div>
              <TrendingDown className="w-8 h-8 text-red-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="card-gradient-border bg-gradient-to-br from-primary/10 to-primary/5">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">💎 Lucro líquido do dia</p>
                <div className="text-2xl font-bold text-primary whitespace-nowrap">
                  {isLoadingData ? <Skeleton className="h-8 w-24" /> : formatCurrency(summary.netToday)}
                </div>
              </div>
              <Wallet className="w-8 h-8 text-primary" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Meta Mensal */}
      {(() => {
        const goalPct = summary.monthlyBudget > 0
          ? (summary.monthlyNetProfit / summary.monthlyBudget) * 100
          : 0;
        const remainingToGoal = Math.max(0, summary.monthlyBudget - summary.monthlyNetProfit);
        const goalColor =
          goalPct >= 100 ? "text-green-500" : goalPct >= 60 ? "text-primary" : "text-yellow-500";
        return (
          <Card className="card-gradient-border bg-gradient-to-br from-primary/5 to-secondary/5">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Target className="w-5 h-5 text-primary" />
                  Meta Mensal
                </CardTitle>
                <Dialog open={isEditBudgetOpen} onOpenChange={setIsEditBudgetOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm">
                      Editar
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Definir Meta Mensal</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-4">
                      <div>
                        <Label>Valor da meta (R$)</Label>
                        <div className="mt-2 p-4 bg-muted rounded-lg">
                          <p className="text-3xl font-bold text-center">
                            R$ {budgetInput || "0.00"}
                          </p>
                        </div>
                      </div>
                      <NumericKeyboard
                        onNumberClick={handleBudgetNumberClick}
                        onDelete={handleBudgetDelete}
                        onClear={handleBudgetClear}
                      />
                      <Button onClick={handleUpdateBudget} className="w-full">
                        Salvar meta
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Meta do mês</p>
                    <p className="text-2xl font-bold whitespace-nowrap">
                      {formatCurrency(summary.monthlyBudget)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">
                      {goalPct >= 100 ? "Meta batida 🎉" : "Faltam"}
                    </p>
                    <p className={`text-2xl font-bold whitespace-nowrap ${goalColor}`}>
                      {goalPct >= 100 ? formatCurrency(summary.monthlyNetProfit) : formatCurrency(remainingToGoal)}
                    </p>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Progresso (líquido do mês)</span>
                    <span className={`font-bold ${goalColor}`}>
                      {goalPct.toFixed(0)}%
                    </span>
                  </div>
                  <Progress
                    value={Math.min(goalPct, 100)}
                    className="h-3"
                  />
                </div>
                {summary.monthlyBudget === 0 && (
                  <div className="flex items-start gap-2 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                    <AlertCircle className="w-4 h-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-yellow-600 dark:text-yellow-400">
                      Defina sua meta mensal pra acompanhar o quanto você já avançou.
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })()}

      {/* Distribuição automática do líquido diário */}
      <FeatureErrorBoundary title="A distribuição automática deu uma travada">
        <AutoDistribution userId={user.id} onChanged={loadFinancialData} />
      </FeatureErrorBoundary>

      <Tabs defaultValue="expenses" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="expenses">Despesas</TabsTrigger>
          <TabsTrigger value="goals">Metas</TabsTrigger>
          <TabsTrigger value="analytics">Análises</TabsTrigger>
        </TabsList>

        {/* Expenses Tab */}
        <TabsContent value="expenses" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Despesas Pessoais</h2>
            <Dialog open={isAddExpenseOpen} onOpenChange={setIsAddExpenseOpen}>
              <DialogTrigger asChild>
                <Button className="w-full sm:w-auto">
                  <Plus className="w-4 h-4 mr-2" />
                  Nova Despesa
                </Button>
              </DialogTrigger>
              <DialogContent className="max-h-[90vh] overflow-y-auto w-[calc(100vw-2rem)] max-w-md sm:max-w-lg p-4 sm:p-6">
                <DialogHeader>
                  <DialogTitle>Adicionar Despesa</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  <div>
                    <Label>Categoria</Label>
                    <Select
                      value={newExpense.category}
                      onValueChange={(value) => setNewExpense({ ...newExpense, category: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {EXPENSE_CATEGORIES.map(cat => (
                          <SelectItem key={cat.value} value={cat.value}>
                            {cat.icon} {cat.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Nome da Despesa</Label>
                    <Input
                      value={newExpense.name}
                      onChange={(e) => setNewExpense({ ...newExpense, name: e.target.value })}
                      placeholder="Ex: Aluguel, Mercado, Gasolina..."
                    />
                  </div>
                  <div>
                    <Label>Valor (R$)</Label>
                    <div className="mt-2 p-4 bg-muted rounded-lg">
                      <p className="text-3xl font-bold text-center">
                        R$ {newExpense.amount || "0.00"}
                      </p>
                    </div>
                  </div>
                  <NumericKeyboard
                    onNumberClick={handleNumberClick}
                    onDelete={handleDelete}
                    onClear={handleClear}
                  />
                  <div>
                    <Label>Tipo</Label>
                    <Select
                      value={newExpense.type}
                      onValueChange={(value: "fixed" | "variable") => setNewExpense({ ...newExpense, type: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="fixed">Fixa (todo mês)</SelectItem>
                        <SelectItem value="variable">Variável (eventual)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Observações (opcional)</Label>
                    <Input
                      value={newExpense.notes}
                      onChange={(e) => setNewExpense({ ...newExpense, notes: e.target.value })}
                      placeholder="Detalhes adicionais..."
                    />
                  </div>
                  <div className="flex flex-col-reverse sm:flex-row gap-2 pt-2">
                    <Button variant="outline" onClick={() => setIsAddExpenseOpen(false)} className="w-full sm:flex-1">
                      Voltar
                    </Button>
                    <Button onClick={handleAddExpense} className="w-full sm:flex-1">
                      Adicionar Despesa
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {isLoadingData ? (
            <div className="space-y-2">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : expenses.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center text-muted-foreground">
                Nenhuma despesa registrada ainda. Comece adicionando suas primeiras despesas!
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {expenses.map(expense => (
                <Card key={expense.id} className="hover:shadow-lg transition-shadow">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div 
                          className="w-10 h-10 rounded-full flex items-center justify-center text-xl"
                          style={{ backgroundColor: `${expense.color}20` }}
                        >
                          {expense.icon}
                        </div>
                        <div>
                          <p className="font-semibold">{expense.name}</p>
                          <div className="flex gap-2 items-center mt-1">
                            <Badge variant={expense.type === "fixed" ? "default" : "secondary"} className="text-xs">
                              {expense.type === "fixed" ? "Fixa" : "Variável"}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {new Date(expense.date).toLocaleDateString('pt-BR')}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <p className="text-lg font-bold text-red-500 whitespace-nowrap">
                          {formatCurrency(-Number(expense.amount))}
                        </p>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteExpense(expense.id)}
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </div>
                    </div>
                    {expense.notes && (
                      <p className="text-sm text-muted-foreground mt-2 ml-13">
                        {expense.notes}
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))}
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
                    <Label>Ícone</Label>
                    <Input
                      value={newGoal.icon}
                      onChange={(e) => setNewGoal({ ...newGoal, icon: e.target.value })}
                      placeholder="🎯"
                    />
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
                          <div className="text-3xl">{goal.icon}</div>
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
                            Faltam {formatCurrency(remaining)} para atingir sua meta 🔥
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
                              disabled={!depositInputs[goal.id] || parseFloat(depositInputs[goal.id]) <= 0}
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
                        <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3 text-center">
                          <p className="text-green-600 dark:text-green-400 font-semibold">
                            🎉 Meta Concluída!
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="space-y-4">
          <h2 className="text-xl font-semibold">Análise Financeira</h2>
          
          {categoryData.length > 0 ? (
            <Card className="card-gradient-border">
              <CardHeader>
                <CardTitle>Gastos por Categoria</CardTitle>
                <CardDescription>Distribuição das suas despesas mensais</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col items-center gap-4">
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={categoryData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {categoryData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} stroke="hsl(var(--card))" strokeWidth={2} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          background: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: 8,
                          color: "hsl(var(--foreground))",
                        }}
                        formatter={(value: number) => [`R$ ${Number(value).toFixed(2)}`, ""]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="w-full grid grid-cols-2 gap-x-3 gap-y-2">
                    {(() => {
                      const total = categoryData.reduce((s, c) => s + Number(c.value || 0), 0) || 1;
                      return categoryData.map((entry, index) => {
                        const pct = (Number(entry.value || 0) / total) * 100;
                        return (
                          <div key={index} className="flex items-center gap-2 min-w-0">
                            <span
                              className="w-3 h-3 rounded-sm flex-shrink-0"
                              style={{ backgroundColor: entry.color }}
                            />
                            <span className="text-xs text-foreground truncate flex-1">{entry.name}</span>
                            <span className="text-xs font-semibold text-foreground">{pct.toFixed(0)}%</span>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="pt-6 text-center text-muted-foreground">
                Adicione despesas para ver a análise dos seus gastos
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
