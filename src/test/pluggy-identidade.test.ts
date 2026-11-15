// A bank entry recognised by the provider's own reference (Mercado Pago, 15/11/2026): the
// scenarios A to I of the owner's brief and the points of the review of PR #319, against a table
// that has the migration's columns and enforces its unique index.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { importarEntradas } from "../../supabase/functions/_shared/pluggy-entradas";
import { bancoComReferencia, estadoPeloErro, modoDaReferencia, MODOS_DA_IDENTIDADE, reapontamentos, referenciaDe, referenciasDaLeitura, type ModosDaIdentidade } from "../../supabase/functions/_shared/pluggy-identidade";

type Linha = Record<string, unknown> & { transaction_id: string; transaction_date: string; amount: number; bank_connection_id: string };

function banco(instituicao = "Mercado Pago") {
  const entradas: Linha[] = [];
  const divergencias: Record<string, unknown>[] = [];
  const cfg = {
    falharLerRef: false, estado: "ativa" as "ativa" | "sem_migration" | "indisponivel",
    antesDeGravar: null as null | (() => void), antesDeReapontar: null as null | (() => void),
  };
  const identidade = (r: Linha) => r.provedor_ref && r.conta_id ? `${r.bank_connection_id}|${r.conta_id}|${r.provedor_ref}|${r.transaction_date}|${Number(r.amount).toFixed(2)}` : null;
  const unico = { message: 'duplicate key value violates unique constraint "auto_detected_sales_identidade_uq"', code: "23505" };
  const from = (tabela: string) => {
    const filtros: ((r: Linha) => boolean)[] = [];
    let op: "select" | "delete" | "update" = "select";
    let novo: Record<string, unknown> = {};
    let porRef = false, sonda = false, colunasNovas = false;
    const q = {
      select: (c?: string) => { if (c?.includes("provedor_ref")) colunasNovas = true; return q; },
      limit: () => { sonda = true; return q; },
      update: (v: Record<string, unknown>) => { op = "update"; novo = v; const rival = cfg.antesDeReapontar; cfg.antesDeReapontar = null; rival?.(); return q; },
      delete: () => { op = "delete"; return q; },
      eq: (c: string, v: unknown) => { filtros.push((r) => String(r[c] ?? (c === "status" ? "pending" : "")) === String(v)); return q; },
      gt: (c: string, v: string) => { filtros.push((r) => String(r[c]) > v); return q; },
      in: (c: string, v: string[]) => { if (c === "provedor_ref") porRef = true; filtros.push((r) => v.includes(String(r[c]))); return q; },
      maybeSingle: () => Promise.resolve({ data: tabela === "bank_connections" ? { institution_name: instituicao } : { cpf: "" }, error: null }),
      upsert: (linhas: Linha[]) => {
        if (tabela === "banco_entradas_divergencias") {
          for (const l of linhas) {
            const k = (d: Record<string, unknown>) => `${d.bank_connection_id}|${d.conta_id}|${d.provedor_ref}|${d.data_nova}|${d.valor_novo}`;
            if (!divergencias.some((d) => k(d) === k(l))) divergencias.push({ ...l });
          }
          return Promise.resolve({ error: null });
        }
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
        const responder = (data: unknown, error: unknown = null) => Promise.resolve({ data, error }).then(res);
        if (tabela !== "auto_detected_sales") return responder(null);
        if (sonda && cfg.estado === "sem_migration") return responder(null, { code: "42703", message: "column auto_detected_sales.conta_id does not exist" });
        if (sonda && cfg.estado === "indisponivel") return responder(null, { message: "canceling statement due to statement timeout" });
        if (colunasNovas && cfg.estado !== "ativa") return responder(null, { code: "42703", message: "column does not exist" });
        if (op === "select" && porRef && cfg.falharLerRef) return responder(null, { message: "timeout" });
        const alvo = entradas.filter((r) => filtros.every((f) => f(r)));
        if (op === "delete") for (const a of alvo) entradas.splice(entradas.indexOf(a), 1);
        if (op === "update") {
          for (const a of alvo) {
            if (novo.transaction_id && entradas.some((e) => e !== a && e.transaction_id === novo.transaction_id)) return responder(null, unico);
            Object.assign(a, novo);
          }
        }
        return responder(alvo.map((a) => ({ ...a })));
      },
    };
    return q;
  };
  const doDia = (dia: string, con = "con-1") => entradas.filter((e) => e.transaction_date === dia && e.bank_connection_id === con);
  const total = (dia: string) => Math.round(doDia(dia).reduce((s, e) => s + e.amount, 0) * 100) / 100;
  const ids = () => entradas.map((e) => e.transaction_id).sort();
  return { admin: { from }, entradas, divergencias, cfg, doDia, total, ids };
}

