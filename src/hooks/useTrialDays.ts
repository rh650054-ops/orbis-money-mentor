import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface TrialDaysStatus {
  daysRemaining: number;
  isExpired: boolean;
  trialStartedAt: string | null;
}

export function useTrialDays(userId: string | undefined) {
  const [status, setStatus] = useState<TrialDaysStatus>({
    daysRemaining: 3,
    isExpired: false,
    trialStartedAt: null,
  });
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const checkTrialDays = async () => {
    if (!userId) {
      setLoading(false);
      return;
    }

    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("trial_days_remaining, trial_started_at, is_demo, billing_exempt")
        .eq("user_id", userId)
        .single();

      // Contas demo têm acesso ilimitado
      if (profile?.is_demo && profile?.billing_exempt) {
        setStatus({
          daysRemaining: 999,
          isExpired: false,
          trialStartedAt: null,
        });
        setLoading(false);
        return;
      }

      const daysRemaining = profile?.trial_days_remaining ?? 3;
      const isExpired = daysRemaining <= 0;

      setStatus({
        daysRemaining,
        isExpired,
        trialStartedAt: profile?.trial_started_at || null,
      });

      // Mostrar aviso quando restam poucos dias
      if (daysRemaining === 1 && !isExpired) {
        const lastWarning = localStorage.getItem('lastTrialWarning');
        const today = new Date().toISOString().split('T')[0];
        
        if (lastWarning !== today) {
          toast({
            title: "⚠️ Último dia de teste!",
            description: "Seu teste acaba amanhã. Assine agora para não perder acesso!",
            duration: 8000,
          });
          localStorage.setItem('lastTrialWarning', today);
        }
      }
    } catch (error) {
      console.error("Error checking trial days:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkTrialDays();
  }, [userId]);

  return { status, loading, refreshTrialDays: checkTrialDays };
}
