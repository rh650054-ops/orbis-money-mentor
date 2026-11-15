// A bank entry recognised by the provider's own reference (Mercado Pago, 15/11/2026):
// the scenarios A to I of the owner's brief, against a table that has the migration's columns
// and enforces its unique index.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { importarEntradas } from "../../supabase/functions/_shared/pluggy-entradas";
import { bancoComReferencia, reapontamentos, referenciaDe, referenciasDaLeitura } from "../../supabase/functions/_shared/pluggy-identidade";

type Linha = Record<string, unknown> & { transaction_id: string; transaction_date: string; amount: number; bank_connection_id: string };

function banco(instituicao = "Mercado Pago") {
  const entradas: Linha[] = [];
  const cfg = { falharLerRef: false, antesDeGravar: null as null | (() => void) };
  const identidade = (r: Linha) => r.provedor_ref && r.conta_id ? `${r.bank_connection_id}|${r.conta_id}|${r.provedor_ref}|${r.transaction_date}|${Number(r.amount).toFixed(2)}` : null;
  const unico = { message: 'duplicate key value violates unique constraint "auto_detected_sales_identidade_uq"', code: "23505" };
  const from = (tabela: string) => {
    const filtros: ((r: Linha) => boolean)[] = [];
    let op: "select" | "delete" | "update" = "select";
    let novo: Record<string, unknown> = {};
    let porRef = false;
    const q = {
      select: () => q, limit: () => q,
      update: (v: Record<string, unknown>) => { op = "update"; novo = v; return q; },
      delete: () => { op = "delete"; return q; },
      eq: (c: string, v: unknown) => { filtros.push((r) => String(r[c] ?? (c === "status" ? "pending" : "")) === String(v)); return q; },
      gt: (c: string, v: string) => { filtros.push((r) => String(r[c]) > v); return q; },
      in: (c: string, v: string[]) => { if (c === "provedor_ref") porRef = true; filtros.push((r) => v.includes(String(r[c]))); return q; },
      maybeSingle: () => Promise.resolve({ data: tabela === "bank_connections" ? { institution_name: instituicao } : { cpf: "" }, error: null }),
      upsert: (linhas: Linha[]) => {
        const rival = cfg.antesDeGravar; cfg.antesDeGravar = null; rival?.();
        for (const l of linhas) { // the whole batch is refused, as a real statement would be
          const k = identidade({ ...(entradas.find((e) => e.transaction_id === l.transaction_id) ?? {}), ...l } as Linha);
          if (k && entradas.some((e) => e.transaction_id !== l.transaction_id && identidade(e) === k)) return Promise.resolve({ error: unico });
        }
        for (const l of linhas) {
          const i = entradas.findIndex((e) => e.transaction_id === l.transaction_id);
          if (i >= 0) entradas[i] = { ...entradas[i], ...l }; else entradas.push({ status: "pending", ids_anteriores: [], ...l });
        }
        return Promise.resolve({ error: null });
      },
      then(res: (r: { data: unknown; error: unknown }) => unknown) {
        if (tabela !== "auto_detected_sales") return Promise.resolve({ data: null, error: null }).then(res);
        if (op === "select" && porRef && cfg.falharLerRef) return Promise.resolve({ data: null, error: { message: "timeout" } }).then(res);
        const alvo = entradas.filter((r) => filtros.every((f) => f(r)));
        if (op === "delete") for (const a of alvo) entradas.splice(entradas.indexOf(a), 1);
        if (op === "update") {
          for (const a of alvo) {
            if (novo.transaction_id && entradas.some((e) => e !== a && e.transaction_id === novo.transaction_id)) return Promise.resolve({ data: null, error: unico }).then(res);
            Object.assign(a, novo);
          }
        }
        return Promise.resolve({ data: alvo.map((a) => ({ ...a })), error: null }).then(res);
      },
    };
    return q;
  };
  const doDia = (dia: string, con = "con-1") => entradas.filter((e) => e.transaction_date === dia && e.bank_connection_id === con);
  const total = (dia: string) => Math.round(doDia(dia).reduce((s, e) => s + e.amount, 0) * 100) / 100;
  return { admin: { from }, entradas, cfg, doDia, total };
}

