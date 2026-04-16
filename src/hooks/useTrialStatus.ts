import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { getBrazilDate } from "@/lib/dateUtils";

interface TrialStatus {
  isTrialActive: boolean;
  trialEnd: string | null;
  planStatus: string;
  daysRemaining: number;
  isExpired: boolean;
}

export function useTrialStatus(userId: string | undefined) {
  const [trialStatus, setTrialStatus] = useState<TrialStatus>({
    isTrialActive: false,
    trialEnd: null,
    planStatus: 'trial',
    daysRemaining: 0,
    isExpired: false,
  });
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    checkTrialStatus();
  }, [userId]);

  const checkTrialStatus = async () => {
    try {
      // Get current profile data
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('trial_end, is_trial_active, plan_status, is_demo, billing_exempt')
        .eq('user_id', userId)
        .single();

      if (error) throw error;

      // Contas demo têm acesso ilimitado
      if (profile.is_demo && profile.billing_exempt) {
        setTrialStatus({
          isTrialActive: true,
          trialEnd: null,
          planStatus: 'active',
          daysRemaining: 999,
          isExpired: false,
        });
        setLoading(false);
        return;
      }

      // Check if trial expired for non-demo users
      await supabase.rpc('check_trial_expired', { user_uuid: userId });

      // Compara datas no fuso de Brasília para evitar leituras erradas perto da meia-noite
      const todayBrazil = getBrazilDate();
      const trialEndDate = profile.trial_end
        ? new Date(profile.trial_end + "T23:59:59-03:00")
        : null;
      const daysRemaining = trialEndDate
        ? Math.ceil((trialEndDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
        : 0;

      const isExpired = profile.plan_status === 'expired';

      setTrialStatus({
        isTrialActive: profile.is_trial_active,
        trialEnd: profile.trial_end,
        planStatus: profile.plan_status,
        daysRemaining: Math.max(0, daysRemaining),
        isExpired,
      });

      // Show notification if trial is ending soon
      if (daysRemaining === 1 && profile.is_trial_active) {
        toast({
          title: "🔥 Falta 1 dia!",
          description: "Seu teste gratuito termina amanhã. Ative o plano Visionário para continuar!",
          duration: 8000,
        });
      } else if (daysRemaining === 0 && profile.is_trial_active) {
        toast({
          title: "🚀 Último dia!",
          description: "Seu teste gratuito termina hoje! Continue evoluindo com o Orbis.",
          duration: 8000,
        });
      }
    } catch (error) {
      console.error('Error checking trial status:', error);
    } finally {
      setLoading(false);
    }
  };

  return { trialStatus, loading, refreshTrialStatus: checkTrialStatus };
}
