import { useEffect, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { formatCurrency } from "@/shared/lib/utils";
import { quick, temQuick } from "../api/ponte";
import { revogarComToken } from "../api/credencial";
import { useCredencialQuick } from "../hooks/use-credencial-quick";
import { esquecerConta, idDoAparelho, lerConfig } from "../lib/memoria";

/** VANT Quick's guard, for the whole app (iPhone only):
    - stamps the signed-in account in the App Group (the widgets show only its numbers);
    - keeps the device credential as the server allows (useCredencialQuick);
    - leaving or switching account: the credential is revoked on the server and wiped from the
      Keychain, the widgets' data is wiped, the Live Activity ends, the quick memory is forgotten. */
export function VigiaQuick() {
  const { user, session, loading } = useAuth();
  const conta = user?.id ?? null;
  const anterior = useRef<string | null | undefined>(undefined);
  // the access token of the account that is signed in now: after sign-out it is the only way left
  // to tell the server to revoke that account's device credential
  const acesso = useRef<string | null>(null);
  useCredencialQuick(temQuick() ? conta : null);

  useEffect(() => {
    if (!temQuick() || loading) return;
    const antes = anterior.current, tokenAntes = acesso.current;
    anterior.current = conta;
    acesso.current = session?.access_token ?? null;
    void (async () => {
      if (antes && antes !== conta) {
        await quick.limpar();                         // App Group + Keychain + Live Activity, natively
        esquecerConta(antes);
        if (tokenAntes) await revogarComToken(tokenAntes, idDoAparelho());
      }
      await quick.definirConta(conta);
      const c = conta ? lerConfig(conta) : null;
      await quick.salvarConfig(c?.valor ?? null, c ? formatCurrency(c.valor) : null);
    })();
  }, [conta, loading, session?.access_token]);

  return null;
}
