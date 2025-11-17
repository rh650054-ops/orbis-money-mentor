import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { getBrazilDate } from "@/lib/dateUtils";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, TrendingUp, Clock, AlertCircle, Timer } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

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

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
      return;
    }
    if (user) {
      loadOrCreateDailyPlan();
    }
  }, [user, loading, navigate]);

  // Timer effect
  useEffect(() => {
    if (activeTimer === null) return;

    const interval = setInterval(() => {
      setTimers(prev => {
        const newTimers = { ...prev };
        if (newTimers[activeTimer] > 0) {
          newTimers[activeTimer] = newTimers[activeTimer] - 1;
        } else {
          // Move to next hour
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
      toast({ title: "Meta do dia criada!", description: `${workHours} blocos de R$ ${hourlyGoal.toFixed(2)} cada.` });
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
    setActiveTimer(0);
    toast({ title: "🚀 Dia iniciado!", description: "Seu cronômetro começou. Vamos lá, Visionário!" });
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
    toast({ title: "Metas redistribuídas", description: `R$ ${shortfall.toFixed(2)} distribuído nas próximas ${remainingBlocks.length} horas.` });
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
    const { error } = await supabase.from("hourly_goal_blocks").update({ achieved_amount: newAchieved, is_completed: isCompleted }).eq("id", blockId);
    if (!error) {
      if (isCompleted && !block.is_completed) {
        toast({ title: "🔥 Meta da hora batida!", description: "Esse é o foco Visionário! 💙" });
      } else if (!isCompleted && shortfall > 0) {
        toast({ title: "Continue firme!", description: `Faltam R$ ${shortfall.toFixed(2)} para bater a hora. Respira, Visionário, bora pra cima na próxima 🔥` });
        await redistributeGoals(hourIndex, shortfall);
      }
      setSalesInputs((prev) => ({ ...prev, [blockId]: "" }));
      loadOrCreateDailyPlan();
    }
  };

  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
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
    <div className="space-y-6 pb-20 md:pb-8">
      <div>
        <h1 className="text-3xl font-bold gradient-text">⚡ Ritmo</h1>
        <p className="text-muted-foreground mt-1">Acompanhe seu progresso hora a hora</p>
      </div>
      <Card className="p-6 card-gradient-border bg-gradient-card">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Meta do dia</p>
              <p className="text-4xl font-bold gradient-text">R$ {plan.daily_goal.toFixed(2)}</p>
            </div>
            <Badge variant={progressPercentage >= 100 ? "default" : "secondary"} className="text-xl px-6 py-3 bg-gradient-primary">{progressPercentage.toFixed(0)}%</Badge>
          </div>
          <Progress value={progressPercentage} className="h-4" />
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">R$ {totalAchieved.toFixed(2)} alcançado</span>
            <span className="text-muted-foreground">{completedBlocks}/{plan.work_hours} blocos ✓</span>
          </div>
          {activeTimer === null && (<Button onClick={startDay} className="w-full bg-gradient-primary shadow-glow-primary" size="lg">🚀 Iniciar Meu Dia</Button>)}
        </div>
      </Card>
      <div className="space-y-4">
        {blocks.map((block) => {
          const total = block.achieved_amount + (block.manual_adjustment || 0);
          const blockProgress = (total / block.target_amount) * 100;
          const remaining = block.target_amount - total;
          const isActive = activeTimer === block.hour_index;
          const timeRemaining = timers[block.hour_index] || 0;
          return (
            <Card key={block.id} className={`p-5 card-gradient-border transition-all ${isActive ? 'shadow-glow-primary scale-105' : ''} ${block.is_completed ? 'bg-success/5' : 'bg-card'}`}>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center text-2xl font-bold ${block.is_completed ? 'bg-success/20 text-success' : 'bg-primary/20 text-primary'}`}>{block.hour_label}</div>
                    <div>
                      <p className="text-sm text-muted-foreground">Meta da hora</p>
                      <p className="text-2xl font-bold">R$ {block.target_amount.toFixed(2)}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    {block.is_completed ? (<CheckCircle2 className="w-8 h-8 text-success" />) : (<XCircle className="w-8 h-8 text-muted-foreground" />)}
                    {isActive && (<div className="flex items-center gap-2 mt-2 text-primary"><Timer className="w-5 h-5" /><span className="text-xl font-mono font-bold">{formatTime(timeRemaining)}</span></div>)}
                  </div>
                </div>
                <div className="space-y-2">
                  <Progress value={Math.min(blockProgress, 100)} className={`h-3 ${block.is_completed ? 'bg-success/20' : ''}`} />
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">R$ {total.toFixed(2)} vendido</span>
                    {!block.is_completed && remaining > 0 && (<span className="text-warning font-semibold">Faltam R$ {remaining.toFixed(2)}</span>)}
                  </div>
                </div>
                {!block.is_completed && remaining > 0 && total > 0 && (
                  <div className="flex items-start gap-2 p-3 bg-warning/10 rounded-lg border border-warning/20">
                    <AlertCircle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-warning-foreground">Faltam R$ {remaining.toFixed(2)} para bater a meta da hora. Respira, Visionário, bora pra cima na próxima 🔥</p>
                  </div>
                )}
                {!block.is_completed && (
                  <div className="flex gap-2">
                    <Input type="number" placeholder="Quanto vendeu agora?" value={salesInputs[block.id] || ""} onChange={(e) => setSalesInputs((prev) => ({ ...prev, [block.id]: e.target.value }))} step="0.01" className="flex-1 border-primary/30 focus:border-primary" />
                    <Button onClick={() => handleAddSale(block.id, block.hour_index)} disabled={!salesInputs[block.id] || parseFloat(salesInputs[block.id]) <= 0} className="bg-gradient-primary shadow-glow-primary">Adicionar</Button>
                  </div>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