type Tx = { id: string; amount: number; date: string; description?: string; providerCode?: string; providerId?: string; conta?: string; pagina?: number };
const pix = (id: string, code: string, amount: number, dia: string, extra: Partial<Tx> = {}): Tx =>
  ({ id, amount, date: `${dia}T03:00:00.000Z`, description: "Transferência PIX recebida", providerCode: code, ...extra });
const pj = (id: string, providerId: string, amount: number, quando: string): Tx => ({ id, amount, date: quando, description: "Liberação de dinheiro", providerId });

/** The list may come in two pages (`pagina: 1` on a transaction); `paginaFora` makes that page fail. */
function pluggy(lista: Tx[], o: { contas?: string[]; paginaFora?: number } = {}) {
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    const u = String(url);
    const ok = (corpo: unknown, status = 200) => ({ ok: status < 300, status, json: async () => corpo, text: async () => "" }) as unknown as Response;
    if (u.includes("/accounts")) return ok({ results: (o.contas ?? ["conta-1"]).map((id) => ({ id, type: "BANK" })) });
    if (/\/transactions\/[^/?]+$/.test(u)) return ok({}, 404);
    const q = new URL(u).searchParams;
    const pagina = q.get("after") === "p1" ? 1 : 0;
    if (o.paginaFora === pagina) return ok({}, 500);
    const daConta = lista.filter((t) => (t.conta ?? "conta-1") === q.get("accountId"));
    const temSegunda = daConta.some((t) => t.pagina === 1);
    return ok({
      results: daConta.filter((t) => (t.pagina ?? 0) === pagina).map(({ conta: _c, pagina: _p, ...t }) => ({ ...t, type: "CREDIT" })),
      next: pagina === 0 && temSegunda ? "p1" : null,
    });
  }));
}
// as the PR ships: providerCode applied, providerId only observed; the oldest-day rule of #315 in "observar"
const ler = (admin: unknown, modos: ModosDaIdentidade = MODOS_DA_IDENTIDADE) => importarEntradas(admin, "chave", "item-1", "vendedor-1", "con-1", 2, "observar", modos);
const NA_JANELA = new Date("2026-11-11T15:00:00Z");   // window starts 08/11
const NA_BORDA_09 = new Date("2026-11-13T01:10:00Z"); // window starts 09/11: 09/11 is its oldest day
const DIA = "2026-11-09";
const semRef = (id: string, amount = 20): Linha => ({ transaction_id: id, bank_connection_id: "con-1", user_id: "vendedor-1", amount, description: "Transferência PIX recebida", transaction_date: DIA, transacted_at: `${DIA}T03:00:00.000Z`, is_pix: true, own_transfer: false, pagador_nome: null, pagador_doc: null, status: "pending" });

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
    expect(b.ids()).toEqual(["b1", "b2", "b3"]);
    expect(b.total(DIA)).toBe(54.99);
    expect(b.entradas.find((e) => e.transaction_id === "b2")).toMatchObject({ status: "ignored", daily_sale_id: "venda-7", ids_anteriores: ["a2"] });
    expect(r.identidade).toEqual({ reapontadas: 3, observadas: 0, divergentes: 0, adiadas: 0 });
    expect(r.completa).toBe(true);
  });

  it("on the oldest day of the window, with production's 28 entries: no copy", async () => {
    const A = [14.99, ...Array(6).fill(15), ...Array(18).fill(20), 30, 30, 30] as number[]; // R$ 554.99
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
    expect(b.total(DIA)).toBe(60);
    expect(r.identidade).toMatchObject({ reapontadas: 2 });
    expect(r.completa).toBe(true);
  });
});

