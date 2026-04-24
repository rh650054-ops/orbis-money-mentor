import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Clock, Sunrise, Briefcase, Utensils, Sunset, Moon, Settings, ListChecks, Edit3 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { getBrazilDate } from "@/lib/dateUtils";
import RoutineOnboardingStep1 from "@/components/routine/RoutineOnboardingStep1";
import RoutineOnboardingStep2, { RoutineItem } from "@/components/routine/RoutineOnboardingStep2";
import RoutineDailyChecklist from "@/components/routine/RoutineDailyChecklist";

type OnboardingStep = "loading" | "step1" | "step2" | "daily";

export default function Routine() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { toast } = useToast();
  const [step, setStep] = useState<OnboardingStep>("loading");
  const [profileData, setProfileData] = useState<any>(null);
  const [showConfig, setShowConfig] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    checkRoutineExists();
  }, [user]);

  const checkRoutineExists = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("routines")
      .select("id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    setStep(data ? "daily" : "step1");
  };

  const handleStep1Complete = (data: any) => {
    setProfileData(data);
    setStep("step2");
  };

  const handleStep2Complete = async (items: RoutineItem[]) => {
    if (!user) return;

    try {
      // Save base routine times from profileData
      const { error: routineError } = await supabase
        .from("routines")
        .upsert({
          user_id: user.id,
          wake_time: profileData.wakeTime,
          work_start: profileData.workStart,
          lunch_time: profileData.hasLunch ? profileData.lunchTime : profileData.workStart,
          work_end: profileData.workEnd,
          sleep_time: profileData.sleepTime,
          notes: `Desafio: ${profileData.challenge}`,
        }, { onConflict: "user_id" });

      if (routineError) {
        // If upsert on user_id doesn't work (no unique constraint), try insert
        const { error: insertError } = await supabase
          .from("routines")
          .insert({
            user_id: user.id,
            wake_time: profileData.wakeTime,
            work_start: profileData.workStart,
            lunch_time: profileData.hasLunch ? profileData.lunchTime : profileData.workStart,
            work_end: profileData.workEnd,
            sleep_time: profileData.sleepTime,
            notes: `Desafio: ${profileData.challenge}`,
          });

        if (insertError) throw insertError;
      }

      // Delete old activities and insert new ones
      await supabase
        .from("routine_activities")
        .delete()
        .eq("user_id", user.id);

      const enabledItems = items.filter((it) => it.enabled && !it.isBase);
      if (enabledItems.length > 0) {
        const activities = enabledItems.map((it, idx) => ({
          user_id: user.id,
          name: it.text,
          start_time: it.time,
          end_time: it.time,
          emoji: it.emoji,
          display_order: idx,
        }));

        await supabase.from("routine_activities").insert(activities);
      }

      // Clear today's checklist so it regenerates
      const today = getBrazilDate();
      await supabase
        .from("daily_checklist")
        .delete()
        .eq("user_id", user.id)
        .eq("date", today);

      toast({
        title: "🚀 Rotina criada!",
        description: "Sua rotina personalizada está pronta. Bora vencer!",
      });

      setStep("daily");
    } catch (error) {
      console.error("Erro ao salvar rotina:", error);
      toast({
        title: "Erro",
        description: "Não foi possível salvar a rotina.",
        variant: "destructive",
      });
    }
  };

  if (loading || !user || step === "loading") {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 pb-4 md:pb-8 space-y-6 animate-fade-in">
      {/* Cinematic background */}
      <div className="fixed inset-0 -z-10 bg-gradient-to-br from-background via-background to-primary/5">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent" />
      </div>

      {step === "step1" && (
        <RoutineOnboardingStep1 onComplete={handleStep1Complete} />
      )}

      {step === "step2" && profileData && (
        <RoutineOnboardingStep2
          profileData={profileData}
          onComplete={handleStep2Complete}
          onBack={() => setStep("step1")}
        />
      )}

      {step === "daily" && !showConfig && (
        <RoutineDailyChecklist
          userId={user.id}
          onOpenConfig={() => setShowConfig(true)}
        />
      )}

      {step === "daily" && showConfig && (
        <RoutineConfigPanel
          userId={user.id}
          onBack={() => setShowConfig(false)}
          onResetOnboarding={() => {
            setShowConfig(false);
            setStep("step1");
          }}
        />
      )}
    </div>
  );
}

