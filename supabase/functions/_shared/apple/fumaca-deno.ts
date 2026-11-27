/* SMOKE UNDER DENO (the runtime of the Supabase Edge Functions). The unit tests run in Node; this
   script loads the SAME modules with Deno and Apple's library through the npm: specifier, to prove
   they load and verify there: the three handlers with the real signature check against the fictional
   authority, Apple's real root, and the official API client building its signed request.
   Not part of CI (CI has no Deno). Run it before a deploy:
     deno run --allow-all --config supabase/functions/_shared/apple/fumaca-deno.json supabase/functions/_shared/apple/fumaca-deno.ts
   Checked on 27/11/2026 with Deno 2.9.6: 7 ok. It uses no credential and touches no database. */
import { Buffer } from "node:buffer";
(globalThis as unknown as { Buffer: unknown }).Buffer = Buffer;
// the modules call Deno.serve when loaded (as on the server): here it must not open a port
Object.defineProperty(Deno, "serve", { value: () => ({}), configurable: true });
const F = new URL("../..", import.meta.url).href.replace(/\/$/, "");
const { criarCadeia, transacao, renovacao, notificacao, bancoFalso, adulterar, CONTA_A } = await import(`${F}/_shared/apple/cadeia-de-teste.ts`);
const { criarVerificador } = await import(`${F}/_shared/apple/verificador.ts`);
const { RAIZES_APPLE } = await import(`${F}/_shared/apple/raizes.ts`);
const { criarClienteApple } = await import(`${F}/_shared/apple/api-apple.ts`);
const { tratarWebhook } = await import(`${F}/apple-webhook/index.ts`);
const { tratarValidar } = await import(`${F}/apple-validar/index.ts`);
const { tratarConciliar } = await import(`${F}/apple-conciliar/index.ts`);
const c = criarCadeia();
const verificar = criarVerificador({ raizes: [c.raiz], bundleId: "app.vant.vendas", appAppleId: 6838336105, online: false });
const ok = (nome: string, cond: boolean) => { console.log(cond ? "ok    " : "FALHOU", nome); if (!cond) Deno.exitCode = 1; };

let db = bancoFalso();
let r = await tratarWebhook(new Request("https://x.test/w", { method: "POST", body: JSON.stringify({ signedPayload: c.assinar(notificacao(c, "DID_RENEW", transacao(), renovacao())) }) }), { verificar, db });
ok("webhook: real notification -> 200, 4 database calls", r.status === 200 && db.chamadas.length === 4);
db = bancoFalso();
r = await tratarWebhook(new Request("https://x.test/w", { method: "POST", body: JSON.stringify({ signedPayload: c.forjar(notificacao(c, "DID_RENEW", transacao(), null)) }) }), { verificar, db });
ok("webhook: forged -> 401, nothing written", r.status === 401 && db.chamadas.length === 0);
db = bancoFalso();
r = await tratarValidar(new Request("https://x.test/v", { method: "POST", headers: { Authorization: "Bearer x" }, body: JSON.stringify({ jws: c.assinar(transacao()) }) }), { quemE: () => Promise.resolve(CONTA_A), verificar, apple: null, db });
ok("validar: real transaction -> 200 gravada", r.status === 200 && (await r.json()).resultados[0].resultado === "gravada");
db = bancoFalso();
r = await tratarValidar(new Request("https://x.test/v", { method: "POST", headers: { Authorization: "Bearer x" }, body: JSON.stringify({ jws: adulterar(c.assinar(transacao()), (p: Record<string, unknown>) => { p.productId = "app.vant.vendas.pro.anual"; }) }) }), { quemE: () => Promise.resolve(CONTA_A), verificar, apple: null, db });
ok("validar: edited -> assinatura_invalida, nothing written", (await r.json()).resultados[0].resultado === "assinatura_invalida" && db.de("apple_assinatura_gravar").length === 0);
db = bancoFalso();
r = await tratarConciliar(new Request("https://x.test/c", { method: "POST", headers: { "x-orbis-cron": "t" }, body: "{}" }), { tokenCron: () => Promise.resolve("t"), verificar, apple: null, db });
ok("conciliar: no key -> local repair only", r.status === 200 && (await r.json()).motivo === "sem_credenciais");
// the server's own verifier: Apple's real root loads under Deno and refuses the fictional chain
const real = criarVerificador({ raizes: RAIZES_APPLE, bundleId: "app.vant.vendas", appAppleId: 6838336105, online: false });
ok("Apple's root loads; a fictional chain is refused by it", await real.transacao(c.assinar(transacao())).then(() => false, (e: Error) => e.name === "AssinaturaInvalida"));
// the official API client builds and signs its request under Deno (the call itself is refused by the sandbox network)
const { generateKeyPairSync } = await import("node:crypto");
const chave = generateKeyPairSync("ec", { namedCurve: "P-256" }).privateKey.export({ type: "pkcs8", format: "pem" }).toString();
const cli = criarClienteApple({ chave, keyId: "K", issuerId: "I", bundleId: "app.vant.vendas" });
const e = await cli.status("2000000000000100", "Sandbox").then(() => null, (x: Error) => x);
ok(`API client under Deno: request attempted, failure typed (${e?.name}: ${e?.message})`, e?.name === "FalhaNaApple");
