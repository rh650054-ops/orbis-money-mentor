// Vant — apple-conciliar. The safety net behind the notifications: on a schedule it
//   1. runs public.apple_expirar_vencidas (an Apple plan whose period ended stops holding the
//      account; an account Apple is paying for that something blocked is turned on again);
//   2. asks Apple's own API about each subscription that still gives a right, or ended in the last
//      days, oldest check first (public.apple_conciliar_lista), verifies what Apple answers and
//      writes it through the same door as the notifications. A lost notification (a renewal, a
//      refund, an expiry) is repaired here.
// A failure to reach Apple changes NOTHING for that subscription: it is counted and tried again in
// the next round. Without the In-App Purchase key only step 1 runs, and the answer says so.
// Door: header x-orbis-cron (painel_tokens, nome = 'cron'), like the other scheduled functions.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { ClienteApple } from "../_shared/apple/api-apple.ts";
import { aplicarEstado, chamar, type Banco } from "../_shared/apple/aplicar.ts";
import { ehAmbiente, linhaDeLog } from "../_shared/apple/regras.ts";
import { bancoDoServidor, clienteAppleDoServidor, json, verificadorDoServidor } from "../_shared/apple/servidor.ts";
import type { Verificador } from "../_shared/apple/verificador.ts";

export interface Deps {
  /** The token the scheduler must present. null = none configured: nobody gets in. */
  tokenCron: () => Promise<string | null>;
  verificar: Verificador;
  apple: ClienteApple | null;
  db: Banco;
}

async function tokenCronDoServidor(): Promise<string | null> {
  const c = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
  const { data } = await c.from("painel_tokens").select("token").eq("nome", "cron").maybeSingle();
  return data?.token ? String(data.token) : null;
}
let doServidor: Deps | null = null;
const depsDoServidor = (): Deps =>
  (doServidor ??= { tokenCron: tokenCronDoServidor, verificar: verificadorDoServidor(), apple: clienteAppleDoServidor(), db: bancoDoServidor() });

/** Compare without leaking, through timing, how much of the token matched. */
function igual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

export async function tratarConciliar(req: Request, deps: Deps = depsDoServidor()): Promise<Response> {
  if (req.method !== "POST") return json({ error: "metodo" }, 405);
  try {
    const apresentado = req.headers.get("x-orbis-cron") ?? "";
    const esperado = await deps.tokenCron();
    if (!apresentado || !esperado || !igual(apresentado, esperado)) return json({ error: "nao_autorizado" }, 401);
    const corpo = (await req.json().catch(() => ({}))) as { limite?: unknown };
    const limite = Math.max(1, Math.min(Number(corpo.limite) || 50, 200));

    const resumo = { reparadas: 0, na_lista: 0, conferidas: 0, nao_encontradas: 0, falhas: 0, com_apple: !!deps.apple };
    resumo.reparadas = Number(await chamar(deps.db, "apple_expirar_vencidas")) || 0;
    if (!deps.apple) {
      console.log("apple-conciliar: no Apple key configured, only the local repair ran", JSON.stringify(resumo));
      return json({ ok: true, motivo: "sem_credenciais", ...resumo });
    }

    const lista = (await chamar<{ original_transaction_id: string; ambiente: string }[] | null>(deps.db, "apple_conciliar_lista", { p_limite: limite })) ?? [];
    resumo.na_lista = lista.length;
    for (const item of lista) {
      const original = item.original_transaction_id;
      try {
        if (!ehAmbiente(item.ambiente)) continue;
        const status = await deps.apple.status(original, item.ambiente);
        const meu = status?.find((x) => x.original === original);
        if (!meu) { resumo.nao_encontradas++; continue; }
        const t = await deps.verificar.transacao(meu.transacao);
        const r = meu.renovacao ? await deps.verificar.renovacao(meu.renovacao) : null;
        if (t.originalTransactionId !== original) throw new Error("outra_assinatura");
        // owner = whoever already owns it in the mirror (null): a reconciliation never moves it
        const assinado = Math.max(t.signedDate ?? 0, r?.signedDate ?? 0) || undefined;
        const feito = await aplicarEstado(deps.db, null, t, r, assinado, true);
        resumo.conferidas++;
        console.log("apple-conciliar:", linhaDeLog({ original, transacao: t.transactionId, ambiente: item.ambiente, resultado: feito.resultado }));
      } catch (e) {
        // nothing is changed for this subscription; the next round tries again
        resumo.falhas++;
        console.warn("apple-conciliar: could not check", linhaDeLog({ original, ambiente: item.ambiente, resultado: e instanceof Error ? e.name : "erro" }));
      }
    }
    // the statuses just written may have ended a right: decide the access once more
    if (resumo.conferidas > 0) resumo.reparadas += Number(await chamar(deps.db, "apple_expirar_vencidas")) || 0;
    console.log("apple-conciliar: round", JSON.stringify(resumo));
    return json({ ok: true, ...resumo });
  } catch (e) {
    console.error("apple-conciliar: failed", e instanceof Error ? e.name : "erro");
    return json({ error: "falhou" }, 500);
  }
}

if (typeof Deno !== "undefined" && typeof Deno.serve === "function") Deno.serve((req) => tratarConciliar(req));
