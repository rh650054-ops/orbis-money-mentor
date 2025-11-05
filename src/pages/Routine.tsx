import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { 
  Clock, Sunrise, Briefcase, Utensils, Sunset, Moon, DollarSign, 
  Plus, CheckCircle2, Calendar, TrendingUp, Circle, Edit 
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ActivityTimer } from "@/components/ActivityTimer";
import { GoalTimer } from "@/components/GoalTimer";
import { z } from "zod";

const routineSchema = z.object({
  wakeTime: z.string().regex(/^\d{2}:\d{2}$/, { message: "Horário inválido" }),
  workStart: z.string().regex(/^\d{2}:\d{2}$/, { message: "Horário inválido" }),
  lunchTime: z.string().regex(/^\d{2}:\d{2}$/, { message: "Horário inválido" }),
  workEnd: z.string().regex(/^\d{2}:\d{2}$/, { message: "Horário inválido" }),
  sleepTime: z.string().regex(/^\d{2}:\d{2}$/, { message: "Horário inválido" }),
});

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

export default function Routine() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [routineId, setRoutineId] = useState<string | null>(null);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [totalFocusTime, setTotalFocusTime] = useState(0);

  const [formData, setFormData] = useState({
    wakeTime: "",
    workStart: "",
    lunchTime: "",
    workEnd: "",
    sleepTime: "",
  });

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
      return;
    }

    if (user) {
      loadData();
    }
  }, [user, loading, navigate, selectedDate]);

  const loadData = async () => {
    if (!user) return;

    try {
      // Carregar rotina
      const { data, error } = await supabase
        .from("routines")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (data && !error) {
        setRoutineId(data.id);
        setShowForm(false);
        setFormData({
          wakeTime: data.wake_time,
          workStart: data.work_start,
          lunchTime: data.lunch_time,
          workEnd: data.work_end,
          sleepTime: data.sleep_time,
        });
        await loadChecklist();
      } else {
        setShowForm(true);
      }
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
    }
  };

  const loadChecklist = async () => {
    if (!user) return;

    try {
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
        await generateChecklistFromRoutine();
      }
    } catch (error) {
      console.error("Erro ao carregar checklist:", error);
    }
  };

  const generateChecklistFromRoutine = async () => {
    if (!user || !routineId) return;

    try {
      const { data: routine } = await supabase
        .from("routines")
        .select("*")
        .eq("id", routineId)
        .single();

      const { data: customActivities } = await supabase
        .from("routine_activities")
        .select("*")
        .eq("user_id", user.id)
        .order("start_time", { ascending: true });

      const activities: { name: string; time: string; emoji?: string }[] = [];

      if (routine) {
        const baseActivities = [
          { name: "Acordar", time: routine.wake_time, emoji: "☀️" },
          { name: "Começar a trabalhar", time: routine.work_start, emoji: "💼" },
          { name: "Almoçar", time: routine.lunch_time, emoji: "🍽️" },
          { name: "Parar de vender", time: routine.work_end, emoji: "🏁" },
          { name: "Dormir", time: routine.sleep_time, emoji: "🌙" }
        ];
        activities.push(...baseActivities);
      }

      if (customActivities) {
        customActivities.forEach((activity: any) => {
          activities.push({
            name: activity.name,
            time: activity.start_time,
            emoji: activity.emoji || "💪"
          });
        });
      }

      activities.sort((a, b) => a.time.localeCompare(b.time));

      const checklistItems = activities.map(activity => ({
        user_id: user.id,
        date: selectedDate,
        activity_name: activity.name,
        activity_time: activity.time,
        emoji: activity.emoji,
        completed: false
      }));

      if (checklistItems.length > 0) {
        const { data } = await supabase
          .from("daily_checklist")
          .upsert(checklistItems, {
            onConflict: 'user_id,date,activity_name,activity_time',
            ignoreDuplicates: false
          })
          .select();

        if (data) {
          setChecklist(data);
        }
      }
    } catch (error) {
      console.error("Erro ao gerar checklist:", error);
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
      });
    } catch (error) {
      toast({
        title: "Erro ao atualizar tarefa",
        variant: "destructive"
      });
    }
  };

  const handleTimerComplete = () => {
    loadChecklist();
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    setIsLoading(true);

    try {
      const validation = routineSchema.safeParse(formData);
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

      const routineData = {
        user_id: user.id,
        wake_time: formData.wakeTime,
        work_start: formData.workStart,
        lunch_time: formData.lunchTime,
        work_end: formData.workEnd,
        sleep_time: formData.sleepTime,
        daily_profit: 0,
        daily_debt: 0,
        notes: ""
      };

      if (routineId) {
        const { error: updateError } = await supabase
          .from("routines")
          .update(routineData)
          .eq("id", routineId);
        
        if (updateError) throw updateError;
      } else {
        const { data: newRoutine, error: insertError } = await supabase
          .from("routines")
          .insert(routineData)
          .select()
          .single();
        
        if (insertError) throw insertError;
        if (newRoutine) setRoutineId(newRoutine.id);
      }

      toast({
        title: "✅ Rotina salva!",
        description: "Gerando checklist diário...",
      });

      setShowForm(false);
      await loadChecklist();
    } catch (error) {
      toast({
        title: "Erro",
        description: "Não foi possível salvar a rotina.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const completionPercentage = getCompletionPercentage();
  const completedCount = checklist.filter(item => item.completed).length;

  if (loading || !user) {
    return null;
  }

  return (
    <div className="space-y-6 pb-20 md:pb-8">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold gradient-text">⚡ Rotina Visionária</h1>
          <p className="text-muted-foreground mt-1">
            Configure sua rotina e acompanhe suas atividades com cronômetros de foco
          </p>
        </div>
        {!showForm && (
          <Button variant="outline" onClick={() => setShowForm(true)}>
            <Edit className="w-4 h-4 mr-2" />
            Editar Rotina
          </Button>
        )}
      </div>

      {/* Goal Timer */}
      {!showForm && <GoalTimer userId={user?.id || ""} />}

      {/* Formulário de Configuração */}
      {showForm && (
        <Card className="card-gradient-border shadow-glow-primary animate-fade-in">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              Configure sua Rotina Diária
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                {[
                  { icon: <Sunrise className="h-4 w-4 text-primary" />, label: "Hora que acorda", key: "wakeTime" },
                  { icon: <Briefcase className="h-4 w-4 text-secondary" />, label: "Hora que começa a trabalhar", key: "workStart" },
                  { icon: <Utensils className="h-4 w-4 text-success" />, label: "Hora que almoça", key: "lunchTime" },
                  { icon: <Sunset className="h-4 w-4 text-warning" />, label: "Hora que para de vender", key: "workEnd" },
                  { icon: <Moon className="h-4 w-4 text-primary" />, label: "Hora que dorme", key: "sleepTime" },
                ].map(({ icon, label, key }) => (
                  <div key={key} className="space-y-2">
                    <Label className="flex items-center gap-2">{icon}{label}</Label>
                    <Input
                      type="time"
                      value={formData[key as keyof typeof formData] as string}
                      onChange={(e) => setFormData({ ...formData, [key]: e.target.value })}
                      required
                    />
                  </div>
                ))}
              </div>

              <div className="flex gap-3">
                <Button 
                  type="submit"
                  className="flex-1"
                  disabled={isLoading}
                >
                  {isLoading ? "⏳ Salvando..." : "💾 Salvar Rotina"}
                </Button>
                {routineId && (
                  <Button 
                    type="button"
                    variant="outline"
                    onClick={() => setShowForm(false)}
                  >
                    Cancelar
                  </Button>
                )}
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Checklist */}
      {!showForm && checklist.length > 0 && (
        <>
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
        </>
      )}

      {/* Empty State */}
      {!showForm && checklist.length === 0 && (
        <Card className="glass">
          <CardContent className="p-8 text-center">
            <TrendingUp className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground mb-4">
              Nenhuma atividade encontrada para este dia.
            </p>
            <Button onClick={() => setShowForm(true)} className="gap-2">
              <Plus className="w-4 h-4" />
              Configurar Rotina
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
