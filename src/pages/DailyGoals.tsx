import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { getBrazilDate } from "@/lib/dateUtils";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, RotateCcw, Pencil, Flag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { EditPlanningModal } from "@/components/EditPlanningModal";
import DailyReportModal from "@/components/DailyReportModal";
import { HourlyBlockDetail } from "@/components/HourlyBlockDetail";
import { useHourlyBlocks, HourlyBlock } from "@/hooks/useHourlyBlocks";
import { celebrationSounds } from "@/utils/celebrationSounds";
import { useLeaderboard } from "@/hooks/useLeaderboard";
import { FireEffect } from "@/components/FireEffect";
import { DashboardBlockStats } from "@/components/DashboardBlockStats";

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
  const [isCreatingPlan, setIsCreatingPlan] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [dailyReport, setDailyReport] = useState<any>(null);
  const [sessionStartTime, setSessionStartTime] = useState<Date | null>(null);
  const [elapsedTime, setElapsedTime] = useState<number>(0);
  const [currentBlockIndex, setCurrentBlockIndex] = useState<number>(0);
  const [dayStatus, setDayStatus] = useState<'not_started' | 'in_progress' | 'finished' | null>(null);
  const [isLoadingSession, setIsLoadingSession] = useState(true);
  const [showFireEffect, setShowFireEffect] = useState(false);

  const { blocks, planId, loadBlocks, stats, startDayTimers } = useHourlyBlocks(user?.id);
  const { updateUserStats, checkWorkedYesterday } = useLeaderboard(user?.id);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
      return;
    }
    if (user) {
      // Load session state FIRST, then plan
      loadSessionState().then(() => {
        loadOrCreateDailyPlan();
      });
    }
  }, [user, loading, navigate]);

  // Listen for work_sessions changes to sync state
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('work-session-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'work_sessions',
          filter: `user_id=eq.${user.id}`
        },
        () => {
          loadSessionState();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  // Load session state from backend - this is the SOURCE OF TRUTH
  const loadSessionState = async () => {
    if (!user) return;
    setIsLoadingSession(true);
    
    const today = getBrazilDate();
    console.log('[DailyGoals] Loading session for date:', today, 'user:', user.id);
    
    const { data, error } = await supabase
      .from("work_sessions")
      .select("start_timestamp, status")
      .eq("user_id", user.id)
      .eq("planning_date", today)
      .maybeSingle();
    
    console.log('[DailyGoals] Session data:', data, 'error:', error);
    
    if (data) {
      if (data.start_timestamp) {
        setSessionStartTime(new Date(data.start_timestamp));
      }
      if (data.status === 'finished') {
        console.log('[DailyGoals] Setting dayStatus to finished');
        setDayStatus('finished');
      } else if (data.status === 'active') {
        console.log('[DailyGoals] Setting dayStatus to in_progress');
        setDayStatus('in_progress');
      } else {
        console.log('[DailyGoals] Session exists but status is:', data.status);
        setDayStatus('not_started');
      }
    } else {
      console.log('[DailyGoals] No session found, setting not_started');
      setDayStatus('not_started');
    }
    
    setIsLoadingSession(false);
  };

  // Determine current active block based on completed status
  useEffect(() => {
    if (blocks.length === 0) return;
    
    // Find first non-completed block
    const firstIncompleteIndex = blocks.findIndex(b => !b.is_completed);
    if (firstIncompleteIndex === -1) {
      // All blocks completed
      setCurrentBlockIndex(blocks.length);
    } else {
      setCurrentBlockIndex(firstIncompleteIndex);
    }
  }, [blocks]);

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

  const loadOrCreateDailyPlan = async () => {
    if (!user) return;
    const today = getBrazilDate();
    const { data: planData } = await supabase
      .from("daily_goal_plans")
      .select("*")
      .eq("user_id", user.id)
      .eq("date", today)
      .maybeSingle();
      
    if (planData) {
      setPlan(planData);
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
      
      const blocksToInsert = Array.from({ length: workHours }, (_, i) => ({ 
        plan_id: newPlan.id, 
        user_id: user.id, 
        hour_index: i, 
        hour_label: `H${i + 1}`, 
        target_amount: hourlyGoal,
        valor_dinheiro: 0,
        valor_cartao: 0,
        valor_pix: 0,
        valor_calote: 0,
        timer_status: 'idle'
      }));
      
      const { error: blocksError } = await supabase.from("hourly_goal_blocks").insert(blocksToInsert);
      if (blocksError) throw blocksError;
      
      setPlan(newPlan);
      loadBlocks();
      toast({ title: "Meta do dia criada!", description: `${workHours} blocos de ${formatCurrency(hourlyGoal)} cada.` });
    } catch (error: any) {
      console.error("Erro ao criar plano:", error);
      toast({ title: "Erro", description: "Não foi possível criar o plano do dia.", variant: "destructive" });
    } finally {
      setIsCreatingPlan(false);
    }
  };

  const startDay = async () => {
    if (!user || !plan) return;
    
    const startTime = new Date();
    const today = getBrazilDate();
    
    console.log('[DailyGoals] Starting day for:', today);
    
    // Save to backend FIRST, then update local state
    const { error } = await supabase
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
      });
    
    if (error) {
      console.error('[DailyGoals] Error starting day:', error);
      toast({ title: "Erro", description: "Não foi possível iniciar o dia.", variant: "destructive" });
      return;
    }
    
    console.log('[DailyGoals] Day started successfully, updating state');
    
    // Update local state after successful save
    setSessionStartTime(startTime);
    setDayStatus('in_progress');
    
    // Start first block timer
    await startDayTimers();
    
    toast({ title: "🚀 Dia iniciado!", description: "Seu cronômetro começou. Vamos lá, Visionário!" });
  };

  const handleBlockCompleted = async (blockId: string, blockIndex: number) => {
    // Start next block's timer if there is one
    const nextBlock = blocks.find(b => b.hour_index === blockIndex + 1);
    if (nextBlock && nextBlock.timer_status === 'idle') {
      await supabase
        .from("hourly_goal_blocks")
        .update({
          timer_status: 'running',
          timer_started_at: new Date().toISOString()
        })
        .eq("id", nextBlock.id);
      
      setCurrentBlockIndex(blockIndex + 1);
      toast({ title: `⏱️ Hora ${blockIndex + 2} iniciada!`, description: "Continue focado!" });
    }
    
    loadBlocks();
  };

  const resetDay = async () => {
    if (!plan || !planId) return;
    
    const { error } = await supabase
      .from("hourly_goal_blocks")
      .update({ 
        achieved_amount: 0, 
        is_completed: false, 
        target_amount: plan.hourly_goal,
        valor_dinheiro: 0,
        valor_cartao: 0,
        valor_pix: 0,
        valor_calote: 0,
        timer_status: 'idle',
        timer_started_at: null,
        timer_paused_at: null,
        timer_elapsed_seconds: 0
      })
      .eq("plan_id", planId);

    if (!error) {
      setSessionStartTime(null);
      setCurrentBlockIndex(0);
      setDayStatus('not_started');
      setDailyReport(null);
      loadBlocks();
      toast({ title: "🔄 Ritmo reiniciado", description: "Todos os blocos foram resetados." });
    }
  };

  const finishDay = async () => {
    if (!plan || !user) return;
    
    // Trigger fire effect
    setShowFireEffect(true);
    
    await generateDailyReport(blocks);
    setDayStatus('finished');
    
    // Update constância (streak) when finishing the day
    await updateDailyWorkLog();
    
    // Update leaderboard stats
    const totalVendidoHoje = stats.totalVendido;
    const workedYesterday = await checkWorkedYesterday();
    await updateUserStats(totalVendidoHoje, workedYesterday);
  };

  const updateDailyWorkLog = async () => {
    if (!user || !plan) return;
    
    const today = getBrazilDate();
    const totalSold = stats.totalVendido;
    const goalAchieved = totalSold >= plan.daily_goal;
    const percentageAchieved = (totalSold / plan.daily_goal) * 100;
    
    // Check if all blocks were completed
    const allBlocksFilled = blocks.every(b => b.is_completed);
    
    // Create or update daily work log entry
    await supabase.from("daily_work_log").upsert({
      user_id: user.id,
      date: today,
      status: 'worked',
      goal_achieved: goalAchieved,
      sales_amount: totalSold,
      daily_goal: plan.daily_goal,
      percentage_achieved: percentageAchieved,
    }, {
      onConflict: 'user_id,date'
    });
  };

  const generateDailyReport = async (completedBlocks: HourlyBlock[]) => {
    if (!plan || !user) return;

    const totalSold = completedBlocks.reduce((sum, b) => sum + (b.achieved_amount || 0), 0);
    const percentageAchieved = (totalSold / plan.daily_goal) * 100;
    const blocksWithValues = completedBlocks.filter(b => b.achieved_amount > 0);
    // Constância is earned by finishing the day (clicking "Concluir Dia"), not by filling all blocks
    const earnedConstancy = true; // User earns constancy by clicking "Concluir Dia"
    
    // Calculate payment method totals
    const totalDinheiro = completedBlocks.reduce((sum, b) => sum + (b.valor_dinheiro || 0), 0);
    const totalCartao = completedBlocks.reduce((sum, b) => sum + (b.valor_cartao || 0), 0);
    const totalPix = completedBlocks.reduce((sum, b) => sum + (b.valor_pix || 0), 0);
    const totalCalote = completedBlocks.reduce((sum, b) => sum + (b.valor_calote || 0), 0);
    
    // Find best and worst hours (only from blocks with values)
    const sortedBlocks = [...blocksWithValues].sort((a, b) => b.achieved_amount - a.achieved_amount);
    const bestHour = sortedBlocks[0] ? { index: sortedBlocks[0].hour_index, amount: sortedBlocks[0].achieved_amount } : null;
    const worstHour = sortedBlocks.length > 0 ? { index: sortedBlocks[sortedBlocks.length - 1].hour_index, amount: sortedBlocks[sortedBlocks.length - 1].achieved_amount } : null;
    
    const averageRhythm = blocksWithValues.length > 0 ? totalSold / blocksWithValues.length : 0;

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
      .maybeSingle();

    if (sessionData) {
      await supabase.from("work_sessions").update({
        status: "finished",
        end_timestamp: new Date().toISOString(),
        total_vendido: totalSold,
        constancia_dia: earnedConstancy, // Constância earned by clicking "Concluir Dia"
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

    // Play celebration sound based on performance
    if (percentageAchieved >= 100) {
      celebrationSounds.playDailyGoalComplete();
    } else {
      celebrationSounds.playSuccess();
    }

    // Show report modal
    setDailyReport({
      totalSold,
      dailyGoal: plan.daily_goal,
      percentageAchieved,
      bestHour,
      worstHour,
      averageRhythm,
      consistency: earnedConstancy,
      advice,
      totalDinheiro,
      totalCartao,
      totalPix,
      totalCalote,
    });
    setShowReportModal(true);
  };

  const formatElapsedTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${String(minutes).padStart(2, '0')}m`;
  };

  if (loading || !user) return null;
  if (!plan || isLoadingSession || dayStatus === null) return (
    <div className="flex items-center justify-center min-h-[60vh] p-8">
      <Card className="p-8 text-center max-w-md card-gradient-border">
        <TrendingUp className="w-16 h-16 mx-auto mb-4 text-primary" />
        <h2 className="text-2xl font-bold mb-2 gradient-text">Carregando meta do dia...</h2>
        <p className="text-muted-foreground">Estamos configurando seus blocos de hora automaticamente.</p>
      </Card>
    </div>
  );

  const totalAchieved = stats.totalVendido;
  const progressPercentage = (totalAchieved / plan.daily_goal) * 100;
  const completedBlocksCount = blocks.filter(b => b.is_completed).length;
  const allBlocksCompleted = completedBlocksCount === blocks.length && blocks.length > 0;

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
          
          <Progress value={Math.min(progressPercentage, 100)} className="h-3" />
          
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {formatCurrency(totalAchieved)} alcançado
            </span>
            <span className="text-muted-foreground">
              {completedBlocksCount}/{plan.work_hours} horas concluídas
            </span>
          </div>

          <div className="flex gap-2">
            {dayStatus === 'not_started' && (
              <Button 
                onClick={startDay} 
                className="flex-1 h-14 text-lg font-semibold bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 shadow-lg shadow-blue-500/50 hover:shadow-xl hover:shadow-blue-500/60 transition-all"
                size="lg"
              >
                🚀 Iniciar Meu Dia
              </Button>
            )}
            
            {dayStatus === 'in_progress' && (
              <Button 
                onClick={finishDay}
                className="flex-1 h-14 text-lg font-semibold bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 shadow-lg shadow-green-500/50 hover:shadow-xl hover:shadow-green-500/60 transition-all"
                size="lg"
              >
                <Flag className="w-5 h-5 mr-2" />
                Concluir Dia
              </Button>
            )}
            
            {dayStatus === 'finished' && (
              <Button 
                onClick={() => setShowReportModal(true)}
                className="flex-1 h-14 text-lg font-semibold bg-gradient-to-r from-purple-500 to-blue-600"
                size="lg"
              >
                📊 Ver Relatório
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

      {/* Daily Summary - Bruto/Calote/Líquido - Updates in real-time from stats */}
      {dayStatus === 'in_progress' && stats.totalBlocks > 0 && (
        <DashboardBlockStats stats={stats} />
      )}

      {/* Hourly Blocks */}
      <div className="space-y-4">
        {blocks.map((block, index) => (
          <HourlyBlockDetail
            key={block.id}
            block={block}
            isCurrentBlock={dayStatus === 'in_progress' && index === currentBlockIndex}
            isCompleted={block.is_completed}
            canEdit={block.is_completed}
            onBlockCompleted={handleBlockCompleted}
            onBlockUpdated={loadBlocks}
            planId={planId || ""}
            allBlocks={blocks}
            userId={user?.id}
          />
        ))}
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
          }}
          report={dailyReport}
        />
      )}

      {/* Fire Effect */}
      <FireEffect 
        show={showFireEffect} 
        onComplete={() => setShowFireEffect(false)} 
      />
    </div>
  );
}
