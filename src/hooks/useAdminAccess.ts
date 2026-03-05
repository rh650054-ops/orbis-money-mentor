import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface AdminAccess {
  whitelisted: boolean;
  role: "admin" | "demo" | null;
  loading: boolean;
}

export function useAdminAccess(userId: string | undefined): AdminAccess {
  const [state, setState] = useState<AdminAccess>({
    whitelisted: false,
    role: null,
    loading: true,
  });

  useEffect(() => {
    if (!userId) {
      setState({ whitelisted: false, role: null, loading: false });
      return;
    }

    const check = async () => {
      try {
        const { data, error } = await supabase.functions.invoke("check-admin-access");
        if (error) {
          console.error("Admin access check error:", error);
          setState({ whitelisted: false, role: null, loading: false });
          return;
        }
        setState({
          whitelisted: data?.whitelisted ?? false,
          role: data?.role ?? null,
          loading: false,
        });
      } catch {
        setState({ whitelisted: false, role: null, loading: false });
      }
    };

    check();
  }, [userId]);

  return state;
}
