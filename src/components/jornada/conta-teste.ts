/* Conta de teste da equipe (Rick, 12/10/2026): toda vez que entra, volta pro zero —
   onboarding, Dia 0, produtos, Foco, metas. Quem decide se a conta é de teste é o
   banco (tabela contas_teste); pra qualquer outra conta isso não faz nada. */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { avisar } from "@/shared/lib/avisar";

const rpc = (fn: string) =>
  (supabase as unknown as { rpc: (f: string) => PromiseLike<{ data: unknown; error: unknown }> }).rpc(fn);

/** Apaga tudo que fica no aparelho pra essa conta (jornada, ofertas, simulação, avisos). */
function limparAparelho(uid: string) {
  try {
    const chaves: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && (k.includes(uid) || k === "vant_simular_teste")) chaves.push(k);
    }
    chaves.forEach((k) => localStorage.removeItem(k));
    sessionStorage.removeItem("trialModalDismissed");
  } catch { /* sem storage: nada pra limpar */ }
}

/** Se a conta logada é de teste, zera tudo e devolve true (quem chamou manda pro onboarding). */
export async function zerarSeContaTeste(uid: string): Promise<boolean> {
  try {
    const { data, error } = await rpc("conta_teste_zerar");
    if (error) throw error;
    if (data !== true) return false;
    limparAparelho(uid);
    try { sessionStorage.setItem("orbis_signup_novo", "1"); } catch { /* ok */ }
    return true;
  } catch (e) {
    avisar.silencioso("conta de teste: zerar", e);
    return false;
  }
}

/** A conta logada é de teste? (mostra o seletor de dias) */
export function useContaTeste(uid: string | null | undefined): boolean {
  const [teste, setTeste] = useState(false);
  useEffect(() => {
    if (!uid) { setTeste(false); return; }
    let vivo = true;
    rpc("sou_conta_teste").then(({ data }) => { if (vivo) setTeste(data === true); }, () => { /* fica false */ });
    return () => { vivo = false; };
  }, [uid]);
  return teste;
}
