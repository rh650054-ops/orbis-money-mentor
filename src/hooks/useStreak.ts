import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export const useStreak = (userId: string | undefined) => {
  const [streak, setStreak] = useState(0);
  const { toast } = useToast();

  useEffect(() => {
    if (!userId) return;
    
    calculateStreak();

    // Realtime subscription
    const channel = supabase
      .channel('streak-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'daily_work_log',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          calculateStreak();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const calculateStreak = async () => {
    if (!userId) return;

    // Get work logs for the last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const { data: logs } = await supabase
      .from("daily_work_log")
      .select("*")
      .eq("user_id", userId)
      .gte("date", thirtyDaysAgo.toISOString().split('T')[0])
      .order("date", { ascending: false });

    if (!logs || logs.length === 0) {
      setStreak(0);
      await updateStreakInProfile(0);
      return;
    }

    let currentStreak = 0;
    const today = new Date().toISOString().split('T')[0];
    let checkDate = new Date();

    // Start from today and go backwards
    while (true) {
      const dateStr = checkDate.toISOString().split('T')[0];
      const log = logs.find(l => l.date === dateStr);

      // If no log for this date and it's not today, break
      if (!log && dateStr !== today) {
        break;
      }

      // If it's a worked day and goal was achieved, increment streak
      if (log?.status === 'worked' && log?.goal_achieved) {
        currentStreak++;
      }
      // If it's a planned off day, maintain streak (don't increment, don't break)
      else if (log?.status === 'planned_off') {
        // Continue checking previous days
      }
      // If it's a missed day or worked but didn't achieve goal, break
      else if (log?.status === 'missed' || (log?.status === 'worked' && !log?.goal_achieved)) {
        break;
      }
      // If there's no log and it's today, it doesn't break the streak yet
      else if (!log && dateStr === today) {
        // Continue to check yesterday
      } else {
        break;
      }

      // Move to previous day
      checkDate.setDate(checkDate.getDate() - 1);
      
      // Safety limit
      if (currentStreak > 365) break;
    }

    const oldStreak = streak;
    setStreak(currentStreak);
    await updateStreakInProfile(currentStreak);

    // Notify if streak changed
    if (currentStreak < oldStreak && oldStreak > 0) {
      toast({
        title: "⚠️ Ofensiva perdida!",
        description: `Sua sequência de ${oldStreak} dias foi interrompida.`,
        variant: "destructive",
      });
    } else if (currentStreak > oldStreak) {
      toast({
        title: "🔥 Ofensiva aumentou!",
        description: `Você está em ${currentStreak} dias consecutivos!`,
      });
    }
  };

  const updateStreakInProfile = async (newStreak: number) => {
    await supabase
      .from("profiles")
      .update({ streak_days: newStreak })
      .eq("user_id", userId);
  };

  return { streak, calculateStreak };
};