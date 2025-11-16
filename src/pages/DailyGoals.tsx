import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { getBrazilDate } from "@/lib/dateUtils";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, TrendingUp, Clock, AlertCircle } from "lucide-react";
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

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
      return;
    }
    if (user) {
      loadOrCreateDailyPlan();
    }
  }, [user, loading, navigate]);

  const loadOrCreateDailyPlan = async () => {
    if (!user) return;

    const today = getBrazilDate();

    // Verificar se já existe plano para hoje
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
      // Criar automaticamente baseado no planejamento
      await createAutomaticPlan();
    }
  };

  const createAutomaticPlan = async () => {
    if (!user || isCreatingPlan) return;
    
    setIsCreatingPlan(true);
    
    try {
      const today = getBrazilDate();

      // Buscar dados do planejamento
      const { data: profile } = await supabase
        .from("profiles")
        .select("base_daily_goal, goal_hours")
        .eq("user_id", user.id)
        .single();

      if (!profile) {
        toast({
          title: "Configure seu planejamento",
          description: "Vá até a aba Planejamento para começar.",
          variant: "destructive",
        });
        navigate("/");
        return;
      }

      const dailyGoal = profile.base_daily_goal || 200;
      const workHours = profile.goal_hours || 8;
      const hourlyGoal = dailyGoal / workHours;

      // Criar plano
      const { data: newPlan, error: planError } = await supabase
        .from("daily_goal_plans")
        .insert({
          user_id: user.id,
          date: today,
          daily_goal: dailyGoal,
          work_hours: workHours,
          mood: "normal",
          hourly_goal: hourlyGoal,
        })
        .select()
        .single();

      if (planError) throw planError;

      // Criar blocos
      const blocks = Array.from({ length: workHours }, (_, i) => ({
        plan_id: newPlan.id,
        user_id: user.id,
        hour_index: i,
        hour_label: `Hora ${i + 1}`,
        target_amount: hourlyGoal,
      }));

      const { error: blocksError } = await supabase
        .from("hourly_goal_blocks")
        .insert(blocks);

      if (blocksError) throw blocksError;

      setPlan(newPlan);
      loadBlocks(newPlan.id);
      
      toast({
        title: "Meta do dia criada!",
        description: `${workHours} blocos de R$ ${hourlyGoal.toFixed(2)} cada.`,
      });
    } catch (error: any) {
      console.error("Erro ao criar plano:", error);
      toast({
        title: "Erro",
        description: "Não foi possível criar o plano do dia.",
        variant: "destructive",
      });
    } finally {
      setIsCreatingPlan(false);
    }
  };

  const loadBlocks = async (planId: string) => {
    const { data: blocksData } = await supabase
      .from("hourly_goal_blocks")
      .select("*")
      .eq("plan_id", planId)
      .order("hour_index");

    if (blocksData) {
      setBlocks(blocksData);
    }
  };

  useEffect(() => {
    if (!plan) return;

    const channel = supabase
      .channel("hourly-blocks-changes")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "hourly_goal_blocks",
          filter: `plan_id=eq.${plan.id}`,
        },
        (payload: any) => {
          setBlocks((prev) =>
            prev.map((block) =>
              block.id === payload.new.id ? payload.new : block
            )
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [plan]);

  const handleAddSale = async (blockId: string, hourIndex: number) => {
    const value = parseFloat(salesInputs[blockId] || "0");
    if (value <= 0) {
      toast({
        title: "Valor inválido",
        description: "Digite um valor maior que zero.",
        variant: "destructive",
      });
      return;
    }

    const block = blocks.find((b) => b.id === blockId);
    if (!block) return;

    const newAchieved = block.achieved_amount + value;
    const isCompleted = newAchieved >= block.target_amount;

    const { error } = await supabase
      .from("hourly_goal_blocks")
      .update({
        achieved_amount: newAchieved,
        is_completed: isCompleted,
      })
      .eq("id", blockId);

    if (!error) {
      if (isCompleted && !block.is_completed) {
        toast({
          title: "🎯 Meta da hora batida!",
          description: `Hora ${hourIndex + 1} concluída com sucesso!`,
        });
      }
      setSalesInputs((prev) => ({ ...prev, [blockId]: "" }));
      loadOrCreateDailyPlan();
    }
  };

  if (loading || !user) {
    return null;
  }

  if (!plan) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] p-8">
        <Card className="p-8 text-center max-w-md">
          <TrendingUp className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-2xl font-bold mb-2">Carregando meta do dia...</h2>
          <p className="text-muted-foreground">
            Estamos configurando seus blocos de hora automaticamente.
          </p>
        </Card>
      </div>
    );
  }

  const totalAchieved = blocks.reduce((sum, b) => sum + b.achieved_amount + (b.manual_adjustment || 0), 0);
  const progressPercentage = (totalAchieved / plan.daily_goal) * 100;
  const completedBlocks = blocks.filter((b) => b.is_completed).length;

  return (
    <div className="space-y-6 pb-20 md:pb-8">
      <div>
        <h1 className="text-3xl font-bold gradient-text">Ritmo</h1>
        <p className="text-muted-foreground mt-1">
          Acompanhe seu progresso hora a hora
        </p>
      </div>

      {/* Resumo geral */}
      <Card className="p-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Meta do dia</p>
              <p className="text-3xl font-bold">R$ {plan.daily_goal.toFixed(2)}</p>
            </div>
            <Badge variant={progressPercentage >= 100 ? "default" : "secondary"} className="text-lg px-4 py-2">
              {progressPercentage.toFixed(0)}%
            </Badge>
          </div>

          <Progress value={progressPercentage} className="h-3" />

          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              R$ {totalAchieved.toFixed(2)} alcançado
            </span>
            <span className="text-muted-foreground">
              {completedBlocks}/{plan.work_hours} blocos ✓
            </span>
          </div>
        </div>
      </Card>

      {/* Lista de blocos */}
      <div className="space-y-3">
        {blocks.map((block) => {
          const total = block.achieved_amount + (block.manual_adjustment || 0);
          const blockProgress = (total / block.target_amount) * 100;
          const remaining = block.target_amount - total;

          return (
            <Card key={block.id} className="p-4">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-1">
                  {block.is_completed ? (
                    <CheckCircle2 className="w-6 h-6 text-green-500" />
                  ) : (
                    <XCircle className="w-6 h-6 text-muted-foreground" />
                  )}
                </div>

                <div className="flex-1 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-muted-foreground" />
                      <span className="font-semibold">{block.hour_label}</span>
                    </div>
                    <span className="text-sm font-medium">
                      R$ {total.toFixed(2)} / R$ {block.target_amount.toFixed(2)}
                    </span>
                  </div>

                  <Progress value={Math.min(blockProgress, 100)} className="h-2" />

                  {!block.is_completed && remaining > 0 && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <AlertCircle className="w-4 h-4" />
                      <span>Ainda faltam R$ {remaining.toFixed(2)} para bater a meta da hora.</span>
                    </div>
                  )}

                  {/* Campo para adicionar venda */}
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      placeholder="Quanto vendeu nesta hora?"
                      value={salesInputs[block.id] || ""}
                      onChange={(e) =>
                        setSalesInputs((prev) => ({ ...prev, [block.id]: e.target.value }))
                      }
                      step="0.01"
                      className="flex-1"
                    />
                    <Button
                      size="sm"
                      onClick={() => handleAddSale(block.id, block.hour_index)}
                      disabled={!salesInputs[block.id] || parseFloat(salesInputs[block.id]) <= 0}
                    >
                      Adicionar
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
