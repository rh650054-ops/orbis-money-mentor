import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2, Settings, Trophy, Flame } from "lucide-react";

interface ChecklistItem {
  id: string;
  activity_name: string;
  activity_time: string | null;
  completed: boolean;
  emoji?: string;
}

interface Props {
  userId: string;
  onOpenConfig: () => void;
}

export default function RoutineDailyChecklist({ userId, onOpenConfig }: Props) {
  const { toast } = useToast();
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [streakDays, setStreakDays] = useState(0);
  const [celebrated, setCelebrated] = useState(false);
  const today = new Date().toISOString().split("T")[0];

  useEffect(() => {
    loadChecklist();
    loadStreak();
  }, [userId]);

  const loadChecklist = async () => {
    setIsLoading(true);
    const { data } = await supabase
      .from("daily_checklist")
      .select("*")
      .eq("user_id", userId)
      .eq("date", today)
      .order("activity_time", { ascending: true });

    if (data && data.length > 0) {
      setItems(data);
    } else {
      await generateFromRoutine();
    }
    setIsLoading(false);
  };

  const generateFromRoutine = async () => {
    const { data: routine } = await supabase
      .from("routines")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: activities } = await supabase
      .from("routine_activities")
      .select("*")
      .eq("user_id", userId)
      .order("start_time", { ascending: true });

    const allItems: { name: string; time: string; emoji: string }[] = [];
    const seen = new Set<string>();

    if (routine) {
      const base = [
        { name: "Acordar", time: routine.wake_time, emoji: "☀️" },
        { name: "Começar a trabalhar", time: routine.work_start, emoji: "💼" },
        { name: "Almoçar", time: routine.lunch_time, emoji: "🍽️" },
        { name: "Parar de vender", time: routine.work_end, emoji: "🏁" },
        { name: "Dormir", time: routine.sleep_time, emoji: "🌙" },
      ];
      base.forEach((a) => {
        const k = `${a.name}-${a.time}`;
        if (!seen.has(k)) { seen.add(k); allItems.push(a); }
      });
    }

    if (activities) {
      activities.forEach((a: any) => {
        const k = `${a.name}-${a.start_time}`;
        if (!seen.has(k)) { seen.add(k); allItems.push({ name: a.name, time: a.start_time, emoji: a.emoji || "💪" }); }
      });
    }

    allItems.sort((a, b) => a.time.localeCompare(b.time));

    if (allItems.length > 0) {
      const rows = allItems.map((a) => ({
        user_id: userId,
        date: today,
        activity_name: a.name,
        activity_time: a.time,
        emoji: a.emoji,
        completed: false,
      }));

      const { data } = await supabase
        .from("daily_checklist")
        .upsert(rows, { onConflict: "user_id,date,activity_name,activity_time", ignoreDuplicates: true })
        .select();

      if (data) setItems(data);
    }
  };

  const loadStreak = async () => {
    // Count consecutive days with 100% completion
    let streak = 0;
    const d = new Date();
    d.setDate(d.getDate() - 1); // start from yesterday

    for (let i = 0; i < 60; i++) {
      const dateStr = d.toISOString().split("T")[0];
      const { data } = await supabase
        .from("daily_checklist")
        .select("completed")
        .eq("user_id", userId)
        .eq("date", dateStr);

      if (!data || data.length === 0) break;
      const allDone = data.every((it) => it.completed);
      if (!allDone) break;
      streak++;
      d.setDate(d.getDate() - 1);
    }
    setStreakDays(streak);
  };

  const toggleItem = async (id: string, current: boolean) => {
    const { error } = await supabase
      .from("daily_checklist")
      .update({ completed: !current })
      .eq("id", id);

    if (error) {
      toast({ title: "Erro", variant: "destructive" });
      return;
    }

    const updated = items.map((it) => it.id === id ? { ...it, completed: !current } : it);
    setItems(updated);

    if (!current) {
      toast({ title: "✅ Concluído!" });
    }

    // Check if all done
    const allDone = updated.every((it) => it.completed);
    if (allDone && !celebrated) {
      setCelebrated(true);
      // Award VP
      await supabase.rpc("has_role", { _user_id: userId, _role: "user" }).then(() => {
        // Just update VP
        supabase
          .from("profiles")
          .select("vision_points")
          .eq("user_id", userId)
          .single()
          .then(({ data: profile }) => {
            if (profile) {
              supabase
                .from("profiles")
                .update({ vision_points: (profile.vision_points || 0) + 15 })
                .eq("user_id", userId);
            }
          });
      });

      toast({
        title: "🎉 Rotina completa!",
        description: "Você está construindo disciplina de campeão. +15 VP!",
      });
    }
  };

  const completedCount = items.filter((it) => it.completed).length;
  const totalCount = items.length;
  const pct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const allDone = completedCount === totalCount && totalCount > 0;

  // Badge info
  const getBadge = () => {
    if (streakDays >= 30) return { label: "Visionário da Rotina", color: "bg-gradient-to-r from-primary to-secondary" };
    if (streakDays >= 7) return { label: "Disciplinado", color: "bg-secondary" };
    if (streakDays >= 3) return { label: "Consistente", color: "bg-success" };
    return null;
  };

  const badge = getBadge();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold gradient-text">Rotina de Hoje</h1>
          <p className="text-muted-foreground text-sm">
            {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={onOpenConfig} className="text-muted-foreground">
          <Settings className="w-4 h-4" />
        </Button>
      </div>

      {/* Progress */}
      <Card className="glass border-primary/20 shadow-[0_0_20px_hsl(var(--primary)/0.1)]">
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-muted-foreground">Progresso do dia</span>
            <Badge className="bg-gradient-to-r from-primary to-secondary text-primary-foreground">
              {completedCount}/{totalCount}
            </Badge>
          </div>
          <div className="h-3 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-primary via-secondary to-primary transition-all duration-700"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="flex items-center justify-between mt-2">
            <span className="text-2xl font-bold text-primary">{pct}%</span>
            <div className="flex items-center gap-2">
              {streakDays > 0 && (
                <div className="flex items-center gap-1 text-warning">
                  <Flame className="w-4 h-4" />
                  <span className="text-sm font-semibold">{streakDays} dias</span>
                </div>
              )}
              {badge && (
                <Badge variant="outline" className="text-xs border-primary/30">
                  <Trophy className="w-3 h-3 mr-1" />
                  {badge.label}
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* All done celebration */}
      {allDone && (
        <Card className="glass border-success/30 bg-success/5 shadow-[0_0_20px_hsl(var(--success)/0.2)] animate-fade-in">
          <CardContent className="p-5 text-center">
            <CheckCircle2 className="w-10 h-10 text-success mx-auto mb-2 animate-bounce" />
            <p className="font-bold text-success text-lg">Rotina completa!</p>
            <p className="text-muted-foreground text-sm">
              Você está construindo disciplina de campeão. 🏆
            </p>
          </CardContent>
        </Card>
      )}

      {/* Checklist items */}
      <div className="space-y-2">
        {items.map((item, idx) => (
          <Card
            key={item.id}
            className={`glass transition-all duration-300 ${
              item.completed
                ? "border-success/30 bg-success/5"
                : "border-border/30 hover:border-primary/30"
            }`}
            style={{ animationDelay: `${idx * 40}ms` }}
          >
            <CardContent className="p-4 flex items-center gap-3">
              <Checkbox
                checked={item.completed}
                onCheckedChange={() => toggleItem(item.id, item.completed)}
                className="h-6 w-6 border-2"
              />
              <span className={`text-2xl transition-transform ${item.completed ? "grayscale" : ""}`}>
                {item.emoji}
              </span>
              <div className="flex-1 min-w-0">
                <p className={`font-medium text-sm ${item.completed ? "line-through text-muted-foreground" : "text-foreground"}`}>
                  {item.activity_name}
                </p>
                {item.activity_time && (
                  <span className="text-xs text-muted-foreground">🕐 {item.activity_time}</span>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
