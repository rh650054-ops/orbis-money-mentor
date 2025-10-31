import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";

interface SubscriptionStatus {
  subscribed: boolean;
  subscription_end: string | null;
  subscription_id: string | null;
}

export function useSubscription(userId: string | undefined) {
  const [status, setStatus] = useState<SubscriptionStatus>({
    subscribed: false,
    subscription_end: null,
    subscription_id: null,
  });
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const checkSubscription = async () => {
    if (!userId) {
      setLoading(false);
      return;
    }

    try {
      const session = await supabase.auth.getSession();
      if (!session.data.session) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase.functions.invoke("check-subscription", {
        headers: {
          Authorization: `Bearer ${session.data.session.access_token}`,
        },
      });

      if (error) throw error;

      setStatus({
        subscribed: data.subscribed || false,
        subscription_end: data.subscription_end || null,
        subscription_id: data.subscription_id || null,
      });
    } catch (error) {
      console.error("Error checking subscription:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkSubscription();
  }, [userId]);

  return { status, loading, refreshSubscription: checkSubscription };
}
