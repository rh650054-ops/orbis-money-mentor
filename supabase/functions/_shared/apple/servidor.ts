/* Apple subscriptions: what the three functions build from the environment when they run on the
   server (the tests inject their own). Secrets only from the Supabase panel, never logged. */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { credenciaisDe, criarClienteApple, type ClienteApple } from "./api-apple.ts";
import type { Banco } from "./aplicar.ts";
import { RAIZES_APPLE } from "./raizes.ts";
import { APP_APPLE_ID, BUNDLE_ID } from "./regras.ts";
import { criarVerificador, type Verificador } from "./verificador.ts";

const env = (k: string) => Deno.env.get(k);

export function bancoDoServidor(): Banco {
  const c = createClient(env("SUPABASE_URL") ?? "", env("SUPABASE_SERVICE_ROLE_KEY") ?? "");
  return { rpc: (nome, args) => c.rpc(nome, args) };
}

/** Always the real Apple root, the real bundle id and the real app id. APPLE_OCSP=1 also asks Apple's
    revocation service about each certificate (off until proven on the Edge runtime). */
export function verificadorDoServidor(): Verificador {
  return criarVerificador({ raizes: RAIZES_APPLE, bundleId: BUNDLE_ID, appAppleId: APP_APPLE_ID, online: env("APPLE_OCSP") === "1" });
}

/** null while the In-App Purchase key is not in the panel: the functions then work from the signed
    documents alone and say so. */
export function clienteAppleDoServidor(): ClienteApple | null {
  const c = credenciaisDe(env, BUNDLE_ID);
  return c ? criarClienteApple(c) : null;
}

export const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
export const json = (obj: unknown, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { ...cors, "Content-Type": "application/json" } });
