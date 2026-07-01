import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface UseMonthlyGoalRequiredResult {
  isRequired: boolean;
  isLoading: boolean;
  reason: "first_time" | "new_month" | null;
  onCompleted: () => void;
}

export function useMonthlyGoalRequired(userId: string | undefined): UseMonthlyGoalRequiredResult {
  const [isRequired, setIsRequired] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [reason, setReason] = useState<"first_time" | "new_month" | null>(null);

  useEffect(() => {
    if (!userId) {
      setIsLoading(false);
      return;
    }

    checkIfRequired();
  }, [userId]);

  const checkIfRequired = async () => {
    if (!userId) return;
    
    setIsLoading(true);
    
    try {
      // Get user profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("monthly_goal, week_start_date, goal_hours, weekly_work_days")
        .eq("user_id", userId)
        .maybeSingle();

      // Check if it's the first time (no monthly goal set or zero)
      const hasMonthlyGoal = profile?.monthly_goal && profile.monthly_goal > 0;
      const hasWorkHours = profile?.goal_hours && profile.goal_hours > 0;
      const hasWorkDays = profile?.weekly_work_days && profile.weekly_work_days > 0;
      
      // A meta mensal é configurada UMA ÚNICA VEZ (primeira vez). Não força mais
      // a cada início de mês — o usuário só define de novo se quiser (pelo dashboard).
      if (!hasMonthlyGoal || !hasWorkHours || !hasWorkDays) {
        setIsRequired(true);
        setReason("first_time");
        setIsLoading(false);
        return;
      }

      setIsRequired(false);
      setReason(null);
    } catch (error) {
      console.error("Error checking monthly goal requirement:", error);
      setIsRequired(false);
      setReason(null);
    } finally {
      setIsLoading(false);
    }
  };

  const onCompleted = () => {
    setIsRequired(false);
    setReason(null);
  };

  return { isRequired, isLoading, reason, onCompleted };
}
