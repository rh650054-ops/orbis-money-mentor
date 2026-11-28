import { useQuery } from "@tanstack/react-query";
import { createQueryKeys, supabase } from "@/shared/api";

export const quickKeys = createQueryKeys("vant-quick");
const URL_PROJETO = (import.meta.env?.VITE_SUPABASE_URL as string | undefined) ?? "";
const CHAVE_PUBLICA = (import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) ?? "";
type Rpc = (n: string, a?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
// resolved at call time (tests replace the client)
const rpc: Rpc = (n, a) => (supabase.rpc as unknown as Rpc).call(supabase, n, a);

export const urlDoProjeto = () => URL_PROJETO;

/** Whether the server lets this account register from the widget / Live Activity (both switches on). */
export function useQuickDisponivel(conta: string | null) {
  return useQuery({
    queryKey: quickKeys.byUser(conta ?? "-"),
    enabled: !!conta,
    queryFn: async (): Promise<boolean> => {
      const { data, error } = await rpc("vant_quick_disponivel");
      if (error) throw error;
      return !!(data as { interativo?: boolean } | null)?.interativo;
    },
  });
}

/** A new device credential: the token is handed to the Keychain by the caller and never stored here. */
export async function emitirCredencial(aparelho: string): Promise<{ token: string; expiraEm: number }> {
  const { data, error } = await rpc("vant_quick_emitir", { p_aparelho: aparelho });
  if (error) throw error;
  const d = data as { token?: string; expira_em?: string };
  if (!d?.token || !d.expira_em) throw new Error("credencial sem token");
  return { token: d.token, expiraEm: new Date(d.expira_em).getTime() };
}

/** Sign-out / account switch: revoke this device's credential with the access token the session
    still had (the session itself is already gone). Best effort: the Keychain copy is wiped anyway. */
export async function revogarComToken(tokenDeAcesso: string, aparelho: string): Promise<void> {
  if (!URL_PROJETO || !tokenDeAcesso) return;
  try {
    await fetch(`${URL_PROJETO}/rest/v1/rpc/vant_quick_revogar`, {
      method: "POST",
      headers: { apikey: CHAVE_PUBLICA, Authorization: `Bearer ${tokenDeAcesso}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_aparelho: aparelho }),
    });
  } catch { /* offline: it expires on its own; the token is no longer on the device */ }
}

/** The server's copy of the VANT Quick sale (the value a widget tap charges). */
export async function salvarConfigServidor(valor: number, metodo: string): Promise<void> {
  const { error } = await rpc("vant_quick_salvar_config", { p_valor: valor, p_metodo: metodo });
  if (error) throw error;
}
