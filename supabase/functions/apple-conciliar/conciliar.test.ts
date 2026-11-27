// @vitest-environment node
/* apple-conciliar: the door, the local repair, the round against Apple, and what a failure of
   communication may (nothing) and may not change. */
import { beforeAll, describe, expect, it, vi } from "vitest";
import type { ClienteApple, StatusApple } from "../_shared/apple/api-apple";
import { bancoFalso, criarCadeia, renovacao, transacao } from "../_shared/apple/cadeia-de-teste";
import { conferirChamada, contratoSql } from "../_shared/apple/contrato-sql";
import { APP_APPLE_ID, BUNDLE_ID } from "../_shared/apple/regras";
import { criarVerificador, type Verificador } from "../_shared/apple/verificador";

type Deps = { tokenCron: () => Promise<string | null>; verificar: Verificador; apple: ClienteApple | null; db: ReturnType<typeof bancoFalso> };
let tratarConciliar: (req: Request, deps: Deps) => Promise<Response>;
const cadeia = criarCadeia();
const verificar = criarVerificador({ raizes: [cadeia.raiz], bundleId: BUNDLE_ID, appAppleId: APP_APPLE_ID, online: false });
const contrato = contratoSql();
const TOKEN = "token-ficticio-do-agendador";
const logs: string[] = [];

beforeAll(async () => {
  for (const m of ["log", "warn", "error"] as const) vi.spyOn(console, m).mockImplementation((...a: unknown[]) => { logs.push(a.map(String).join(" ")); });
  (globalThis as unknown as { Deno: unknown }).Deno = { env: { get: () => "x" } };
  ({ tratarConciliar } = (await import("./index")) as unknown as { tratarConciliar: typeof tratarConciliar });
});

const pedido = (token: string | null, corpo: unknown = {}, metodo = "POST") =>
  new Request("https://x.test/apple-conciliar", { method: metodo, headers: token === null ? {} : { "x-orbis-cron": token }, body: metodo === "POST" ? JSON.stringify(corpo) : undefined });
async function rodar(o: Partial<Deps> & { token?: string | null; corpo?: unknown } = {}) {
  const db = o.db ?? bancoFalso();
  const r = await tratarConciliar(pedido(o.token === undefined ? TOKEN : o.token, o.corpo), { tokenCron: o.tokenCron ?? (() => Promise.resolve(TOKEN)), verificar: o.verificar ?? verificar, apple: o.apple === undefined ? null : o.apple, db });
  return { r, corpo: (await r.json()) as Record<string, unknown>, db };
}
const apple = (f: (id: string, amb: string) => StatusApple[] | null): ClienteApple & { pedidos: [string, string][] } => {
  const pedidos: [string, string][] = [];
  return { pedidos, status: (id, amb) => { pedidos.push([id, amb]); return Promise.resolve().then(() => f(id, amb)); } };
};
const linha = (original: string, ambiente = "Sandbox") => ({ original_transaction_id: original, ambiente, user_id: "11111111-1111-4111-8111-111111111111" });
const status = (original: string, extraT: Record<string, unknown> = {}, extraR: Record<string, unknown> | null = {}): StatusApple => ({
  original, status: 1, transacao: cadeia.assinar(transacao({ originalTransactionId: original, transactionId: `${original}9`, ...extraT })),
  renovacao: extraR ? cadeia.assinar(renovacao({ originalTransactionId: original, ...extraR })) : null,
});

describe("the door", () => {
  it("without the scheduler's token, with a wrong one, or with none configured: 401 and nothing runs", async () => {
    for (const o of [{ token: null }, { token: "" }, { token: "errado" }, { token: TOKEN.slice(0, -1) }, { token: TOKEN, tokenCron: () => Promise.resolve(null) }, { token: "null", tokenCron: () => Promise.resolve(null) }]) {
      const { r, db } = await rodar(o);
      expect(r.status).toBe(401);
      expect(db.chamadas).toEqual([]);
    }
    const db = bancoFalso();
    expect((await tratarConciliar(pedido(TOKEN, null, "GET"), { tokenCron: () => Promise.resolve(TOKEN), verificar, apple: null, db })).status).toBe(405);
  });
});

describe("without the Apple key", () => {
  it("only the local repair runs, and the answer says why", async () => {
    const { r, corpo, db } = await rodar({ db: bancoFalso({ apple_expirar_vencidas: 3 }) });
    expect(r.status).toBe(200);
    expect(corpo).toMatchObject({ ok: true, motivo: "sem_credenciais", reparadas: 3, conferidas: 0, com_apple: false });
    expect(db.chamadas.map((c) => c.funcao)).toEqual(["apple_expirar_vencidas"]);
  });
});