describe("E and pages — a list that is not whole decides nothing and removes nothing", () => {
  const dez = (p: string) => Array.from({ length: 10 }, (_, i) => pix(`${p}${i}`, `C${i}`, 20, DIA));

  it("Pluggy answers with only 4 of the 10, re-issued: the other 6 stay", async () => {
    const b = banco();
    pluggy(dez("a")); await ler(b.admin);
    pluggy(dez("b").slice(0, 4)); await ler(b.admin);
    expect(b.doDia(DIA)).toHaveLength(10); // the day+amount rule alone would have removed the 6 missing ones
    pluggy(dez("c")); await ler(b.admin);
    expect(b.doDia(DIA)).toHaveLength(10);
    expect(b.total(DIA)).toBe(200);
  });

  it("a re-issue split between two pages is recognised whole", async () => {
    const b = banco();
    pluggy(dez("a")); await ler(b.admin);
    pluggy(dez("b").map((t, i) => ({ ...t, pagina: i < 5 ? 0 : 1 })));
    const r = await ler(b.admin);
    expect(b.doDia(DIA)).toHaveLength(10);
    expect(r.identidade?.reapontadas).toBe(10);
    expect(r.completa).toBe(true);
  });

  it("the OLD id is still there, on the second page: nothing is pointed back and both are kept", async () => {
    const b = banco();
    pluggy([pix("a1", "C1", 20, DIA)]); await ler(b.admin);
    pluggy([pix("b1", "C1", 20, DIA), pix("a1", "C1", 20, DIA, { pagina: 1 })]); // Pluggy lists two transactions with that reference
    const r = await ler(b.admin);
    expect(b.ids()).toEqual(["a1", "b1"]);
    expect(r.identidade?.reapontadas).toBe(0);
    expect(b.entradas.find((e) => e.transaction_id === "a1")?.ids_anteriores).toEqual([]);
  });

  it("the second page fails: no id is moved on the half list, the suspect is not written, no stamp; the next whole read settles it", async () => {
    const b = banco();
    pluggy([pix("a1", "C1", 20, DIA), pix("a2", "C2", 30, DIA)]); await ler(b.admin);
    pluggy([pix("b1", "C1", 20, DIA), pix("b2", "C2", 30, DIA, { pagina: 1 })], { paginaFora: 1 });
    const r = await ler(b.admin);
    expect(b.ids()).toEqual(["a1", "a2"]); // untouched
    expect(r.identidade).toMatchObject({ reapontadas: 0, adiadas: 1 });
    expect(r.completa).toBe(false);
    pluggy([pix("b1", "C1", 20, DIA), pix("b2", "C2", 30, DIA, { pagina: 1 })]);
    expect((await ler(b.admin)).completa).toBe(true);
    expect(b.ids()).toEqual(["b1", "b2"]);
  });

  it("a NEW payment on a half list is still written (only the stamp waits)", async () => {
    const b = banco();
    pluggy([pix("a1", "C1", 20, DIA)]); await ler(b.admin);
    pluggy([pix("a1", "C1", 20, DIA), pix("n1", "C5", 20, DIA), pix("x", "C6", 5, DIA, { pagina: 1 })], { paginaFora: 1 });
    const r = await ler(b.admin);
    expect(b.ids()).toEqual(["a1", "n1"]);
    expect(r.completa).toBe(false);
  });
});

