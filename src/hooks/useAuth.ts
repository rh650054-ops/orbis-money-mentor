import { useState, useEffect } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    // Limpa o estado local do usuário antes de sair — senão a PRÓXIMA conta no
    // mesmo navegador "herda" flags (onboarding, tours, lembretes, cache) da
    // conta anterior. (As chaves já são por usuário, mas isso garante a limpeza.)
    try {
      Object.keys(localStorage).forEach((k) => {
        if (k.startsWith("orbis_") || k.startsWith("last")) localStorage.removeItem(k);
      });
    } catch {
      /* ignore */
    }
    await supabase.auth.signOut();
  };

  return { user, session, loading, signOut };
}
