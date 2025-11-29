import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { getBrazilDate } from "@/lib/dateUtils";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, TrendingUp, AlertCircle, RotateCcw, Pencil } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { EditPlanningModal } from "@/components/EditPlanningModal";
import DailyReportModal from "@/components/DailyReportModal";

interface HourlyBlock {
  id: string;
  hour_index: number;
  hour_label: string;
  target_amount: number;
  achieved_amount: number;
  is_completed: boolean;
  manual_adjustment: number;
}

interface DailyPlan {
  id: string;
  daily_goal: number;
  work_hours: number;
  mood: string;
  hourly_goal: number;
}

export default function DailyGoals() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { toast } = useToast();
  const [plan, setPlan] = useState<DailyPlan | null>(null);
  const [blocks, setBlocks] = useState<HourlyBlock[]>([]);
  const [salesInputs, setSalesInputs] = useState<{ [key: string]: string }>({});
  const [isCreatingPlan, setIsCreatingPlan] = useState(false);
  const [timers, setTimers] = useState<{ [key: number]: number }>({});
  const [activeTimer, setActiveTimer] = useState<number | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [dailyReport, setDailyReport] = useState<any>(null);
  const [sessionStartTime, setSessionStartTime] = useState<Date | null>(null);
  const [elapsedTime, setElapsedTime] = useState<number>(0);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
      return;
    }
    if (user) {
      loadOrCreateDailyPlan();
      loadSessionStartTime();
    }
  }, [user, loading, navigate]);

  // Load session start time from backend
  const loadSessionStartTime = async () => {
    if (!user) return;
    const today = getBrazilDate();
    const { data } = await supabase
      .from("work_sessions")
      .select("start_timestamp")
      .eq("user_id", user.id)
      .eq("planning_date", today)
      .eq("status", "active")
      .maybeSingle();
    
    if (data?.start_timestamp) {
      setSessionStartTime(new Date(data.start_timestamp));
      setActiveTimer(0); // Mark as active
    }
  };

  // Update elapsed time every second
  useEffect(() => {
    if (!sessionStartTime) return;
    
    const interval = setInterval(() => {
      const now = new Date();
      const elapsed = Math.floor((now.getTime() - sessionStartTime.getTime()) / 1000);
      setElapsedTime(elapsed);
    }, 1000);

    return () => clearInterval(interval);
  }, [sessionStartTime]);

  // Listen for profile changes
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('profile-updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `user_id=eq.${user.id}`
        },
        () => {
          loadOrCreateDailyPlan();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  // Timer effect
  useEffect(() => {
    if (activeTimer === null) return;

    const interval = setInterval(() => {
      setTimers(prev => {
        const newTimers = { ...prev };
        if (newTimers[activeTimer] > 0) {
          newTimers[activeTimer] = newTimers[activeTimer] - 1;
        } else {
          const nextHour = activeTimer + 1;
          if (nextHour < (plan?.work_hours || 0)) {
            setActiveTimer(nextHour);
            newTimers[nextHour] = 3600;
          } else {
            setActiveTimer(null);
          }
        }
        return newTimers;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [activeTimer, plan]);

  const loadOrCreateDailyPlan = async () => {
    if (!user) return;
    const today = getBrazilDate();
    const { data: planData } = await supabase
      .from("daily_goal_plans")
      .select("*")
      .eq("user_id", user.id)
      .eq("date", today)
      .single();
    if (planData) {
      setPlan(planData);
      loadBlocks(planData.id);
    } else {
      await createAutomaticPlan();
    }
  };

  const createAutomaticPlan = async () => {
    if (!user || isCreatingPlan) return;
    setIsCreatingPlan(true);
    try {
      const today = getBrazilDate();
      const { data: profile } = await supabase
        .from("profiles")
        .select("base_daily_goal, goal_hours")
        .eq("user_id", user.id)
        .single();
      if (!profile) {
        toast({ title: "Configure seu planejamento", description: "Vá até a aba Planejamento para começar.", variant: "destructive" });
        navigate("/");
        return;
      }
      const dailyGoal = profile.base_daily_goal || 200;
      const workHours = profile.goal_hours || 8;
      const hourlyGoal = dailyGoal / workHours;
      const { data: newPlan, error: planError } = await supabase
        .from("daily_goal_plans")
        .insert({ user_id: user.id, date: today, daily_goal: dailyGoal, work_hours: workHours, mood: "normal", hourly_goal: hourlyGoal })
        .select()
        .single();
      if (planError) throw planError;
      const blocks = Array.from({ length: workHours }, (_, i) => ({ plan_id: newPlan.id, user_id: user.id, hour_index: i, hour_label: `H${i + 1}`, target_amount: hourlyGoal }));
      const { error: blocksError } = await supabase.from("hourly_goal_blocks").insert(blocks);
      if (blocksError) throw blocksError;
      setPlan(newPlan);
      loadBlocks(newPlan.id);
      const initialTimers: { [key: number]: number } = {};
      for (let i = 0; i < workHours; i++) initialTimers[i] = 3600;
      setTimers(initialTimers);
      toast({ title: "Meta do dia criada!", description: `${workHours} blocos de ${formatCurrency(hourlyGoal)} cada.` });
    } catch (error: any) {
      console.error("Erro ao criar plano:", error);
      toast({ title: "Erro", description: "Não foi possível criar o plano do dia.", variant: "destructive" });
    } finally {
      setIsCreatingPlan(false);
    }
  };

  const loadBlocks = async (planId: string) => {
    const { data: blocksData } = await supabase.from("hourly_goal_blocks").select("*").eq("plan_id", planId).order("hour_index");
    if (blocksData) {
      setBlocks(blocksData);
      const initialTimers: { [key: number]: number } = {};
      blocksData.forEach((block) => { initialTimers[block.hour_index] = 3600; });
      setTimers(initialTimers);
    }
  };

  useEffect(() => {
    if (!plan) return;
    const channel = supabase.channel("hourly-blocks-changes")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "hourly_goal_blocks", filter: `plan_id=eq.${plan.id}` },
        (payload: any) => { setBlocks((prev) => prev.map((block) => block.id === payload.new.id ? payload.new : block)); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [plan]);

  const startDay = () => {
    const startTime = new Date();
    setSessionStartTime(startTime);
    setActiveTimer(0);
    
    // Save start timestamp in backend
    if (user && plan) {
      const today = getBrazilDate();
      supabase
        .from("work_sessions")
        .upsert({
          user_id: user.id,
          planning_date: today,
          start_timestamp: startTime.toISOString(),
          meta_dia: plan.daily_goal,
          ritmo_ideal_inicial: plan.hourly_goal,
          status: "active",
        }, {
          onConflict: "user_id,planning_date",
        })
        .then(() => {
          toast({ title: "🚀 Dia iniciado!", description: "Seu cronômetro começou. Vamos lá, Visionário!" });
        });
    }
  };

  const resetDay = async () => {
    if (!plan) return;
    
    const { error } = await supabase
      .from("hourly_goal_blocks")
      .update({ achieved_amount: 0, is_completed: false, target_amount: plan.hourly_goal })
      .eq("plan_id", plan.id);

    if (!error) {
      setActiveTimer(null);
      const initialTimers: { [key: number]: number } = {};
      for (let i = 0; i < plan.work_hours; i++) initialTimers[i] = 3600;
      setTimers(initialTimers);
      await loadBlocks(plan.id);
      toast({ title: "🔄 Ritmo reiniciado", description: "Todos os blocos foram resetados." });
    }
  };

  const redistributeGoals = async (currentIndex: number, shortfall: number) => {
    const remainingBlocks = blocks.filter((b) => b.hour_index > currentIndex && !b.is_completed);
    if (remainingBlocks.length === 0) return;
    const additionalPerBlock = shortfall / remainingBlocks.length;
    for (const block of remainingBlocks) {
      const newTarget = block.target_amount + additionalPerBlock;
      await supabase.from("hourly_goal_blocks").update({ target_amount: newTarget }).eq("id", block.id);
    }
    await loadBlocks(plan!.id);
    toast({ title: "⚠️ Metas redistribuídas", description: `${formatCurrency(shortfall)} distribuído nas próximas ${remainingBlocks.length} horas.` });
  };

  const redistributeSurplus = async (currentIndex: number, surplus: number) => {
    const remainingBlocks = blocks.filter((b) => b.hour_index > currentIndex && !b.is_completed);
    if (remainingBlocks.length === 0) return;
    const reductionPerBlock = surplus / remainingBlocks.length;
    for (const block of remainingBlocks) {
      const newTarget = Math.max(0, block.target_amount - reductionPerBlock);
      await supabase.from("hourly_goal_blocks").update({ target_amount: newTarget }).eq("id", block.id);
    }
    await loadBlocks(plan!.id);
    toast({ title: "🎯 Excedente redistribuído", description: `${formatCurrency(surplus)} a menos nas próximas ${remainingBlocks.length} horas!` });
  };

  const handleAddSale = async (blockId: string, hourIndex: number) => {
    const value = parseFloat(salesInputs[blockId] || "0");
    if (value <= 0) {
      toast({ title: "Valor inválido", description: "Digite um valor maior que zero.", variant: "destructive" });
      return;
    }
    const block = blocks.find((b) => b.id === blockId);
    if (!block) return;
    const newAchieved = block.achieved_amount + value;
    const isCompleted = newAchieved >= block.target_amount;
    const shortfall = block.target_amount - newAchieved;
    const surplus = newAchieved - block.target_amount;
    
    const { error } = await supabase.from("hourly_goal_blocks").update({ achieved_amount: newAchieved, is_completed: isCompleted }).eq("id", blockId);
    
    if (!error) {
      // If there's a surplus, redistribute it to reduce future blocks
      if (surplus > 0 && isCompleted) {
        await redistributeSurplus(hourIndex, surplus);
      } else if (shortfall > 0 && !isCompleted) {
        // If there's a shortfall, redistribute to increase future blocks
        await redistributeGoals(hourIndex, shortfall);
      }
      
      if (isCompleted && !block.is_completed) {
        toast({ title: "🔥 Meta da hora batida!", description: "Esse é o foco Visionário! 💙" });
      }
      
      setSalesInputs((prev) => ({ ...prev, [blockId]: "" }));
      
      // Check if all blocks have values (for final report)
      const updatedBlocks = await supabase
        .from("hourly_goal_blocks")
        .select("*")
        .eq("plan_id", plan!.id)
        .order("hour_index");
      
      if (updatedBlocks.data) {
        const allHaveValues = updatedBlocks.data.every((b) => b.achieved_amount > 0);
        
        if (allHaveValues) {
          // Generate daily report when all blocks have been filled
          await generateDailyReport(updatedBlocks.data);
        }
      }
      
      loadOrCreateDailyPlan();
    }
  };

  const generateDailyReport = async (completedBlocks: HourlyBlock[]) => {
    if (!plan || !user) return;

    const totalSold = completedBlocks.reduce((sum, b) => sum + b.achieved_amount, 0);
    const percentageAchieved = (totalSold / plan.daily_goal) * 100;
    const allBlocksFilled = completedBlocks.every((b) => b.achieved_amount > 0);
    
    // Find best and worst hours
    const sortedBlocks = [...completedBlocks].sort((a, b) => b.achieved_amount - a.achieved_amount);
    const bestHour = sortedBlocks[0] ? { index: sortedBlocks[0].hour_index, amount: sortedBlocks[0].achieved_amount } : null;
    const worstHour = sortedBlocks[sortedBlocks.length - 1] ? { index: sortedBlocks[sortedBlocks.length - 1].hour_index, amount: sortedBlocks[sortedBlocks.length - 1].achieved_amount } : null;
    
    const averageRhythm = totalSold / completedBlocks.length;

    // Generate advice
    let advice = "";
    if (percentageAchieved >= 100) {
      advice = "Parabéns! Você bateu sua meta do dia! Continue com esse ritmo incrível e mantenha a constância. 🔥";
    } else if (percentageAchieved >= 80) {
      advice = "Você chegou muito perto da meta! Ajuste seu planejamento e você vai bater amanhã. 💪";
    } else if (bestHour && worstHour) {
      const bestHourLabel = `H${bestHour.index + 1}`;
      advice = `Seu melhor desempenho foi na ${bestHourLabel}. Tente replicar o que funcionou nesse período nas outras horas.`;
    } else {
      advice = "Continue se esforçando! Cada dia é uma oportunidade de melhorar. Não desista! 🚀";
    }

    // Save report to database
    const today = getBrazilDate();
    const { data: sessionData } = await supabase
      .from("work_sessions")
      .select("id")
      .eq("user_id", user.id)
      .eq("planning_date", today)
      .single();

    if (sessionData) {
      await supabase.from("work_sessions").update({
        status: "finished",
        end_timestamp: new Date().toISOString(),
        total_vendido: totalSold,
        constancia_dia: allBlocksFilled,
      }).eq("id", sessionData.id);

      await supabase.from("daily_reports").insert({
        session_id: sessionData.id,
        user_id: user.id,
        total_vendido: totalSold,
        melhor_hora: bestHour?.index,
        pior_hora: worstHour?.index,
        ritmo_medio: averageRhythm,
        porcentagem_meta: percentageAchieved,
        conselho: advice,
      });
    }

    // Show report modal
    setDailyReport({
      totalSold,
      dailyGoal: plan.daily_goal,
      percentageAchieved,
      bestHour,
      worstHour,
      averageRhythm,
      consistency: allBlocksFilled,
      advice,
    });
    setShowReportModal(true);
  };

  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const formatElapsedTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${String(minutes).padStart(2, '0')}m`;
  };

  if (loading || !user) return null;
  if (!plan) return (
    <div className="flex items-center justify-center min-h-[60vh] p-8">
      <Card className="p-8 text-center max-w-md card-gradient-border">
        <TrendingUp className="w-16 h-16 mx-auto mb-4 text-primary" />
        <h2 className="text-2xl font-bold mb-2 gradient-text">Carregando meta do dia...</h2>
        <p className="text-muted-foreground">Estamos configurando seus blocos de hora automaticamente.</p>
      </Card>
    </div>
  );

  const totalAchieved = blocks.reduce((sum, b) => sum + b.achieved_amount + (b.manual_adjustment || 0), 0);
  const progressPercentage = (totalAchieved / plan.daily_goal) * 100;
  const completedBlocks = blocks.filter((b) => b.is_completed).length;

  return (
    <div className="space-y-6 pb-24 md:pb-8">
      <div className="text-center space-y-2">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 via-purple-500 to-blue-600 bg-clip-text text-transparent">
          ⚡ Ritmo
        </h1>
        <p className="text-muted-foreground">Acompanhe seu progresso hora a hora</p>
      </div>

      <Card className="overflow-hidden border-white/10 bg-gradient-to-br from-blue-500/10 to-purple-600/10 backdrop-blur-sm">
        <CardContent className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Meta do Dia</p>
              <p className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-purple-600 bg-clip-text text-transparent">
                {formatCurrency(plan.daily_goal)}
              </p>
              {sessionStartTime && (
                <p className="text-sm text-blue-400 font-semibold mt-2">
                  ⏱️ Tempo decorrido: {formatElapsedTime(elapsedTime)}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={() => setShowEditModal(true)}
                variant="ghost"
                size="sm"
                className="h-10 w-10 p-0"
                title="Editar planejamento"
              >
                <Pencil className="w-4 h-4" />
              </Button>
              <Badge
                variant={progressPercentage >= 100 ? "default" : "secondary"} 
                className={cn(
                  "text-xl px-6 py-3 font-bold",
                  progressPercentage >= 100 
                    ? "bg-gradient-to-r from-green-500 to-emerald-600" 
                    : "bg-gradient-to-r from-blue-500 to-purple-600"
                )}
              >
                {progressPercentage.toFixed(0)}%
              </Badge>
            </div>
          </div>
          
          <Progress value={progressPercentage} className="h-3" />
          
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {formatCurrency(totalAchieved)} alcançado
            </span>
            <span className="text-muted-foreground">
              {completedBlocks}/{plan.work_hours} blocos ✓
            </span>
          </div>

          <div className="flex gap-2">
            {activeTimer === null && (
              <Button 
                onClick={startDay} 
                className="flex-1 h-14 text-lg font-semibold bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 shadow-lg shadow-blue-500/50 hover:shadow-xl hover:shadow-blue-500/60 transition-all"
                size="lg"
              >
                🚀 Iniciar Meu Dia
              </Button>
            )}
            <Button
              onClick={resetDay}
              variant="outline"
              className="h-14 px-6 border-white/10 hover:bg-white/5"
            >
              <RotateCcw className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {blocks.map((block) => {
          const total = block.achieved_amount + (block.manual_adjustment || 0);
          const blockProgress = (total / block.target_amount) * 100;
          const remaining = block.target_amount - total;
          const isActive = activeTimer === block.hour_index;
          const timeRemaining = timers[block.hour_index] || 0;
          const progressPercentage = Math.min(blockProgress, 100);
          
          return (
            <Card
              key={block.id}
              className={cn(
                "overflow-hidden border-2 transition-all duration-300 rounded-2xl",
                isActive && "ring-2 ring-blue-500 shadow-xl shadow-blue-500/30 scale-[1.01]",
                total > 0 && total >= block.target_amount && "bloco-verde",
                total > 0 && total < block.target_amount && "bloco-vermelho",
                total === 0 && !isActive && "border-white/10 bg-black/40 backdrop-blur-sm"
              )}
            >
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      "w-16 h-16 rounded-2xl flex items-center justify-center text-3xl font-bold transition-all shadow-lg",
                      total > 0 && total >= block.target_amount && "bloco-verde-numero",
                      total > 0 && total < block.target_amount && "bloco-vermelho-numero",
                      isActive && total === 0 && "bg-gradient-to-br from-blue-500 to-purple-600 text-white animate-pulse",
                      total === 0 && !isActive && "bg-white/5 text-foreground"
                    )}>
                      {block.hour_label}
                    </div>
                    
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">Meta da Hora</p>
                      <p className="text-2xl font-bold">{formatCurrency(block.target_amount)}</p>
                      {total > 0 && (
                        <p className="text-sm text-muted-foreground mt-0.5">
                          Vendido: {formatCurrency(total)}
                        </p>
                      )}
                    </div>
                  </div>
                  
                  <div className="text-right space-y-2">
                    {block.is_completed ? (
                      <div className="flex flex-col items-end gap-1">
                        <CheckCircle2 className="w-8 h-8 text-green-500" />
                        <span className="text-xs text-green-500 font-semibold">Completo!</span>
                      </div>
                    ) : isActive ? (
                      <div className="flex flex-col items-center gap-2">
                        <div className="relative w-16 h-16">
                          <svg className="w-16 h-16 transform -rotate-90">
                            <circle
                              cx="32"
                              cy="32"
                              r="28"
                              stroke="currentColor"
                              strokeWidth="4"
                              fill="none"
                              className="text-white/10"
                            />
                            <circle
                              cx="32"
                              cy="32"
                              r="28"
                              stroke="currentColor"
                              strokeWidth="4"
                              fill="none"
                              strokeDasharray={`${2 * Math.PI * 28}`}
                              strokeDashoffset={`${2 * Math.PI * 28 * (1 - timeRemaining / 3600)}`}
                              className="text-blue-500 transition-all duration-1000"
                              strokeLinecap="round"
                            />
                          </svg>
                          <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-xs font-mono font-bold text-blue-400">
                              {formatTime(timeRemaining).substring(3)}
                            </span>
                          </div>
                        </div>
                        <span className="text-xs text-blue-400 font-semibold">Em andamento</span>
                      </div>
                    ) : (
                      <XCircle className="w-8 h-8 text-muted-foreground/50" />
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Progresso</span>
                    <span className={cn(
                      "font-semibold",
                      total > 0 && total >= block.target_amount && "bloco-verde-texto",
                      total > 0 && total < block.target_amount && "bloco-vermelho-texto",
                      total === 0 && progressPercentage >= 50 && progressPercentage < 100 && "text-yellow-500",
                      total === 0 && progressPercentage < 50 && "text-muted-foreground"
                    )}>
                      {progressPercentage.toFixed(0)}%
                    </span>
                  </div>
                  <Progress 
                    value={progressPercentage} 
                    className={cn(
                      "h-2",
                      total > 0 && total >= block.target_amount && "bloco-verde-progresso",
                      total > 0 && total < block.target_amount && "bloco-vermelho-progresso"
                    )}
                  />
                </div>

                {total > 0 && remaining > 0 && (
                  <div className={cn(
                    "flex items-start gap-3 p-4 rounded-xl border backdrop-blur-sm",
                    progressPercentage >= 80 ? "bg-yellow-500/10 border-yellow-500/20" : "bg-red-500/10 border-red-500/20"
                  )}>
                    <AlertCircle className={cn(
                      "w-5 h-5 flex-shrink-0 mt-0.5",
                      progressPercentage >= 80 ? "text-yellow-500" : "text-red-500"
                    )} />
                    <div className="flex-1 space-y-1">
                      <p className={cn(
                        "text-sm font-medium",
                        progressPercentage >= 80 ? "text-yellow-500" : "text-red-500"
                      )}>
                        Faltam {formatCurrency(remaining)} para bater a hora
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {progressPercentage >= 80 
                          ? "Você está quase lá! Continue assim 🔥" 
                          : "Respira, Visionário, bora pra cima na próxima 💪"}
                      </p>
                    </div>
                  </div>
                )}

                {total >= block.target_amount && (
                  <div className="flex items-start gap-3 p-4 rounded-xl bg-green-500/20 border border-green-500/30 backdrop-blur-sm">
                    <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 space-y-1">
                      <p className="text-sm font-medium text-green-500">
                        🔥 Meta da hora batida!
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Esse é o foco Visionário! Continue assim 💙
                      </p>
                    </div>
                  </div>
                )}

                {total > 0 && total < block.target_amount && (
                  <div className="flex items-start gap-3 p-4 rounded-xl bg-red-500/20 border border-red-500/30 backdrop-blur-sm">
                    <XCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 space-y-1">
                      <p className="text-sm font-medium text-red-500">
                        ⚠️ Meta não atingida!
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Faltaram {formatCurrency(block.target_amount - total)}. Vamos recuperar na próxima! 💪
                      </p>
                    </div>
                  </div>
                )}

                {total < block.target_amount && (
                  <div className="flex gap-2 pt-2">
                    <Input
                      type="number"
                      placeholder="Quanto vendeu agora?"
                      value={salesInputs[block.id] || ""}
                      onChange={(e) => setSalesInputs((prev) => ({ ...prev, [block.id]: e.target.value }))}
                      step="0.01"
                      className="flex-1 h-12 border-white/20 bg-white/5 focus:border-blue-500 focus:ring-blue-500"
                    />
                    <Button
                      onClick={() => handleAddSale(block.id, block.hour_index)}
                      disabled={!salesInputs[block.id] || parseFloat(salesInputs[block.id]) <= 0}
                      className="h-12 px-6 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 font-semibold shadow-lg"
                    >
                      Adicionar
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {user && (
        <EditPlanningModal
          userId={user.id}
          isOpen={showEditModal}
          onClose={() => setShowEditModal(false)}
        />
      )}

      {dailyReport && (
        <DailyReportModal
          isOpen={showReportModal}
          onClose={() => {
            setShowReportModal(false);
            setDailyReport(null);
          }}
          report={dailyReport}
        />
      )}
    </div>
  );
}