type Tx = { id: string; amount: number; date: string; description?: string; providerCode?: string; providerId?: string; conta?: string };
const pix = (id: string, code: string, amount: number, dia: string, extra: Partial<Tx> = {}): Tx =>
  ({ id, amount, date: `${dia}T03:00:00.000Z`, description: "Transferência PIX recebida", providerCode: code, ...extra });

function pluggy(lista: Tx[], contas = ["conta-1"]) {
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    const u = String(url);
    const ok = (corpo: unknown, status = 200) => ({ ok: status < 300, status, json: async () => corpo, text: async () => "" }) as unknown as Response;
    if (u.includes("/accounts")) return ok({ results: contas.map((id) => ({ id, type: "BANK" })) });
    if (/\/transactions\/[^/?]+$/.test(u)) return ok({}, 404);
    const conta = new URL(u).searchParams.get("accountId");
    return ok({ results: lista.filter((t) => (t.conta ?? "conta-1") === conta).map(({ conta: _c, ...t }) => ({ ...t, type: "CREDIT" })) });
  }));
}
const ler = (admin: unknown, modoDaIdentidade: "aplicar" | "observar" = "aplicar") =>
  importarEntradas(admin, "chave", "item-1", "vendedor-1", "con-1", 2, "observar", modoDaIdentidade); // oldest-day rule as in production: observe only
const NA_JANELA = new Date("2026-11-11T15:00:00Z");   // window starts 08/11
const NA_BORDA_09 = new Date("2026-11-13T01:10:00Z"); // window starts 09/11: 09/11 is its oldest day
const DIA = "2026-11-09";

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(NA_JANELA); vi.spyOn(console, "log").mockImplementation(() => {}); vi.spyOn(console, "error").mockImplementation(() => {}); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("A — the same Pix under a new Pluggy id is counted once", () => {
  const tres = (p: string) => [pix(`${p}1`, "C1", 14.99, DIA), pix(`${p}2`, "C2", 20, DIA), pix(`${p}3`, "C3", 20, DIA)];

  it("inside the window: the stored row takes the new id, keeps the old one and everything else it had", async () => {
    const b = banco();
    pluggy(tres("a")); await ler(b.admin);
    const linha = b.entradas.find((e) => e.transaction_id === "a2");
    if (linha) { linha.status = "ignored"; linha.daily_sale_id = "venda-7"; } // what the seller did with it
    pluggy(tres("b"));
    const r = await ler(b.admin);
    expect(b.doDia(DIA)).toHaveLength(3);
    expect(b.total(DIA)).toBe(54.99);
    expect(b.entradas.map((e) => e.transaction_id).sort()).toEqual(["b1", "b2", "b3"]);
    expect(b.entradas.find((e) => e.transaction_id === "b2")).toMatchObject({ status: "ignored", daily_sale_id: "venda-7", ids_anteriores: ["a2"] });
    expect(r.identidade).toEqual({ reapontadas: 3, divergentes: 0, adiadas: 0 });
    expect(r.completa).toBe(true);
  });

  it("on the oldest day of the window (the production defect): no copy, even with that day's rule only observing", async () => {
    const A = [14.99, ...Array(6).fill(15), ...Array(18).fill(20), 30, 30, 30] as number[]; // production: 28 entries, R$ 554.99
    const dia = (p: string) => A.map((v, i) => pix(`${p}${i}`, `C${i}`, v, DIA));
    const b = banco();
    pluggy(dia("a")); await ler(b.admin);
    vi.setSystemTime(NA_BORDA_09);
    pluggy(dia("b"));
    const r = await ler(b.admin);
    expect(b.doDia(DIA)).toHaveLength(28); // production stored 56
    expect(b.total(DIA)).toBe(554.99);     // production showed R$ 1,109.98
    expect(r.identidade?.reapontadas).toBe(28);
  });

  it("re-issued again and again: one row, every former id remembered", async () => {
    const b = banco();
    for (const p of ["a", "b", "c", "d"]) { pluggy(tres(p)); await ler(b.admin); }
    expect(b.entradas).toHaveLength(3);
    expect(b.entradas.find((e) => e.transaction_id === "d1")?.ids_anteriores).toEqual(["a1", "b1", "c1"]);
  });
});

