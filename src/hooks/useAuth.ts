import { useSyncExternalStore } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

// ESTADO DE AUTH COMPARTILHADO (singleton de módulo).
// Antes, cada chamada de useAuth() criava seu PRÓPRIO useState + getSession() +
// onAuthStateChange — e o hook é usado em ~46 componentes. No boot isso disparava
// 46 consultas de sessão e cada componente resolvia a auth num frame diferente
// (o Layout já "logado" enquanto a página ainda estava "carregando"), causando
// piscadas e telas inconsistentes. Agora existe UMA assinatura e UM estado; todos
// os componentes leem o mesmo snapshot e mudam juntos, no mesmo render.

type AuthState = { user: User | null; session: Session | null; loading: boolean };

let state: AuthState = { user: null, session: null, loading: true };
const listeners = new Set<() => void>();

function setState(next: AuthState) {
  state = next;
  listeners.forEach((l) => l());
}

let started = false;
function ensureStarted() {
  if (started) return;
  started = true;
  supabase.auth.onAuthStateChange((_event, session) => {
    setState({ user: session?.user ?? null, session, loading: false });
  });
  supabase.auth.getSession().then(({ data: { session } }) => {
    setState({ user: session?.user ?? null, session, loading: false });
  });
}

function subscribe(listener: () => void) {
  ensureStarted();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): AuthState {
  return state;
}

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

export function useAuth() {
  const snap = useSyncExternalStore(subscribe, getSnapshot);
  return { user: snap.user, session: snap.session, loading: snap.loading, signOut };
}
