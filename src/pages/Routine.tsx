import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Clock, Sunrise, Briefcase, Utensils, Sunset, Moon, DollarSign, Settings, ListChecks } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { z } from "zod";
import DayStatusHeader from "@/components/routine/DayStatusHeader";
import ActivityCard from "@/components/routine/ActivityCard";
import VisualTimeline from "@/components/routine/VisualTimeline";
import NightSummary from "@/components/routine/NightSummary";
import CustomActivitiesSection from "@/components/routine/CustomActivitiesSection";
import { useEnergy } from "@/hooks/useEnergy";

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

interface RoutineData {
  wake_time: string;
  work_start: string;
  lunch_time: string;
  work_end: string;
  sleep_time: string;
}

const routineSchema = z.object({
  wakeTime: z.string().regex(/^\d{2}:\d{2}$/, { message: "Horário inválido" }),
  workStart: z.string().regex(/^\d{2}:\d{2}$/, { message: "Horário inválido" }),
  lunchTime: z.string().regex(/^\d{2}:\d{2}$/, { message: "Horário inválido" }),
  workEnd: z.string().regex(/^\d{2}:\d{2}$/, { message: "Horário inválido" }),
  sleepTime: z.string().regex(/^\d{2}:\d{2}$/, { message: "Horário inválido" }),
  notes: z.string().max(1000).optional(),
  dailyGoal: z.string().refine((val) => {
    if (!val) return true;
    const num = parseFloat(val);
    return !isNaN(num) && num >= 0 && num <= 999999;
  }).optional()
});

