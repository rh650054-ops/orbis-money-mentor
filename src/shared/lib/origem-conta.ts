import { supabase } from "@/integrations/supabase/client";
import { avisar } from "@/shared/lib/avisar";
import { getReferralCode, setReferralCode } from "@/shared/lib/checkout";

type RpcOrigem = (fn: "parc_fixar_minha_origem", args: { p_code: string | null }) => Promise<{ data: unknown; error: unknown }>;

/** Origem na CONTA, não só no aparelho (06/10/2026). Depois do login: manda o código
 *  guardado; o servidor grava na conta se ela ainda não tem dono (conta nova, parceiro
 *  ativo) e devolve o dono da conta. Esse código passa a ser o do checkout — então a
 *  pessoa que clicou no Instagram e assina pelo PC ainda leva o sck do influenciador. */
export async function syncReferralWithAccount(): Promise<void> {
  try {
    const rpc = (supabase as unknown as { rpc: RpcOrigem }).rpc;
    const { data, error } = await rpc.call(supabase, "parc_fixar_minha_origem", { p_code: getReferralCode() });
    if (error) return;
    const code = typeof data === "string" ? data.trim().toUpperCase() : "";
    if (code) setReferralCode(code);
  } catch (e) {
    avisar.silencioso("checkout: origem da conta", e);
  }
}