describe("G — two accounts of one connection are never mixed", () => {
  it("the same reference, day and amount in two accounts are two payments; re-issuing one touches only that one", async () => {
    const contas = ["conta-1", "conta-2"];
    const b = banco();
    pluggy([pix("a1", "X1", 20, DIA, { conta: "conta-1" }), pix("z1", "X1", 20, DIA, { conta: "conta-2" })], { contas });
    await ler(b.admin);
    pluggy([pix("b1", "X1", 20, DIA, { conta: "conta-1" }), pix("z1", "X1", 20, DIA, { conta: "conta-2" })], { contas });
    await ler(b.admin);
    expect(b.entradas.map((e) => `${e.transaction_id}@${e.conta_id}`).sort()).toEqual(["b1@conta-1", "z1@conta-2"]);
  });
});

describe("H — imports at the same time, and a row that moves under our feet", () => {
  const dois = (p: string) => [pix(`${p}1`, "C1", 20, DIA), pix(`${p}2`, "C2", 30, DIA)];

  it("webhook, robot and manual sync read the same re-issue together: still one row each", async () => {
    const b = banco();
    pluggy(dois("a")); await ler(b.admin);
    pluggy(dois("b"));
    await Promise.all([ler(b.admin), ler(b.admin), ler(b.admin)]);
    expect(b.ids()).toEqual(["b1", "b2"]);
    expect(b.total(DIA)).toBe(50);
  });

  it("another import points the row back between our lookup and our update: ours changes nothing, writes no copy, gets no stamp", async () => {
    const b = banco();
    pluggy(dois("a")); await ler(b.admin);
    pluggy(dois("b"));
    b.cfg.antesDeReapontar = () => { const l = b.entradas.find((e) => e.transaction_id === "a1"); if (l) { l.transaction_id = "b1"; l.ids_anteriores = ["a1"]; } };
    const r = await ler(b.admin);
    expect(b.ids()).toEqual(["b1", "b2"]);
    expect(b.entradas.find((e) => e.transaction_id === "b1")?.ids_anteriores).toEqual(["a1"]); // not appended twice
    expect(r.identidade).toMatchObject({ reapontadas: 1, adiadas: 1 });
    expect(r.completa).toBe(false);
    expect((await ler(b.admin)).completa).toBe(true);
  });

  it("a rival import stores the same NEW payment under another id between our lookup and our write: the index refuses ours", async () => {
    const b = banco();
    pluggy([pix("x1", "C1", 20, DIA)]);
    b.cfg.antesDeGravar = () => { b.entradas.push({ ...semRef("x2"), conta_id: "conta-1", provedor_ref: "code:C1", ids_anteriores: [] }); };
    const r = await ler(b.admin);
    expect(b.doDia(DIA)).toHaveLength(1);
    expect(r.completa).toBe(false); // what was not written is never stamped as read
    const depois = await ler(b.admin); // next read: recognised by its reference
    expect(b.doDia(DIA)).toHaveLength(1);
    expect(depois.completa).toBe(true);
  });
});

