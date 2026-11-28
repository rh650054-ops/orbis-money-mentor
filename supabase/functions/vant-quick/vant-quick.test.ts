// @vitest-environment node
/* vant-quick: the door of VANT Quick interactive. The rules are SQL (case 54); here: the credential
   gate, the input shape, the HTTP answer of each outcome, and that an inconclusive call is never
   reported as done. The database is a stand-in that records every call. */
import { beforeAll, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

type Banco = { rpc: (n: string, a?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }> };
let tratar: (req: Request, deps: { db: Banco }) => Promise<Response>;
beforeAll(async () => {
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  (globalThis as unknown as { Deno: unknown }).Deno = { env: { get: () => "x" } };
  ({ tratarVantQuick: tratar } = (await import("./index")) as unknown as { tratarVantQuick: typeof tratar });
});

const TK = "vq1_" + "ab".repeat(32);
const ID = "0f8fad5b-d9cb-469f-a165-70867728950e";
const banco = (resposta: unknown, erro: string | null = null) => {
  const chamadas: { n: string; a: Record<string, unknown> }[] = [];
  return { chamadas, rpc: async (n: string, a: Record<string, unknown> = {}) => { chamadas.push({ n, a }); return { data: erro ? null : resposta, error: erro ? { message: erro } : null }; } };
};
const pedir = (corpo: unknown, token: string | null = TK, metodo = "POST") => new Request("https://x.test/vant-quick", {
  method: metodo, headers: token ? { authorization: `Bearer ${token}` } : {}, body: metodo === "POST" ? JSON.stringify(corpo) : undefined,
});

describe("vant-quick", () => {
  it("passes the tap to the SQL rules with exactly the declared parameters", async () => {
    const db = banco({ ok: true, aplicado: true, painel: { faturamento: 20 } });
    const r = await tratar(pedir({ acao: "venda", id: ID, origem: "atividade" }), { db });
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({ ok: true, aplicado: true });
    expect(db.chamadas).toEqual([{ n: "vant_quick_executar", a: { p_token: TK, p_acao: "venda", p_id: ID, p_origem: "atividade" } }]);
    const sql = readFileSync(fileURLToPath(new URL("../../migrations/20261128140000_vant_quick_interativo.sql", import.meta.url)), "utf8");
    expect(sql).toMatch(/function public\.vant_quick_executar\(p_token text, p_acao text, p_id uuid default null, p_origem text default 'widget'\)/);
  });

  it("no or malformed credential: 401 without touching the database", async () => {
    for (const tk of [null, "abc", "vq1_short", `${TK}x`]) {
      const db = banco({ ok: true });
      const r = await tratar(pedir({ acao: "venda", id: ID }, tk), { db });
      expect(r.status).toBe(401);
      expect(db.chamadas).toHaveLength(0);
    }
  });

  it("a write needs a real tap id (the idempotency key); the panel does not", async () => {
    const db = banco({ ok: true, painel: {} });
    expect((await tratar(pedir({ acao: "abordagem" }), { db })).status).toBe(400);
    expect((await tratar(pedir({ acao: "venda", id: "not-a-uuid" }), { db })).status).toBe(400);
    expect((await tratar(pedir({ acao: "transferir", id: ID }), { db })).status).toBe(400);
    expect(db.chamadas).toHaveLength(0);
    expect((await tratar(pedir({ acao: "painel" }), { db })).status).toBe(200);
    expect(db.chamadas[0]!.a.p_id).toBeNull();
  });

  it("each refusal keeps its reason and a status that is never 2xx", async () => {
    const casos: [string, number][] = [["credencial_invalida", 401], ["credencial_expirada", 401], ["desativado", 503], ["rapido_demais", 429],
      ["limite_do_dia", 429], ["sem_defcon", 409], ["bloco_parado", 409], ["sem_valor", 409], ["atualize_outro_aparelho", 409], ["defcon_nao_habilitado", 409]];
    for (const [motivo, status] of casos) {
      const r = await tratar(pedir({ acao: "venda", id: ID }), { db: banco({ ok: false, motivo }) });
      expect(r.status, motivo).toBe(status);
      expect(await r.json()).toEqual({ ok: false, motivo });
    }
  });

  it("database error: 'inconclusivo' (503), never success; the token is not logged", async () => {
    const erros: string[] = [];
    (console.error as unknown as { mockImplementation: (f: (...a: unknown[]) => void) => void }).mockImplementation((...a) => { erros.push(a.join(" ")); });
    const r = await tratar(pedir({ acao: "venda", id: ID }), { db: banco(null, "timeout") });
    expect(r.status).toBe(503);
    expect(await r.json()).toEqual({ ok: false, motivo: "inconclusivo" });
    expect(erros.join(" ")).not.toContain(TK);
  });

  it("only POST", async () => {
    expect((await tratar(pedir(null, TK, "GET"), { db: banco({}) })).status).toBe(405);
  });
});
