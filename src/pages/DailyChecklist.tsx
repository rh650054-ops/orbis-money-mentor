import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { 
  CheckCircle2, 
  Circle, 
  Calendar, 
  TrendingUp,
  Sunrise,
  Briefcase,
  Utensils,
  Sunset,
  Moon,
  Plus
} from "lucide-react";

interface ChecklistItem {
  id: string;
  activity_name: string;
  activity_time: string | null;
  completed: boolean;
}

interface RoutineActivity {
  name: string;
  start_time: string;
  end_time: string;
}

export default function DailyChecklist() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { toast } = useToast();
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
      return;
    }

    if (user) {
      loadChecklist();
    }
  }, [user, loading, navigate, selectedDate]);

  const loadChecklist = async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      // Check if checklist exists for today
      const { data: existingChecklist } = await supabase
        .from("daily_checklist")
        .select("*")
        .eq("user_id", user.id)
        .eq("date", selectedDate)
        .order("activity_time", { ascending: true });

      if (existingChecklist && existingChecklist.length > 0) {
        setChecklist(existingChecklist);
      } else {
        // Create checklist from routine activities
        await generateChecklistFromRoutine();
      }
    } catch (error) {
      toast({
        title: "Erro",
        description: "Não foi possível carregar o checklist.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const generateChecklistFromRoutine = async () => {
    if (!user) return;

    try {
      // Load routine data
      const { data: routine } = await supabase
        .from("routines")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      // Load custom activities
      const { data: customActivities } = await supabase
        .from("routine_activities")
        .select("*")
        .eq("user_id", user.id)
        .order("start_time", { ascending: true });

      const activities: { name: string; time: string }[] = [];

      // Add routine base activities
      if (routine) {
        activities.push(
          { name: "Acordar", time: routine.wake_time },
          { name: "Começar a trabalhar", time: routine.work_start },
          { name: "Almoçar", time: routine.lunch_time },
          { name: "Parar de vender", time: routine.work_end },
          { name: "Dormir", time: routine.sleep_time }
        );
      }

      // Add custom activities
      if (customActivities) {
        customActivities.forEach((activity: RoutineActivity) => {
          activities.push({
            name: activity.name,
            time: activity.start_time
          });
        });
      }

      // Sort by time
      activities.sort((a, b) => a.time.localeCompare(b.time));

      // Insert into database
      const checklistItems = activities.map(activity => ({
        user_id: user.id,
        date: selectedDate,
        activity_name: activity.name,
        activity_time: activity.time,
        completed: false
      }));

      if (checklistItems.length > 0) {
        const { data, error } = await supabase
          .from("daily_checklist")
          .insert(checklistItems)
          .select();

        if (error) throw error;
        if (data) setChecklist(data);
      } else {
        toast({
          title: "Nenhuma rotina encontrada",
          description: "Configure sua rotina primeiro para ver o checklist.",
          variant: "default"
        });
      }
    } catch (error) {
      toast({
        title: "Erro",
        description: "Não foi possível gerar o checklist.",
        variant: "destructive"
      });
    }
  };

  const toggleComplete = async (itemId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from("daily_checklist")
        .update({ completed: !currentStatus })
        .eq("id", itemId);

      if (error) throw error;

      setChecklist(prev =>
        prev.map(item =>
          item.id === itemId ? { ...item, completed: !currentStatus } : item
        )
      );

      toast({
        title: !currentStatus ? "✅ Tarefa concluída!" : "Tarefa desmarcada",
        description: !currentStatus ? "Continue assim!" : undefined,
      });
    } catch (error) {
      toast({
        title: "Erro",
        description: "Não foi possível atualizar a tarefa.",
        variant: "destructive"
      });
    }
  };

  const getCompletionPercentage = () => {
    if (checklist.length === 0) return 0;
    const completed = checklist.filter(item => item.completed).length;
    return Math.round((completed / checklist.length) * 100);
  };

  const getActivityIcon = (activityName: string) => {
    const name = activityName.toLowerCase();
    if (name.includes("acordar")) return <Sunrise className="w-4 h-4 text-primary" />;
    if (name.includes("trabalhar") || name.includes("vender")) return <Briefcase className="w-4 h-4 text-secondary" />;
    if (name.includes("almoço") || name.includes("almoçar")) return <Utensils className="w-4 h-4 text-success" />;
    if (name.includes("parar")) return <Sunset className="w-4 h-4 text-warning" />;
    if (name.includes("dormir")) return <Moon className="w-4 h-4 text-primary" />;
    return <Circle className="w-4 h-4 text-muted-foreground" />;
  };

  if (loading || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-muted-foreground">Carregando checklist...</p>
        </div>
      </div>
    );
  }

  const completionPercentage = getCompletionPercentage();
  const completedCount = checklist.filter(item => item.completed).length;

  return (
    <div className="space-y-6 pb-20 md:pb-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold gradient-text">Checklist Diário</h1>
        <p className="text-muted-foreground mt-1">
          Acompanhe suas atividades e mantenha a constância
        </p>
      </div>

      {/* Progress Card */}
      <Card className="glass card-gradient-border">
        <CardContent className="p-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-primary" />
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  max={new Date().toISOString().split('T')[0]}
                  className="bg-transparent border border-border rounded-lg px-3 py-1.5 text-sm"
                />
              </div>
              <Badge className="bg-primary/20 text-primary">
                {completedCount}/{checklist.length} concluídas
              </Badge>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Progresso do dia</span>
                <span className="font-semibold text-primary">{completionPercentage}%</span>
              </div>
              <div className="h-3 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-primary to-secondary transition-all duration-500"
                  style={{ width: `${completionPercentage}%` }}
                />
              </div>
            </div>

            {completionPercentage === 100 && (
              <div className="flex items-center gap-2 p-3 bg-success/10 border border-success/20 rounded-lg">
                <CheckCircle2 className="w-5 h-5 text-success" />
                <p className="text-sm text-success font-medium">
                  🎉 Parabéns! Você completou todas as atividades de hoje!
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Checklist Items */}
      {checklist.length === 0 ? (
        <Card className="glass">
          <CardContent className="p-8 text-center">
            <TrendingUp className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground mb-4">
              Nenhuma atividade encontrada para este dia.
            </p>
            <Button onClick={() => navigate("/routine")} className="gap-2">
              <Plus className="w-4 h-4" />
              Configurar Rotina
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {checklist.map((item) => (
            <Card
              key={item.id}
              className={`glass transition-smooth hover:shadow-lg cursor-pointer ${
                item.completed ? "bg-success/5 border-success/20" : ""
              }`}
              onClick={() => toggleComplete(item.id, item.completed)}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <Checkbox
                    checked={item.completed}
                    onCheckedChange={() => toggleComplete(item.id, item.completed)}
                    className="h-5 w-5"
                  />
                  
                  <div className="flex-1 flex items-center gap-3">
                    {getActivityIcon(item.activity_name)}
                    <div className="flex-1">
                      <p className={`font-medium ${item.completed ? "line-through text-muted-foreground" : ""}`}>
                        {item.activity_name}
                      </p>
                      {item.activity_time && (
                        <p className="text-xs text-muted-foreground">
                          {item.activity_time}
                        </p>
                      )}
                    </div>
                  </div>

                  {item.completed && (
                    <CheckCircle2 className="w-5 h-5 text-success" />
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Action Card */}
      <Card className="glass border-primary/20 bg-primary/5">
        <CardContent className="p-6">
          <div className="flex items-start space-x-4">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <TrendingUp className="w-6 h-6 text-primary" />
            </div>
            <div className="space-y-2">
              <h3 className="font-semibold text-lg">Dica de Constância</h3>
              <p className="text-muted-foreground text-sm">
                Manter uma rotina consistente é fundamental para o sucesso. Complete suas
                atividades diariamente e veja seus resultados melhorarem ao longo do tempo!
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