describe("I — the provider changes an entry", () => {
  it("description corrected, with and without a new id: one row, updated", async () => {
    const b = banco();
    pluggy([pix("a1", "C1", 20, DIA)]); await ler(b.admin);
    pluggy([pix("a1", "C1", 20, DIA, { description: "Venda: Produto" })]); await ler(b.admin);
    expect(b.entradas[0]?.description).toBe("Venda: Produto");
    pluggy([pix("b1", "C1", 20, DIA, { description: "Venda presencial" })]); await ler(b.admin);
    expect(b.entradas).toHaveLength(1);
    expect(b.entradas[0]).toMatchObject({ transaction_id: "b1", description: "Venda presencial", ids_anteriores: ["a1"] });
  });

  it("the same reference comes back with ANOTHER amount: not a new payment, not an overwrite — recorded once, money unchanged", async () => {
    const b = banco();
    pluggy([pix("a1", "C1", 20, DIA), pix("a2", "C2", 30, DIA)]); await ler(b.admin);
    pluggy([pix("b1", "C1", 25, DIA), pix("a2", "C2", 30, DIA)]);
    const r = await ler(b.admin);
    expect(b.ids()).toEqual(["a1", "a2"]);            // the stored row stays as it was
    expect(b.total(DIA)).toBe(50);                    // not 75: the money is not inflated
    expect(b.divergencias).toHaveLength(1);
    expect(b.divergencias[0]).toMatchObject({ transaction_id_guardado: "a1", transaction_id_novo: "b1", valor_guardado: 20, valor_novo: 25, provedor_ref: "code:C1" });
    expect(r.identidade).toMatchObject({ divergentes: 1, adiadas: 0 });
    expect(r.completa).toBe(false);                   // an entry kept out of the money: the day is not taken as read
    pluggy([pix("c1", "C1", 25, DIA), pix("a2", "C2", 30, DIA)]); // seen again, under yet another id
    await ler(b.admin);
    expect(b.divergencias).toHaveLength(1);
    expect(b.total(DIA)).toBe(50);
  });

  it("the same reference comes back on ANOTHER day: same treatment", async () => {
    const b = banco();
    pluggy([pix("a1", "C1", 20, DIA)]); await ler(b.admin);
    pluggy([pix("b1", "C1", 20, "2026-11-10")]);
    await ler(b.admin);
    expect(b.ids()).toEqual(["a1"]);
    expect(b.divergencias[0]).toMatchObject({ data_guardada: DIA, data_nova: "2026-11-10" });
  });
});

describe("scope: providerCode is applied, providerId is only observed", () => {
  it("the modes this PR ships with", () => {
    expect(MODOS_DA_IDENTIDADE).toEqual({ code: "aplicar", id: "observar", exigida: false });
    expect(modoDaReferencia("code:X")).toBe("aplicar");
    expect(modoDaReferencia("id:9")).toBe("observar");
  });
  it("a business account (providerId): the re-issue is counted and everything is written exactly as today", async () => {
    const b = banco("Mercado Pago Empresas");
    pluggy([pj("a1", "900", 19.85, "2026-11-09T21:28:14.000Z")]); await ler(b.admin);
    expect(b.entradas[0]).toMatchObject({ provedor_ref: "id:900", conta_id: "conta-1" });
    vi.setSystemTime(NA_BORDA_09);
    pluggy([pj("b1", "900", 19.85, "2026-11-09T21:28:14.000Z")]);
    const r = await ler(b.admin);
    expect(b.ids()).toEqual(["a1", "b1"]); // today's behaviour on the oldest day, unchanged
    expect(r.identidade).toMatchObject({ reapontadas: 0, observadas: 1 });
    expect(r.completa).toBe(true);
  });
  it("a bank that is not on the proven list never gets a reference", async () => {
    const b = banco("Nubank");
    pluggy([pix("a1", "PIX", 20, DIA), pix("a2", "PIX", 20, DIA)]);
    const r = await ler(b.admin);
    expect(b.entradas.every((e) => e.provedor_ref === undefined)).toBe(true);
    expect(r.identidade).toBeNull();
  });
  it("a reference on two transactions of one read identifies neither: both stored, neither constrained", async () => {
    const b = banco();
    pluggy([pix("a1", "X", 20, DIA), pix("a2", "X", 20, DIA)]); await ler(b.admin);
    expect(b.entradas.map((e) => e.provedor_ref)).toEqual([null, null]);
    expect(b.total(DIA)).toBe(40);
  });
});

