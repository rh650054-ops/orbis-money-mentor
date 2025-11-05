import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Clock, Sunrise, Briefcase, Utensils, Sunset, Moon, DollarSign, CheckCircle2, Circle, Calendar, Plus, TrendingUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import CustomActivityForm from "@/components/CustomActivityForm";
import { ActivityTimer } from "@/components/ActivityTimer";
import { GoalTimer } from "@/components/GoalTimer";
import { z } from "zod";

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

const routineSchema = z.object({
  wakeTime: z.string().regex(/^\d{2}:\d{2}$/, { message: "Horário inválido" }),
  workStart: z.string().regex(/^\d{2}:\d{2}$/, { message: "Horário inválido" }),
  lunchTime: z.string().regex(/^\d{2}:\d{2}$/, { message: "Horário inválido" }),
  workEnd: z.string().regex(/^\d{2}:\d{2}$/, { message: "Horário inválido" }),
  sleepTime: z.string().regex(/^\d{2}:\d{2}$/, { message: "Horário inválido" }),
  notes: z.string().max(1000, { message: "Observações devem ter no máximo 1000 caracteres" }).optional(),
  dailyGoal: z.string().refine((val) => {
    if (!val) return true;
    const num = parseFloat(val);
    return !isNaN(num) && num >= 0 && num <= 999999;
  }, { message: "Meta deve ser entre 0 e 999.999" }).optional()
});

