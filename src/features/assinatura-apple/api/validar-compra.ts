import { supabase } from "@/shared/api";
import type { RespostaDoServidor } from "../lib/fluxo-compra";

/** apple-validar (edge function): the signed transactions go in, the server verifies Apple's
    signature, the owner and the current status, and stores the right. Never throws: every way it
    can fail becomes a kind the purchase flow knows how to recover from. */
export async function validarNoServidor(jws: string[]): Promise<RespostaDoServidor> {
  try {
    const { data, error } = await supabase.functions.invoke("apple-validar", { body: { transacoes: jws } });
    if (error) {
      const status = (error as { context?: { status?: unknown } }).context?.status;
      if (status === 401) return { tipo: "sessao" };
      // an HTTP answer that is not 2xx (503 = try again, 5xx): the server is there but could not do it now
      if (typeof status === "number") return { tipo: "servidor" };
      return { tipo: "sem_internet" };
    }
    const resultados = (data as { resultados?: unknown } | null)?.resultados;
    if (!Array.isArray(resultados)) return { tipo: "servidor" };
    return { tipo: "ok", resultados: resultados as { resultado: string }[] };
  } catch {
    return { tipo: "sem_internet" };
  }
}
