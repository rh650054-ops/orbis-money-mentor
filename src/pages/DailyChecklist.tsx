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
  Plus,
  Clock
} from "lucide-react";
import { ActivityTimer } from "@/components/ActivityTimer";

interface ChecklistItem {
  id: string;
  activity_name: string;
  activity_time: string | null;
  completed: boolean;
  emoji?: string;
  duration_minutes?: number;
  started_at?: string | null;
  completed_at?: string | null;
  progress?: number;
  status?: string;
}

interface RoutineActivity {
  name: string;
  start_time: string;
  end_time: string;
  emoji: string;
}

export default function DailyChecklist() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { toast } = useToast();
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [totalFocusTime, setTotalFocusTime] = useState(0);

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
        calculateTotalFocusTime(existingChecklist);
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
      // Verificar se já existe checklist para esta data
      const { data: existingCheck, error: checkError } = await supabase
        .from("daily_checklist")
        .select("id")
        .eq("user_id", user.id)
        .eq("date", selectedDate)
        .limit(1);

      if (checkError) {
        console.error("Erro ao verificar checklist existente:", checkError);
      }

      if (existingCheck && existingCheck.length > 0) {
        console.log("Checklist já existe para esta data, carregando...");
        await loadChecklist();
        return;
      }

      // Load routine data
      const { data: routine, error: routineError } = await supabase
        .from("routines")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (routineError) {
        console.error("Erro ao carregar rotina:", routineError);
      }

      // Load custom activities
      const { data: customActivities, error: activitiesError } = await supabase
        .from("routine_activities")
        .select("*")
        .eq("user_id", user.id)
        .order("start_time", { ascending: true });

      if (activitiesError) {
        console.error("Erro ao carregar atividades:", activitiesError);
      }

      const activities: { name: string; time: string; emoji?: string }[] = [];
      const activitySet = new Set<string>(); // Para evitar duplicatas

      // Add routine base activities
      if (routine) {
        const baseActivities = [
          { name: "Acordar", time: routine.wake_time, emoji: "☀️" },
          { name: "Começar a trabalhar", time: routine.work_start, emoji: "💼" },
          { name: "Almoçar", time: routine.lunch_time, emoji: "🍽️" },
          { name: "Parar de vender", time: routine.work_end, emoji: "🏁" },
          { name: "Dormir", time: routine.sleep_time, emoji: "🌙" }
        ];
        
        baseActivities.forEach(activity => {
          const key = `${activity.name}-${activity.time}`;
          if (!activitySet.has(key)) {
            activitySet.add(key);
            activities.push(activity);
          }
        });
      }

      // Add custom activities (avoiding duplicates)
      if (customActivities && customActivities.length > 0) {
        customActivities.forEach((activity: RoutineActivity) => {
          const key = `${activity.name}-${activity.start_time}`;
          if (!activitySet.has(key)) {
            activitySet.add(key);
            activities.push({
              name: activity.name,
              time: activity.start_time,
              emoji: activity.emoji || "💪"
            });
          }
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
        emoji: activity.emoji,
        completed: false
      }));

      if (checklistItems.length > 0) {
        // Usar upsert para evitar duplicatas caso haja erro de timing
        const { data, error } = await supabase
          .from("daily_checklist")
          .upsert(checklistItems, {
            onConflict: 'user_id,date,activity_name,activity_time',
            ignoreDuplicates: false
          })
          .select();

        if (error) {
          console.error("Erro ao inserir checklist:", error);
          // Se o erro for de duplicata, apenas recarrega o checklist
          if (error.code === '23505') {
            console.log("Atividades já existem, carregando checklist...");
            await loadChecklist();
            return;
          }
          throw error;
        }
        if (data) {
          setChecklist(data);
          toast({
            title: "✅ Checklist criado!",
            description: `${data.length} atividades adicionadas para hoje.`
          });
        }
      } else {
        toast({
          title: "Nenhuma rotina encontrada",
          description: "Configure sua rotina primeiro para ver o checklist.",
          variant: "default"
        });
      }
    } catch (error) {
      console.error("Erro completo:", error);
      toast({
        title: "Erro",
        description: "Não foi possível gerar o checklist. Verifique o console para mais detalhes.",
        variant: "destructive"
      });
    }
  };

  const calculateTotalFocusTime = (items: ChecklistItem[]) => {
    const total = items.reduce((sum, item) => {
      if (item.status === "completed" && item.duration_minutes) {
        return sum + item.duration_minutes;
      }
      return sum;
    }, 0);
    setTotalFocusTime(total);
  };

  const handleTimerComplete = () => {
    loadChecklist();
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

  const formatTotalTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h${mins > 0 ? ` ${mins}min` : ''}`;
    }
    return `${mins}min`;
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
      <Card className="glass card-gradient-border shadow-glow-primary animate-fade-in">
        <CardContent className="p-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-primary animate-pulse" />
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  max={new Date().toISOString().split('T')[0]}
                  className="bg-card border border-primary/30 rounded-lg px-3 py-1.5 text-sm hover:border-primary transition-smooth focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <Badge className="bg-gradient-to-r from-primary to-secondary text-primary-foreground shadow-lg animate-fade-in">
                {completedCount}/{checklist.length} concluídas
              </Badge>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Progresso do dia</span>
                <span className="font-bold text-primary text-lg animate-pulse">{completionPercentage}%</span>
              </div>
              <div className="h-4 bg-muted rounded-full overflow-hidden shadow-inner relative">
                <div
                  className="h-full bg-gradient-to-r from-primary via-secondary to-primary transition-all duration-700 ease-out shadow-glow-primary relative"
                  style={{ width: `${completionPercentage}%` }}
                >
                  <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
                </div>
              </div>
            </div>

            {totalFocusTime > 0 && (
              <div className="flex items-center justify-between p-3 bg-gradient-to-r from-primary/10 to-secondary/10 border border-primary/20 rounded-lg">
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-primary" />
                  <span className="text-sm font-semibold">Tempo de foco hoje:</span>
                </div>
                <span className="text-lg font-bold text-primary">{formatTotalTime(totalFocusTime)}</span>
              </div>
            )}

            {completionPercentage === 100 && (
              <div className="flex items-center gap-2 p-4 bg-gradient-to-r from-success/20 to-success/10 border border-success/30 rounded-lg shadow-glow-success animate-fade-in">
                <CheckCircle2 className="w-6 h-6 text-success animate-bounce" />
                <p className="text-sm text-success font-bold">
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
        <div className="space-y-3">
          {checklist.map((item, index) => (
            <Card
              key={item.id}
              className={`glass transition-all duration-300 transform hover:scale-[1.02] hover:-translate-y-1 animate-fade-in ${
                item.completed 
                  ? "bg-gradient-to-r from-success/10 to-success/5 border-success/30 shadow-glow-success" 
                  : "hover:shadow-glow-primary hover:border-primary/30"
              }`}
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <div className={`transition-transform duration-300 ${item.completed ? "scale-110" : ""}`}>
                    <Checkbox
                      checked={item.completed}
                      onCheckedChange={() => toggleComplete(item.id, item.completed)}
                      className="h-6 w-6 border-2"
                    />
                  </div>
                  
                  <div className="flex-1 flex items-center gap-3">
                    {item.emoji ? (
                      <span className={`text-3xl transition-transform duration-300 ${item.completed ? "grayscale" : "hover:scale-125"}`}>
                        {item.emoji}
                      </span>
                    ) : (
                      <div className={`transition-transform duration-300 ${item.completed ? "opacity-50" : "hover:scale-110"}`}>
                        {getActivityIcon(item.activity_name)}
                      </div>
                    )}
                    <div className="flex-1">
                      <p className={`font-semibold text-base transition-all duration-300 ${
                        item.completed ? "line-through text-muted-foreground" : "text-foreground"
                      }`}>
                        {item.activity_name}
                      </p>
                      {item.activity_time && (
                        <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                          <span className="text-primary">🕐</span>
                          {item.activity_time}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="ml-auto">
                    <ActivityTimer
                      taskId={item.id}
                      taskName={item.activity_name}
                      currentStatus={item.status || "pending"}
                      currentProgress={item.progress || 0}
                      durationMinutes={item.duration_minutes || 0}
                      startedAt={item.started_at || null}
                      onTimerComplete={handleTimerComplete}
                    />
                  </div>
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