export default function Routine() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [aiResponse, setAiResponse] = useState("");
  const [stats, setStats] = useState({ sleepHours: "", workHours: "" });
  const [routineId, setRoutineId] = useState<string | null>(null);
  const [customActivities, setCustomActivities] = useState<any[]>([]);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [totalFocusTime, setTotalFocusTime] = useState(0);
  const [showChecklist, setShowChecklist] = useState(false);

  const [formData, setFormData] = useState({
    wakeTime: "",
    workStart: "",
    lunchTime: "",
    workEnd: "",
    sleepTime: "",
    notes: "",
    dailyGoal: ""
  });

  // 🧮 Função para calcular horas
  const calculateHours = (start: string, end: string): string => {
    if (!start || !end) return "--h";
    const [startH, startM] = start.split(":").map(Number);
    const [endH, endM] = end.split(":").map(Number);
    let diff = (endH * 60 + endM) - (startH * 60 + startM);
    if (diff < 0) diff += 24 * 60;
    const hours = Math.floor(diff / 60);
    const minutes = diff % 60;
    return `${hours}h ${minutes.toString().padStart(2, "0")}min`;
  };

  // 📥 Carregar rotina salva e atividades personalizadas
  useEffect(() => {
    if (!user) return;
    
    const loadData = async () => {
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
        setShowChecklist(true);
        setFormData({
          wakeTime: data.wake_time,
          workStart: data.work_start,
          lunchTime: data.lunch_time,
          workEnd: data.work_end,
          sleepTime: data.sleep_time,
          notes: data.notes || "",
          dailyGoal: data.daily_profit?.toString() || ""
        });
      }

      // Carregar atividades personalizadas
      const { data: activities } = await supabase
        .from("routine_activities")
        .select("*")
        .eq("user_id", user.id)
        .order("display_order", { ascending: true });

      if (activities) {
        setCustomActivities(activities);
      }

      // Carregar checklist se rotina existir
      if (data && !error) {
        loadChecklist();
      }
    };

    loadData();
  }, [user, selectedDate]);

  // 🔄 Atualiza estatísticas sempre que mudar os horários
  useEffect(() => {
    const sleepHours = calculateHours(formData.sleepTime, formData.wakeTime);
    const workHours = calculateHours(formData.workStart, formData.workEnd);
    setStats({ sleepHours, workHours });
  }, [formData]);

  // 🔐 Verificar autenticação
  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  // Retornar null enquanto carrega ou se não houver usuário
  if (loading || !user) {
    return null;
  }

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
      console.error("Error loading checklist:", error);
    }
  };

  const generateChecklistFromRoutine = async () => {
    if (!user || !routineId) return;

    try {
      const { data: routine } = await supabase
        .from("routines")
        .select("*")
        .eq("user_id", user.id)
        .eq("id", routineId)
        .single();

      const { data: customActivities } = await supabase
        .from("routine_activities")
        .select("*")
        .eq("user_id", user.id)
        .order("start_time", { ascending: true });

      const activities: { name: string; time: string; emoji?: string }[] = [];

      if (routine) {
        activities.push(
          { name: "Acordar", time: routine.wake_time, emoji: "☀️" },
          { name: "Começar a trabalhar", time: routine.work_start, emoji: "💼" },
          { name: "Almoçar", time: routine.lunch_time, emoji: "🍽️" },
          { name: "Parar de vender", time: routine.work_end, emoji: "🏁" },
          { name: "Dormir", time: routine.sleep_time, emoji: "🌙" }
        );
      }

      if (customActivities && customActivities.length > 0) {
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
      console.error("Error generating checklist:", error);
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

  // Função para recarregar dados após mudanças
  const reloadData = async () => {
    if (!user) return;
    
    const { data: activities } = await supabase
      .from("routine_activities")
      .select("*")
      .eq("user_id", user.id)
      .order("display_order", { ascending: true });

    if (activities) {
      setCustomActivities(activities);
    }
    
    loadChecklist();
  };

  // 🚀 Enviar rotina para IA
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    setIsLoading(true);
    setAiResponse("");

    try {
      // Validate form data
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

      // 💾 Salvar no banco de dados
      const routineData = {
        user_id: user.id,
        wake_time: formData.wakeTime,
        work_start: formData.workStart,
        lunch_time: formData.lunchTime,
        work_end: formData.workEnd,
        sleep_time: formData.sleepTime,
        daily_profit: formData.dailyGoal ? parseFloat(formData.dailyGoal) : 0,
        daily_debt: 0,
        notes: formData.notes.trim()
      };

      if (routineId) {
        // Atualizar rotina existente
        const { error: updateError } = await supabase
          .from("routines")
          .update(routineData)
          .eq("id", routineId);
        
        if (updateError) throw updateError;
      } else {
        // Criar nova rotina
        const { data: newRoutine, error: insertError } = await supabase
          .from("routines")
          .insert(routineData)
          .select()
          .single();
        
        if (insertError) throw insertError;
        if (newRoutine) setRoutineId(newRoutine.id);
      }

      toast({
        title: "✅ Rotina salva com sucesso!",
        description: "Checklist atualizado!",
      });

      setShowChecklist(true);
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

  return (
    <div className="min-h-screen p-6 bg-gradient-to-br from-background via-background/95 to-background/80 space-y-10 animate-fade-in">
      
      {/* 🔥 Título principal */}
      <div className="text-center space-y-3 mb-8">
        <h1 className="text-5xl font-bold text-primary tracking-tight drop-shadow-[0_0_20px_rgba(0,180,255,0.7)]">
          {showChecklist ? "Checklist Diário" : "Domine seu futuro"}
        </h1>
        <p className="text-muted-foreground text-base md:text-lg">
          {showChecklist ? "Acompanhe suas atividades e mantenha a constância" : "Crie, analise e otimize sua rotina com o poder da IA Orbis ⚡"}
        </p>
      </div>

      {showChecklist && (
        <>
          {/* Goal Timer */}
          <GoalTimer userId={user?.id || ""} />

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
                  <Progress value={completionPercentage} className="h-4" />
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
          {checklist.length > 0 && (
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
                      <Checkbox
                        checked={item.completed}
                        onCheckedChange={() => toggleComplete(item.id, item.completed)}
                        className="h-6 w-6 border-2"
                      />
                      
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

                      <ActivityTimer
                        taskId={item.id}
                        taskName={item.activity_name}
                        currentStatus={item.status || "pending"}
                        currentProgress={item.progress || 0}
                        durationMinutes={item.duration_minutes || 0}
                        startedAt={item.started_at || null}
                        onTimerComplete={reloadData}
                      />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          <Button 
            onClick={() => setShowChecklist(false)}
            variant="outline"
            className="w-full max-w-2xl mx-auto block"
          >
            Editar Rotina
          </Button>
        </>
      )}

      {!showChecklist && (
        <>

      {/* 📋 Formulário */}
      <Card className="card-gradient-border max-w-2xl mx-auto shadow-xl backdrop-blur-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg md:text-xl font-semibold">
            <Clock className="h-5 w-5 text-primary" />
            Sua Rotina Diária
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

            <div className="space-y-2 mt-4">
              <Label className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-success" />
                Meta de vendas do dia (R$)
              </Label>
              <Input
                type="number"
                step="0.01"
                placeholder="Ex: 200,00"
                value={formData.dailyGoal}
                onChange={(e) => setFormData({ ...formData, dailyGoal: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Observações</Label>
            <Textarea
                placeholder="Adicione detalhes: deslocamento, treino, descanso..."
                value={formData.notes}
                onChange={(e) => setFormData({...formData, notes: e.target.value})}
                rows={4}
                maxLength={1000}
              />
            </div>

            <Button 
              type="submit"
              className="w-full"
              disabled={isLoading}
            >
              {isLoading ? "⏳ Salvando..." : "💾 Salvar Rotina"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Atividades Personalizadas */}
      <CustomActivityForm 
        userId={user.id} 
        activities={customActivities} 
        onActivitiesChange={reloadData}
      />

      {/* 🧭 Linha do Tempo */}
      {(formData.wakeTime || formData.workStart || formData.workEnd || formData.sleepTime || customActivities.length > 0) && (
        <Card className="max-w-3xl mx-auto bg-gradient-to-br from-card/80 to-card/50 shadow-lg border border-primary/20 mt-10">
          <CardHeader>
            <CardTitle className="text-center text-primary font-semibold text-lg">
              🕓 Linha do Tempo Visionária
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Atividades Base da Rotina */}
            <div className="relative flex items-center justify-between w-full mt-6">
              {[
                { icon: <Sunrise className="text-primary" />, label: "Acorda", time: formData.wakeTime },
                { icon: <Briefcase className="text-secondary" />, label: "Trabalha", time: formData.workStart },
                { icon: <Utensils className="text-success" />, label: "Almoça", time: formData.lunchTime },
                { icon: <Sunset className="text-warning" />, label: "Para", time: formData.workEnd },
                { icon: <Moon className="text-primary" />, label: "Dorme", time: formData.sleepTime },
              ].map(({ icon, label, time }, i, arr) => (
                <div key={label} className="flex flex-col items-center text-center relative">
                  <div className="p-3 bg-background rounded-full border border-primary/30 shadow-sm mb-2">
                    {icon}
                  </div>
                  <p className="text-xs md:text-sm font-medium text-foreground">{label}</p>
                  <p className="text-[10px] text-muted-foreground">{time || "--:--"}</p>

                  {i < arr.length - 1 && (
                    <div className="absolute top-5 left-[55%] w-[100%] h-[2px] bg-gradient-to-r from-primary/30 to-transparent -z-10" />
                  )}
                </div>
              ))}
            </div>

            {/* Atividades Personalizadas */}
            {customActivities.length > 0 && (
              <div className="mt-6 pt-6 border-t border-primary/20">
                <h4 className="text-sm font-semibold text-primary mb-4 text-center">Atividades Personalizadas</h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {customActivities.map((activity) => (
                    <div key={activity.id} className="p-3 rounded-lg bg-secondary/10 border border-secondary/20">
                      <p className="text-xs font-medium text-foreground">{activity.name}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {activity.start_time} - {activity.end_time}
                      </p>
                      {activity.category && (
                        <p className="text-[10px] text-primary mt-1">
                          {activity.category}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Estatísticas de horas */}
            <div className="flex flex-col md:flex-row justify-center gap-6 mt-8 text-center">
              <div className="p-3 bg-primary/10 rounded-lg border border-primary/20">
                <p className="text-sm text-muted-foreground">Horas de Sono</p>
                <p className="text-lg font-semibold text-primary">{stats.sleepHours}</p>
              </div>
              <div className="p-3 bg-secondary/10 rounded-lg border border-secondary/20">
                <p className="text-sm text-muted-foreground">Horas de Trabalho</p>
                <p className="text-lg font-semibold text-secondary">{stats.workHours}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

        </>
      )}
    </div>
  );
}
