import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

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

  const checkSubscription = async () => {
    if (!userId) {
      setLoading(false);
      return;
    }

    try {
      const { data: profile, error } = await supabase
        .from("profiles")
        .select("plan_status, is_demo, billing_exempt, subscription_id")
        .eq("user_id", userId)
        .single();

      if (error) throw error;

      // Demo accounts or active plans count as subscribed
      const isSubscribed =
        (profile.is_demo && profile.billing_exempt) ||
        profile.plan_status === "active";

      setStatus({
        subscribed: isSubscribed,
        subscription_end: null,
        subscription_id: profile.subscription_id || null,
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
