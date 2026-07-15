import { useState, useEffect, useRef } from "react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/tabs";
import { useToast } from "@/shared/hooks/use-toast";
import { Skeleton } from "@/shared/ui/skeleton";
import { Progress } from "@/shared/ui/progress";
import AutoDistribution from "@/components/AutoDistribution";
import FeatureErrorBoundary from "@/shared/components/feature-error-boundary";
import ImportPdfDialog from "@/components/ImportPdfDialog";
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
  RotateCcw,
  Copy,
  Paperclip,
  FileText,
  Download,
  PartyPopper,
  Loader2,
  CreditCard,
  ChevronDown,
  Upload
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
  risco?: string; // 'baixo' | 'medio' | 'alto' — o quão perigoso é atrasar
  paid_cycle?: string | null; // 'YYYY-MM' do ciclo em que foi paga (recorrente reseta no próximo)
  duration_months?: number | null; // null = fixa (todo mês); N = dura N meses e acaba
  cycles_paid?: number; // quantos ciclos já foram pagos (pra saber quando a duração acaba)
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
  prazo?: string; // 'curto' | 'medio' | 'longo'
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
  mediaDiariaLiquida: number; // lucro líquido médio por dia trabalhado (pra recomendação de metas)
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
    mediaDiariaLiquida: 0,
  });
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isAddBillOpen, setIsAddBillOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  // Guarda o último "Guardei tudo" pra poder DESFAZER (reverte contas, metas e o guardado de hoje).
  const [ultimoGuardei, setUltimoGuardei] = useState<
    | { billDeltas: { id: string; delta: number }[]; goalDeltas: { id: string; delta: number; prevStatus: string }[]; savedHojeDelta: number }
    | null
  >(null);
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
    risco: "medio" as "baixo" | "medio" | "alto",
    tipoTempo: "fixa" as "fixa" | "duracao" | "unica", // fixa (todo mês) / com duração (N meses) / única (uma vez só)
    durationMonths: "",
  });

  // Form states for new goal
  const [newGoal, setNewGoal] = useState({
    name: "",
    target_amount: "",
    deadline: "",
    icon: "🎯",
    prazo: "medio" as "curto" | "medio" | "longo",
  });
  const [goalImage, setGoalImage] = useState<File | null>(null);
  const [goalImagePreview, setGoalImagePreview] = useState<string>("");
  // Qual recomendação de meta está aberta (id da meta) — pra expandir o texto detalhado.
  const [recAberta, setRecAberta] = useState<string | null>(null);
  // Qual meta está expandida (bloco compacto → abre detalhes ao tocar).
  const [metaAberta, setMetaAberta] = useState<string | null>(null);
  // Qual conta a pagar está expandida.
  const [contaAberta, setContaAberta] = useState<string | null>(null);
  // Editar meta (sem apagar/recriar).
  const [editGoal, setEditGoal] = useState<Goal | null>(null);
  const [editGoalForm, setEditGoalForm] = useState({ name: "", target_amount: "", prazo: "medio" as "curto" | "medio" | "longo", deadline: "" });
  const [savingEditGoal, setSavingEditGoal] = useState(false);

  // Reusable "guardar" deposit dialog — shared por Contas a pagar (Guardei) e Metas (Guardar hoje)
  const [depositTarget, setDepositTarget] = useState<
    | { kind: "bill"; bill: PlannedBill }
    | { kind: "goal"; goal: Goal }
    | null
  >(null);
  const [depositValue, setDepositValue] = useState("");
  // "Guardei outro valor": informar quanto realmente guardou hoje (a mais/a menos)
  const [customSaveOpen, setCustomSaveOpen] = useState(false);
  const [customSaveValue, setCustomSaveValue] = useState("");
  // "Guardar pra quitar vencidas": valor que vai 100% pras contas atrasadas (mais antiga 1º)
  const [vencidasSaveOpen, setVencidasSaveOpen] = useState(false);
  const [vencidasSaveValue, setVencidasSaveValue] = useState("");
  // Planejador "pagar em X dias úteis" por conta vencida (id -> nº de dias úteis).
  const [prazoVencida, setPrazoVencida] = useState<Record<string, number>>({});
  // "Próximos dias": projeção de quanto guardar nos próximos dias de trabalho
  const [showProjecao, setShowProjecao] = useState(false);
  const [showProjecaoMetas, setShowProjecaoMetas] = useState(false);
  // Registrar "guardei X" num dia específico (selecionado na lista de próximos dias)
  const [diaSave, setDiaSave] = useState<{ label: string; isToday: boolean } | null>(null);
  const [diaSaveValue, setDiaSaveValue] = useState("");
  // Data pra lançar/ajustar o guardado num dia ANTERIOR (rever dias passados).
  const [outroDiaData, setOutroDiaData] = useState(getBrazilDate());
  // "Já guardou hoje?" — evita pedir pra guardar de novo se a pessoa vender mais à tarde.
  const [savedToday, setSavedToday] = useState(() => {
    try { return localStorage.getItem("orbis_last_save_date") === getBrazilDate(); } catch { return false; }
  });
  // "A guardar hoje" = ALVO FIXO do dia − o que já foi guardado hoje. O alvo é
  // congelado no 1º load do dia (senão encolheria a cada depósito por causa da
  // amortização) e o guardado-hoje é somado a cada depósito. Reinicia à meia-noite.
  const [savedTodayAmount, setSavedTodayAmount] = useState(0);
  const [targetSnapshot, setTargetSnapshot] = useState<number | null>(null);

  // Edit bill dialog state
  const [editBill, setEditBill] = useState<PlannedBill | null>(null);
  const [editBillForm, setEditBillForm] = useState({ name: "", amount: "", due_date: "", recurring: false, payment_code: "", risco: "medio" as "baixo" | "medio" | "alto", tipoTempo: "fixa" as "fixa" | "duracao" | "unica", durationMonths: "" });

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
        .select("id, name, amount, due_date, saved_amount, paid, recurring, payment_code, file_path, is_credit_card, installments, risco, paid_cycle, duration_months, cycles_paid")
        .eq("user_id", user.id)
        .order("paid", { ascending: true })
        .order("due_date", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: true });

      if (billsError) throw billsError;

      // MODELO CONTÍNUO das recorrentes: uma conta recorrente NUNCA fica "paga parada".
      // Assim que é paga, ela reabre e volta a guardar um pouco por dia até o próximo
      // vencimento (ex: Aluguel pago dia 8 → já começa a juntar pro dia 8 do mês seguinte).
      // O ciclo pago fica gravado em paid_cycle (pra saber que aquele mês está quitado e
      // não cobrar de novo). Aqui convertemos qualquer recorrente legada marcada como paga
      // pro novo modelo: tira o "paid", zera o guardado e registra o ciclo atual como pago.
      const cicloAtual = getBrazilDate().slice(0, 7); // YYYY-MM
      const bruto = (billsData || []) as PlannedBill[];
      // Conta com DURAÇÃO já encerrada (pagou todas as parcelas) fica paga de vez — não reabre.
      const duracaoEncerrada = (b: PlannedBill) => b.duration_months != null && (b.cycles_paid || 0) >= b.duration_months;
      const legadas = bruto.filter((b) => b.recurring && b.paid && !duracaoEncerrada(b));
      if (legadas.length > 0) {
        await supabase
          .from("planned_bills")
          .update({ paid: false, saved_amount: 0, paid_cycle: cicloAtual } as never)
          .in("id", legadas.map((b) => b.id));
      }
      const legadaIds = new Set(legadas.map((b) => b.id));
      const billsAjustadas = bruto.map((b) =>
        legadaIds.has(b.id) ? { ...b, paid: false, saved_amount: 0, paid_cycle: cicloAtual } : b,
      );
      setBills(billsAjustadas);

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

      // Média diária líquida = lucro do mês ÷ dias que teve venda (pra estimar
      // quanto sobra por dia e recomendar prazo de metas).
      const diasComVenda = (salesData || []).filter((s) => Number(s.total_profit) > 0).length;
      const mediaDiariaLiquida = diasComVenda > 0 ? monthlyNetProfit / diasComVenda : 0;

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
        mediaDiariaLiquida,
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

    // Duração: só quando "com duração". Fixa/única → null.
    const durMeses = parseInt(newBill.durationMonths) || 0;
    const duration_months = newBill.tipoTempo === "duracao" && durMeses > 0 ? durMeses : null;

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
          // Fixa/duração repetem todo mês; ÚNICA = pagamento único (não recorrente, some ao pagar).
          recurring: newBill.tipoTempo !== "unica",
          payment_code: newBill.payment_code.trim() || null,
          file_path: null,
          is_credit_card: newBill.isCreditCard,
          installments: newBill.isCreditCard && parcelas > 0 ? parcelas : null,
          risco: newBill.risco,
          duration_months,
          cycles_paid: 0,
        } as never);

      if (error) throw error;

      toast({
        title: "Conta adicionada!",
        description: `${newBill.name} entrou no seu planejamento`,
      });

      setNewBill({ name: "", amount: "", due_date: "", recurring: false, payment_code: "", isCreditCard: false, cardMode: "total", installments: "", risco: "medio", tipoTempo: "fixa", durationMonths: "" });
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

  // Abre o diálogo de depósito ("Guardei" / "Guardar hoje") para uma conta ou meta.
  // prefill (opcional) já preenche o valor sugerido (ex: a sobra de hoje pras metas).
  const openDeposit = (target: NonNullable<typeof depositTarget>, prefill?: number) => {
    setDepositTarget(target);
    setDepositValue(prefill && prefill > 0.005 ? String(Math.round(prefill * 100) / 100) : "");
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
      // Conta no "guardado hoje" (abate do alvo do dia). Não fecha o dia à força —
      // deixa o card mostrar o quanto ainda falta.
      registrarGuardadoHoje(value);
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
      risco: (bill.risco as "baixo" | "medio" | "alto") || "medio",
      tipoTempo: bill.duration_months != null ? "duracao" : !bill.recurring ? "unica" : "fixa",
      durationMonths: bill.duration_months != null ? String(bill.duration_months) : "",
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
          recurring: editBillForm.tipoTempo !== "unica",
          payment_code: editBillForm.payment_code.trim() || null,
          risco: editBillForm.risco,
          duration_months: editBillForm.tipoTempo === "duracao" && (parseInt(editBillForm.durationMonths) || 0) > 0
            ? parseInt(editBillForm.durationMonths)
            : null,
        } as never)
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
      const cicloAtual = getBrazilDate().slice(0, 7);
      let update: Record<string, unknown>;
      let titulo: string;
      let descricao: string;
      if (bill.recurring) {
        // Recorrente: "pagar" fecha o ciclo atual e RECOMEÇA na hora — zera o guardado e
        // volta a juntar um pouco por dia até o próximo vencimento. Tocar de novo desfaz.
        // Se a conta tem DURAÇÃO (N meses), conta os ciclos: ao pagar o último, quita de vez.
        const jaPagaCiclo = bill.paid_cycle === cicloAtual;
        const dur = bill.duration_months;
        if (jaPagaCiclo) {
          update = { paid_cycle: null, paid: false, cycles_paid: Math.max(0, (bill.cycles_paid || 0) - 1) };
          titulo = "Pagamento desfeito";
          descricao = `${bill.name} voltou pro ciclo atual`;
        } else {
          const novoCiclos = (bill.cycles_paid || 0) + 1;
          const acabou = dur != null && novoCiclos >= dur;
          if (acabou) {
            update = { paid_cycle: cicloAtual, cycles_paid: novoCiclos, paid: true };
            titulo = "Conta quitada de vez ✓";
            descricao = `${bill.name}: última parcela paga (${novoCiclos}/${dur}). Não volta mais.`;
          } else {
            update = { paid_cycle: cicloAtual, saved_amount: 0, paid: false, cycles_paid: novoCiclos };
            titulo = "Conta paga ✓";
            descricao = dur != null
              ? `${bill.name} paga (${novoCiclos}/${dur}). Guardando pro próximo.`
              : `${bill.name} paga. Já comecei a guardar pro próximo vencimento.`;
          }
        }
      } else {
        // Não recorrente: pagamento único — pago fica pago.
        update = { paid: !bill.paid };
        titulo = bill.paid ? "Conta reaberta" : "Conta quitada ✓";
        descricao = bill.paid ? `${bill.name} voltou para as contas a pagar` : `${bill.name} marcada como paga`;
      }
      const { error } = await supabase.from("planned_bills").update(update as never).eq("id", bill.id);
      if (error) throw error;
      toast({ title: titulo, description: descricao });
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
          status: "active",
          prazo: newGoal.prazo,
        } as any);

      if (error) throw error;

      toast({
        title: "Meta criada!",
        description: `${newGoal.name} adicionada com sucesso`,
      });

      setNewGoal({ name: "", target_amount: "", deadline: "", icon: "🎯", prazo: "medio" });
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

  // Abrir/salvar edição de meta (sem apagar e recriar).
  const openEditGoal = (goal: Goal) => {
    setEditGoal(goal);
    setEditGoalForm({
      name: goal.name,
      target_amount: String(goal.target_amount),
      prazo: (goal.prazo as "curto" | "medio" | "longo") || "medio",
      deadline: goal.deadline ? goal.deadline.slice(0, 10) : "",
    });
  };

  const handleSaveEditGoal = async () => {
    if (!user || !editGoal) return;
    const alvo = parseFloat(editGoalForm.target_amount.replace(",", "."));
    if (!editGoalForm.name.trim() || !alvo || alvo <= 0) {
      toast({ title: "Preencha nome e valor", variant: "destructive" });
      return;
    }
    setSavingEditGoal(true);
    try {
      const { error } = await supabase
        .from("financial_goals")
        .update({
          name: editGoalForm.name.trim(),
          target_amount: alvo,
          prazo: editGoalForm.prazo,
          deadline: editGoalForm.deadline || null,
        } as any)
        .eq("id", editGoal.id);
      if (error) throw error;
      toast({ title: "Meta atualizada", description: editGoalForm.name.trim() });
      setEditGoal(null);
      loadFinancialData();
    } catch (e) {
      toast({ title: "Erro ao salvar", variant: "destructive" });
    } finally {
      setSavingEditGoal(false);
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
  // "Trabalhou hoje" = registrou venda hoje. Se sim, HOJE conta como dia de trabalho mesmo
  // sendo seu descanso — aí você guarda a parte de hoje e os valores por dia se ajustam sozinhos.
  const trabalhouHoje = (Number(summary.grossToday) || 0) > 0;
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
    let primeiro = true; // 1ª iteração = hoje
    while (cursor.getTime() <= dueDay.getTime()) {
      const name = weekdayNames[cursor.getDay()];
      // Conta o dia se é dia de trabalho — OU se é HOJE e você trabalhou hoje (mesmo no descanso).
      if (workingDays.includes(name) || (primeiro && trabalhouHoje)) count++;
      primeiro = false;
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
      const cicloAtual = getBrazilDate().slice(0, 7);
      let year = now.getFullYear();
      let month = now.getMonth(); // 0-based
      // Se o ciclo (mês) atual JÁ foi pago, mira o vencimento do mês que vem (começa a juntar
      // pro próximo). Senão, mira o vencimento DESTE mês (mesmo se já passou → vira vencida).
      if (bill.paid_cycle === cicloAtual) {
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

  // Vencida: COM due_date, ainda não quitada (saved < amount E não paga), e o vencimento
  // já passou. Para RECORRENTE, considera o DIA do vencimento deste mês: se hoje já passou
  // desse dia e o ciclo não foi quitado, está vencida (ex: Mercado dia 10, hoje dia 11).
  const isOverdue = (bill: PlannedBill): boolean => {
    if (!bill.due_date) return false;
    const quitada = bill.paid || Number(bill.saved_amount) >= Number(bill.amount);
    if (quitada) return false;
    if (bill.recurring) {
      // Já paga este ciclo → não está vencida (já está juntando pro próximo mês).
      const cicloAtual = getBrazilDate().slice(0, 7);
      if (bill.paid_cycle === cicloAtual) return false;
      const dueDay = Number(bill.due_date.slice(8, 10));
      return new Date().getDate() > dueDay;
    }
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

  // Snapshot do "a guardar hoje": congela o ALVO no 1º load do dia e carrega o
  // guardado-hoje; reinicia à meia-noite (fuso BR). PRECISA ficar antes do early
  // return abaixo (regras de hooks). Lê o alvo via ref, pois totalGuardarHoje só é
  // calculado mais adiante no render.
  const guardarTargetRef = useRef(0);
  useEffect(() => {
    if (isLoadingData) return;
    const hoje = getBrazilDate();
    const alvo = guardarTargetRef.current;
    try {
      // LIMPEZA 1x: o modelo antigo de "saldo adiantado" deixou saldos travados
      // (ex.: "guardou 990 hoje") gravados com a data de hoje — aí o reinício-no-dia
      // não pegava. Esta migração zera o resíduo uma única vez por aparelho.
      if (localStorage.getItem("orbis_guardar_ver") !== "2") {
        localStorage.setItem("orbis_guardar_ver", "2");
        localStorage.setItem("orbis_guardar_date", hoje);
        localStorage.setItem("orbis_guardar_target", String(alvo));
        localStorage.setItem("orbis_guardar_saved", "0");
        localStorage.removeItem("orbis_last_save_date");
        setSavedToday(false);
        setTargetSnapshot(alvo);
        setSavedTodayAmount(0);
        return;
      }
      if (localStorage.getItem("orbis_guardar_date") !== hoje) {
        // NOVO DIA → REINICIA limpo: alvo = sugestão de hoje, guardado-hoje = 0.
        // Nada de "saldo adiantado" carregado do dia anterior (isso travava o card em
        // "já guardou tudo"). Cada dia mostra do zero quanto falta guardar HOJE. O que
        // você guardou antes já abateu as contas (bills.saved_amount), então o alvo de
        // hoje já vem naturalmente menor conforme você quita.
        localStorage.setItem("orbis_guardar_date", hoje);
        localStorage.setItem("orbis_guardar_target", String(alvo));
        localStorage.setItem("orbis_guardar_saved", "0");
        setTargetSnapshot(alvo);
        setSavedTodayAmount(0);
      } else {
        // Mesmo dia: o alvo congela pra não encolher enquanto você guarda. MAS se você
        // ADICIONA uma conta (o alvo ao vivo sobe acima do congelado), atualiza na hora —
        // o congelado só SOBE, nunca desce (descer é o guardar, que já é mostrado à parte).
        const stored = Number(localStorage.getItem("orbis_guardar_target") || alvo);
        const novo = Math.max(stored, alvo);
        if (novo !== stored) localStorage.setItem("orbis_guardar_target", String(novo));
        setTargetSnapshot(novo);
        setSavedTodayAmount(Number(localStorage.getItem("orbis_guardar_saved") || 0));
      }
    } catch {
      setTargetSnapshot(alvo);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoadingData]);

  // Carrega o "último guardei" salvo no aparelho (sobrevive a fechar/abrir o app),
  // pra o botão de desfazer continuar disponível mesmo depois de sair e voltar.
  useEffect(() => {
    try {
      const raw = localStorage.getItem("orbis_ultimo_guardei");
      if (!raw) return;
      const obj = JSON.parse(raw);
      if (obj?.date === getBrazilDate() && obj?.data) setUltimoGuardei(obj.data);
      else localStorage.removeItem("orbis_ultimo_guardei");
    } catch {
      /* ignore */
    }
  }, []);

  if (loading || !user) {
    return null;
  }

  // "A guardar hoje" — quanto reservar do líquido de hoje pras metas + contas
  const todayName = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"][new Date().getDay()];
  const escaladoHoje = workingDays && workingDays.length > 0 ? workingDays.includes(todayName) : true;
  // Trabalhou no descanso? Conta como dia de trabalho → guarda a parte de hoje também.
  const todayIsWorkDay = escaladoHoje || trabalhouHoje;
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

  // Alimenta o ref com o alvo do dia. O snapshot é feito por um efeito lá em cima —
  // ANTES do early return — pra respeitar as regras de hooks.
  guardarTargetRef.current = totalGuardarHoje;

  // Soma um depósito ao "guardado hoje" (persiste no fuso BR).
  const registrarGuardadoHoje = (valor: number) => {
    const novo = savedTodayAmount + Math.max(0, valor);
    setSavedTodayAmount(novo);
    try {
      localStorage.setItem("orbis_guardar_date", getBrazilDate());
      localStorage.setItem("orbis_guardar_saved", String(novo));
      if (localStorage.getItem("orbis_guardar_target") == null) {
        localStorage.setItem("orbis_guardar_target", String(totalGuardarHoje));
      }
    } catch { /* ignore */ }
  };

  // ALVO do dia (snapshot). O "saldo adiantado" é savedTodayAmount (persiste e é
  // consumido a cada dia que passa, no efeito lá em cima).
  const alvoHoje = targetSnapshot ?? totalGuardarHoje;

  // PROJEÇÃO + crédito da poupança. Cada dia útil tem um alvo (contas amortizadas);
  // o saldo adiantado abate do dia MAIS PRÓXIMO primeiro. O "add-back" devolve o saldo
  // ao cronograma antes de abater concentrado, pra não contar duas vezes (o dinheiro
  // guardado já reduziu as contas). Total ao longo dos dias fica igual; muda só ONDE
  // o alívio aparece → guardar hoje faz o próximo dia cair de verdade, consistente.
  const proximosDias = (() => {
    const nomes = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
    const base = new Date();
    base.setHours(12, 0, 0, 0);
    // Dias úteis por mês (pra taxa sustentável das contas recorrentes no próximo ciclo).
    const diasUteisPorMes = Math.max(1, Math.round((workingDays && workingDays.length > 0 ? workingDays.length : 6) * 30 / 7));
    // Mostra só de HOJE até o ÚLTIMO DIA do mês atual (não uma lista rolando de 30 dias).
    const ultimoDiaMes = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate();
    const diasAteFimMes = Math.max(0, ultimoDiaMes - base.getDate());
    const out: { key: string; label: string; isWork: boolean; isToday: boolean; raw: number; valor: number }[] = [];
    for (let i = 0; i <= diasAteFimMes; i++) {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      const nome = nomes[d.getDay()];
      const isToday = i === 0;
      // Hoje conta como trabalho se está na escala OU se você trabalhou hoje (descanso trabalhado).
      const isWork = (workingDays && workingDays.length > 0 ? workingDays.includes(nome) : true) || (isToday && trabalhouHoje);
      let raw = 0;
      if (isToday) {
        raw = alvoHoje;
      } else if (isWork) {
        for (const bill of bills) {
          const quitada = bill.paid || Number(bill.saved_amount) >= Number(bill.amount);
          if (quitada || isOverdue(bill)) continue;
          const nd = nextDueDate(bill);
          if (nd && d.getTime() <= nd.getTime()) {
            raw += perDay(bill); // ciclo atual: o que falta ÷ dias úteis até vencer
          } else if (bill.recurring) {
            // Recorrente: passou o vencimento deste mês → rola pro próximo ciclo e mostra
            // a taxa mensal sustentável (valor cheio ÷ dias úteis do mês). Sem dia zerado.
            raw += (Number(bill.amount) || 0) / diasUteisPorMes;
          }
        }
      }
      const label = isToday ? "Hoje" : d.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" });
      out.push({ key: `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`, label, isWork, isToday, raw, valor: 0 });
    }
    // O que você guarda HOJE já abate as contas (bills.saved_amount cai e o perDay dos
    // PRÓXIMOS dias recalcula menor sozinho). Por isso o "guardado hoje" só desconta do
    // PRÓPRIO dia de hoje — descontar também dos dias seguintes seria contar duas vezes
    // (foi esse o bug de "300 antes da meia-noite, 500 depois"). Dias futuros mostram o
    // perDay real do saldo atual das contas.
    for (const x of out) {
      if (!x.isWork) { x.valor = 0; continue; }
      x.valor = x.isToday ? Math.max(0, x.raw - savedTodayAmount) : x.raw;
    }
    return out;
  })();
  // Hoje e "dia fechado" saem da própria projeção (já com o crédito aplicado).
  const restanteGuardarHoje = proximosDias.find((d) => d.isToday)?.valor ?? Math.max(0, alvoHoje - savedTodayAmount);
  const diaGuardadoFechado = savedToday || (savedTodayAmount > 0 && restanteGuardarHoje <= 0.005);
  const proximoDiaTrabalho = proximosDias.find((d) => !d.isToday && d.isWork);

  // Como a maioria das contas é RECORRENTE (nunca "acaba"), em vez de "livre das contas"
  // mostramos o RITMO SUSTENTÁVEL: quanto guardar por dia útil pra manter tudo em dia.
  // Recorrente = valor cheio ÷ dias úteis do mês; pontual = o que falta ÷ dias até vencer.
  const diasUteisMes = Math.max(1, Math.round((workingDays && workingDays.length > 0 ? workingDays.length : 6) * 30 / 7));
  const ritmoSustentavel = bills
    .filter((b) => !(b.paid || Number(b.saved_amount) >= Number(b.amount)) && !isOverdue(b))
    .reduce((s, b) => {
      if (b.recurring) return s + (Number(b.amount) || 0) / diasUteisMes;
      const nd = nextDueDate(b);
      return s + (nd ? remaining(b) / Math.max(1, workingDaysUntil(toYMD(nd))) : 0);
    }, 0);

  // Converte N dias ÚTEIS a partir de hoje numa data curta + nome do mês.
  const dataEmDiasUteis = (nDiasUteis: number) => {
    const nm = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
    const cur = new Date(); cur.setHours(12, 0, 0, 0);
    let count = 0, guard = 0;
    while (count < nDiasUteis && guard < 4000) {
      cur.setDate(cur.getDate() + 1); guard++;
      const util = workingDays && workingDays.length > 0 ? workingDays.includes(nm[cur.getDay()]) : true;
      if (util) count++;
    }
    return { data: cur.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }), mes: cur.toLocaleDateString("pt-BR", { month: "long" }) };
  };

  // Sobra por dia disponível pras METAS (renda líquida média − o que as contas comem).
  const sobraDiaMetas = Math.max(0, summary.mediaDiariaLiquida - ritmoSustentavel);

  // PLANO das metas: com várias metas dividindo a MESMA sobra, o mais eficiente é fazer
  // UMA DE CADA VEZ, por prioridade (curto → médio → longo; dentro do mesmo, a menor primeiro).
  // Cada meta "começa" quando as anteriores terminam → dá pra recomendar deixar as longas
  // pra um mês mais à frente.
  const planoMetas = (() => {
    const ordemPrazo: Record<string, number> = { curto: 0, medio: 1, longo: 2 };
    const ativas = goals
      .filter((g) => g.status === "active" && (Number(g.target_amount) - Number(g.current_amount)) > 0.005)
      .map((g) => ({ g, falta: Number(g.target_amount) - Number(g.current_amount) }))
      .sort((a, z) => (ordemPrazo[a.g.prazo || "medio"] - ordemPrazo[z.g.prazo || "medio"]) || (a.falta - z.falta));
    const mapa = new Map<string, { ordem: number; total: number; diasInicio: number; diasFim: number | null; dias: number | null }>();
    let acum = 0;
    ativas.forEach((item, i) => {
      const dias = sobraDiaMetas > 0 ? Math.ceil(item.falta / sobraDiaMetas) : null;
      const diasInicio = acum;
      const diasFim = dias !== null ? acum + dias : null;
      mapa.set(item.g.id, { ordem: i + 1, total: ativas.length, diasInicio, diasFim, dias });
      if (dias !== null) acum = diasFim!;
    });
    return mapa;
  })();

  // Metas ORDENADAS na tela pela mesma prioridade do plano (1ª, 2ª, 3ª...). As que já
  // não estão na fila (concluídas / atingidas) vão pro fim.
  const goalsOrdenadas = [...goals].sort((a, z) => {
    const oa = planoMetas.get(a.id)?.ordem ?? 9999;
    const oz = planoMetas.get(z.id)?.ordem ?? 9999;
    return oa - oz;
  });

  // Totais GUARDADOS — só o que está EM ABERTO, pra bater com o dinheiro que você realmente
  // tem separado. Conta paga sai da conta (o dinheiro já foi usado) → o total cai sozinho.
  // Guardar a mais também entra automático (saved_amount sobe e recalcula aqui).
  const contasGuardado = bills.filter((b) => !b.paid).reduce((s, b) => s + (Number(b.saved_amount) || 0), 0);
  const contasTotal = bills.filter((b) => !b.paid).reduce((s, b) => s + (Number(b.amount) || 0), 0);
  const metasGuardado = goals.filter((g) => g.status === "active").reduce((s, g) => s + (Number(g.current_amount) || 0), 0);
  const metasTotal = goals.filter((g) => g.status === "active").reduce((s, g) => s + (Number(g.target_amount) || 0), 0);

  // Calendário das METAS — CONTAS PRIMEIRO, meta só com a sobra.
  // Pra cada dia útil: sobra = líquido médio do dia − o que precisa guardar de CONTA naquele
  // dia (o mesmo valor do calendário de contas). Só o que sobra vai pra meta. Dia em que a
  // conta come tudo → R$0 pra meta (as metas "começam" quando alivia das contas). A sobra vai
  // acumulando na meta prioritária; quando ela fecha, passa pra próxima. Sem reserva por ora.
  const proximosDiasMetas = (() => {
    const fila = goalsOrdenadas
      .filter((g) => planoMetas.has(g.id))
      .map((g) => ({ nome: g.name, falta: Math.max(0, Number(g.target_amount) - Number(g.current_amount)) }));
    const ganhoDia = summary.mediaDiariaLiquida;
    let filaIdx = 0;
    let acum = 0;
    return proximosDias.map((dia) => {
      if (!dia.isWork) {
        return { key: dia.key, label: dia.label, isWork: false, isToday: dia.isToday, valor: 0, meta: null as string | null };
      }
      // dia.valor = quanto guardar de CONTA nesse dia (contas primeiro).
      const valor = Math.max(0, ganhoDia - dia.valor);
      const meta = filaIdx < fila.length ? fila[filaIdx].nome : null;
      if (valor > 0.005 && filaIdx < fila.length) {
        acum += valor;
        while (filaIdx < fila.length && acum >= fila[filaIdx].falta - 0.005) {
          acum -= fila[filaIdx].falta;
          filaIdx++;
        }
      }
      return { key: dia.key, label: dia.label, isWork: true, isToday: dia.isToday, valor, meta };
    });
  })();
  const metaHoje = proximosDiasMetas.find((d) => d.isToday)?.valor ?? 0;
  const temSobraMetas = proximosDiasMetas.some((d) => d.valor > 0.005);
  // Meta que recebe a sobra de hoje (a 1ª da fila de prioridade).
  const metaPrioritaria = goalsOrdenadas.find((g) => planoMetas.get(g.id)?.ordem === 1) ?? null;

  // Faixa de dias úteis "ideal" pra cada prazo (pra avisar quando aperta demais).
  const faixaPrazo = (p?: string) =>
    p === "curto" ? { max: 20, nome: "curto prazo" }
    : p === "longo" ? { max: 100000, nome: "longo prazo" }
    : { max: 66, nome: "médio prazo" }; // médio (default) ~ até 3 meses úteis

  // RECOMENDAÇÃO DE META (cálculo direto). Considera TODAS as metas: com várias, sugere
  // fazer uma de cada vez por prioridade e deixar as longas pra um mês à frente, dizendo
  // quanto guardar por dia. Retorna tom (cor), resumo (linha) e detalhe (abre ao tocar).
  const recomendarMeta = (
    targetAmount: number,
    currentAmount: number,
    prazo?: string | null,
    plano?: { ordem: number; total: number; diasInicio: number; diasFim: number | null; dias: number | null },
  ) => {
    const falta = Math.max(0, (Number(targetAmount) || 0) - (Number(currentAmount) || 0));
    if (falta <= 0) return { tom: "ok" as const, resumo: "Meta atingida! 🎉", detalhe: [] as string[] };

    const ganhoDia = summary.mediaDiariaLiquida;
    if (ganhoDia <= 0) {
      return { tom: "neutro" as const, resumo: "Registre alguns dias de venda que eu calculo o prazo.", detalhe: [] as string[] };
    }
    const fatMes = ganhoDia * diasUteisMes;
    const contasMes = ritmoSustentavel * diasUteisMes;
    const sobraDia = sobraDiaMetas; // renda média − contas (≥ 0)
    const sobraMes = sobraDia * diasUteisMes;
    const base: string[] = [
      `Você fatura, líquido, ~${formatCurrency(fatMes)}/mês (média ~${formatCurrency(ganhoDia)}/dia).`,
      `Suas contas comem ~${formatCurrency(contasMes)}/mês, sobrando ~${formatCurrency(sobraMes)}/mês (~${formatCurrency(sobraDia)}/dia) pra metas.`,
    ];

    if (sobraDia <= 0) {
      return {
        tom: "alerta" as const,
        resumo: "Suas contas consomem quase toda a renda — difícil separar pra essa meta agora.",
        detalhe: [...base, "Pra começar essa meta, aumente o faturamento ou reveja/renegocie contas."],
      };
    }

    // Sozinha (com a sobra cheia) e cenários.
    const soloN = Math.ceil(falta / sobraDia);
    const otimN = Math.ceil(falta / (sobraDia * 1.3));
    const pessN = Math.ceil(falta / (sobraDia * 0.7));

    // Na fila (se houver várias metas), cada uma começa quando as anteriores terminam.
    const multi = !!plano && plano.total > 1;
    const fimN = multi && plano!.diasFim != null ? plano!.diasFim : soloN;
    const inicioN = multi ? plano!.diasInicio : 0;
    const fim = dataEmDiasUteis(fimN);
    const inicio = dataEmDiasUteis(inicioN);

    const fx = faixaPrazo(prazo || undefined);
    const apertou = fimN > fx.max;

    let resumo: string;
    if (multi && plano!.ordem > 1) {
      resumo = `${plano!.ordem}ª de ${plano!.total} metas. Ideal começar ~${inicio.data} e terminar ~${fim.data}.`;
    } else if (apertou) {
      resumo = `Pra ${fx.nome} aperta: leva ~${fimN} dias (${fim.data}).`;
    } else {
      resumo = `Dá pra juntar em ~${fimN} dias (por volta de ${fim.data}).`;
    }

    const detalhe = [
      ...base,
      multi
        ? `Você tem ${plano!.total} metas ativas dividindo essa sobra. Fazendo uma de cada vez (mais rápido), essa é a ${plano!.ordem}ª — comece por volta de ${inicio.mes} (${inicio.data}) e termine ~${fim.data}.`
        : `Guardando ~${formatCurrency(sobraDia)}/dia, junta em ~${soloN} dias.`,
      `Guarde ~${formatCurrency(sobraDia)}/dia quando for a vez dela.`,
      `Cenários (fazendo sozinha): realista ~${soloN} dias · se render mais ~${otimN} · se render menos ~${pessN}.`,
      prazo
        ? (apertou
            ? `Você marcou ${fx.nome}, mas nesse plano fecha em ~${fimN} dias — considere longo prazo ou deixar pra outro mês.`
            : `Você marcou ${fx.nome} — combina com o seu ritmo. 👍`)
        : "Dica: defina curto/médio/longo pra eu avaliar melhor.",
    ];

    return { tom: (apertou ? "alerta" : "ok") as "ok" | "alerta", resumo, detalhe };
  };

  // Ordem de prioridade das contas (1ª, 2ª, 3ª...) — vencidas antes, depois a que vence
  // mais cedo, cartão como desempate. É o mesmo critério que numera os cards e reordena
  // sozinho quando você paga uma conta (a paga sai e a próxima vira a 1ª).
  const contasOrdem = (() => {
    const ativas = bills
      .filter((b) => !(b.paid || Number(b.saved_amount) >= Number(b.amount)))
      .map((b) => ({
        b,
        over: isOverdue(b),
        dueT: nextDueDate(b)?.getTime() ?? Number.MAX_SAFE_INTEGER,
        cartao: !!(b as { is_credit_card?: boolean }).is_credit_card,
      }))
      .sort((a, z) => (Number(z.over) - Number(a.over)) || (a.dueT - z.dueT) || (Number(z.cartao) - Number(a.cartao)));
    const mapa = new Map<string, { ordem: number; total: number }>();
    ativas.forEach((item, i) => mapa.set(item.b.id, { ordem: i + 1, total: ativas.length }));
    return mapa;
  })();

  // Contas ORDENADAS na tela pela prioridade acima. As quitadas vão pro fim.
  const billsOrdenadas = [...bills].sort((a, z) => {
    const oa = contasOrdem.get(a.id)?.ordem ?? 9999;
    const oz = contasOrdem.get(z.id)?.ordem ?? 9999;
    return oa - oz;
  });

  // "Guardei tudo": guarda a parte de hoje de TODAS as contas e metas de uma vez,
  // e marca "já guardou hoje" (renova amanhã).
  const handleGuardeiTudo = async () => {
    if (!user || totalGuardarHoje <= 0) return;
    try {
      const billDeltas: { id: string; delta: number }[] = [];
      const goalDeltas: { id: string; delta: number; prevStatus: string }[] = [];
      for (const bill of bills) {
        const quitada = bill.paid || Number(bill.saved_amount) >= Number(bill.amount);
        if (quitada || isOverdue(bill) || !todayIsWorkDay) continue;
        const add = perDay(bill);
        if (add > 0) {
          await supabase
            .from("planned_bills")
            .update({ saved_amount: Number(bill.saved_amount) + add })
            .eq("id", bill.id);
          billDeltas.push({ id: bill.id, delta: add });
        }
      }
      for (const goal of goals) {
        const share = (Math.max(0, summary.netToday) * (Number(goal.percentual_distribuicao) || 0)) / 100;
        if (share > 0) {
          const newAmount = Number(goal.current_amount) + share;
          await supabase
            .from("financial_goals")
            .update({ current_amount: newAmount, status: newAmount >= Number(goal.target_amount) ? "completed" : "active" })
            .eq("id", goal.id);
          goalDeltas.push({ id: goal.id, delta: share, prevStatus: goal.status });
        }
      }
      const savedHojeDelta = restanteGuardarHoje > 0 ? restanteGuardarHoje : totalGuardarHoje;
      registrarGuardadoHoje(savedHojeDelta);
      const guardeiInfo = { billDeltas, goalDeltas, savedHojeDelta };
      try {
        localStorage.setItem("orbis_last_save_date", getBrazilDate());
        // Persiste o "último guardei" pra o botão de desfazer sobreviver a fechar/abrir o app.
        localStorage.setItem("orbis_ultimo_guardei", JSON.stringify({ date: getBrazilDate(), data: guardeiInfo }));
      } catch { /* ignore */ }
      setSavedToday(true);
      setUltimoGuardei(guardeiInfo);
      toast({ title: "✓ Guardei tudo!", description: `${formatCurrency(totalGuardarHoje)} guardado.` });
      loadFinancialData();
    } catch {
      toast({ title: "Erro ao guardar", variant: "destructive" });
    }
  };

  // DESFAZER o último "Guardei tudo": tira das contas/metas exatamente o que foi somado
  // e reverte o "guardado hoje". Só funciona na mesma sessão (não sobrevive a recarregar).
  const handleDesfazerGuardei = async () => {
    if (!user) return;
    try {
      // Se ainda tenho os deltas do clique (mesma sessão / mesmo dia), reverto no banco
      // exatamente o que foi somado. Se não tenho (ex.: cliquei antes do app atualizar),
      // só zero o "guardou hoje" local — o valor no banco já é o que a pessoa realmente tem.
      let novoSaved = 0;
      if (ultimoGuardei) {
        for (const { id, delta } of ultimoGuardei.billDeltas) {
          const bill = bills.find((b) => b.id === id);
          if (bill) {
            await supabase
              .from("planned_bills")
              .update({ saved_amount: Math.max(0, Number(bill.saved_amount) - delta) })
              .eq("id", id);
          }
        }
        for (const { id, delta, prevStatus } of ultimoGuardei.goalDeltas) {
          const goal = goals.find((g) => g.id === id);
          if (goal) {
            await supabase
              .from("financial_goals")
              .update({ current_amount: Math.max(0, Number(goal.current_amount) - delta), status: prevStatus || "active" })
              .eq("id", id);
          }
        }
        novoSaved = Math.max(0, savedTodayAmount - ultimoGuardei.savedHojeDelta);
      }
      setSavedTodayAmount(novoSaved);
      try {
        localStorage.setItem("orbis_guardar_saved", String(novoSaved));
        localStorage.removeItem("orbis_last_save_date");
      } catch { /* ignore */ }
      setSavedToday(false);
      setUltimoGuardei(null);
      try { localStorage.removeItem("orbis_ultimo_guardei"); } catch { /* ignore */ }
      toast({ title: "Desfeito", description: "O 'guardei tudo' foi revertido." });
      loadFinancialData();
    } catch {
      toast({ title: "Erro ao desfazer", variant: "destructive" });
    }
  };

  // "Guardei outro valor": distribui o valor informado (a mais OU a menos que o
  // sugerido) proporcionalmente entre metas e contas, e diz quanto ainda falta.
  const handleGuardeiValor = async () => {
    const value = parseFloat(customSaveValue.replace(",", "."));
    if (!user || totalGuardarHoje <= 0 || isNaN(value) || value <= 0) {
      toast({ title: "Valor inválido", description: "Digite um valor maior que zero", variant: "destructive" });
      return;
    }
    const factor = value / totalGuardarHoje; // usado só na parte das metas
    const billPortion = value * (billsShareToday / totalGuardarHoje);
    try {
      // Contas: paga em cascata (vencimento mais próximo primeiro).
      await distribuirGuardado(billPortion);
      for (const goal of goals) {
        const share = ((Math.max(0, summary.netToday) * (Number(goal.percentual_distribuicao) || 0)) / 100) * factor;
        if (share > 0) {
          const newAmount = Number(goal.current_amount) + share;
          await supabase
            .from("financial_goals")
            .update({ current_amount: newAmount, status: newAmount >= Number(goal.target_amount) ? "completed" : "active" })
            .eq("id", goal.id);
        }
      }
      // Soma ao "guardado hoje": o card passa a mostrar o ALVO DO DIA − o que já foi
      // guardado (ex.: 602 − 392 = 210). Não cobra o restante amortizado no mesmo dia;
      // reinicia à meia-noite com o valor recalculado.
      registrarGuardadoHoje(value);
      setCustomSaveOpen(false);
      setCustomSaveValue("");
      const restanteAgora = Math.max(0, alvoHoje - (savedTodayAmount + value));
      toast({
        title: "✓ Guardado!",
        description: restanteAgora > 0.005
          ? `${formatCurrency(value)} guardado. Falta ${formatCurrency(restanteAgora)} pra hoje.`
          : `${formatCurrency(value)} guardado — dia fechado! Reinicia amanhã.`,
      });
      loadFinancialData();
    } catch {
      toast({ title: "Erro ao guardar", variant: "destructive" });
    }
  };

  // CASCATA: guardar paga o VENCIMENTO MAIS PRÓXIMO primeiro (não divide igual entre
  // todas). Assim os dias mais perto caem mais quando você guarda, de forma consistente
  // (vem do estado real das contas) e financeiramente esperta (quita o que vence antes).
  const distribuirGuardado = async (value: number) => {
    let restante = value;
    // Inclui VENCIDAS e paga elas primeiro: como a vencida tem vencimento no passado, ela
    // já entra no topo do sort por data (menor timestamp). Assim o dinheiro guardado quita
    // primeiro o que está atrasado (ex: o mercado), depois o vencimento mais próximo.
    const ativas = bills
      .filter((b) => !(b.paid || Number(b.saved_amount) >= Number(b.amount)))
      .map((b) => ({ b, over: isOverdue(b), due: nextDueDate(b)?.getTime() ?? Number.MAX_SAFE_INTEGER, falta: remaining(b) }))
      .sort((a, z) => (Number(z.over) - Number(a.over)) || (a.due - z.due));
    for (const item of ativas) {
      if (restante <= 0.005) break;
      const add = Math.min(restante, item.falta);
      if (add > 0) {
        await supabase
          .from("planned_bills")
          .update({ saved_amount: Number(item.b.saved_amount) + add })
          .eq("id", item.b.id);
        restante -= add;
      }
    }
  };

  // Distribui um valor SÓ nas contas vencidas (mais antiga primeiro), até acabar o valor.
  const distribuirVencidas = async (value: number) => {
    let restante = value;
    const vencidas = overdueBills
      .map((b) => ({ b, falta: remaining(b) }))
      .sort((a, z) => (a.b.due_date || "").localeCompare(z.b.due_date || ""));
    for (const item of vencidas) {
      if (restante <= 0.005) break;
      const add = Math.min(restante, item.falta);
      if (add > 0) {
        await supabase
          .from("planned_bills")
          .update({ saved_amount: Number(item.b.saved_amount) + add })
          .eq("id", item.b.id);
        restante -= add;
      }
    }
  };

  // "Guardar pra quitar vencidas": o valor informado vai 100% pras atrasadas.
  const handleGuardarVencidas = async () => {
    const value = parseFloat(vencidasSaveValue.replace(",", "."));
    if (!user || isNaN(value) || value <= 0) {
      toast({ title: "Valor inválido", description: "Digite um valor maior que zero", variant: "destructive" });
      return;
    }
    try {
      await distribuirVencidas(value);
      setVencidasSaveOpen(false);
      setVencidasSaveValue("");
      toast({ title: "✓ Guardado nas vencidas!", description: "O valor foi pra quitar o que está atrasado." });
      loadFinancialData();
    } catch {
      toast({ title: "Erro ao guardar", variant: "destructive" });
    }
  };

  // Registrar "guardei X" no dia selecionado na lista de próximos dias. Paga em cascata
  // (vencimento mais próximo primeiro). Se for hoje, conta no "guardado hoje".
  const handleGuardarNoDia = async () => {
    const value = parseFloat(diaSaveValue.replace(",", "."));
    if (!user || isNaN(value) || value <= 0) {
      toast({ title: "Valor inválido", description: "Digite um valor maior que zero", variant: "destructive" });
      return;
    }
    try {
      await distribuirGuardado(value);
      // Só conta no "guardado hoje" se o dia selecionado for HOJE. Dia anterior/outro só
      // abate as contas (senão inflava o buffer de hoje com um lançamento retroativo).
      if (diaSave?.isToday) registrarGuardadoHoje(value);
      const label = diaSave?.label || "hoje";
      setDiaSave(null);
      setDiaSaveValue("");
      toast({ title: "✓ Guardado!", description: `${formatCurrency(value)} registrado (${label}).` });
      loadFinancialData();
    } catch {
      toast({ title: "Erro ao guardar", variant: "destructive" });
    }
  };

  // Contas vencidas (não recorrentes que passaram do prazo e não estão quitadas)
  const overdueBills = bills.filter((bill) => isOverdue(bill));
  const vencidasTotal = overdueBills.reduce((sum, bill) => sum + remaining(bill), 0);
  // Rótulo/cor do risco de atrasar (Alto = juros/negativação rápido → prioridade).
  const riscoInfo = (r?: string) =>
    r === "alto" ? { label: "Risco alto", cls: "bg-destructive/15 text-destructive border-destructive/40" }
    : r === "baixo" ? { label: "Risco baixo", cls: "bg-muted text-muted-foreground border-border" }
    : { label: "Risco médio", cls: "bg-amber-500/15 text-amber-600 border-amber-500/40" };
  // Vencidas ordenadas por RISCO (alto primeiro), depois pela mais antiga.
  const ordemRisco: Record<string, number> = { alto: 0, medio: 1, baixo: 2 };
  const overdueBillsOrdenadas = [...overdueBills].sort(
    (a, z) => (ordemRisco[a.risco || "medio"] - ordemRisco[z.risco || "medio"]) || (a.due_date || "").localeCompare(z.due_date || ""),
  );
  // Contas "apertadas": vencem em poucos dias úteis e ainda falta bastante — são elas que
  // inflam o "a guardar hoje". Listamos pra avisar o porquê do valor alto.
  const contasApertadas = bills
    .filter((b) => !(b.paid || Number(b.saved_amount) >= Number(b.amount)) && !isOverdue(b))
    .map((b) => ({ b, wd: workingDaysUntil(nextDueDate(b) ? toYMD(nextDueDate(b)!) : null), falta: remaining(b) }))
    .filter((x) => x.wd <= 2 && x.falta > 20)
    .sort((a, z) => a.wd - z.wd || z.falta - a.falta);

  // Contas que VENCEM HOJE — precisa pagar hoje pra não pegar juros/multa.
  const contasVenceHojeLista = bills.filter((b) => {
    if (b.paid || Number(b.saved_amount) >= Number(b.amount) || isOverdue(b)) return false;
    const nd = nextDueDate(b);
    return nd != null && toYMD(nd) === getBrazilDate();
  });

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
              <div className="flex items-center justify-between gap-1">
                <p className="text-xs text-muted-foreground">A guardar hoje</p>
                {diaGuardadoFechado && (
                  <button
                    onClick={handleDesfazerGuardei}
                    title="Reverter o guardar de hoje"
                    aria-label="Reverter o guardar de hoje"
                    className="shrink-0 -mr-1 -mt-1 w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-primary active:scale-90 transition"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                )}
              </div>
              {diaGuardadoFechado ? (
                <>
                  <p className="text-base font-bold text-success mt-1 tracking-tight">
                    {savedTodayAmount > 0 ? `✓ Guardou ${formatCurrency(savedTodayAmount)} hoje` : "✓ Já guardou hoje"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1 truncate">Amanhã aparece o novo valor.</p>
                </>
              ) : (
                <>
                  <p className="text-2xl font-bold text-primary mt-1 tracking-tight truncate">
                    {formatCurrency(restanteGuardarHoje)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1 truncate">
                    {savedTodayAmount > 0
                      ? `adiantado: ${formatCurrency(savedTodayAmount)}`
                      : `metas ${formatCurrency(goalShareToday)} · contas ${formatCurrency(billsShareToday)}`}
                  </p>
                </>
              )}
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
                ) : diaGuardadoFechado ? (
                  <p className="text-xl font-bold text-success mt-1 tracking-tight">
                    {savedTodayAmount > 0 ? `✓ Guardou ${formatCurrency(savedTodayAmount)} hoje` : "✓ Já guardou hoje"}
                  </p>
                ) : (
                  <p className="text-2xl font-bold text-primary mt-1 tracking-tight whitespace-nowrap">
                    {formatCurrency(restanteGuardarHoje)}
                  </p>
                )}
                {!isLoadingData && diaGuardadoFechado && (
                  <p className="text-xs text-muted-foreground mt-1">Amanhã aparece o novo valor.</p>
                )}
                {!isLoadingData && !diaGuardadoFechado && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {savedTodayAmount > 0
                      ? `adiantado: ${formatCurrency(savedTodayAmount)}`
                      : `metas ${formatCurrency(goalShareToday)} · contas ${formatCurrency(billsShareToday)}`}
                  </p>
                )}
                {!isLoadingData && !todayIsWorkDay && (
                  <p className="text-xs text-muted-foreground mt-1">Hoje é seu descanso.</p>
                )}
              </div>
              <div className="flex flex-col items-end gap-2 shrink-0">
                {!isLoadingData && diaGuardadoFechado && (
                  <button
                    onClick={handleDesfazerGuardei}
                    title="Reverter o guardar de hoje"
                    aria-label="Reverter o guardar de hoje"
                    className="w-9 h-9 rounded-xl border border-primary/30 bg-primary/10 flex items-center justify-center text-primary active:scale-90 transition"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                )}
                <div className="w-10 h-10 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center">
                  <PiggyBank className="w-5 h-5 text-primary" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Aviso: contas apertadas (vencem logo) puxam o "a guardar hoje" pra cima */}
      {!isLoadingData && contasApertadas.length > 0 && (
        <Card className="bg-warning/5 border border-warning/30 rounded-2xl">
          <CardContent className="p-4">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">Contas apertadas puxam o valor a guardar</p>
                <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                  Vencem em poucos dias úteis e ainda falta juntar — por isso o "a guardar" do próximo dia útil sobe. Se der, pague ou adiante uma delas pra aliviar:
                </p>
                <div className="mt-2 space-y-1">
                  {contasApertadas.map(({ b, wd, falta }) => (
                    <div key={b.id} className="flex items-center justify-between gap-2 text-xs">
                      <span className="truncate text-foreground">{b.name} <span className="text-warning">· vence em {wd} {wd === 1 ? "dia útil" : "dias úteis"}</span></span>
                      <span className="font-bold text-foreground tabular-nums shrink-0">{formatCurrency(falta)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* VENCE HOJE — precisa pagar hoje pra não pegar juros/multa */}
      {!isLoadingData && contasVenceHojeLista.length > 0 && (
        <Card className="bg-destructive/5 border border-destructive/40 rounded-2xl">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
              <p className="text-sm font-semibold text-destructive">Vence HOJE — pague hoje</p>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Se passar de hoje, pode pegar juros/multa (principalmente cartão). Pague ainda hoje:
            </p>
            <div className="space-y-1">
              {contasVenceHojeLista.map((b) => (
                <div key={b.id} className="flex items-center justify-between gap-2 rounded-lg bg-background border border-destructive/20 px-3 py-2">
                  <span className="text-sm font-semibold truncate">
                    {b.name}
                    {b.risco === "alto" && <span className="ml-1.5 text-[10px] font-bold uppercase text-destructive">· risco alto</span>}
                  </span>
                  <span className="text-sm font-bold text-destructive tabular-nums shrink-0">{formatCurrency(remaining(b))}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Vencidas — lista detalhada: o que venceu, quanto já tem guardado e quanto FALTA */}
      {!isLoadingData && overdueBills.length > 0 && (
        <Card className="bg-destructive/5 border border-destructive/30 rounded-2xl">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
              <p className="text-sm font-semibold text-destructive">Vencidas — quite o quanto antes</p>
            </div>
            {overdueBillsOrdenadas.map((bill) => {
              const saved = Number(bill.saved_amount) || 0;
              const amount = Number(bill.amount) || 0;
              const falta = remaining(bill);
              const venceu = bill.due_date
                ? new Date(bill.due_date + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })
                : "—";
              const risco = riscoInfo(bill.risco);
              const dias = Math.max(1, prazoVencida[bill.id] ?? 3);
              const porDia = falta / dias;
              const quita = dataEmDiasUteis(dias);
              return (
                <div key={bill.id} className="rounded-lg bg-background border border-destructive/20 px-3 py-2 space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="text-sm font-semibold truncate">{bill.name}</p>
                        <span className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${risco.cls}`}>
                          {risco.label}
                        </span>
                      </div>
                      <p className="text-[11px] text-destructive">
                        venceu {venceu} · guardado {formatCurrency(saved)} de {formatCurrency(amount)}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[10px] text-muted-foreground">faltam</p>
                      <p className="text-sm font-bold text-destructive tabular-nums">{formatCurrency(falta)}</p>
                    </div>
                  </div>
                  {/* Planejador: em quantos dias úteis quer quitar essa vencida */}
                  <div className="rounded-lg bg-muted/40 border border-border/50 px-2.5 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] text-muted-foreground">Pagar em</span>
                      <div className="flex items-center gap-1">
                        {[3, 5, 10, 15].map((n) => (
                          <button
                            key={n}
                            type="button"
                            onClick={() => setPrazoVencida((p) => ({ ...p, [bill.id]: n }))}
                            className={`w-7 h-7 rounded-md text-xs font-bold transition-colors ${
                              dias === n ? "bg-primary text-primary-foreground" : "bg-background border border-border text-muted-foreground"
                            }`}
                          >
                            {n}
                          </button>
                        ))}
                        <span className="text-[11px] text-muted-foreground ml-0.5">dias úteis</span>
                      </div>
                    </div>
                    <p className="text-[11px] text-foreground mt-1.5">
                      Guarde <span className="font-bold text-primary">{formatCurrency(porDia)}</span>/dia útil · quita ~{quita.data}
                    </p>
                  </div>
                </div>
              );
            })}
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Já passaram do vencimento, então não entram no "a guardar hoje" (que é o ritmo pros próximos dias). São prioridade: o que você guardar aqui vai 100% pra quitar elas (mais antiga primeiro).
            </p>
            <Button
              onClick={() => { setVencidasSaveValue(String(Math.round(vencidasTotal * 100) / 100)); setVencidasSaveOpen(true); }}
              variant="destructive"
              className="w-full"
            >
              <PiggyBank className="w-4 h-4 mr-2" />
              Guardar pra quitar — {formatCurrency(vencidasTotal)}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Botão "Guardei tudo" — guarda a parte de hoje de tudo de uma vez */}
      {!isLoadingData && !diaGuardadoFechado && todayIsWorkDay && restanteGuardarHoje > 0 && (
        <div className="space-y-2">
          <button
            onClick={handleGuardeiTudo}
            className="w-full h-12 rounded-2xl bg-primary text-primary-foreground font-bold text-sm active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
          >
            ✓ Guardei tudo — {formatCurrency(restanteGuardarHoje)}
          </button>
          <button
            onClick={() => { setCustomSaveValue(""); setCustomSaveOpen(true); }}
            className="w-full h-11 rounded-2xl bg-card border border-primary/40 text-primary font-semibold text-sm active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
          >
            Guardei outro valor
          </button>
        </div>
      )}

      {/* Desfazer o último "Guardei tudo" (caso tenha apertado sem querer) */}
      {!isLoadingData && ultimoGuardei && (
        <button
          onClick={handleDesfazerGuardei}
          className="w-full h-11 rounded-2xl bg-card border border-border text-muted-foreground hover:text-foreground font-semibold text-sm active:scale-[0.98] transition flex items-center justify-center gap-2"
        >
          <RotateCw className="w-4 h-4" /> Desfazer "Guardei tudo"
        </button>
      )}

      {/* Próximos dias — projeção de quanto guardar (contas) nos dias que vêm */}
      {!isLoadingData && bills.length > 0 && (
        <Card className="bg-card border border-border/60 rounded-2xl">
          <CardContent className="p-4">
            <button
              onClick={() => setShowProjecao((v) => !v)}
              className="w-full flex items-center gap-3 text-left"
            >
              <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                <Calendar className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground">Próximos dias</p>
                <p className="text-xs text-muted-foreground truncate">
                  {proximoDiaTrabalho
                    ? <>Próximo dia útil: <span className="font-semibold text-primary">{proximoDiaTrabalho.label}</span> · {formatCurrency(proximoDiaTrabalho.valor)}</>
                    : "Sem dia de trabalho nos próximos 7 dias"}
                </p>
              </div>
              <ChevronDown className={`w-5 h-5 text-muted-foreground shrink-0 transition-transform ${showProjecao ? "rotate-180" : ""}`} />
            </button>

            {/* Ritmo sustentável — quanto guardar por dia útil pra manter as contas em dia */}
            {ritmoSustentavel > 0 && (
              <div className="mt-3 flex items-center justify-between gap-2 rounded-xl bg-success/5 border border-success/20 px-3 py-2">
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Valor fixo por dia pra pagar as contas</p>
                  <p className="text-[11px] text-muted-foreground">guardando isso todo dia de trabalho, as contas fecham mês a mês</p>
                </div>
                <p className="text-sm font-bold text-success text-right shrink-0">
                  {formatCurrency(ritmoSustentavel)}<span className="text-muted-foreground font-normal text-xs">/dia</span>
                </p>
              </div>
            )}

            {showProjecao && (
              <div className="mt-3 pt-3 border-t border-border/50">
                {/* Rolável: arraste pra baixo pra ver mais dias (próximos 30 dias). */}
                <div className="max-h-72 overflow-y-auto space-y-1.5 pr-1 overscroll-contain">
                  {proximosDias.map((d) => (
                    <button
                      key={d.key}
                      onClick={() => { setDiaSaveValue(""); setDiaSave({ label: d.label, isToday: d.isToday }); }}
                      className="w-full flex items-center justify-between px-2 py-2 rounded-lg hover:bg-primary/5 active:scale-[0.99] transition-[colors,transform]"
                    >
                      <span className="text-sm capitalize text-foreground">{d.label}</span>
                      <span className="flex items-center gap-2">
                        {d.isWork ? (
                          <span className="text-sm font-bold text-primary tabular-nums">{formatCurrency(d.valor)}</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">descanso</span>
                        )}
                        <Plus className="w-3.5 h-3.5 text-muted-foreground" />
                      </span>
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-muted-foreground pt-2 leading-relaxed">
                  Arraste pra baixo pra ver mais dias. Toque num dia pra registrar quanto guardou. Estimativa só das contas.
                </p>

                {/* Rever/lançar num dia ANTERIOR — pra corrigir depois que virou o dia */}
                <div className="mt-3 pt-3 border-t border-border/50 space-y-2">
                  <p className="text-[11px] font-semibold text-muted-foreground">Guardei em outro dia (rever / corrigir)</p>
                  <div className="flex gap-2">
                    <input
                      type="date"
                      value={outroDiaData}
                      max={getBrazilDate()}
                      onChange={(e) => setOutroDiaData(e.target.value)}
                      className="h-10 flex-1 min-w-0 bg-background border border-border rounded-lg px-2 text-sm text-foreground"
                    />
                    <button
                      onClick={() => {
                        setDiaSaveValue("");
                        const [, m, d] = outroDiaData.split("-");
                        setDiaSave({ label: outroDiaData === getBrazilDate() ? "Hoje" : `${d}/${m}`, isToday: outroDiaData === getBrazilDate() });
                      }}
                      className="shrink-0 h-10 px-4 rounded-lg bg-primary text-primary-foreground font-bold text-sm flex items-center gap-1.5 active:scale-95"
                    >
                      <Plus className="w-4 h-4" /> Lançar
                    </button>
                  </div>
                  <p className="text-[10px] text-muted-foreground leading-relaxed">
                    Escolha um dia passado e informe quanto guardou nele — vai pras suas contas do mesmo jeito (quita o vencimento mais próximo primeiro).
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Diálogo "Guardei em <dia>" — registra o valor guardado no dia selecionado */}
      <Dialog open={diaSave !== null} onOpenChange={(o) => { if (!o) setDiaSave(null); }}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-sm p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>Guardei em {diaSave?.label ?? ""}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Quanto você guardou{diaSave?.isToday ? " hoje" : ` em ${diaSave?.label ?? "esse dia"}`}? Vai abater do que falta nas suas contas.
            </p>
            <MoneyInput
              value={parseFloat(diaSaveValue) || 0}
              onChange={(n) => setDiaSaveValue(n ? String(n) : "")}
              autoFocus
              className="text-2xl font-bold h-14"
            />
            <Button
              onClick={handleGuardarNoDia}
              disabled={!diaSaveValue || (parseFloat(diaSaveValue.replace(",", ".")) || 0) <= 0}
              className="w-full h-12 text-base font-bold"
            >
              Guardar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Diálogo "Guardei outro valor" — valor real guardado (a mais/a menos) */}
      <Dialog open={customSaveOpen} onOpenChange={setCustomSaveOpen}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-sm p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>Quanto você guardou hoje?</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Falta guardar hoje: <span className="font-bold text-primary">{formatCurrency(restanteGuardarHoje)}</span>.
              Informe o que realmente guardou — pode ser a mais ou a menos.
            </p>
            <MoneyInput
              value={parseFloat(customSaveValue) || 0}
              onChange={(n) => setCustomSaveValue(n ? String(n) : "")}
              autoFocus
              className="text-2xl font-bold h-14"
            />
            {(() => {
              const v = parseFloat(customSaveValue.replace(",", ".")) || 0;
              if (v <= 0) return null;
              const falta = restanteGuardarHoje - v;
              return (
                <p className={`text-sm font-semibold ${falta > 0.005 ? "text-muted-foreground" : "text-success"}`}>
                  {falta > 0.005
                    ? `Vão faltar ${formatCurrency(falta)} pra hoje (aparece no card).`
                    : falta < -0.005
                      ? `Fecha o dia e ainda passa ${formatCurrency(-falta)}. 🎉`
                      : "Fecha o dia certinho. ✓"}
                </p>
              );
            })()}
            <Button
              onClick={handleGuardeiValor}
              disabled={!customSaveValue || (parseFloat(customSaveValue.replace(",", ".")) || 0) <= 0}
              className="w-full h-12 text-base font-bold"
            >
              Guardar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Diálogo "Guardar pra quitar vencidas" — valor vai 100% pras contas atrasadas */}
      <Dialog open={vencidasSaveOpen} onOpenChange={(o) => { if (!o) { setVencidasSaveOpen(false); setVencidasSaveValue(""); } }}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-sm p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>Guardar pra quitar vencidas</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Total vencido em aberto: <span className="font-bold text-destructive">{formatCurrency(vencidasTotal)}</span>.
              O valor vai 100% pras contas atrasadas, quitando a mais antiga primeiro.
            </p>
            <MoneyInput
              value={parseFloat(vencidasSaveValue) || 0}
              onChange={(n) => setVencidasSaveValue(n ? String(n) : "")}
              autoFocus
              className="text-2xl font-bold h-14"
            />
            {(() => {
              const v = parseFloat(vencidasSaveValue.replace(",", ".")) || 0;
              if (v <= 0) return null;
              const falta = vencidasTotal - v;
              return (
                <p className={`text-sm font-semibold ${falta > 0.005 ? "text-muted-foreground" : "text-success"}`}>
                  {falta > 0.005
                    ? `Ainda vão faltar ${formatCurrency(falta)} pra quitar tudo que está vencido.`
                    : "Quita todas as contas vencidas. ✓"}
                </p>
              );
            })()}
            <Button
              onClick={handleGuardarVencidas}
              disabled={!vencidasSaveValue || (parseFloat(vencidasSaveValue.replace(",", ".")) || 0) <= 0}
              variant="destructive"
              className="w-full h-12 text-base font-bold"
            >
              Guardar nas vencidas
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Distribuição automática do líquido diário */}
      <FeatureErrorBoundary title="A distribuição automática deu uma travada">
        <AutoDistribution userId={user.id} onChanged={loadFinancialData} />
      </FeatureErrorBoundary>

      {/* Importar histórico de vendas por PDF (IA lê e você revisa) */}
      <button
        onClick={() => setImportOpen(true)}
        className="w-full h-11 rounded-xl bg-card border border-primary/30 hover:border-primary/60 text-primary text-sm font-semibold flex items-center justify-center gap-2 active:scale-[0.98] transition"
      >
        <Upload className="w-4 h-4" />
        Importar histórico (PDF)
      </button>
      <ImportPdfDialog open={importOpen} onOpenChange={setImportOpen} userId={user.id} onImported={loadFinancialData} />

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
                      onClick={() => setNewBill({ ...newBill, isCreditCard: true, risco: "alto" })}
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

                  {/* Fixa / Com duração / Única — vale pra conta normal E cartão */}
                  <div className="space-y-2">
                    <Label>Essa conta se repete?</Label>
                    <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-muted">
                      {(["fixa", "duracao", "unica"] as const).map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setNewBill({ ...newBill, tipoTempo: t })}
                          className={`py-2 rounded-lg text-[11px] font-semibold transition-colors ${newBill.tipoTempo === t ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"}`}
                        >
                          {t === "fixa" ? "Fixa (todo mês)" : t === "duracao" ? "Com duração" : "Única (1 vez)"}
                        </button>
                      ))}
                    </div>
                    {newBill.tipoTempo === "duracao" && (
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">Dura</span>
                        <Input
                          type="number"
                          min="1"
                          value={newBill.durationMonths}
                          onChange={(e) => setNewBill({ ...newBill, durationMonths: e.target.value })}
                          placeholder="12"
                          className="w-20"
                        />
                        <span className="text-sm text-muted-foreground">meses e acaba</span>
                      </div>
                    )}
                    <p className="text-[11px] text-muted-foreground">
                      Fixa = todo mês pra sempre. Com duração = acaba depois de X meses (financiamento). <b className="text-foreground">Única</b> = aparece só uma vez; depois de pagar, some (não volta no mês seguinte).
                    </p>
                  </div>

                  {/* Risco se atrasar — orienta a urgência quando vence (cartão sugere Alto). */}
                  <div className="space-y-2">
                    <Label>Risco se atrasar</Label>
                    <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-muted">
                      {(["baixo", "medio", "alto"] as const).map((r) => (
                        <button
                          key={r}
                          type="button"
                          onClick={() => setNewBill({ ...newBill, risco: r })}
                          className={`py-2 rounded-lg text-xs font-semibold capitalize transition-colors ${
                            newBill.risco === r
                              ? r === "alto" ? "bg-background shadow-sm text-destructive"
                                : r === "medio" ? "bg-background shadow-sm text-amber-500"
                                : "bg-background shadow-sm text-foreground"
                              : "text-muted-foreground"
                          }`}
                        >
                          {r === "medio" ? "Médio" : r}
                        </button>
                      ))}
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Alto = juros/negativação rápido (cartões). Usado pra priorizar e avisar quando vence.
                    </p>
                  </div>

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

          {/* Total guardado — confira se bate com o que você separou de fato */}
          {!isLoadingData && bills.length > 0 && (
            <Card className="bg-card border border-border/60 rounded-2xl">
              <CardContent className="p-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Total guardado nas contas</p>
                  <p className="text-[11px] text-muted-foreground">de {formatCurrency(contasTotal)} no total das contas</p>
                </div>
                <p className="text-lg font-bold text-primary text-right shrink-0 tabular-nums">{formatCurrency(contasGuardado)}</p>
              </CardContent>
            </Card>
          )}

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
              {billsOrdenadas.map((bill) => {
                const ordemConta = contasOrdem.get(bill.id);
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
                // Recorrente já paga NESTE ciclo (mês) — já está juntando pro próximo vencimento.
                const pagoEsteCiclo = isRecurring && bill.paid_cycle === getBrazilDate().slice(0, 7);
                // Conta com duração: mostra progresso das parcelas (X/N).
                const temDuracao = bill.duration_months != null && bill.duration_months > 0;
                const ciclosPagos = bill.cycles_paid || 0;

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
                // "Apertada": vence em poucos dias úteis e ainda falta bastante — é o que
                // faz o "a guardar hoje" subir. Avisa em vez de só empilhar o valor num dia.
                const apertada = !overdue && !quitada && remainingValue > 20 && workDaysLeft <= 2;
                // Vence HOJE — precisa pagar hoje pra não pegar juros/multa.
                const venceHoje = !overdue && !quitada && nextDue != null && toYMD(nextDue) === getBrazilDate();

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
                    <CardContent className="p-3 space-y-2">
                      {/* Bloco COMPACTO — recorrente, valor e próximo vencimento; toca pra abrir */}
                      <button
                        type="button"
                        onClick={() => setContaAberta(contaAberta === bill.id ? null : bill.id)}
                        className="w-full text-left"
                      >
                        <div className="flex items-center gap-2">
                          {ordemConta?.ordem && (
                            <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-black flex items-center justify-center shrink-0">
                              {ordemConta.ordem}º
                            </span>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-semibold truncate">{bill.name}</p>
                              {bill.is_credit_card ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-violet-500/10 border border-violet-500/30 px-2 py-0.5 text-[10px] font-medium text-violet-400">
                                  <CreditCard className="w-3 h-3" />
                                  Cartão{bill.installments ? ` · ${bill.installments}x` : ""}
                                </span>
                              ) : isRecurring && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 border border-primary/20 px-2 py-0.5 text-[10px] font-medium text-primary">
                                  <RotateCw className="w-3 h-3" />
                                  Recorrente
                                </span>
                              )}
                              {bill.risco === "alto" && !pagoEsteCiclo && (
                                <span className="inline-flex items-center rounded-full bg-destructive/15 border border-destructive/40 px-2 py-0.5 text-[10px] font-bold uppercase text-destructive">
                                  Risco alto
                                </span>
                              )}
                              {pagoEsteCiclo && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-success/10 border border-success/30 px-2 py-0.5 text-[10px] font-medium text-success">
                                  <Check className="w-3 h-3" />
                                  Pago este mês
                                </span>
                              )}
                              {temDuracao && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-muted border border-border px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                                  {ciclosPagos}/{bill.duration_months} pagas
                                </span>
                              )}
                              {venceHoje && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-destructive/15 border border-destructive/40 px-2 py-0.5 text-[10px] font-bold uppercase text-destructive">
                                  <AlertTriangle className="w-3 h-3" />
                                  Vence hoje · pague hoje
                                </span>
                              )}
                              {apertada && !venceHoje && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-warning/10 border border-warning/30 px-2 py-0.5 text-[10px] font-bold uppercase text-warning">
                                  <AlertTriangle className="w-3 h-3" />
                                  Aperta · vence em {workDaysLeft} {workDaysLeft === 1 ? "dia útil" : "dias úteis"}
                                </span>
                              )}
                            </div>
                            <div className="flex flex-wrap items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                              <span>Valor: <span className="font-medium text-foreground">{formatCurrency(amount)}</span></span>
                              {overdue ? (
                                bill.due_date && (
                                  <span className="flex items-center gap-1 text-destructive font-semibold">
                                    <AlertTriangle className="w-3 h-3" />
                                    Venceu {new Date(bill.due_date + "T12:00:00Z").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} · faltam {formatCurrency(remainingValue)}
                                  </span>
                                )
                              ) : isRecurring ? (
                                nextDueLabel && (
                                  <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />Próxima: {nextDueLabel}</span>
                                )
                              ) : (
                                bill.due_date && (
                                  <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />Vence {new Date(bill.due_date + "T12:00:00Z").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}</span>
                                )
                              )}
                            </div>
                          </div>
                          {quitada ? (
                            <Check className="w-5 h-5 text-success shrink-0" />
                          ) : (
                            <ChevronDown className={`w-5 h-5 text-muted-foreground shrink-0 transition-transform ${contaAberta === bill.id ? "rotate-180" : ""}`} />
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                          <Progress value={progress} className="h-1.5 flex-1" />
                          <span className="text-[11px] font-semibold text-primary shrink-0">{progress.toFixed(0)}%</span>
                        </div>
                      </button>

                      {contaAberta === bill.id && (
                        <div className="pt-1 space-y-3">
                        <p className="text-xs text-muted-foreground">{formatCurrency(saved)} guardado</p>

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

                      {/* Editar / excluir a conta */}
                      <div className="flex gap-2">
                        {bill.payment_code && bill.payment_code.trim() !== "" && (
                          <Button variant="outline" size="sm" onClick={() => handleCopyPaymentCode(bill)} className="flex-1">
                            <Copy className="w-4 h-4 mr-1.5 text-primary" /> Copiar código
                          </Button>
                        )}
                        <Button variant="outline" size="sm" onClick={() => openEditBill(bill)} className="flex-1" aria-label="Editar conta">
                          <Pencil className="w-4 h-4 mr-1.5" /> Editar
                        </Button>
                        <Button variant="outline" size="icon" onClick={() => handleDeleteBill(bill)} className="shrink-0" aria-label="Excluir conta">
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                        </div>
                      )}
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
                    <Label>Prazo</Label>
                    <div className="grid grid-cols-3 gap-2 mt-1.5">
                      {([["curto", "Curto"], ["medio", "Médio"], ["longo", "Longo"]] as const).map(([val, lbl]) => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setNewGoal({ ...newGoal, prazo: val })}
                          className={`h-9 rounded-lg border text-xs font-semibold transition-colors ${
                            newGoal.prazo === val ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/40"
                          }`}
                        >
                          {lbl}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Prévia da recomendação — já avisa (em vermelho) se o prazo apertar */}
                  {parseFloat(newGoal.target_amount) > 0 && (() => {
                    const rec = recomendarMeta(parseFloat(newGoal.target_amount), 0, newGoal.prazo);
                    return (
                      <div className={`rounded-xl px-3 py-2.5 border text-xs leading-relaxed ${
                        rec.tom === "ok" ? "bg-success/5 border-success/25 text-foreground/90"
                        : rec.tom === "alerta" ? "bg-destructive/5 border-destructive/35 text-destructive"
                        : "bg-muted/40 border-border/50 text-muted-foreground"
                      }`}>
                        {rec.resumo}
                      </div>
                    );
                  })()}

                  <div>
                    <Label>Data limite (opcional)</Label>
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

          {/* Total guardado — confira se bate com o que você separou de fato */}
          {!isLoadingData && goals.length > 0 && (
            <Card className="bg-card border border-border/60 rounded-2xl">
              <CardContent className="p-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Total guardado nas metas</p>
                  <p className="text-[11px] text-muted-foreground">de {formatCurrency(metasTotal)} somando todas as metas</p>
                </div>
                <p className="text-lg font-bold text-primary text-right shrink-0 tabular-nums">{formatCurrency(metasGuardado)}</p>
              </CardContent>
            </Card>
          )}

          {/* Calendário das metas — quanto guardar por dia útil, e pra qual meta cada dia vai */}
          {!isLoadingData && goals.length > 0 && planoMetas.size > 0 && (
            <Card className="bg-card border border-border/60 rounded-2xl">
              <CardContent className="p-4">
                <button
                  onClick={() => setShowProjecaoMetas((v) => !v)}
                  className="w-full flex items-center gap-3 text-left"
                >
                  <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                    <Calendar className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground">Calendário das metas</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {temSobraMetas
                        ? <>Hoje, depois das contas, sobra <span className="font-semibold text-primary">{formatCurrency(metaHoje)}</span> pra meta</>
                        : "Suas contas consomem toda a renda do dia — as metas começam quando aliviar das contas"}
                    </p>
                  </div>
                  <ChevronDown className={`w-5 h-5 text-muted-foreground shrink-0 transition-transform ${showProjecaoMetas ? "rotate-180" : ""}`} />
                </button>

                {/* Guardar hoje pras metas — joga a sobra do dia na meta prioritária */}
                {temSobraMetas && metaPrioritaria && (
                  <Button
                    onClick={() => openDeposit({ kind: "goal", goal: metaPrioritaria }, metaHoje)}
                    className="w-full mt-3"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Guardar hoje — {formatCurrency(metaHoje)} em {metaPrioritaria.name}
                  </Button>
                )}

                {showProjecaoMetas && (
                  <div className="mt-3 pt-3 border-t border-border/50">
                    <div className="max-h-72 overflow-y-auto space-y-1.5 pr-1 overscroll-contain">
                      {proximosDiasMetas.map((d) => {
                        const sobrou = d.isWork && d.valor > 0.005;
                        return (
                          <div
                            key={d.key}
                            className="w-full flex items-center justify-between px-2 py-2 rounded-lg"
                          >
                            <div className="min-w-0">
                              <span className="text-sm capitalize text-foreground">{d.label}</span>
                              {sobrou && d.meta && (
                                <span className="block text-[11px] text-muted-foreground truncate">→ {d.meta}</span>
                              )}
                              {d.isWork && !sobrou && (
                                <span className="block text-[11px] text-muted-foreground truncate">tudo foi pras contas</span>
                              )}
                            </div>
                            {d.isWork ? (
                              <span className={`text-sm font-bold tabular-nums shrink-0 ${sobrou ? "text-primary" : "text-muted-foreground"}`}>{formatCurrency(d.valor)}</span>
                            ) : (
                              <span className="text-xs text-muted-foreground shrink-0">descanso</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    <p className="text-[11px] text-muted-foreground pt-2 leading-relaxed">
                      Contas primeiro: cada dia guarda a conta do dia e só a sobra do líquido vai pra meta prioritária (curto → médio → longo). Dia sem sobra fica em R$0 pra meta.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

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
              {goalsOrdenadas.map(goal => {
                const progress = (goal.current_amount / goal.target_amount) * 100;
                const remaining = goal.target_amount - goal.current_amount;
                const plano = planoMetas.get(goal.id);
                const rec = recomendarMeta(goal.target_amount, goal.current_amount, goal.prazo, plano);
                const recExpandida = recAberta === goal.id;
                const aberta = metaAberta === goal.id;

                return (
                  <Card key={goal.id} className="card-gradient-border">
                    <CardContent className="p-3 space-y-2">
                      {/* Bloco COMPACTO — toca pra abrir os detalhes */}
                      <button
                        type="button"
                        onClick={() => setMetaAberta(aberta ? null : goal.id)}
                        className="w-full flex items-center gap-3 text-left"
                      >
                        {plano?.ordem && (
                          <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-black flex items-center justify-center shrink-0">
                            {plano.ordem}º
                          </span>
                        )}
                        {goal.icon && goal.icon.startsWith("http") ? (
                          <img src={goal.icon} alt="" className="w-10 h-10 rounded-xl object-cover border border-primary/30 shrink-0" />
                        ) : (
                          <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                            <Target className="w-5 h-5 text-primary" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold truncate">{goal.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatCurrency(goal.current_amount)} de {formatCurrency(goal.target_amount)} · {progress.toFixed(0)}%
                          </p>
                        </div>
                        {goal.status === "completed" ? (
                          <Check className="w-5 h-5 text-success shrink-0" />
                        ) : (
                          <ChevronDown className={`w-5 h-5 text-muted-foreground shrink-0 transition-transform ${aberta ? "rotate-180" : ""}`} />
                        )}
                      </button>
                      <Progress value={progress} className="h-1.5" />

                      {aberta && (
                        <div className="pt-2 space-y-3">
                        {remaining > 0 && (
                          <p className="text-sm text-muted-foreground">
                            Faltam {formatCurrency(remaining)} para atingir sua meta
                          </p>
                        )}
                        {goal.deadline && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Calendar className="w-3 h-3" /> Data limite: {new Date(goal.deadline).toLocaleDateString('pt-BR')}
                          </p>
                        )}
                        {Number(goal.percentual_distribuicao) > 0 && (
                          <p className="text-xs text-primary flex items-center gap-1.5">
                            <Sparkles className="w-3 h-3 shrink-0" />
                            Guardar {Number(goal.percentual_distribuicao).toFixed(0)}% do líquido do dia
                          </p>
                        )}

                      {/* Recomendação (cálculo direto) — toca pra abrir o detalhe com cenários */}
                      {remaining > 0 && (
                        <button
                          type="button"
                          onClick={() => setRecAberta(recExpandida ? null : goal.id)}
                          className={`w-full text-left flex items-start gap-2 rounded-xl px-3 py-2.5 border transition-colors ${
                            rec.tom === "ok" ? "bg-success/5 border-success/25"
                            : rec.tom === "alerta" ? "bg-destructive/5 border-destructive/35"
                            : "bg-muted/40 border-border/50"
                          }`}
                        >
                          <Sparkles className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${
                            rec.tom === "ok" ? "text-success" : rec.tom === "alerta" ? "text-destructive" : "text-muted-foreground"
                          }`} />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <p className={`text-[10px] uppercase tracking-wider font-semibold ${rec.tom === "alerta" ? "text-destructive" : "text-muted-foreground"}`}>Recomendação</p>
                              {rec.detalhe.length > 0 && (
                                <span className="text-[10px] text-muted-foreground">{recExpandida ? "fechar ▲" : "ver mais ▼"}</span>
                              )}
                            </div>
                            <p className="text-xs text-foreground/90 leading-relaxed">{rec.resumo}</p>
                            {recExpandida && rec.detalhe.length > 0 && (
                              <div className="mt-2 pt-2 border-t border-border/40 space-y-1">
                                {rec.detalhe.map((linha, i) => (
                                  <p key={i} className="text-[11px] text-muted-foreground leading-relaxed">{linha}</p>
                                ))}
                                <p className="text-[10px] text-muted-foreground/70 italic pt-1">É uma recomendação baseada nos seus resultados — a decisão é sua.</p>
                              </div>
                            )}
                          </div>
                        </button>
                      )}

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
                            variant="outline"
                            size="icon"
                            onClick={() => openEditGoal(goal)}
                            className="flex-shrink-0"
                            aria-label="Editar meta"
                          >
                            <Pencil className="w-4 h-4" />
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

      {/* Editar meta — muda nome, valor e prazo sem precisar apagar e recriar */}
      <Dialog open={editGoal !== null} onOpenChange={(o) => { if (!o) setEditGoal(null); }}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-sm p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>Editar meta</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label>Nome</Label>
              <Input
                value={editGoalForm.name}
                onChange={(e) => setEditGoalForm({ ...editGoalForm, name: e.target.value })}
                placeholder="Ex.: Óculos novo"
              />
            </div>
            <div>
              <Label>Valor da meta (R$)</Label>
              <MoneyInput
                value={parseFloat(editGoalForm.target_amount) || 0}
                onChange={(n) => setEditGoalForm({ ...editGoalForm, target_amount: n ? String(n) : "" })}
              />
            </div>
            <div>
              <Label>Prazo</Label>
              <div className="grid grid-cols-3 gap-2 mt-1.5">
                {([["curto", "Curto"], ["medio", "Médio"], ["longo", "Longo"]] as const).map(([val, lbl]) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setEditGoalForm({ ...editGoalForm, prazo: val })}
                    className={`h-9 rounded-lg border text-xs font-semibold transition-colors ${
                      editGoalForm.prazo === val ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/40"
                    }`}
                  >
                    {lbl}
                  </button>
                ))}
              </div>
            </div>
            {parseFloat(editGoalForm.target_amount) > 0 && editGoal && (() => {
              const rec = recomendarMeta(parseFloat(editGoalForm.target_amount), editGoal.current_amount, editGoalForm.prazo);
              return (
                <div className={`rounded-xl px-3 py-2.5 border text-xs leading-relaxed ${
                  rec.tom === "ok" ? "bg-success/5 border-success/25 text-foreground/90"
                  : rec.tom === "alerta" ? "bg-destructive/5 border-destructive/35 text-destructive"
                  : "bg-muted/40 border-border/50 text-muted-foreground"
                }`}>
                  {rec.resumo}
                </div>
              );
            })()}
            <div>
              <Label>Data limite (opcional)</Label>
              <Input
                type="date"
                value={editGoalForm.deadline}
                onChange={(e) => setEditGoalForm({ ...editGoalForm, deadline: e.target.value })}
              />
            </div>
            <Button onClick={handleSaveEditGoal} disabled={savingEditGoal} className="w-full">
              {savingEditGoal ? "Salvando..." : "Salvar alterações"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

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
            <div className="space-y-2">
              <Label>Essa conta se repete?</Label>
              <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-muted">
                {(["fixa", "duracao", "unica"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setEditBillForm({ ...editBillForm, tipoTempo: t })}
                    className={`py-2 rounded-lg text-[11px] font-semibold transition-colors ${editBillForm.tipoTempo === t ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"}`}
                  >
                    {t === "fixa" ? "Fixa (todo mês)" : t === "duracao" ? "Com duração" : "Única (1 vez)"}
                  </button>
                ))}
              </div>
              {editBillForm.tipoTempo === "duracao" && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Dura</span>
                  <Input
                    type="number"
                    min="1"
                    value={editBillForm.durationMonths}
                    onChange={(e) => setEditBillForm({ ...editBillForm, durationMonths: e.target.value })}
                    placeholder="12"
                    className="w-20"
                  />
                  <span className="text-sm text-muted-foreground">meses e acaba</span>
                </div>
              )}
              <p className="text-[11px] text-muted-foreground">
                <b className="text-foreground">Única</b> = some depois de pagar (não volta no mês seguinte).
              </p>
            </div>
            <div className="space-y-2">
              <Label>Risco se atrasar</Label>
              <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-muted">
                {(["baixo", "medio", "alto"] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setEditBillForm({ ...editBillForm, risco: r })}
                    className={`py-2 rounded-lg text-xs font-semibold capitalize transition-colors ${
                      editBillForm.risco === r
                        ? r === "alto" ? "bg-background shadow-sm text-destructive"
                          : r === "medio" ? "bg-background shadow-sm text-amber-500"
                          : "bg-background shadow-sm text-foreground"
                        : "text-muted-foreground"
                    }`}
                  >
                    {r === "medio" ? "Médio" : r}
                  </button>
                ))}
              </div>
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
