import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface SubscriptionStatus {
  subscribed: boolean;
  status: string | null;
  graceUntil: string | null;
  subscription_id: string | null;
}

export function useSubscription(userId: string | undefined) {
  const [status, setStatus] = useState<SubscriptionStatus>({
    subscribed: false,
    status: null,
    graceUntil: null,
    subscription_id: null,
  });
  const [loading, setLoading] = useState(true);

  const checkSubscription = async () => {
    if (!userId) {
      setLoading(false);
      return;
    }

    try {
      // First, trigger admin access check (server-side whitelist)
      // This updates profile flags if user is whitelisted
      try {
        await supabase.functions.invoke("check-admin-access");
      } catch (e) {
        console.warn("Admin access check failed, continuing with normal flow:", e);
      }

      // Now read profile (after admin check may have updated it)
      const { data: profile } = await supabase
        .from("profiles")
        .select("plan_status, is_demo, billing_exempt, is_trial_active, trial_end, subscription_id")
        .eq("user_id", userId)
        .single();

      if (!profile) {
        setLoading(false);
        return;
      }

      // Demo/admin accounts always have access
      if (profile.is_demo && profile.billing_exempt) {
        setStatus({ subscribed: true, status: "demo", graceUntil: null, subscription_id: null });
        setLoading(false);
        return;
      }

      // Check trial
      if (profile.is_trial_active && profile.trial_end) {
        const trialEnd = new Date(profile.trial_end + "T23:59:59-03:00");
        if (new Date() <= trialEnd) {
          setStatus({ subscribed: true, status: "trial", graceUntil: profile.trial_end, subscription_id: null });
          setLoading(false);
          return;
        }
        await supabase
          .from("profiles")
          .update({ is_trial_active: false, plan_status: "expired" })
          .eq("user_id", userId);
      }

      // Check subscriptions table
      const { data: sub } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

      if (sub) {
        const now = new Date();
        const graceUntil = sub.grace_until ? new Date(sub.grace_until) : null;
        const isActive = sub.status === "active" && graceUntil && now <= graceUntil;
        const isPastDueInGrace = sub.status === "past_due" && graceUntil && now <= graceUntil;

        setStatus({
          subscribed: isActive || isPastDueInGrace || false,
          status: sub.status,
          graceUntil: sub.grace_until,
          subscription_id: sub.hotmart_subscription_id || null,
        });
        setLoading(false);
        return;
      }

      // Check if profile has active status (from admin manual activation)
      if (profile.plan_status === "active") {
        setStatus({ subscribed: true, status: "active", graceUntil: null, subscription_id: profile.subscription_id });
        setLoading(false);
        return;
      }

      // No subscription found
      setStatus({ subscribed: false, status: "inactive", graceUntil: null, subscription_id: null });
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
