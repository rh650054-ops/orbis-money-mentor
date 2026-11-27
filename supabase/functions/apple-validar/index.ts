// Vant — apple-validar. Called by the iPhone app right after a purchase (and by "Restaurar compras")
// with the transaction(s) StoreKit 2 handed it, each one a JWS signed by Apple.
// 27/11/2026 (Rick): "Nunca libere um plano pago apenas com base em informações fornecidas pelo
// aplicativo cliente. Toda liberação deverá ser validada no servidor."
//
// What the app sends is treated as a CLAIM. For each transaction this function:
//   1. verifies Apple's signature and that it is of THIS app (verificador.ts). Nothing the app adds
//      around the JWS is read: the product, the dates, the price and the account all come from inside it;
//   2. checks the owner: the account Apple signed (appAccountToken) must be the logged-in account.
//      The database then refuses a purchase that already belongs to another VANT account;
//   3. asks Apple's own API for the current status of that subscription, when the key is configured,
//      and writes what Apple answers (also signed and verified). If Apple cannot be reached, the
//      verified copy from the device is used and the subscription is marked "not confirmed" for
//      apple-conciliar. A refunded transaction is refused either way (the database knows it);
//   4. writes through public.apple_assinatura_gravar: the right comes from the product id, in the
//      database. A Sandbox purchase gives access only to a registered test account.
// Never logs a JWS, a token or a payload.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { ClienteApple } from "../_shared/apple/api-apple.ts";
import { aplicarEstado, chamar, type Banco } from "../_shared/apple/aplicar.ts";
import { donoPeloToken, ehAmbiente, linhaDeLog, type Renovacao, type Transacao } from "../_shared/apple/regras.ts";
import { bancoDoServidor, clienteAppleDoServidor, cors, json, verificadorDoServidor } from "../_shared/apple/servidor.ts";
import { AssinaturaInvalida, type Verificador } from "../_shared/apple/verificador.ts";

const MAXIMO = 20;

export interface Deps {
  /** The logged-in account, from the Authorization header. null = no valid session. */
  quemE: (authorization: string) => Promise<string | null>;
  verificar: Verificador;
  apple: ClienteApple | null;
  db: Banco;
}

async function quemENoServidor(authorization: string): Promise<string | null> {
  if (!authorization) return null;
  const c = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_ANON_KEY") ?? "", { global: { headers: { Authorization: authorization } } });
  const { data: { user } } = await c.auth.getUser();
  return user?.id ?? null;
}

let doServidor: Deps | null = null;
const depsDoServidor = (): Deps =>
  (doServidor ??= { quemE: quemENoServidor, verificar: verificadorDoServidor(), apple: clienteAppleDoServidor(), db: bancoDoServidor() });

export interface Item { produto: string | null; resultado: string; confirmada_na_apple: boolean }

async function validarUma(jws: string, userId: string, deps: Deps): Promise<Item> {
  let t: Transacao;
  try {
    t = await deps.verificar.transacao(jws);
  } catch (e) {
    const retry = e instanceof AssinaturaInvalida && e.tentarDeNovo;
    console.warn("apple-validar: signature refused", linhaDeLog({ resultado: e instanceof AssinaturaInvalida ? e.motivo : "FALHA", user: userId }));
    return { produto: null, resultado: retry ? "tente_de_novo" : "assinatura_invalida", confirmada_na_apple: false };
  }
  const produto = t.productId ?? null;
  const dono = donoPeloToken(t);
  if (dono && dono !== userId.toLowerCase()) {
    console.warn("apple-validar: purchase of another account", linhaDeLog({ original: t.originalTransactionId, ambiente: t.environment, resultado: "pertence_a_outra_conta", user: userId }));
    return { produto, resultado: "pertence_a_outra_conta", confirmada_na_apple: false };
  }

  // the freshest signed status, straight from Apple, when we can ask
  let fonteT = t, fonteR: Renovacao | null = null, conferida = false;
  if (deps.apple && t.originalTransactionId && ehAmbiente(t.environment)) {
    try {
      const lista = await deps.apple.status(t.originalTransactionId, t.environment);
      const meu = lista?.find((x) => x.original === t.originalTransactionId);
      if (meu) {
        const tApple = await deps.verificar.transacao(meu.transacao);
        const rApple = meu.renovacao ? await deps.verificar.renovacao(meu.renovacao) : null;
        const donoApple = donoPeloToken(tApple);
        if (tApple.originalTransactionId !== t.originalTransactionId) throw new Error("outra_assinatura");
        if (donoApple && donoApple !== userId.toLowerCase()) return { produto, resultado: "pertence_a_outra_conta", confirmada_na_apple: true };
        fonteT = tApple; fonteR = rApple; conferida = true;
      }
    } catch (e) {
      // Apple did not answer (or answered something we could not verify): go on with the verified
      // copy from the device; apple-conciliar confirms it later
      console.warn("apple-validar: could not confirm with Apple", linhaDeLog({ original: t.originalTransactionId, ambiente: t.environment, resultado: e instanceof Error ? e.name : "erro", user: userId }));
    }
  }

  const r = await aplicarEstado(deps.db, userId, fonteT, fonteR, fonteT.signedDate, conferida);
  console.log("apple-validar:", linhaDeLog({ original: fonteT.originalTransactionId, transacao: fonteT.transactionId, ambiente: fonteT.environment, resultado: r.resultado, user: userId }));
  return { produto: fonteT.productId ?? produto, resultado: r.resultado, confirmada_na_apple: conferida };
}

export async function tratarValidar(req: Request, deps: Deps = depsDoServidor()): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "metodo" }, 405);
  try {
    const userId = await deps.quemE(req.headers.get("Authorization") ?? "");
    if (!userId) return json({ error: "nao_autorizado" }, 401);

    const corpo = (await req.json().catch(() => null)) as { transacoes?: unknown; jws?: unknown } | null;
    const bruto = Array.isArray(corpo?.transacoes) ? corpo.transacoes : typeof corpo?.jws === "string" ? [corpo.jws] : null;
    if (!bruto || bruto.length === 0) return json({ error: "sem_transacao" }, 400);
    if (bruto.length > MAXIMO || bruto.some((j) => typeof j !== "string")) return json({ error: "corpo_invalido" }, 400);
    const transacoes = [...new Set(bruto as string[])];

    const resultados: Item[] = [];
    for (const jws of transacoes) resultados.push(await validarUma(jws, userId, deps));

    // what the account has NOW, read from the server (never computed by the app)
    const direitos = (await chamar<{ direito: string; origem: string }[] | null>(deps.db, "vant_direitos", { p_user: userId })) ?? [];
    const acesso = {
      suspensa: direitos.some((d) => d.direito === "suspensao"),
      plano: direitos.some((d) => d.direito === "plano"),
      pro: direitos.some((d) => d.direito === "pro"),
      bancos_adicionais: direitos.filter((d) => d.direito === "banco").length,
    };
    // every transaction needs another try: tell the app not to close the purchase yet
    const todasPendentes = resultados.every((x) => x.resultado === "tente_de_novo");
    return json({ ok: !todasPendentes, resultados, acesso }, todasPendentes ? 503 : 200);
  } catch (e) {
    console.error("apple-validar: failed", e instanceof Error ? e.name : "erro");
    return json({ error: "falhou" }, 500);
  }
}

if (typeof Deno !== "undefined" && typeof Deno.serve === "function") Deno.serve((req) => tratarValidar(req));