describe("a round against Apple", () => {
  it("each subscription of the list is asked to Apple in its own environment, verified, and written as CONFIRMED without moving its owner", async () => {
    const a = apple((id) => [status("2000000000000777"), status(id, { expiresDate: 1_950_000_000_000 }, { autoRenewStatus: 0 })]);
    const db = bancoFalso({ apple_conciliar_lista: [linha("2000000000000100"), linha("1000000000000200", "Production")] });
    const { corpo } = await rodar({ apple: { ...a, status: (id, amb) => a.status(id, amb).then((l) => l?.map((x) => amb === "Production" ? { ...x, transacao: cadeia.assinar(transacao({ originalTransactionId: x.original, environment: "Production", expiresDate: 1_950_000_000_000 })), renovacao: null } : x) ?? null) }, db, corpo: { limite: 10 } });
    expect(a.pedidos).toEqual([["2000000000000100", "Sandbox"], ["1000000000000200", "Production"]]);
    expect(corpo).toMatchObject({ ok: true, na_lista: 2, conferidas: 2, falhas: 0, nao_encontradas: 0, com_apple: true });
    expect(db.de("apple_conciliar_lista")[0]?.args).toEqual({ p_limite: 10 });
    const gravadas = db.de("apple_assinatura_gravar").map((c) => c.args);
    expect(gravadas.map((g) => [g.p_original, g.p_ambiente, g.p_user, g.p_conferida])).toEqual([["2000000000000100", "Sandbox", null, true], ["1000000000000200", "Production", null, true]]);
    expect(gravadas[0]).toMatchObject({ p_renova: false, p_expira: new Date(1_950_000_000_000).toISOString() });
    expect(db.chamadas.map((c) => conferirChamada(contrato, c.funcao, c.args)).filter(Boolean)).toEqual([]);
    // the access is decided once more after the statuses were written
    expect(db.de("apple_expirar_vencidas")).toHaveLength(2);
  });

  it("a renewal or a refund whose notification was lost is repaired from Apple's answer", async () => {
    const quando = Date.now() - 2000;
    const a = apple((id) => [status(id, id.endsWith("1") ? { revocationDate: quando } : { expiresDate: Date.now() + 60 * 86_400_000 })]);
    const { db } = await rodar({ apple: a, db: bancoFalso({ apple_conciliar_lista: [linha("2000000000000101"), linha("2000000000000102")] }) });
    const g = db.de("apple_assinatura_gravar").map((c) => c.args);
    expect(g[0]).toMatchObject({ p_original: "2000000000000101", p_revogada: new Date(quando).toISOString() });
    expect(g[1]?.p_revogada).toBeNull();
    expect(db.de("apple_transacao_registrar")[0]?.args.p_reembolsado).toBe(new Date(quando).toISOString());
  });

  it("FAILURE OF COMMUNICATION on one subscription changes NOTHING for it and does not stop the others", async () => {
    const outra = criarCadeia({ nome: "Impostora" });
    const a = apple((id) => {
      if (id === "2000000000000101") throw new Error("ETIMEDOUT");
      if (id === "2000000000000102") return [{ original: id, status: 1, transacao: outra.assinar(transacao({ originalTransactionId: id })), renovacao: null }];
      if (id === "2000000000000103") return [{ original: id, status: 1, transacao: cadeia.assinar(transacao({ originalTransactionId: "2000000000000999" })), renovacao: null }];
      if (id === "2000000000000104") return null;
      if (id === "2000000000000105") return [];
      return [status(id)];
    });
    const lista = ["2000000000000101", "2000000000000102", "2000000000000103", "2000000000000104", "2000000000000105", "2000000000000106"].map((x) => linha(x));
    const { r, corpo, db } = await rodar({ apple: a, db: bancoFalso({ apple_conciliar_lista: lista }) });
    expect(r.status).toBe(200);
    expect(corpo).toMatchObject({ na_lista: 6, conferidas: 1, falhas: 3, nao_encontradas: 2 });
    expect(db.de("apple_assinatura_gravar").map((c) => c.args.p_original)).toEqual(["2000000000000106"]);
  });

  it("Apple completely down: every item is a failure, no status is written, the local repair still ran", async () => {
    const a = apple(() => { throw new Error("ECONNREFUSED"); });
    const { corpo, db } = await rodar({ apple: a, db: bancoFalso({ apple_conciliar_lista: [linha("2000000000000101"), linha("2000000000000102")], apple_expirar_vencidas: 1 }) });
    expect(corpo).toMatchObject({ ok: true, conferidas: 0, falhas: 2, reparadas: 1 });
    expect(db.de("apple_assinatura_gravar")).toEqual([]);
    expect(db.de("apple_expirar_vencidas")).toHaveLength(1);
  });

  it("the database fails: 500 and a neutral message", async () => {
    const { r, corpo } = await rodar({ apple: apple(() => []), db: bancoFalso({ apple_conciliar_lista: () => { throw new Error("timeout"); } }) });
    expect(r.status).toBe(500);
    expect(corpo).toEqual({ error: "falhou" });
  });

  it("the limit asked is bounded (1 to 200) and the logs carry no token and no JWS", async () => {
    logs.length = 0;
    const a = apple((id) => [status(id)]);
    for (const [pedida, usada] of [[0, 50], [-5, 1], [9999, 200], ["abc", 50], [7, 7]] as const) {
      const { db } = await rodar({ apple: a, corpo: { limite: pedida }, db: bancoFalso({ apple_conciliar_lista: [linha("2000000000000100")] }) });
      expect(db.de("apple_conciliar_lista")[0]?.args).toEqual({ p_limite: usada });
    }
    const tudo = logs.join("\n");
    expect(tudo).not.toContain(TOKEN);
    expect(tudo).not.toMatch(/eyJ[A-Za-z0-9_-]{20,}/);
  });
});
