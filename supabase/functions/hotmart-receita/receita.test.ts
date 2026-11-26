// @vitest-environment node
/* hotmart-receita answers with subscriber data, so only an admin may call it (26/11/2026).
   Before: any logged-in account got `amostra`, the raw record of another subscriber. */
import { beforeAll, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

type Deps = { quemE: (a: string) => Promise<{ userId: string | null; admin: boolean }>; token: () => Promise<string | null>; busca: typeof fetch };
let tratarReceita: (req: Request, deps: Deps) => Promise<Response>;
let extrairValor: (it: unknown) => number;

beforeAll(async () => {
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  (globalThis as unknown as { Deno: unknown }).Deno = { env: { get: () => "x" }, serve: () => {} };
  ({ tratarReceita, extrairValor } = (await import("./index")) as unknown as { tratarReceita: typeof tratarReceita; extrairValor: typeof extrairValor });
});

const ASSINANTE = { subscriber: { name: "Fulana de Tal", email: "fulana@exemplo.com", ucode: "u-1" }, price: { value: 29.9 } };
const paginas = [
  { items: [ASSINANTE, { plan: { price: { value: 49.9 } } }], page_info: { next_page_token: "p2" } },
  { items: [{ subscription: { price: { value: "29.90" } } }, { sem: "valor" }] },
];

function montar(quem: { userId: string | null; admin: boolean }, opts: { token?: string | null; status?: number } = {}) {
  const urls: string[] = [];
  const busca = vi.fn(async (url: string | URL | Request) => {
    urls.push(String(url));
    const pagina = paginas[urls.length - 1] ?? { items: [] };
    return new Response(JSON.stringify(pagina), { status: opts.status ?? 200 });
  }) as unknown as typeof fetch;
  const token = vi.fn(async () => (opts.token === undefined ? "tok" : opts.token));
  const deps: Deps = { quemE: async () => quem, token, busca };
  return { deps, urls, token, busca };
}
const pedido = (auth?: string) => new Request("https://x/hotmart-receita", { method: "POST", headers: auth ? { Authorization: auth } : {} });

describe("hotmart-receita: only an admin reads subscriber data", () => {
  it("no login → 401, Hotmart is never asked", async () => {
    const m = montar({ userId: null, admin: false });
    const r = await tratarReceita(pedido(), m.deps);
    expect(r.status).toBe(401);
    expect(await r.json()).toEqual({ error: "nao_autorizado" });
    expect(m.token).not.toHaveBeenCalled();
    expect(m.busca).not.toHaveBeenCalled();
  });

  it("ordinary logged-in user → 403, no subscriber data and Hotmart is never asked", async () => {
    const m = montar({ userId: "user-comum", admin: false });
    const r = await tratarReceita(pedido("Bearer jwt-de-usuario"), m.deps);
    const corpo = await r.text();
    expect(r.status).toBe(403);
    expect(JSON.parse(corpo)).toEqual({ error: "so_admin" });
    expect(corpo).not.toMatch(/amostra|ativos|receita|exemplo\.com|Fulana/);
    expect(m.token).not.toHaveBeenCalled();
    expect(m.busca).not.toHaveBeenCalled();
  });

  it("admin → 200 with the same numbers as before (count, sum over the pages, first record)", async () => {
    const m = montar({ userId: "admin-1", admin: true });
    const r = await tratarReceita(pedido("Bearer jwt-de-admin"), m.deps);
    expect(r.status).toBe(200);
    const corpo = await r.json();
    expect(corpo.ativos).toBe(4);
    expect(corpo.receita).toBeCloseTo(29.9 + 49.9 + 29.9 + 0, 5);
    expect(corpo.amostra).toEqual(ASSINANTE);
    expect(m.urls).toHaveLength(2);
    expect(m.urls[0]).toContain("status=ACTIVE");
    expect(m.urls[0]).toContain("max_results=50");
    expect(m.urls[1]).toContain("page_token=p2");
  });

  it("admin, Hotmart refuses → 502 without Hotmart's raw answer", async () => {
    const semToken = await tratarReceita(pedido("Bearer a"), montar({ userId: "admin-1", admin: true }, { token: null }).deps);
    expect(semToken.status).toBe(502);
    const recusou = await tratarReceita(pedido("Bearer a"), montar({ userId: "admin-1", admin: true }, { status: 500 }).deps);
    expect(recusou.status).toBe(502);
    expect(Object.keys(await recusou.json())).toEqual(["error"]);
  });

  it("the check throws → 500 with a neutral body (fail closed)", async () => {
    const m = montar({ userId: "x", admin: true });
    m.deps.quemE = async () => { throw new Error("segredo interno"); };
    const r = await tratarReceita(pedido("Bearer a"), m.deps);
    expect(r.status).toBe(500);
    expect(await r.text()).not.toContain("segredo");
    expect(m.busca).not.toHaveBeenCalled();
  });

  it("OPTIONS answers without touching anything", async () => {
    const m = montar({ userId: null, admin: false });
    const r = await tratarReceita(new Request("https://x/hotmart-receita", { method: "OPTIONS" }), m.deps);
    expect(r.status).toBe(200);
    expect(m.busca).not.toHaveBeenCalled();
  });
});

describe("hotmart-receita: the server-side rule", () => {
  const fonte = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");
  it("who is admin is decided by is_orbis_admin() as the caller, and only `true` passes", () => {
    expect(fonte).toMatch(/rpc\("is_orbis_admin"\)/);
    expect(fonte).toMatch(/admin: !error && data === true/);
  });
  it("the admin check comes before the Hotmart token and before any read", () => {
    const corpo = fonte.slice(fonte.indexOf("export async function tratarReceita"));
    const portao = corpo.indexOf("if (!quem.admin)");
    expect(portao).toBeGreaterThan(0);
    expect(portao).toBeLessThan(corpo.indexOf("deps.token()"));
    expect(portao).toBeLessThan(corpo.indexOf("deps.busca("));
  });
  it("no raw Hotmart answer and no exception text goes back to the caller", () => {
    expect(fonte).not.toMatch(/detalhe/);
    expect(fonte).not.toMatch(/String\(e\)/);
  });
  it("is registered with the login required at the gateway", () => {
    const toml = readFileSync(fileURLToPath(new URL("../../config.toml", import.meta.url)), "utf8");
    expect(toml).toMatch(/\[functions\.hotmart-receita\]\s*\nverify_jwt = true/);
  });
});

describe("hotmart-receita: price of one subscription (unchanged arithmetic)", () => {
  it("takes the first positive number among the known places", () => {
    expect(extrairValor({ price: { value: 29.9 } })).toBe(29.9);
    expect(extrairValor({ subscription: { price: { value: "49.90" } } })).toBe(49.9);
    expect(extrairValor({ plan: { price: 19 } })).toBe(19);
    expect(extrairValor({ price: { value: 0 }, value: 12.9 })).toBe(12.9);
    expect(extrairValor({})).toBe(0);
    expect(extrairValor(null)).toBe(0);
  });
});
