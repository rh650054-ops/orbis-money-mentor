import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getBrazilDate } from "@/lib/dateUtils";

export const useDailyGoalPlan = (userId: string | undefined) => {
  const [hasPlanToday, setHasPlanToday] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentPlanId, setCurrentPlanId] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;

    const checkPlan = async () => {
      const today = getBrazilDate();

      const { data } = await supabase
        .from("daily_goal_plans")
        .select("id")
        .eq("user_id", userId)
        .eq("date", today)
        .single();

      setHasPlanToday(!!data);
      setCurrentPlanId(data?.id || null);
      setLoading(false);
    };

    checkPlan();
  }, [userId]);

  return { hasPlanToday, loading, currentPlanId };
};
