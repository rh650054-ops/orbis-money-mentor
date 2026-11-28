import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { formatCurrency } from "@/shared/lib/utils";
import { quick, temQuick } from "../api/ponte";
import { esquecerConta, lerConfig } from "../lib/memoria";

/** VANT Quick's guard, for the whole app (iPhone only):
    - stamps the signed-in account in the App Group, so a widget tap is checked against it;
    - leaving or switching account: widget data wiped, Live Activity ended, quick memory forgotten;
    - a widget tap opens the DEFCON, where the tap is executed by the DEFCON's own code. */
export function VigiaQuick() {
  const { user, loading } = useAuth();
  const conta = user?.id ?? null;
  const anterior = useRef<string | null | undefined>(undefined);
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const rota = useRef(pathname);
  rota.current = pathname;

  useEffect(() => {
    if (!temQuick() || loading) return;
    const antes = anterior.current;
    anterior.current = conta;
    void (async () => {
      if (antes && antes !== conta) { await quick.limpar(); esquecerConta(antes); }
      await quick.definirConta(conta);
      const c = conta ? lerConfig(conta) : null;
      await quick.salvarConfig(c?.valor ?? null, c ? formatCurrency(c.valor) : null);
    })();
  }, [conta, loading]);

  useEffect(() => {
    if (!temQuick()) return;
    const ouvinte = quick.aoTocarNoWidget(() => { if (rota.current !== "/defcon") navigate("/defcon"); });
    return () => { void ouvinte.then((h) => h?.remove()); };
  }, [navigate]);

  return null;
}
