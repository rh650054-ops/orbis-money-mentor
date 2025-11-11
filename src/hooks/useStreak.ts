import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { getBrazilDate, formatBrazilDate } from "@/lib/dateUtils";

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

    // Get profile with working days configuration
    const { data: profile } = await supabase
      .from("profiles")
      .select("working_days, missed_days_this_week, week_start_date, freeze_used_this_week")
      .eq("user_id", userId)
      .single();

    if (!profile) return;

    const workingDays = profile.working_days || ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];

    // Get work logs for the last 90 days
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    
    const { data: logs } = await supabase
      .from("daily_work_log")
      .select("*")
      .eq("user_id", userId)
      .gte("date", formatBrazilDate(ninetyDaysAgo))
      .order("date", { ascending: false });

    if (!logs) {
      setStreak(0);
      await updateStreakInProfile(0);
      return;
    }

    // Check if we need to reset weekly counters
    const today = new Date();
    const weekStart = profile.week_start_date ? new Date(profile.week_start_date) : today;
    const daysSinceWeekStart = Math.floor((today.getTime() - weekStart.getTime()) / (1000 * 60 * 60 * 24));
    
    let missedThisWeek = profile.missed_days_this_week || 0;
    let freezeUsedThisWeek = profile.freeze_used_this_week || false;

    // Reset weekly counters if it's a new week (more than 7 days)
    if (daysSinceWeekStart >= 7) {
      missedThisWeek = 0;
      freezeUsedThisWeek = false;
      await supabase
        .from("profiles")
        .update({
          missed_days_this_week: 0,
          freeze_used_this_week: false,
          week_start_date: getBrazilDate(),
        })
        .eq("user_id", userId);
    }

    let currentStreak = 0;
    let checkDate = new Date();
    const todayStr = getBrazilDate();
    let consecutiveMissed = 0;
    let lastWasWorked = false;

    // Helper function to get day of week
    const getDayOfWeek = (date: Date) => {
      const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      return days[date.getDay()];
    };

    // Start from today and go backwards
    while (true) {
      const dateStr = formatBrazilDate(checkDate);
      const dayOfWeek = getDayOfWeek(checkDate);
      const log = logs.find(l => l.date === dateStr);

      // Skip if this day is not in working days
      if (!workingDays.includes(dayOfWeek)) {
        checkDate.setDate(checkDate.getDate() - 1);
        continue;
      }

      // Check if it's today and no log yet - doesn't break streak
      if (dateStr === todayStr && !log) {
        checkDate.setDate(checkDate.getDate() - 1);
        continue;
      }

      // If there's a log
      if (log) {
        if (log.status === 'worked' && log.goal_achieved) {
          // Worked and achieved goal - increment streak
          currentStreak++;
          lastWasWorked = true;
          consecutiveMissed = 0;
        } else if (log.status === 'worked' && !log.goal_achieved) {
          // Worked but didn't achieve goal - don't increment, but don't break
          // Show motivational message based on percentage
          lastWasWorked = false;
          // Don't break the streak, just don't increment
        } else if (log.status === 'planned_off') {
          // Planned off - maintain streak
          consecutiveMissed = 0;
        } else if (log.status === 'missed') {
          // Missed day - count it
          consecutiveMissed++;
          lastWasWorked = false;
          
          // Check freeze rules
          if (consecutiveMissed === 1 && !freezeUsedThisWeek) {
            // First missed day this week - freeze (don't break)
            freezeUsedThisWeek = true;
            missedThisWeek++;
          } else if (consecutiveMissed >= 2 || missedThisWeek >= 2) {
            // Two consecutive missed days OR two total missed days in the week - break streak
            break;
          } else {
            // Already used freeze this week, break
            break;
          }
        }
      } else {
        // No log for a working day (past day)
        consecutiveMissed++;
        lastWasWorked = false;
        
        // Apply same freeze logic
        if (consecutiveMissed === 1 && !freezeUsedThisWeek) {
          freezeUsedThisWeek = true;
          missedThisWeek++;
        } else if (consecutiveMissed >= 2 || missedThisWeek >= 2) {
          break;
        } else {
          break;
        }
      }

      // Move to previous day
      checkDate.setDate(checkDate.getDate() - 1);
      
      // Safety limit - streak can go on indefinitely, but limit iteration
      if (currentStreak > 1000) break;
    }

    const oldStreak = streak;
    setStreak(currentStreak);
    await updateStreakInProfile(currentStreak);

    // Update freeze tracking
    await supabase
      .from("profiles")
      .update({
        missed_days_this_week: missedThisWeek,
        freeze_used_this_week: freezeUsedThisWeek,
      })
      .eq("user_id", userId);

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
