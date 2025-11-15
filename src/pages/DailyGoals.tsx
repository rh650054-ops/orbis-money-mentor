import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { getBrazilDate } from "@/lib/dateUtils";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, TrendingUp, Clock } from "lucide-react";
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
  const [adjustments, setAdjustments] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
      return;
    }
    if (user) {
      loadDailyPlan();
    }
  }, [user, loading, navigate]);

  const loadDailyPlan = async () => {
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

      const { data: blocksData } = await supabase
        .from("hourly_goal_blocks")
        .select("*")
        .eq("plan_id", planData.id)
        .order("hour_index");

      if (blocksData) {
        setBlocks(blocksData);
      }
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

  const handleAdjustment = async (blockId: string) => {
    const value = parseFloat(adjustments[blockId] || "0");
    if (value === 0) return;

    const { error } = await supabase
      .from("hourly_goal_blocks")
      .update({ manual_adjustment: value })
      .eq("id", blockId);

    if (!error) {
      toast({
        title: "Ajuste aplicado",
        description: `Valor ajustado em R$ ${value.toFixed(2)}`,
      });
      setAdjustments((prev) => ({ ...prev, [blockId]: "" }));
      loadDailyPlan();
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
          <h2 className="text-2xl font-bold mb-2">Sem meta hoje</h2>
          <p className="text-muted-foreground">
            Você ainda não definiu sua meta para hoje. Volte à tela inicial para começar!
          </p>
        </Card>
      </div>
    );
  }

  const totalAchieved = blocks.reduce((sum, b) => sum + b.achieved_amount + b.manual_adjustment, 0);
  const progressPercentage = (totalAchieved / plan.daily_goal) * 100;
  const completedBlocks = blocks.filter((b) => b.is_completed).length;

  return (
    <div className="space-y-6 pb-20 md:pb-8">
      <div>
        <h1 className="text-3xl font-bold gradient-text">Metas do Dia</h1>
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
          const total = block.achieved_amount + block.manual_adjustment;
          const blockProgress = (total / block.target_amount) * 100;

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

                  {/* Ajuste manual */}
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      placeholder="Ajuste manual"
                      value={adjustments[block.id] || ""}
                      onChange={(e) =>
                        setAdjustments((prev) => ({ ...prev, [block.id]: e.target.value }))
                      }
                      step="0.01"
                      className="flex-1"
                    />
                    <Button
                      size="sm"
                      onClick={() => handleAdjustment(block.id)}
                      disabled={!adjustments[block.id]}
                    >
                      Ajustar
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
