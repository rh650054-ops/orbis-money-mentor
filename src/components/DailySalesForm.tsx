import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DollarSign, CreditCard, Smartphone, Banknote, AlertTriangle, X, CalendarIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";
import { MotivationalCard } from "./MotivationalCard";
import { MotivationalMessage } from "./MotivationalMessage";
import { getBrazilDate, formatBrazilDate } from "@/lib/dateUtils";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { syncLeaderboardRevenue } from "@/utils/syncDailySales";

const salesSchema = z.object({
  totalProfit: z.string().min(1, { message: "Valor vendido é obrigatório" }).refine((val) => {
    const num = parseFloat(val);
    return !isNaN(num) && num > 0 && num <= 999999;
  }, { message: "Valor vendido deve ser maior que 0" }),
  cost: z.string().refine((val) => {
    if (!val) return true;
    const num = parseFloat(val);
    return !isNaN(num) && num >= 0 && num <= 999999;
  }, { message: "Custo deve ser entre 0 e 999.999" }),
  totalDebt: z.string().refine((val) => {
    if (!val) return true;
    const num = parseFloat(val);
    return !isNaN(num) && num >= 0 && num <= 999999;
  }, { message: "Calotes devem ser entre 0 e 999.999" }),
  cashSales: z.string().refine((val) => {
    if (!val) return true;
    const num = parseFloat(val);
    return !isNaN(num) && num >= 0 && num <= 999999;
  }, { message: "Vendas em dinheiro devem ser entre 0 e 999.999" }),
  pixSales: z.string().refine((val) => {
    if (!val) return true;
    const num = parseFloat(val);
    return !isNaN(num) && num >= 0 && num <= 999999;
  }, { message: "Vendas em Pix devem ser entre 0 e 999.999" }),
  cardSales: z.string().refine((val) => {
    if (!val) return true;
    const num = parseFloat(val);
    return !isNaN(num) && num >= 0 && num <= 999999;
  }, { message: "Vendas em cartão devem ser entre 0 e 999.999" }),
  notes: z.string().max(1000, { message: "Observações devem ter no máximo 1000 caracteres" }).optional()
});

interface DailySalesFormProps {
  userId: string;
  onSaved?: () => void;
}

