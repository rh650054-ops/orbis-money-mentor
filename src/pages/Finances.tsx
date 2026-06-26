import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/shared/ui/card";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { MoneyInput } from "@/shared/ui/money-input";
import { Textarea } from "@/shared/ui/textarea";
import { Label } from "@/shared/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/shared/ui/dialog";
import { Switch } from "@/shared/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/tabs";
import { useToast } from "@/shared/hooks/use-toast";
import { Skeleton } from "@/shared/ui/skeleton";
import { Progress } from "@/shared/ui/progress";
import AutoDistribution from "@/components/AutoDistribution";
import FeatureErrorBoundary from "@/shared/components/feature-error-boundary";
import {
  Wallet,
  Plus,
  Trash2,
  Target,
  Calendar,
  Check,
  ImagePlus,
  Pencil,
  Sparkles,
  PiggyBank,
  AlertTriangle,
  RotateCw,
  Copy,
  Paperclip,
  FileText,
  Download,
  PartyPopper,
  Loader2,
  CreditCard
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
  recurring: boolean;
  payment_code: string | null;
  file_path: string | null;
  is_credit_card?: boolean;
  installments?: number | null;
}

interface Goal {
  id: string;
  name: string;
  target_amount: number;
  current_amount: number;
  deadline?: string;
  status: string;
  icon: string;
  percentual_distribuicao?: number;
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
  expensesToday: number;
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
    expensesToday: 0,
    netToday: 0,
    monthlyNetProfit: 0,
  });
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isAddBillOpen, setIsAddBillOpen] = useState(false);
  const [isAddGoalOpen, setIsAddGoalOpen] = useState(false);

  // Dias de trabalho do perfil — usados pra dividir "guardar por dia" só nos dias úteis
  const [workingDays, setWorkingDays] = useState<string[]>([]);
  const [weeklyWorkDays, setWeeklyWorkDays] = useState<number>(0);

  // Form state for new planned bill (Contas a pagar)
  const [newBill, setNewBill] = useState({
    name: "",
    amount: "",
    due_date: "",
    recurring: false,
    payment_code: "",
    isCreditCard: false,
    cardMode: "total" as "total" | "parcela",
    installments: "",
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

  // Reusable "guardar" deposit dialog — shared por Contas a pagar (Guardei) e Metas (Guardar hoje)
  const [depositTarget, setDepositTarget] = useState<
    | { kind: "bill"; bill: PlannedBill }
    | { kind: "goal"; goal: Goal }
    | null
  >(null);
  const [depositValue, setDepositValue] = useState("");

  // Edit bill dialog state
  const [editBill, setEditBill] = useState<PlannedBill | null>(null);
  const [editBillForm, setEditBillForm] = useState({ name: "", amount: "", due_date: "", recurring: false, payment_code: "" });

  // Anexo de boleto: id da conta cujo arquivo está subindo (spinner/disabled)
  const [uploadingBillId, setUploadingBillId] = useState<string | null>(null);

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
        .select("id, name, amount, due_date, saved_amount, paid, recurring, payment_code, file_path, is_credit_card, installments")
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

      // Dias de trabalho do perfil (pra dividir "guardar por dia" só nos dias úteis)
      const { data: profileData } = await supabase
        .from("profiles")
        .select("working_days, weekly_work_days")
        .eq("user_id", user.id)
        .maybeSingle();
      setWorkingDays(
        Array.isArray(profileData?.working_days) ? (profileData!.working_days as string[]) : []
      );
      setWeeklyWorkDays(Number(profileData?.weekly_work_days) || 0);

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

      // Custos lançados no botão "Custos do dia" (personal_expenses) — do mês inteiro.
      const { data: expData } = await supabase
        .from("personal_expenses")
        .select("amount, date")
        .eq("user_id", user.id)
        .gte("date", `${currentMonth}-01`)
        .lte("date", `${currentMonth}-${String(lastDay).padStart(2, '0')}`);

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
      // Custos lançados que abatem do líquido (mês inteiro e só hoje).
      const expensesMonth = (expData || []).reduce((sum, e) => sum + (Number((e as any).amount) || 0), 0);
      const expensesToday = (expData || []).filter((e) => (e as any).date === today).reduce((sum, e) => sum + (Number((e as any).amount) || 0), 0);

      // LÍQUIDO = BRUTO − MERCADORIA − TRANSPORTE − ALIMENTAÇÃO − CUSTOS LANÇADOS (calote NÃO entra).
      // Pode ficar negativo (dia de prejuízo), igual à planilha.
      const netToday = grossToday - costToday - transportToday - foodToday - expensesToday;

      // Lucro líquido do mês = faturamento − mercadoria − transporte − alimentação − custos lançados.
      // Calote NÃO entra; permite negativo.
      const monthlyNetProfit = totalProfit - totalCostMonth - totalTransportMonth - totalFoodMonth - expensesMonth;

      setSummary({
        totalProfit,
        totalReinvestment,
        grossToday,
        costToday,
        transportToday,
        foodToday,
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

  const handleAddBill = async () => {
    if (!user || !newBill.name || !newBill.amount) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha o nome e o valor da conta",
        variant: "destructive"
      });
      return;
    }

    const parcelas = parseInt(newBill.installments) || 0;
    if (newBill.isCreditCard && newBill.cardMode === "total" && parcelas < 1) {
      toast({ title: "Informe as parcelas", description: "No cartão por total, diga em quantas vezes dividiu.", variant: "destructive" });
      return;
    }
    // Valor MENSAL no planejamento: cartão por total → divide pelas parcelas;
    // por parcela → é o próprio valor. Cartão é sempre recorrente.
    const monthly = newBill.isCreditCard && newBill.cardMode === "total"
      ? parseFloat(newBill.amount) / parcelas
      : parseFloat(newBill.amount);

    try {
      const { error } = await supabase
        .from("planned_bills")
        .insert({
          user_id: user.id,
          name: newBill.name,
          amount: monthly,
          due_date: newBill.due_date || null,
          saved_amount: 0,
          paid: false,
          recurring: newBill.isCreditCard ? true : newBill.recurring,
          payment_code: newBill.payment_code.trim() || null,
          file_path: null,
          is_credit_card: newBill.isCreditCard,
          installments: newBill.isCreditCard && parcelas > 0 ? parcelas : null,
        });

      if (error) throw error;

      toast({
        title: "Conta adicionada!",
        description: `${newBill.name} entrou no seu planejamento`,
      });

      setNewBill({ name: "", amount: "", due_date: "", recurring: false, payment_code: "", isCreditCard: false, cardMode: "total", installments: "" });
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

  // Abre o diálogo de depósito ("Guardei" / "Guardar hoje") para uma conta ou meta
  const openDeposit = (target: NonNullable<typeof depositTarget>) => {
    setDepositTarget(target);
    setDepositValue("");
  };

  // Confirma o depósito do diálogo compartilhado: soma ao saved_amount (conta)
  // ou ao current_amount (meta).
  const handleConfirmDeposit = async () => {
    if (!depositTarget) return;
    const value = parseFloat(depositValue.replace(",", "."));
    if (isNaN(value) || value <= 0) {
      toast({
        title: "Valor inválido",
        description: "Digite um valor maior que zero",
        variant: "destructive"
      });
      return;
    }

    try {
      if (depositTarget.kind === "bill") {
        const bill = depositTarget.bill;
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
      } else {
        const goal = depositTarget.goal;
        const newAmount = Number(goal.current_amount) + value;
        const newStatus = newAmount >= goal.target_amount ? "completed" : "active";
        const { error } = await supabase
          .from("financial_goals")
          .update({ current_amount: newAmount, status: newStatus })
          .eq("id", goal.id);
        if (error) throw error;
        if (newStatus === "completed") {
          toast({
            title: "🎉 Meta alcançada!",
            description: `Parabéns! Você completou a meta ${goal.name}!`,
          });
        } else {
          toast({
            title: "Guardado!",
            description: `${formatCurrency(value)} adicionado à meta ${goal.name}`,
          });
        }
      }
      setDepositTarget(null);
      setDepositValue("");
      loadFinancialData();
    } catch (error) {
      console.error("Error depositing:", error);
      toast({ title: "Erro ao guardar", variant: "destructive" });
    }
  };

  // Abre o diálogo de edição de uma conta, pré-preenchido com os valores atuais
  const openEditBill = (bill: PlannedBill) => {
    setEditBill(bill);
    setEditBillForm({
      name: bill.name,
      amount: String(bill.amount ?? ""),
      due_date: bill.due_date ?? "",
      recurring: Boolean(bill.recurring),
      payment_code: bill.payment_code ?? "",
    });
  };

  // Salva a edição: atualiza nome, valor e vencimento da conta
  const handleSaveEditBill = async () => {
    if (!editBill) return;
    if (!editBillForm.name || !editBillForm.amount) {
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
        .update({
          name: editBillForm.name,
          amount: parseFloat(editBillForm.amount),
          due_date: editBillForm.due_date || null,
          recurring: editBillForm.recurring,
          payment_code: editBillForm.payment_code.trim() || null,
        })
        .eq("id", editBill.id);
      if (error) throw error;
      toast({
        title: "Conta atualizada",
        description: `"${editBillForm.name}" foi salva.`,
      });
      setEditBill(null);
      loadFinancialData();
    } catch (error) {
      console.error("Error updating bill:", error);
      toast({ title: "Erro ao atualizar conta", variant: "destructive" });
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

  // Copia o código de pagamento (linha digitável do boleto ou chave Pix) pra área
  // de transferência. Usa a Clipboard API async; se não houver (contexto inseguro
  // ou navegador antigo), cai num fallback com <textarea> + execCommand("copy").
  const handleCopyPaymentCode = async (bill: PlannedBill) => {
    const code = (bill.payment_code ?? "").trim();
    if (!code) return;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(code);
      } else {
        const ta = document.createElement("textarea");
        ta.value = code;
        ta.setAttribute("readonly", "");
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand("copy");
        document.body.removeChild(ta);
        if (!ok) throw new Error("execCommand copy failed");
      }
      toast({
        title: "Copiado!",
        description: "Cole no seu banco pra pagar.",
      });
    } catch (error) {
      console.error("Error copying payment code:", error);
      toast({
        title: "Não consegui copiar",
        description: "Tente copiar manualmente o código.",
        variant: "destructive",
      });
    }
  };

  // Anexa (ou troca) o boleto/comprovante de uma conta. Sobe pro bucket privado
  // "bill-files" numa pasta com o auth.uid() do usuário (regra do RLS), grava o
  // caminho em planned_bills.file_path e atualiza o estado local.
  const handleUploadBillFile = async (bill: PlannedBill, file: File | null) => {
    if (!user || !file) return;
    setUploadingBillId(bill.id);
    try {
      // Sanitiza o nome: mantém letras/números/ponto/hífen; o resto vira "_"
      const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
      const path = `${user.id}/${bill.id}-${Date.now()}-${safeName}`;

      const { error: upErr } = await supabase.storage
        .from("bill-files")
        .upload(path, file, { upsert: true });
      if (upErr) throw upErr;

      const { error: dbErr } = await supabase
        .from("planned_bills")
        .update({ file_path: path })
        .eq("id", bill.id);
      if (dbErr) throw dbErr;

      setBills((prev) => prev.map((b) => (b.id === bill.id ? { ...b, file_path: path } : b)));
      toast({ title: "Boleto anexado", description: `Arquivo salvo em ${bill.name}.` });
    } catch (error) {
      console.error("Error uploading bill file:", error);
      toast({
        title: "Erro ao anexar boleto",
        description: "Tente novamente mais tarde.",
        variant: "destructive",
      });
    } finally {
      setUploadingBillId(null);
    }
  };

  // Abre/baixa o boleto da conta via URL assinada temporária (válida ~60s).
  const handleViewBillFile = async (bill: PlannedBill) => {
    if (!bill.file_path) return;
    // Abre a aba JÁ no clique (senão o navegador bloqueia o popup depois do await)
    const win = window.open("", "_blank");
    try {
      const { data, error } = await supabase.storage
        .from("bill-files")
        .createSignedUrl(bill.file_path, 60);
      if (error || !data?.signedUrl) throw error || new Error("Sem URL");
      if (win) {
        win.location.href = data.signedUrl;
      } else {
        // popup bloqueado: clica num link (sem sair do app)
        const a = document.createElement("a");
        a.href = data.signedUrl;
        a.target = "_blank";
        a.rel = "noopener";
        document.body.appendChild(a);
        a.click();
        a.remove();
      }
    } catch (error) {
      console.error("Error opening bill file:", error);
      if (win) win.close();
      toast({
        title: "Erro ao abrir boleto",
        description: "Não foi possível gerar o link do arquivo.",
        variant: "destructive",
      });
    }
  };

  // Remove o boleto: apaga do Storage e zera file_path (com confirmação).
  const handleRemoveBillFile = async (bill: PlannedBill) => {
    if (!bill.file_path) return;
    if (!confirm(`Remover o boleto anexado de "${bill.name}"?`)) return;
    try {
      const { error: rmErr } = await supabase.storage
        .from("bill-files")
        .remove([bill.file_path]);
      if (rmErr) throw rmErr;

      const { error: dbErr } = await supabase
        .from("planned_bills")
        .update({ file_path: null })
        .eq("id", bill.id);
      if (dbErr) throw dbErr;

      setBills((prev) => prev.map((b) => (b.id === bill.id ? { ...b, file_path: null } : b)));
      toast({ title: "Boleto removido", description: `O arquivo de "${bill.name}" foi excluído.` });
    } catch (error) {
      console.error("Error removing bill file:", error);
      toast({ title: "Erro ao remover boleto", variant: "destructive" });
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

  // Conta os DIAS DE TRABALHO de hoje até o vencimento (inclusive), considerando
  // só os dias da semana em working_days. Sem prazo → fallback grande (30).
  // Sem working_days: usa weekly_work_days pra estimar; senão, dias corridos.
  const workingDaysUntil = (dueDateStr: string | null): number => {
    if (!dueDateStr) return 30;
    const weekdayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

    // Parse ao meio-dia local pra evitar erro de fuso/DST
    const due = new Date(dueDateStr + "T12:00:00");
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueDay = new Date(due);
    dueDay.setHours(0, 0, 0, 0);

    // Dias corridos de hoje até o vencimento (inclusive)
    const msPerDay = 1000 * 60 * 60 * 24;
    const calendarDays = Math.floor((dueDay.getTime() - today.getTime()) / msPerDay) + 1;

    if (!workingDays || workingDays.length === 0) {
      if (weeklyWorkDays > 0) {
        return Math.max(1, Math.ceil(calendarDays * (weeklyWorkDays / 7)));
      }
      return Math.max(1, calendarDays);
    }

    let count = 0;
    const cursor = new Date(today);
    while (cursor.getTime() <= dueDay.getTime()) {
      const name = weekdayNames[cursor.getDay()];
      if (workingDays.includes(name)) count++;
      cursor.setDate(cursor.getDate() + 1);
    }
    return Math.max(1, count);
  };

  // Formata uma Date local como "YYYY-MM-DD" (pra alimentar o workingDaysUntil)
  const toYMD = (d: Date): string =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  // Próximo vencimento "efetivo" da conta (ao meio-dia local).
  // - Recorrente: próxima ocorrência mensal do dia do due_date. Pega o dia do mês
  //   do due_date; a próxima ocorrência é a deste mês se hoje <= esse dia, senão a
  //   do mês que vem. O dia é limitado ao último dia do mês (ex.: 31 em mês de 30 → 30).
  // - Não recorrente: o próprio due_date (meio-dia local). Sem due_date → null.
  const nextDueDate = (bill: PlannedBill): Date | null => {
    if (bill.recurring) {
      if (!bill.due_date) {
        // Recorrente sem data definida: usa o dia de hoje como "dia da conta"
        const base = new Date();
        return new Date(base.getFullYear(), base.getMonth(), base.getDate(), 12, 0, 0, 0);
      }
      const dueDay = Number(bill.due_date.slice(8, 10)); // dia-do-mês do due_date (1–31)
      const now = new Date();
      const todayDay = now.getDate();
      // Este mês se ainda dá tempo (hoje <= dia), senão mês que vem
      let year = now.getFullYear();
      let month = now.getMonth(); // 0-based
      if (todayDay > dueDay) {
        month += 1;
        if (month > 11) { month = 0; year += 1; }
      }
      const lastDayOfMonth = new Date(year, month + 1, 0).getDate();
      const day = Math.min(dueDay, lastDayOfMonth); // clamp ao último dia do mês
      return new Date(year, month, day, 12, 0, 0, 0);
    }
    if (!bill.due_date) return null;
    return new Date(bill.due_date + "T12:00:00");
  };

  // Vencida: NÃO recorrente, COM due_date, vencimento antes da meia-noite de hoje,
  // e ainda não quitada (saved < amount E não paga).
  const isOverdue = (bill: PlannedBill): boolean => {
    if (bill.recurring) return false;
    if (!bill.due_date) return false;
    const quitada = bill.paid || Number(bill.saved_amount) >= Number(bill.amount);
    if (quitada) return false;
    const todayMidnight = new Date();
    todayMidnight.setHours(0, 0, 0, 0);
    const due = new Date(bill.due_date + "T12:00:00");
    return due.getTime() < todayMidnight.getTime();
  };

  // Quanto ainda falta guardar pra conta
  const remaining = (bill: PlannedBill): number =>
    Math.max(0, (Number(bill.amount) || 0) - (Number(bill.saved_amount) || 0));

  // Quanto guardar POR DIA DE TRABALHO. Vencida → 0 (já passou o prazo).
  // Senão divide o que falta pelos dias úteis até o próximo vencimento (recorrente rola).
  const perDay = (bill: PlannedBill): number => {
    if (isOverdue(bill)) return 0;
    const nd = nextDueDate(bill);
    const wd = workingDaysUntil(nd ? toYMD(nd) : null);
    return remaining(bill) / Math.max(1, wd);
  };

  if (loading || !user) {
    return null;
  }

  // "A guardar hoje" — quanto reservar do líquido de hoje pras metas + contas
  const todayName = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"][new Date().getDay()];
  const todayIsWorkDay = workingDays && workingDays.length > 0 ? workingDays.includes(todayName) : true;
  const goalPctTotal = Math.min(
    100,
    goals.reduce((sum, g) => sum + (Number(g.percentual_distribuicao) || 0), 0)
  );
  const goalShareToday = (Math.max(0, summary.netToday) * goalPctTotal) / 100;
  // Soma o "por dia" só das contas NÃO pagas e NÃO vencidas (recorrentes entram, pois rolam).
  // Vencida tem perDay = 0, mas filtramos explicitamente pra deixar claro.
  const billsShareToday = todayIsWorkDay
    ? bills.reduce((sum, bill) => {
        const quitada = bill.paid || Number(bill.saved_amount) >= Number(bill.amount);
        if (quitada || isOverdue(bill)) return sum;
        return sum + perDay(bill);
      }, 0)
    : 0;
  const totalGuardarHoje = goalShareToday + billsShareToday;

  // Contas vencidas (não recorrentes que passaram do prazo e não estão quitadas)
  const overdueBills = bills.filter((bill) => isOverdue(bill));
  const vencidasTotal = overdueBills.reduce((sum, bill) => sum + remaining(bill), 0);

  return (
    <div className="space-y-6 pb-4 md:pb-8">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
          <Wallet className="w-5 h-5 text-primary" />
        </div>
        <h1 className="text-3xl font-bold text-foreground tracking-tight">Minhas Finanças</h1>
      </div>

      {/* HERO: Hoje — lucro líquido do dia em destaque, vendido/custos demovidos */}
      <Card className="bg-card border border-border rounded-2xl shadow-lg">
        <CardContent className="p-6 space-y-4">
          <div>
            <p className="text-sm text-muted-foreground mb-2">Lucro líquido do dia</p>
            {isLoadingData ? (
              <Skeleton className="h-11 w-40" />
            ) : (
              <p className={`text-4xl font-bold tracking-tight ${summary.netToday >= 0 ? "text-primary" : "text-destructive"}`}>
                {formatCurrency(summary.netToday)}
              </p>
            )}
            <p className="text-xs text-muted-foreground mt-1">bruto − mercadoria − transporte − alimentação</p>
          </div>

          {/* Vendido / Custos do dia (demoted, inline) */}
          <div className="flex items-end justify-between pt-3 border-t border-border">
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Vendido hoje</p>
              {isLoadingData ? (
                <Skeleton className="h-7 w-24 mt-1" />
              ) : (
                <p className="text-xl font-bold text-foreground tracking-tight whitespace-nowrap">
                  {formatCurrency(summary.grossToday)}
                </p>
              )}
            </div>
            <div className="text-right min-w-0">
              <p className="text-xs text-muted-foreground">Custos do dia</p>
              {isLoadingData ? (
                <Skeleton className="h-7 w-24 mt-1 ml-auto" />
              ) : (
                <p className="text-xl font-bold text-destructive tracking-tight whitespace-nowrap">
                  {formatCurrency(summary.costToday + summary.transportToday + summary.foodToday + summary.expensesToday)}
                </p>
              )}
            </div>
          </div>

          {/* Fiado / não pago — informativo, não entra no líquido */}
          {!isLoadingData && summary.debtToday > 0 && (
            <p className="text-xs text-muted-foreground">
              Fiado/não pago: <strong className="text-warning font-semibold">{formatCurrency(summary.debtToday)}</strong> (não entra no líquido)
            </p>
          )}
        </CardContent>
      </Card>

      {/* A guardar hoje + Contas vencidas */}
      {!isLoadingData && overdueBills.length > 0 ? (
        <div className="grid grid-cols-2 gap-3">
          {/* A guardar hoje (accent primário) */}
          <Card className="bg-primary/5 border border-primary/30 rounded-2xl">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">A guardar hoje</p>
              <p className="text-2xl font-bold text-primary mt-1 tracking-tight truncate">
                {formatCurrency(totalGuardarHoje)}
              </p>
              <p className="text-xs text-muted-foreground mt-1 truncate">
                metas {formatCurrency(goalShareToday)} · contas {formatCurrency(billsShareToday)}
              </p>
            </CardContent>
          </Card>

          {/* Contas vencidas (accent destrutivo) */}
          <Card className="bg-destructive/5 border border-destructive/30 rounded-2xl">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Contas vencidas</p>
              <p className="text-2xl font-bold text-destructive mt-1 tracking-tight truncate">
                {formatCurrency(vencidasTotal)}
              </p>
              <p className="text-xs text-muted-foreground mt-1 truncate">
                {overdueBills.length} {overdueBills.length === 1 ? "conta" : "contas"} — pague logo
              </p>
            </CardContent>
          </Card>
        </div>
      ) : (
        /* Sem contas vencidas: A guardar hoje em largura total */
        <Card className="bg-primary/5 border border-primary/30 rounded-2xl">
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">A guardar hoje</p>
                {isLoadingData ? (
                  <Skeleton className="h-8 w-28 mt-1" />
                ) : (
                  <p className="text-2xl font-bold text-primary mt-1 tracking-tight whitespace-nowrap">
                    {formatCurrency(totalGuardarHoje)}
                  </p>
                )}
                {!isLoadingData && (
                  <p className="text-xs text-muted-foreground mt-1">
                    metas {formatCurrency(goalShareToday)} · contas {formatCurrency(billsShareToday)}
                  </p>
                )}
                {!isLoadingData && !todayIsWorkDay && (
                  <p className="text-xs text-muted-foreground mt-1">Hoje é seu descanso.</p>
                )}
              </div>
              <div className="w-10 h-10 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center shrink-0">
                <PiggyBank className="w-5 h-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Distribuição automática do líquido diário */}
      <FeatureErrorBoundary title="A distribuição automática deu uma travada">
        <AutoDistribution userId={user.id} onChanged={loadFinancialData} />
      </FeatureErrorBoundary>

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
                  {/* Tipo: conta normal ou cartão de crédito */}
                  <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-muted">
                    <button
                      type="button"
                      onClick={() => setNewBill({ ...newBill, isCreditCard: false })}
                      className={`py-2 rounded-lg text-sm font-semibold transition-colors ${!newBill.isCreditCard ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"}`}
                    >
                      Conta normal
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewBill({ ...newBill, isCreditCard: true })}
                      className={`py-2 rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-1.5 ${newBill.isCreditCard ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"}`}
                    >
                      <CreditCard className="w-4 h-4" /> Cartão
                    </button>
                  </div>

                  <div className="space-y-2">
                    <Label>Nome da conta</Label>
                    <Input
                      value={newBill.name}
                      onChange={(e) => setNewBill({ ...newBill, name: e.target.value })}
                      placeholder={newBill.isCreditCard ? "Ex: Nubank, Itaú..." : "Ex: Aluguel, Luz, Internet..."}
                    />
                  </div>

                  {/* Cartão: digitar o total ou a parcela */}
                  {newBill.isCreditCard && (
                    <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-muted">
                      <button
                        type="button"
                        onClick={() => setNewBill({ ...newBill, cardMode: "total" })}
                        className={`py-1.5 rounded-lg text-xs font-semibold transition-colors ${newBill.cardMode === "total" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"}`}
                      >
                        Total da compra
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewBill({ ...newBill, cardMode: "parcela" })}
                        className={`py-1.5 rounded-lg text-xs font-semibold transition-colors ${newBill.cardMode === "parcela" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"}`}
                      >
                        Valor da parcela
                      </button>
                    </div>
                  )}

                  <div className={newBill.isCreditCard ? "flex gap-3" : "space-y-2"}>
                    <div className="space-y-2 flex-1 min-w-0">
                      <Label>{newBill.isCreditCard ? (newBill.cardMode === "total" ? "Total (R$)" : "Parcela (R$)") : "Valor (R$)"}</Label>
                      <MoneyInput
                        value={parseFloat(newBill.amount) || 0}
                        onChange={(n) => setNewBill({ ...newBill, amount: n ? String(n) : "" })}
                        placeholder="0,00"
                      />
                    </div>
                    {newBill.isCreditCard && (
                      <div className="space-y-2 w-24 shrink-0">
                        <Label>Parcelas</Label>
                        <Input
                          type="number"
                          min="1"
                          value={newBill.installments}
                          onChange={(e) => setNewBill({ ...newBill, installments: e.target.value })}
                          placeholder="6"
                        />
                      </div>
                    )}
                  </div>

                  {/* Prévia do cartão */}
                  {newBill.isCreditCard && parseFloat(newBill.amount) > 0 && (() => {
                    const parc = parseInt(newBill.installments) || 0;
                    const monthly = newBill.cardMode === "total" && parc > 0 ? parseFloat(newBill.amount) / parc : parseFloat(newBill.amount);
                    return (
                      <div className="rounded-lg bg-violet-500/10 border border-violet-500/30 px-3 py-2 text-xs text-foreground leading-relaxed">
                        <span className="font-semibold text-violet-400">{parc > 0 ? `${parc}x de ` : ""}{formatCurrency(monthly)}</span> por mês{newBill.cardMode === "total" && parc > 0 ? ` (total ${formatCurrency(parseFloat(newBill.amount))})` : ""}. É recorrente — entra todo mês no planejamento.
                      </div>
                    );
                  })()}

                  <div className="space-y-2">
                    <Label>{newBill.isCreditCard ? "Dia do vencimento" : "Data de vencimento"}</Label>
                    <Input
                      type="date"
                      value={newBill.due_date}
                      onChange={(e) => setNewBill({ ...newBill, due_date: e.target.value })}
                    />
                  </div>

                  {/* Recorrente: só conta normal (cartão já é sempre recorrente) */}
                  {!newBill.isCreditCard && (
                    <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
                      <div className="min-w-0 pr-3">
                        <Label htmlFor="new-bill-recurring" className="cursor-pointer">Conta recorrente (todo mês)</Label>
                        <p className="text-xs text-muted-foreground mt-0.5">Repete todo mês no mesmo dia de vencimento.</p>
                      </div>
                      <Switch
                        id="new-bill-recurring"
                        checked={newBill.recurring}
                        onCheckedChange={(checked) => setNewBill({ ...newBill, recurring: checked })}
                      />
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label>Código pra pagar (boleto ou Pix) — opcional</Label>
                    <Textarea
                      value={newBill.payment_code}
                      onChange={(e) => setNewBill({ ...newBill, payment_code: e.target.value })}
                      placeholder="Cole aqui a linha digitável do boleto ou a chave Pix"
                      rows={2}
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
                const remainingValue = remaining(bill);
                const progress = amount > 0 ? Math.min(100, (saved / amount) * 100) : 0;
                const quitada = bill.paid || saved >= amount;
                // "Pode pagar": já guardou tudo, mas ainda não marcou como paga.
                const canPay = !bill.paid && amount > 0 && saved >= amount;
                const hasFile = Boolean(bill.file_path && bill.file_path.trim() !== "");
                const isUploading = uploadingBillId === bill.id;
                const overdue = isOverdue(bill);
                const isRecurring = Boolean(bill.recurring);

                // Próximo vencimento efetivo (recorrente rola pro próximo mês)
                const nextDue = nextDueDate(bill);
                const nextDueLabel = nextDue
                  ? nextDue.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })
                  : null;

                // Dias corridos até o vencimento (só pra rótulo "vence hoje/venceu")
                let daysLeft: number | null = null;
                if (bill.due_date) {
                  const msPerDay = 1000 * 60 * 60 * 24;
                  const todayMs = new Date(getBrazilDate() + "T12:00:00Z").getTime();
                  const dueMs = new Date(bill.due_date + "T12:00:00Z").getTime();
                  daysLeft = Math.ceil((dueMs - todayMs) / msPerDay);
                }
                const overdueDays = daysLeft !== null && daysLeft < 0 ? Math.abs(daysLeft) : 0;
                // Guardar por DIA DE TRABALHO (vencida = 0; recorrente usa o próximo vencimento)
                const workDaysLeft = workingDaysUntil(nextDue ? toYMD(nextDue) : null);
                const perDayValue = perDay(bill);

                return (
                  <Card
                    key={bill.id}
                    className={
                      quitada
                        ? "border-success/30"
                        : overdue
                        ? "bg-destructive/5 border-destructive/30"
                        : "card-gradient-border"
                    }
                  >
                    <CardContent className="pt-6 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold">{bill.name}</p>
                            {bill.is_credit_card ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-violet-500/10 border border-violet-500/30 px-2 py-0.5 text-[11px] font-medium text-violet-400">
                                <CreditCard className="w-3 h-3" />
                                Cartão{bill.installments ? ` · ${bill.installments}x` : ""}
                              </span>
                            ) : isRecurring && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 border border-primary/20 px-2 py-0.5 text-[11px] font-medium text-primary">
                                <RotateCw className="w-3 h-3" />
                                Recorrente
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-muted-foreground">
                            <span>Valor: <span className="font-medium text-foreground">{formatCurrency(amount)}</span></span>
                            {isRecurring ? (
                              nextDueLabel && (
                                <span className="flex items-center gap-1">
                                  <Calendar className="w-3 h-3" />
                                  Próxima: {nextDueLabel}
                                </span>
                              )
                            ) : (
                              bill.due_date && (
                                <span className="flex items-center gap-1">
                                  <Calendar className="w-3 h-3" />
                                  Vence {new Date(bill.due_date + "T12:00:00Z").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
                                </span>
                              )
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {bill.payment_code && bill.payment_code.trim() !== "" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleCopyPaymentCode(bill)}
                              aria-label="Copiar código de pagamento"
                            >
                              <Copy className="w-4 h-4 text-primary" />
                              <span className="ml-1.5 text-xs text-primary">Copiar código</span>
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditBill(bill)}
                            aria-label="Editar conta"
                          >
                            <Pencil className="w-4 h-4 text-muted-foreground" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteBill(bill)}
                            aria-label="Excluir conta"
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
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

                      {bill.paid ? (
                        <div className="bg-success/10 border border-success/20 rounded-lg p-2.5 flex items-center justify-center gap-2">
                          <Check className="w-4 h-4 text-success" />
                          <p className="text-success font-semibold text-sm">Quitada ✓</p>
                        </div>
                      ) : canPay ? (
                        <div className="rounded-lg bg-success/10 border border-success/30 px-3 py-3 space-y-2.5">
                          <div className="flex items-start gap-2">
                            <PartyPopper className="w-4 h-4 text-success shrink-0 mt-0.5" />
                            <div className="min-w-0">
                              <p className="text-sm font-bold text-success">Você já guardou tudo! 🎉</p>
                              <p className="text-xs text-success/80 mt-0.5">Agora é só pagar.</p>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {bill.payment_code && bill.payment_code.trim() !== "" && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleCopyPaymentCode(bill)}
                                className="border-success/40 text-success hover:bg-success/10"
                              >
                                <Copy className="w-4 h-4 mr-1.5" />
                                Copiar código
                              </Button>
                            )}
                            {hasFile && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleViewBillFile(bill)}
                                className="border-success/40 text-success hover:bg-success/10"
                              >
                                <FileText className="w-4 h-4 mr-1.5" />
                                Ver boleto
                              </Button>
                            )}
                            <Button
                              size="sm"
                              onClick={() => handleToggleBillPaid(bill)}
                              className="bg-success text-success-foreground hover:bg-success/90"
                            >
                              <Check className="w-4 h-4 mr-1.5" />
                              Marcar como paga
                            </Button>
                          </div>
                        </div>
                      ) : overdue ? (
                        <div className="flex items-start gap-2 rounded-lg bg-destructive/10 border border-destructive/30 px-3 py-2">
                          <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-destructive">
                              {overdueDays === 0
                                ? "Venceu hoje"
                                : `Venceu há ${overdueDays} ${overdueDays === 1 ? "dia" : "dias"}`}
                            </p>
                            <p className="text-xs text-destructive/80 mt-0.5">
                              {formatCurrency(remainingValue)} em aberto
                            </p>
                          </div>
                        </div>
                      ) : isRecurring ? (
                        <div className="flex items-center justify-between gap-3 rounded-lg bg-primary/5 border border-primary/20 px-3 py-2">
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-primary">
                              Guardar {formatCurrency(perDayValue)} por dia de trabalho
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {`${workDaysLeft} ${workDaysLeft === 1 ? "dia" : "dias"} de trabalho${
                                nextDueLabel ? ` até a próxima (${nextDueLabel})` : ""
                              }`}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="inline-block text-xs font-bold text-primary bg-primary/15 rounded-full px-2.5 py-1 whitespace-nowrap">
                              {workDaysLeft} {workDaysLeft === 1 ? "dia útil" : "dias úteis"}
                            </span>
                            <p className="text-[11px] text-muted-foreground mt-1">ajusta sozinho</p>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between gap-3 rounded-lg bg-primary/5 border border-primary/20 px-3 py-2">
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-primary">
                              Guardar {formatCurrency(perDayValue)} por dia de trabalho
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {daysLeft === 0
                                ? "vence hoje"
                                : `${workDaysLeft} ${workDaysLeft === 1 ? "dia" : "dias"} de trabalho${
                                    bill.due_date
                                      ? ` até ${new Date(bill.due_date + "T12:00:00Z").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}`
                                      : ""
                                  }`}
                            </p>
                          </div>
                          {daysLeft !== 0 && (
                            <div className="text-right shrink-0">
                              <span className="inline-block text-xs font-bold text-primary bg-primary/15 rounded-full px-2.5 py-1 whitespace-nowrap">
                                {workDaysLeft} {workDaysLeft === 1 ? "dia útil" : "dias úteis"}
                              </span>
                              <p className="text-[11px] text-muted-foreground mt-1">ajusta sozinho</p>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Boleto: anexar/trocar, ver e remover (bucket privado bill-files) */}
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <input
                          id={`bill-file-${bill.id}`}
                          type="file"
                          accept="application/pdf,image/*"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0] ?? null;
                            handleUploadBillFile(bill, f);
                            e.target.value = "";
                          }}
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={isUploading}
                          onClick={() => document.getElementById(`bill-file-${bill.id}`)?.click()}
                          aria-label={hasFile ? "Trocar boleto" : "Anexar boleto"}
                        >
                          {isUploading ? (
                            <Loader2 className="w-4 h-4 text-primary animate-spin" />
                          ) : (
                            <Paperclip className="w-4 h-4 text-primary" />
                          )}
                          <span className="ml-1.5 text-xs text-primary">
                            {isUploading ? "Enviando..." : hasFile ? "Trocar boleto" : "Anexar boleto"}
                          </span>
                        </Button>
                        {hasFile && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleViewBillFile(bill)}
                              aria-label="Ver boleto"
                            >
                              <Download className="w-4 h-4 text-primary" />
                              <span className="ml-1.5 text-xs text-primary">Ver boleto</span>
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleRemoveBillFile(bill)}
                              aria-label="Remover boleto"
                            >
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </>
                        )}
                      </div>

                      <div className="flex flex-col sm:flex-row gap-2 pt-1">
                        {!quitada && (
                          <Button
                            variant="outline"
                            onClick={() => openDeposit({ kind: "bill", bill })}
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
                    <MoneyInput
                      value={parseFloat(newGoal.target_amount) || 0}
                      onChange={(n) => setNewGoal({ ...newGoal, target_amount: n ? String(n) : "" })}
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
                        {Number(goal.percentual_distribuicao) > 0 && (
                          <p className="text-xs text-primary flex items-center gap-1.5">
                            <Sparkles className="w-3 h-3 shrink-0" />
                            Guardar {Number(goal.percentual_distribuicao).toFixed(0)}% do líquido do dia
                          </p>
                        )}
                      </div>

                      {/* Depósito do dia — abre o diálogo "Guardar hoje" compartilhado */}
                      {goal.status === "active" && (
                        <div className="flex gap-2 pt-2 border-t">
                          <Button
                            onClick={() => openDeposit({ kind: "goal", goal })}
                            className="flex-1"
                          >
                            <Plus className="w-4 h-4 mr-2" />
                            Guardar hoje
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

      {/* Diálogo de depósito compartilhado: "Guardei" (conta) e "Guardar hoje" (meta) */}
      <Dialog open={depositTarget !== null} onOpenChange={(open) => { if (!open) { setDepositTarget(null); setDepositValue(""); } }}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-sm p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>Quanto você guardou?</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            {depositTarget && (
              <p className="text-sm text-muted-foreground">
                {depositTarget.kind === "bill" ? depositTarget.bill.name : depositTarget.goal.name}
              </p>
            )}
            <div className="space-y-2">
              <Label>Valor (R$)</Label>
              <MoneyInput
                autoFocus
                value={parseFloat(depositValue) || 0}
                onChange={(n) => setDepositValue(n ? String(n) : "")}
                onKeyDown={(e) => { if (e.key === "Enter") handleConfirmDeposit(); }}
                placeholder="0,00"
              />
            </div>
            <div className="flex flex-col-reverse sm:flex-row gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => { setDepositTarget(null); setDepositValue(""); }}
                className="w-full sm:flex-1"
              >
                Cancelar
              </Button>
              <Button onClick={handleConfirmDeposit} className="w-full sm:flex-1">
                Confirmar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Diálogo de edição de conta: nome, valor e vencimento */}
      <Dialog open={editBill !== null} onOpenChange={(open) => { if (!open) setEditBill(null); }}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-md p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>Editar conta</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Nome da conta</Label>
              <Input
                value={editBillForm.name}
                onChange={(e) => setEditBillForm({ ...editBillForm, name: e.target.value })}
                placeholder="Ex: Aluguel, Luz, Internet..."
              />
            </div>
            <div className="space-y-2">
              <Label>Valor (R$)</Label>
              <MoneyInput
                value={parseFloat(editBillForm.amount) || 0}
                onChange={(n) => setEditBillForm({ ...editBillForm, amount: n ? String(n) : "" })}
                placeholder="0,00"
              />
            </div>
            <div className="space-y-2">
              <Label>Data de vencimento</Label>
              <Input
                type="date"
                value={editBillForm.due_date}
                onChange={(e) => setEditBillForm({ ...editBillForm, due_date: e.target.value })}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
              <div className="min-w-0 pr-3">
                <Label htmlFor="edit-bill-recurring" className="cursor-pointer">Conta recorrente (todo mês)</Label>
                <p className="text-xs text-muted-foreground mt-0.5">Repete todo mês no mesmo dia de vencimento.</p>
              </div>
              <Switch
                id="edit-bill-recurring"
                checked={editBillForm.recurring}
                onCheckedChange={(checked) => setEditBillForm({ ...editBillForm, recurring: checked })}
              />
            </div>
            <div className="space-y-2">
              <Label>Código pra pagar (boleto ou Pix) — opcional</Label>
              <Textarea
                value={editBillForm.payment_code}
                onChange={(e) => setEditBillForm({ ...editBillForm, payment_code: e.target.value })}
                placeholder="Cole aqui a linha digitável do boleto ou a chave Pix"
                rows={3}
              />
            </div>
            <div className="flex flex-col-reverse sm:flex-row gap-2 pt-2">
              <Button variant="outline" onClick={() => setEditBill(null)} className="w-full sm:flex-1">
                Cancelar
              </Button>
              <Button onClick={handleSaveEditBill} className="w-full sm:flex-1">
                Salvar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