describe("B, C, D — payments that look alike are different payments", () => {
  it("B: two real Pix of R$ 20 on the same day are R$ 40, before and after a re-issue", async () => {
    const b = banco();
    pluggy([pix("a1", "C1", 20, DIA), pix("a2", "C2", 20, DIA)]); await ler(b.admin);
    expect(b.total(DIA)).toBe(40);
    pluggy([pix("b1", "C1", 20, DIA), pix("b2", "C2", 20, DIA)]); await ler(b.admin);
    expect(b.doDia(DIA)).toHaveLength(2);
    expect(b.total(DIA)).toBe(40);
  });

  it("C: ten Pix of R$ 20 are ten payments, and stay ten when every id changes", async () => {
    const dez = (p: string) => Array.from({ length: 10 }, (_, i) => pix(`${p}${i}`, `C${i}`, 20, DIA));
    const b = banco();
    pluggy(dez("a")); await ler(b.admin);
    pluggy(dez("b")); await ler(b.admin);
    vi.setSystemTime(NA_BORDA_09);
    pluggy(dez("c")); await ler(b.admin);
    expect(b.doDia(DIA)).toHaveLength(10);
    expect(b.total(DIA)).toBe(200);
  });

  it("D: a Pix that shows up three days late, with its own reference, is imported next to the re-issued ones", async () => {
    const b = banco();
    pluggy([pix("a1", "C1", 20, DIA), pix("a2", "C2", 20, DIA)]); await ler(b.admin);
    vi.setSystemTime(NA_BORDA_09);
    pluggy([pix("b1", "C1", 20, DIA), pix("b2", "C2", 20, DIA), pix("tardio", "C9", 20, DIA)]);
    const r = await ler(b.admin);
    expect(b.doDia(DIA)).toHaveLength(3);
    expect(b.total(DIA)).toBe(60);
    expect(r.identidade).toMatchObject({ reapontadas: 2 });
  });
});

describe("E — a partial list removes nothing", () => {
  it("4 of 10 come back re-issued, inside the window: the other 6 stay, the 4 are recognised", async () => {
    const dez = (p: string) => Array.from({ length: 10 }, (_, i) => pix(`${p}${i}`, `C${i}`, 20, DIA));
    const b = banco();
    pluggy(dez("a")); await ler(b.admin);
    pluggy(dez("b").slice(0, 4));
    await ler(b.admin);
    expect(b.doDia(DIA)).toHaveLength(10); // the day+amount rule alone would have removed the 6 missing ones
    expect(b.total(DIA)).toBe(200);
    pluggy(dez("c")); await ler(b.admin); // the whole list again
    expect(b.doDia(DIA)).toHaveLength(10);
  });
});

describe("G — two accounts of one connection are never mixed", () => {
  it("the same reference, day and amount in two accounts are two payments; re-issuing one touches only that one", async () => {
    const b = banco();
    pluggy([pix("a1", "X1", 20, DIA, { conta: "conta-1" }), pix("z1", "X1", 20, DIA, { conta: "conta-2" })], ["conta-1", "conta-2"]);
    await ler(b.admin);
    expect(b.doDia(DIA)).toHaveLength(2);
    pluggy([pix("b1", "X1", 20, DIA, { conta: "conta-1" }), pix("z1", "X1", 20, DIA, { conta: "conta-2" })], ["conta-1", "conta-2"]);
    await ler(b.admin);
    expect(b.entradas.map((e) => `${e.transaction_id}@${e.conta_id}`).sort()).toEqual(["b1@conta-1", "z1@conta-2"]);
  });
});