describe("the first reads after the migration (rows stored before it have no reference)", () => {
  it("a stored row gains account and reference only when ITS OWN id comes back", async () => {
    const b = banco();
    b.entradas.push(semRef("a1"), semRef("a2"));
    pluggy([pix("a1", "C1", 20, DIA)]); await ler(b.admin);
    expect(b.entradas.find((e) => e.transaction_id === "a1")).toMatchObject({ conta_id: "conta-1", provedor_ref: "code:C1" });
    expect(b.entradas.find((e) => e.transaction_id === "a2")?.provedor_ref).toBeUndefined(); // never guessed
  });
  it("re-issue of rows without reference on the OLDEST day, the very first read: no copy, and no reference is invented for them", async () => {
    const b = banco();
    b.entradas.push(semRef("a1"), semRef("a2"), semRef("a3", 30));
    vi.setSystemTime(NA_BORDA_09);
    pluggy([pix("b1", "C1", 20, DIA), pix("b2", "C2", 20, DIA), pix("b3", "C3", 30, DIA)]); // old ids answer 404
    const r = await ler(b.admin);
    expect(b.ids()).toEqual(["a1", "a2", "a3"]);
    expect(b.total(DIA)).toBe(70);
    expect(b.entradas.every((e) => e.provedor_ref === undefined)).toBe(true);
    expect(r.margem).toMatchObject({ duplicadas: 3, aConferir: 0 });
    expect(r.completa).toBe(true);
  });
  it("the same on a day inside the window: replaced as today, and the new rows carry their reference", async () => {
    const b = banco();
    b.entradas.push(semRef("a1"), semRef("a2", 30));
    pluggy([pix("b1", "C1", 20, DIA), pix("b2", "C2", 30, DIA)]);
    await ler(b.admin);
    expect(b.ids()).toEqual(["b1", "b2"]);
    expect(b.entradas.map((e) => e.provedor_ref).sort()).toEqual(["code:C1", "code:C2"]);
    pluggy([pix("c1", "C1", 20, DIA), pix("c2", "C2", 30, DIA)]); // from now on: recognised
    expect((await ler(b.admin)).identidade?.reapontadas).toBe(2);
    expect(b.total(DIA)).toBe(50);
  });
  it("on the oldest day, a NEW Pix identical to a stored one whose id is gone is still written when both have a reference", async () => {
    const b = banco();
    pluggy([pix("a1", "C1", 20, DIA)]); await ler(b.admin); // stored with its reference
    vi.setSystemTime(NA_BORDA_09);
    pluggy([pix("n1", "C9", 20, DIA)]); // a1 left Pluggy (404); another payment, same day and amount, arrives late
    const r = await ler(b.admin);
    expect(b.ids()).toEqual(["a1", "n1"]); // the evidence rule alone would have called n1 a copy of a1
    expect(r.margem).toMatchObject({ duplicadas: 0 });
  });
  it("historical copies on that day (56 stored for 28 real) are neither multiplied nor given a reference", async () => {
    const b = banco();
    for (let i = 0; i < 4; i++) b.entradas.push(semRef(`o${i}`), semRef(`copia${i}`));
    vi.setSystemTime(NA_BORDA_09);
    pluggy([0, 1, 2, 3].map((i) => pix(`n${i}`, `C${i}`, 20, DIA)));
    await ler(b.admin);
    expect(b.doDia(DIA)).toHaveLength(8);
    expect(b.entradas.filter((e) => e.provedor_ref).length).toBe(0);
  });
});