export default function DailySalesForm({ userId, onSaved }: DailySalesFormProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [baseDailyGoal, setBaseDailyGoal] = useState(200);
  const [showMotivation, setShowMotivation] = useState(false);
  const [showMessage, setShowMessage] = useState(false);
  const [motivationPercentage, setMotivationPercentage] = useState(0);
  const [dayProfit, setDayProfit] = useState(0);
  const [formData, setFormData] = useState({
    totalProfit: "",
    cost: "",
    totalDebt: "",
    cashSales: "",
    pixSales: "",
    cardSales: "",
    notes: ""
  });
  const [dateOption, setDateOption] = useState<"today" | "yesterday" | "custom">("today");
  const [customDate, setCustomDate] = useState<Date>();

  useEffect(() => {
    loadDailyGoal();
  }, [userId]);

  const loadDailyGoal = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("base_daily_goal")
      .eq("user_id", userId)
      .single();

    if (data?.base_daily_goal) {
      setBaseDailyGoal(data.base_daily_goal);
    }
  };

  const handlePlannedOff = async () => {
    const today = getBrazilDate();
    
    const { error } = await supabase
      .from("daily_work_log")
      .upsert({
        user_id: userId,
        date: today,
        status: 'planned_off',
        notes: 'Folga planejada'
      }, {
        onConflict: 'user_id,date'
      });

    if (error) {
      toast({
        title: "Erro",
        description: "Não foi possível registrar a folga.",
        variant: "destructive"
      });
      return;
    }

    toast({
      title: "✅ Folga registrada!",
      description: "Sua ofensiva está protegida. Descanse bem!",
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Validate form data
      const validation = salesSchema.safeParse(formData);
      if (!validation.success) {
        const firstError = validation.error.errors[0];
        toast({
          title: "Erro de validação",
          description: firstError.message,
          variant: "destructive"
        });
        setIsLoading(false);
        return;
      }

      const salesData = {
        user_id: userId,
        date: getBrazilDate(),
        total_profit: formData.totalProfit ? parseFloat(formData.totalProfit) : 0,
        cost: formData.cost ? parseFloat(formData.cost) : 0,
        total_debt: formData.totalDebt ? parseFloat(formData.totalDebt) : 0,
        cash_sales: formData.cashSales ? parseFloat(formData.cashSales) : 0,
        pix_sales: formData.pixSales ? parseFloat(formData.pixSales) : 0,
        card_sales: formData.cardSales ? parseFloat(formData.cardSales) : 0,
        notes: formData.notes.trim()
      };

      const today = getBrazilDate();
      const profit = parseFloat(formData.totalProfit);

      // CORRIGIDO: Verificar se já existe registro para hoje e somar valores
      const { data: existingSale } = await supabase
        .from("daily_sales")
        .select("*")
        .eq("user_id", userId)
        .eq("date", today)
        .maybeSingle();

      let totalDayProfit = profit;

      if (existingSale) {
        // Atualizar somando aos valores existentes
        totalDayProfit = (existingSale.total_profit || 0) + profit;
        const { error } = await supabase
          .from("daily_sales")
          .update({
            total_profit: totalDayProfit,
            cost: (existingSale.cost || 0) + salesData.cost,
            total_debt: (existingSale.total_debt || 0) + salesData.total_debt,
            cash_sales: (existingSale.cash_sales || 0) + salesData.cash_sales,
            pix_sales: (existingSale.pix_sales || 0) + salesData.pix_sales,
            card_sales: (existingSale.card_sales || 0) + salesData.card_sales,
            notes: formData.notes ? `${existingSale.notes || ''}\n${formData.notes}` : existingSale.notes,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingSale.id);
        
        if (error) throw error;
      } else {
        // Inserir novo registro
        const { error } = await supabase
          .from("daily_sales")
          .insert(salesData);
        
        if (error) throw error;
      }

      // Atualizar blocos de hora se existir plano hoje
      const currentHour = new Date().getHours();
      const { data: planData } = await supabase
        .from("daily_goal_plans")
        .select("id, work_hours")
        .eq("user_id", userId)
        .eq("date", today)
        .single();

      if (planData) {
        // Calcular qual bloco estamos (baseado na hora atual)
        const hourIndex = Math.min(currentHour % planData.work_hours, planData.work_hours - 1);
        
        const { data: currentBlock } = await supabase
          .from("hourly_goal_blocks")
          .select("*")
          .eq("plan_id", planData.id)
          .eq("hour_index", hourIndex)
          .single();

        if (currentBlock) {
          const newAchievedAmount = currentBlock.achieved_amount + profit;
          const totalWithAdjustment = newAchievedAmount + currentBlock.manual_adjustment;
          const isCompleted = totalWithAdjustment >= currentBlock.target_amount;

          await supabase
            .from("hourly_goal_blocks")
            .update({
              achieved_amount: newAchievedAmount,
              is_completed: isCompleted,
            })
            .eq("id", currentBlock.id);

          if (isCompleted && !currentBlock.is_completed) {
            toast({
              title: "🎯 Meta da hora batida!",
              description: `Bloco ${hourIndex + 1} completado! Continue assim!`,
              duration: 5000,
            });
          }
        }
      }

      // Mostrar mensagem motivacional
      setDayProfit(totalDayProfit);
      setShowMessage(true);
      setTimeout(() => setShowMessage(false), 5000);

      // Atualizar constância baseado no total do dia
      const { data: profile } = await supabase
        .from("profiles")
        .select("streak_days, last_check_in_date")
        .eq("user_id", userId)
        .single();

      let newStreak = profile?.streak_days || 0;
      
      // Se bateu a meta, avançar constância
      if (totalDayProfit >= baseDailyGoal) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayDate = new Date(yesterday);
        yesterdayDate.setHours(0, 0, 0, 0);
        
        if (profile?.last_check_in_date) {
          const lastCheckDate = new Date(profile.last_check_in_date);
          lastCheckDate.setHours(0, 0, 0, 0);
          const todayDate = new Date(today);
          todayDate.setHours(0, 0, 0, 0);
          
          const daysDiff = Math.floor((todayDate.getTime() - lastCheckDate.getTime()) / (1000 * 60 * 60 * 24));
          
          if (daysDiff === 1) {
            newStreak = newStreak + 1;
          } else if (daysDiff > 1) {
            newStreak = 1;
          }
        } else {
          newStreak = 1;
        }

        await supabase
          .from("profiles")
          .update({ streak_days: newStreak, last_check_in_date: today })
          .eq("user_id", userId);
      }

      // Calculate percentage and show motivational message
      const percentage = (totalDayProfit / baseDailyGoal) * 100;
      setMotivationPercentage(percentage);
      setShowMotivation(true);

      // Log work day with details
      const goalAchieved = totalDayProfit >= baseDailyGoal;
      const percentageAchieved = percentage;
      
      await supabase
        .from("daily_work_log")
        .upsert({
          user_id: userId,
          date: today,
          status: 'worked',
          goal_achieved: goalAchieved,
          sales_amount: totalDayProfit,
          daily_goal: baseDailyGoal,
          percentage_achieved: percentageAchieved
        }, {
          onConflict: 'user_id,date'
        });

      // Mensagem motivacional automática
      const missing = Math.max(0, baseDailyGoal - totalDayProfit);
      const missingPercent = ((missing / baseDailyGoal) * 100).toFixed(0);
      
      if (totalDayProfit >= baseDailyGoal) {
        toast({
          title: "🔥 Visionário! Meta batida!",
          description: `R$${totalDayProfit.toFixed(2)} hoje! Isso aqui é disciplina de verdade!`,
          duration: 6000,
        });
      } else {
        toast({
          title: `Você fez R$${totalDayProfit.toFixed(2)} hoje`,
          description: `Faltou ${missingPercent}% para a meta. Não para. Tua história está sendo escrita.`,
          duration: 6000,
        });
      }

      // Clear form after successful save
      setFormData({
        totalProfit: "",
        cost: "",
        totalDebt: "",
        cashSales: "",
        pixSales: "",
        cardSales: "",
        notes: ""
      });

      if (onSaved) onSaved();
    } catch (error) {
      toast({
        title: "Erro",
        description: "Não foi possível salvar os dados.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <MotivationalCard 
        percentage={motivationPercentage}
        visible={showMotivation}
        onHide={() => setShowMotivation(false)}
      />
      
      {showMessage && (
        <MotivationalMessage totalDayProfit={dayProfit} dailyGoal={baseDailyGoal} />
      )}
      
      <Card className="card-gradient-border shadow-xl">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-xl">
                <DollarSign className="h-5 w-5 text-primary" />
                Novo Lançamento
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Registre cada venda individualmente para manter histórico completo
              </p>
            </div>
            <Button
              size="icon"
              variant="outline"
              onClick={handlePlannedOff}
              title="Marcar dia OFF (preserva ofensiva)"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Campo de Data da Venda */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">Data da Venda</Label>
            <div className="flex flex-col sm:flex-row gap-2">
              <Select value={dateOption} onValueChange={(value: any) => setDateOption(value)}>
                <SelectTrigger className="w-full sm:w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Hoje</SelectItem>
                  <SelectItem value="yesterday">Ontem</SelectItem>
                  <SelectItem value="custom">Outra data</SelectItem>
                </SelectContent>
              </Select>
              
              {dateOption === "custom" && (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full sm:flex-1 justify-start text-left font-normal",
                        !customDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {customDate ? format(customDate, "dd/MM/yyyy") : "Selecionar data"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={customDate}
                      onSelect={setCustomDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              )}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-success" />
                Total Vendido (R$)
              </Label>
              <Input
                type="number"
                step="0.01"
                placeholder="0,00"
                value={formData.totalProfit}
                onChange={(e) => setFormData({ ...formData, totalProfit: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-warning" />
                Gasto em Mercadoria (R$)
              </Label>
              <Input
                type="number"
                step="0.01"
                placeholder="0,00"
                value={formData.cost}
                onChange={(e) => setFormData({ ...formData, cost: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                Calotes (R$)
              </Label>
              <Input
                type="number"
                step="0.01"
                placeholder="0,00"
                value={formData.totalDebt}
                onChange={(e) => setFormData({ ...formData, totalDebt: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-3">
            <Label className="text-base font-semibold">Vendas por Método de Pagamento</Label>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Banknote className="h-4 w-4 text-success" />
                  Dinheiro (R$)
                </Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0,00"
                  value={formData.cashSales}
                  onChange={(e) => setFormData({ ...formData, cashSales: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Smartphone className="h-4 w-4 text-primary" />
                  Pix (R$)
                </Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0,00"
                  value={formData.pixSales}
                  onChange={(e) => setFormData({ ...formData, pixSales: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-secondary" />
                  Cartão (R$)
                </Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0,00"
                  value={formData.cardSales}
                  onChange={(e) => setFormData({ ...formData, cardSales: e.target.value })}
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea
              placeholder="Adicione detalhes sobre o dia..."
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              maxLength={1000}
            />
          </div>

          <Button 
            type="submit"
            className="w-full"
            disabled={isLoading}
          >
            {isLoading ? "⏳ Salvando..." : "💰 Registrar Lançamento"}
          </Button>
        </form>
      </CardContent>
    </Card>
    </>
  );
}