describe("H — imports at the same time store no copy", () => {
  it("webhook, robot and manual sync read the same re-issue together: still one row each", async () => {
    const dois = (p: string) => [pix(`${p}1`, "C1", 20, DIA), pix(`${p}2`, "C2", 30, DIA)];
    const b = banco();
    pluggy(dois("a")); await ler(b.admin);
    pluggy(dois("b"));
    await Promise.all([ler(b.admin), ler(b.admin), ler(b.admin)]);
    expect(b.doDia(DIA)).toHaveLength(2);
    expect(b.total(DIA)).toBe(50);
  });

  it("a rival import stores the same new payment under another id between our lookup and our write: the index refuses ours, no copy, no stamp", async () => {
    const b = banco();
    pluggy([pix("x1", "C1", 20, DIA)]);
    b.cfg.antesDeGravar = () => { b.entradas.push({ transaction_id: "x2", bank_connection_id: "con-1", conta_id: "conta-1", provedor_ref: "code:C1", transaction_date: DIA, amount: 20, status: "pending", ids_anteriores: [] }); };
    const r = await ler(b.admin);
    expect(b.doDia(DIA)).toHaveLength(1);
    expect(r.completa).toBe(false); // what was not written is never stamped as read
    const depois = await ler(b.admin); // next read: recognised by its reference
    expect(b.doDia(DIA)).toHaveLength(1);
    expect(depois.completa).toBe(true);
  });
});

describe("I — an entry the provider corrects", () => {
  it("description corrected under the same id: updated in place", async () => {
    const b = banco();
    pluggy([pix("a1", "C1", 20, DIA)]); await ler(b.admin);
    pluggy([pix("a1", "C1", 20, DIA, { description: "Venda: Produto" })]); await ler(b.admin);
    expect(b.entradas).toHaveLength(1);
    expect(b.entradas[0]?.description).toBe("Venda: Produto");
  });
  it("description corrected AND id re-issued: still one row, with the new description and the old id remembered", async () => {
    const b = banco();
    pluggy([pix("a1", "C1", 20, DIA)]); await ler(b.admin);
    pluggy([pix("b1", "C1", 20, DIA, { description: "Venda: Produto" })]); await ler(b.admin);
    expect(b.entradas).toHaveLength(1);
    expect(b.entradas[0]).toMatchObject({ transaction_id: "b1", description: "Venda: Produto", ids_anteriores: ["a1"] });
  });
  it("same reference on ANOTHER day or amount is not assumed to be the same payment: counted as divergent, nothing merged", async () => {
    const b = banco();
    pluggy([pix("a1", "C1", 20, DIA)]); await ler(b.admin);
    pluggy([pix("a1", "C1", 20, DIA), pix("b1", "C1", 20, "2026-11-10")]); // the reference repeats in one read: ignored
    await ler(b.admin);
    expect(b.entradas).toHaveLength(2);
    pluggy([pix("c1", "C7", 25, "2026-11-10")]); await ler(b.admin);
    pluggy([pix("d1", "C7", 35, "2026-11-10")]); // same reference, other amount, other id
    const r = await ler(b.admin);
    expect(r.identidade?.divergentes).toBe(1);
    expect(b.entradas.some((e) => e.transaction_id === "d1")).toBe(true);
  });
});