// Config panel for editing routine after initial setup
function RoutineConfigPanel({ userId, onBack, onResetOnboarding }: { userId: string; onBack: () => void; onResetOnboarding: () => void }) {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    wakeTime: "",
    workStart: "",
    lunchTime: "",
    workEnd: "",
    sleepTime: "",
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadRoutine();
  }, []);

  const loadRoutine = async () => {
    const { data } = await supabase
      .from("routines")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data) {
      setFormData({
        wakeTime: data.wake_time,
        workStart: data.work_start,
        lunchTime: data.lunch_time,
        workEnd: data.work_end,
        sleepTime: data.sleep_time,
      });
    }
    setIsLoading(false);
  };

  const handleSave = async () => {
    setIsLoading(true);
    const { error } = await supabase
      .from("routines")
      .update({
        wake_time: formData.wakeTime,
        work_start: formData.workStart,
        lunch_time: formData.lunchTime,
        work_end: formData.workEnd,
        sleep_time: formData.sleepTime,
      })
      .eq("user_id", userId);

    if (error) {
      toast({ title: "Erro ao salvar", variant: "destructive" });
    } else {
      // Clear today's checklist to regenerate
      const today = getBrazilDate();
      await supabase
        .from("daily_checklist")
        .delete()
        .eq("user_id", userId)
        .eq("date", today);

      toast({ title: "✅ Rotina atualizada!" });
      onBack();
    }
    setIsLoading(false);
  };

  const fields = [
    { icon: <Sunrise className="h-4 w-4 text-primary" />, label: "Acordar", key: "wakeTime" },
    { icon: <Briefcase className="h-4 w-4 text-secondary" />, label: "Trabalhar", key: "workStart" },
    { icon: <Utensils className="h-4 w-4 text-success" />, label: "Almoço", key: "lunchTime" },
    { icon: <Sunset className="h-4 w-4 text-warning" />, label: "Parar", key: "workEnd" },
    { icon: <Moon className="h-4 w-4 text-primary" />, label: "Dormir", key: "sleepTime" },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold gradient-text">Configurar Rotina</h2>
        <Button variant="ghost" onClick={onBack}>← Voltar</Button>
      </div>

      <Card className="glass border-primary/20">
        <CardContent className="p-6 space-y-4">
          {fields.map(({ icon, label, key }) => (
            <div key={key} className="flex items-center gap-3">
              {icon}
              <Label className="w-20 text-sm">{label}</Label>
              <Input
                type="time"
                value={formData[key as keyof typeof formData]}
                onChange={(e) => setFormData({ ...formData, [key]: e.target.value })}
                className="bg-card/50 flex-1"
              />
            </div>
          ))}

          <Button
            onClick={handleSave}
            disabled={isLoading}
            className="w-full bg-gradient-to-r from-primary to-secondary hover:from-primary/90 hover:to-secondary/90 shadow-[0_0_20px_hsl(var(--primary)/0.3)]"
          >
            {isLoading ? "Salvando..." : "💾 Salvar Alterações"}
          </Button>
        </CardContent>
      </Card>

      <Card className="glass border-border/30">
        <CardContent className="p-4 text-center">
          <p className="text-muted-foreground text-sm mb-3">Quer refazer o onboarding do zero?</p>
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              await supabase.from("routines").delete().eq("user_id", userId);
              await supabase.from("routine_activities").delete().eq("user_id", userId);
              onResetOnboarding();
            }}
            className="border-destructive/30 text-destructive hover:bg-destructive/10"
          >
            Refazer Onboarding
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