export default function Routine() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [routineId, setRoutineId] = useState<string | null>(null);
  const [routineData, setRoutineData] = useState<RoutineData | null>(null);
  const [customActivities, setCustomActivities] = useState<any[]>([]);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [selectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [showChecklist, setShowChecklist] = useState(false);
  const [currentTime, setCurrentTime] = useState("");
  const [currentTimeMinutes, setCurrentTimeMinutes] = useState(0);
  const [activeTab, setActiveTab] = useState("checklist");

  const [formData, setFormData] = useState({
    wakeTime: "",
    workStart: "",
    lunchTime: "",
    workEnd: "",
    sleepTime: "",
    notes: "",
    dailyGoal: ""
  });

  // Energy calculation
  const energy = useEnergy(checklist, routineData, currentTimeMinutes);

  // Update current time every second
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const hours = now.getHours().toString().padStart(2, "0");
      const minutes = now.getMinutes().toString().padStart(2, "0");
      setCurrentTime(`${hours}:${minutes}`);
      setCurrentTimeMinutes(now.getHours() * 60 + now.getMinutes());
    };
    
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Load routine data
  useEffect(() => {
    if (!user) return;
    
    const loadData = async () => {
      const { data, error } = await supabase
        .from("routines")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (data && !error) {
        setRoutineId(data.id);
        setRoutineData({
          wake_time: data.wake_time,
          work_start: data.work_start,
          lunch_time: data.lunch_time,
          work_end: data.work_end,
          sleep_time: data.sleep_time,
        });
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

      const { data: activities } = await supabase
        .from("routine_activities")
        .select("*")
        .eq("user_id", user.id)
        .order("display_order", { ascending: true });

      if (activities) {
        setCustomActivities(activities);
      }

      if (data && !error) {
        loadChecklist();
      }
    };

    loadData();
  }, [user, selectedDate]);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

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

      const { data: customActivitiesData } = await supabase
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

      if (customActivitiesData && customActivitiesData.length > 0) {
        customActivitiesData.forEach((activity: any) => {
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    setIsLoading(true);

    try {
      const validation = routineSchema.safeParse(formData);
      if (!validation.success) {
        toast({
          title: "Erro de validação",
          description: validation.error.errors[0].message,
          variant: "destructive"
        });
        setIsLoading(false);
        return;
      }

      const routineDataToSave = {
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
        const { error } = await supabase
          .from("routines")
          .update(routineDataToSave)
          .eq("id", routineId);
        
        if (error) throw error;
      } else {
        const { data: newRoutine, error } = await supabase
          .from("routines")
          .insert(routineDataToSave)
          .select()
          .single();
        
        if (error) throw error;
        if (newRoutine) setRoutineId(newRoutine.id);
      }

      setRoutineData({
        wake_time: formData.wakeTime,
        work_start: formData.workStart,
        lunch_time: formData.lunchTime,
        work_end: formData.workEnd,
        sleep_time: formData.sleepTime,
      });

      toast({
        title: "✅ Rotina salva com sucesso!",
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

  const handleSaveDay = () => {
    toast({
      title: "🌙 Dia salvo!",
      description: "Descanse bem, visionário. Amanhã é um novo dia de vitórias!",
    });
  };

  const completedCount = checklist.filter(item => item.completed).length;
  const totalCount = checklist.length;

  return (
    <div className="min-h-screen p-4 md:p-6 pb-24 space-y-6 animate-fade-in">
      {/* Cinematic background */}
      <div className="fixed inset-0 -z-10 bg-gradient-to-br from-background via-background to-primary/5">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent" />
      </div>

      {showChecklist ? (
        <>
          {/* Day Status Header */}
          <DayStatusHeader
            completedCount={completedCount}
            totalCount={totalCount}
            currentTime={currentTime}
            energy={energy}
            checklist={checklist}
          />

          {/* Tabs for different views */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="w-full grid grid-cols-3 bg-card/50 border border-border/50">
              <TabsTrigger value="checklist" className="gap-2 data-[state=active]:bg-primary/20">
                <ListChecks className="w-4 h-4" />
                <span className="hidden sm:inline">Checklist</span>
              </TabsTrigger>
              <TabsTrigger value="timeline" className="gap-2 data-[state=active]:bg-primary/20">
                <Clock className="w-4 h-4" />
                <span className="hidden sm:inline">Timeline</span>
              </TabsTrigger>
              <TabsTrigger value="config" className="gap-2 data-[state=active]:bg-primary/20">
                <Settings className="w-4 h-4" />
                <span className="hidden sm:inline">Configurar</span>
              </TabsTrigger>
            </TabsList>

            {/* Checklist Tab */}
            <TabsContent value="checklist" className="space-y-4 mt-4">
              {checklist.length > 0 ? (
                <div className="space-y-3">
                  {checklist.map((item, index) => (
                    <ActivityCard
                      key={item.id}
                      id={item.id}
                      name={item.activity_name}
                      time={item.activity_time}
                      emoji={item.emoji}
                      completed={item.completed}
                      durationMinutes={item.duration_minutes}
                      currentTimeMinutes={currentTimeMinutes}
                      onToggle={toggleComplete}
                      index={index}
                    />
                  ))}
                </div>
              ) : (
                <Card className="glass text-center p-8">
                  <p className="text-muted-foreground">
                    Configure sua rotina para ver o checklist.
                  </p>
                  <Button 
                    onClick={() => setActiveTab("config")}
                    className="mt-4"
                  >
                    Configurar Rotina
                  </Button>
                </Card>
              )}

              {/* Night Summary */}
              <NightSummary
                completedCount={completedCount}
                totalCount={totalCount}
                energy={energy}
                sleepTime={formData.sleepTime}
                currentTime={currentTime}
                onSaveDay={handleSaveDay}
              />

              {/* Custom Activities */}
              <CustomActivitiesSection
                userId={user.id}
                activities={customActivities}
                onActivitiesChange={reloadData}
              />
            </TabsContent>

            {/* Timeline Tab */}
            <TabsContent value="timeline" className="mt-4">
              <Card className="glass border-primary/20">
                <CardContent className="p-0">
                  <VisualTimeline
                    items={checklist}
                    currentTimeMinutes={currentTimeMinutes}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            {/* Config Tab */}
            <TabsContent value="config" className="space-y-6 mt-4">
              <Card className="glass border-primary/20">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
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
                            className="bg-card/50"
                          />
                        </div>
                      ))}
                    </div>

                    <div className="space-y-2">
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
                        className="bg-card/50"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Observações</Label>
                      <Textarea
                        placeholder="Adicione detalhes: deslocamento, treino, descanso..."
                        value={formData.notes}
                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                        rows={3}
                        maxLength={1000}
                        className="bg-card/50"
                      />
                    </div>

                    <Button 
                      type="submit"
                      className="w-full bg-gradient-to-r from-primary to-secondary hover:from-primary/90 hover:to-secondary/90 shadow-[0_0_30px_hsl(var(--primary)/0.3)]"
                      disabled={isLoading}
                    >
                      {isLoading ? "⏳ Salvando..." : "💾 Salvar Rotina"}
                    </Button>
                  </form>
                </CardContent>
              </Card>

              {/* Custom Activities in Config */}
              <CustomActivitiesSection
                userId={user.id}
                activities={customActivities}
                onActivitiesChange={reloadData}
              />
            </TabsContent>
          </Tabs>
        </>
      ) : (
        /* Initial Setup View */
        <div className="space-y-6">
          <div className="text-center space-y-3">
            <h1 className="text-4xl font-bold gradient-text">
              Configure sua Rotina
            </h1>
            <p className="text-muted-foreground">
              Defina seus horários e crie sua rotina visionária
            </p>
          </div>

          <Card className="glass border-primary/20 max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
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
                        className="bg-card/50"
                      />
                    </div>
                  ))}
                </div>

                <div className="space-y-2">
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
                    className="bg-card/50"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Observações</Label>
                  <Textarea
                    placeholder="Adicione detalhes: deslocamento, treino, descanso..."
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={3}
                    maxLength={1000}
                    className="bg-card/50"
                  />
                </div>

                <Button 
                  type="submit"
                  className="w-full bg-gradient-to-r from-primary to-secondary hover:from-primary/90 hover:to-secondary/90 shadow-[0_0_30px_hsl(var(--primary)/0.3)]"
                  disabled={isLoading}
                >
                  {isLoading ? "⏳ Salvando..." : "🚀 Criar Minha Rotina"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