describe("what is not proven is not decided", () => {
  it("a bank that is not on the proven list never gets a reference: its behaviour is the one before", async () => {
    const b = banco("Nubank");
    pluggy([pix("a1", "PIX", 20, DIA), pix("a2", "PIX", 20, DIA)]); // a code that is the same for every transaction
    const r = await ler(b.admin);
    expect(b.entradas).toHaveLength(2);
    expect(b.entradas.every((e) => e.provedor_ref === undefined)).toBe(true);
    expect(r.identidade).toBeNull();
  });
  it("the stored references cannot be read: those entries are not written now and the read gets no stamp", async () => {
    const b = banco();
    pluggy([pix("a1", "C1", 20, DIA)]); await ler(b.admin);
    b.cfg.falharLerRef = true;
    pluggy([pix("b1", "C1", 20, DIA)]);
    const r = await ler(b.admin);
    expect(b.entradas.map((e) => e.transaction_id)).toEqual(["a1"]); // no copy, nothing lost
    expect(r.completa).toBe(false);
    b.cfg.falharLerRef = false;
    expect((await ler(b.admin)).completa).toBe(true);
    expect(b.entradas.map((e) => e.transaction_id)).toEqual(["b1"]);
  });
  it("'observar': the re-issue is only counted and the copy is written as today, without tripping the index", async () => {
    const b = banco();
    pluggy([pix("a1", "C1", 20, DIA)]); await ler(b.admin, "observar");
    vi.setSystemTime(NA_BORDA_09);
    pluggy([pix("b1", "C1", 20, DIA)]);
    const r = await ler(b.admin, "observar");
    expect(b.doDia(DIA)).toHaveLength(2);
    expect(r.identidade?.reapontadas).toBe(1);
  });
  it("rows stored before the migration gain account and reference the first time their id comes back", async () => {
    const b = banco();
    b.entradas.push({ transaction_id: "a1", bank_connection_id: "con-1", user_id: "vendedor-1", amount: 20, description: "Transferência PIX recebida", transaction_date: DIA, transacted_at: `${DIA}T03:00:00.000Z`, is_pix: true, own_transfer: false, pagador_nome: null, pagador_doc: null, status: "pending" });
    pluggy([pix("a1", "C1", 20, DIA)]); await ler(b.admin);
    expect(b.entradas[0]).toMatchObject({ conta_id: "conta-1", provedor_ref: "code:C1" });
    pluggy([pix("b1", "C1", 20, DIA)]); await ler(b.admin);
    expect(b.entradas.map((e) => e.transaction_id)).toEqual(["b1"]);
  });
});

describe("the pure rules", () => {
  it("referenciaDe: providerCode first (personal accounts), providerId otherwise (business), nothing when neither", () => {
    expect(referenciaDe({ providerCode: "ABC" })).toBe("code:ABC");
    expect(referenciaDe({ providerId: "123" })).toBe("id:123");
    expect(referenciaDe({ providerCode: " ", providerId: null })).toBeNull();
    expect(referenciaDe(null)).toBeNull();
  });
  it("referenciasDaLeitura: a reference on two transactions of one read identifies neither", () => {
    const r = referenciasDaLeitura([{ id: "a", providerCode: "X" }, { id: "b", providerCode: "X" }, { id: "c", providerCode: "Y" }]);
    expect([...r.porId]).toEqual([["c", "code:Y"]]);
    expect(r.repetidas).toBe(2);
  });
  it("reapontamentos: a stored id that came back is itself; account, day and amount must all match", () => {
    const g = { transaction_id: "o", conta_id: "c1", provedor_ref: "code:X", transaction_date: DIA, amount: 20, ids_anteriores: ["m"] };
    const n = { ...g, transaction_id: "n" };
    expect(reapontamentos([n], [g], new Set(["n"]))).toEqual({ reapontar: [{ de: "o", para: "n", anteriores: ["m", "o"] }], divergentes: [] });
    expect(reapontamentos([n], [g], new Set(["n", "o"])).reapontar).toEqual([]);
    expect(reapontamentos([{ ...n, conta_id: "c2" }], [g], new Set()).reapontar).toEqual([]);
    expect(reapontamentos([{ ...n, amount: 21 }], [g], new Set())).toEqual({ reapontar: [], divergentes: ["n"] });
  });
  it("only Mercado Pago is on the proven list", () => {
    expect(bancoComReferencia("Mercado Pago")).toBe(true);
    expect(bancoComReferencia("Mercado Pago Empresas")).toBe(true);
    for (const outro of ["Nubank", "Inter", "PagBank", "InfinitePay", "Itaú", null]) expect(bancoComReferencia(outro)).toBe(false);
  });
});