describe("a failed query never makes the protection disappear", () => {
  it("estadoPeloErro: a missing column is 'not applied'; a timeout, a network or a permission error is 'unavailable'", () => {
    expect(estadoPeloErro(null)).toBe("ativa");
    expect(estadoPeloErro({ code: "42703", message: "column auto_detected_sales.conta_id does not exist" })).toBe("sem_migration");
    expect(estadoPeloErro({ code: "PGRST204", message: "Could not find the 'conta_id' column of 'auto_detected_sales' in the schema cache" })).toBe("sem_migration");
    expect(estadoPeloErro({ code: "57014", message: "canceling statement due to statement timeout" })).toBe("indisponivel");
    expect(estadoPeloErro({ message: "fetch failed" })).toBe("indisponivel");
    expect(estadoPeloErro({ code: "42501", message: "permission denied for table auto_detected_sales" })).toBe("indisponivel");
  });
  it("phase 2 (columns required): not finding them is a failure too — nothing written, no stamp", async () => {
    expect(estadoPeloErro({ code: "42703", message: "column does not exist" }, true)).toBe("indisponivel");
    const b = banco();
    b.cfg.estado = "sem_migration";
    pluggy([pix("a1", "C1", 20, DIA)]);
    const r = await ler(b.admin, { ...MODOS_DA_IDENTIDADE, exigida: true });
    expect(b.entradas).toHaveLength(0);
    expect(r.completa).toBe(false);
  });
  it("migration not applied: the importer behaves exactly as before it", async () => {
    const b = banco();
    b.cfg.estado = "sem_migration";
    pluggy([pix("a1", "C1", 20, DIA)]);
    const r = await ler(b.admin);
    expect(b.entradas[0]?.provedor_ref).toBeUndefined();
    expect(r.identidade).toBeNull();
    expect(r.completa).toBe(true);
  });
  it("the check itself fails: nothing is written, nothing is removed, no stamp; the next read works", async () => {
    const b = banco();
    pluggy([pix("a1", "C1", 20, DIA)]); await ler(b.admin);
    b.cfg.estado = "indisponivel";
    pluggy([pix("b1", "C1", 20, DIA), pix("n", "C2", 30, DIA)]);
    const r = await ler(b.admin);
    expect(b.ids()).toEqual(["a1"]);
    expect(r).toMatchObject({ gravadas: 0, removidas: 0, completa: false });
    b.cfg.estado = "ativa";
    expect((await ler(b.admin)).completa).toBe(true);
    expect(b.ids()).toEqual(["b1", "n"]);
  });
  it("the stored references cannot be read: those entries are not written now and the read gets no stamp", async () => {
    const b = banco();
    pluggy([pix("a1", "C1", 20, DIA)]); await ler(b.admin);
    b.cfg.falharLerRef = true;
    pluggy([pix("b1", "C1", 20, DIA)]);
    const r = await ler(b.admin);
    expect(b.ids()).toEqual(["a1"]);
    expect(r.completa).toBe(false);
    b.cfg.falharLerRef = false;
    expect((await ler(b.admin)).completa).toBe(true);
    expect(b.ids()).toEqual(["b1"]);
  });
});

describe("the pure rules", () => {
  it("referenciaDe: providerCode first (personal accounts), providerId otherwise (business), nothing when neither", () => {
    expect(referenciaDe({ providerCode: "ABC" })).toBe("code:ABC");
    expect(referenciaDe({ providerId: "123" })).toBe("id:123");
    expect(referenciaDe({ providerCode: " ", providerId: null })).toBeNull();
  });
  it("referenciasDaLeitura: a reference on two transactions of one read identifies neither", () => {
    const r = referenciasDaLeitura([{ id: "a", providerCode: "X" }, { id: "b", providerCode: "X" }, { id: "c", providerCode: "Y" }]);
    expect([...r.porId]).toEqual([["c", "code:Y"]]);
    expect(r.repetidas).toBe(2);
  });
  it("reapontamentos: a stored id that came back is itself; account must match; another day or amount is a divergence", () => {
    const g = { transaction_id: "o", conta_id: "c1", provedor_ref: "code:X", transaction_date: DIA, amount: 20, ids_anteriores: ["m"] };
    const n = { ...g, transaction_id: "n" };
    expect(reapontamentos([n], [g], new Set(["n"]))).toEqual({ reapontar: [{ de: "o", para: "n", anteriores: ["m", "o"] }], divergentes: [] });
    expect(reapontamentos([n], [g], new Set(["n", "o"])).reapontar).toEqual([]);
    expect(reapontamentos([{ ...n, conta_id: "c2" }], [g], new Set())).toEqual({ reapontar: [], divergentes: [] });
    expect(reapontamentos([{ ...n, amount: 21 }], [g], new Set()).divergentes).toEqual([{ novo: { ...n, amount: 21 }, guardado: g }]);
  });
  it("only Mercado Pago is on the proven list", () => {
    expect(bancoComReferencia("Mercado Pago")).toBe(true);
    for (const outro of ["Nubank", "Inter", "PagBank", "InfinitePay", "Itaú", null]) expect(bancoComReferencia(outro)).toBe(false);
  });
});
