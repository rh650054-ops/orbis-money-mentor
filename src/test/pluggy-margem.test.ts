import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { chaveSumida, importarEntradas } from "../../supabase/functions/_shared/pluggy-entradas";
import { contaNaMargem, guardadasPorChave, novasQueCabem } from "../../supabase/functions/_shared/pluggy-margem";

const k = (dia: string, v: number) => chaveSumida(dia, v);
const nova = (id: string, dia: string, v: number) => ({ transaction_id: id, chave: k(dia, v) });

describe("novasQueCabem: the window's oldest day never stores a re-issued twin", () => {
  const D = "2026-11-09";

  it("ids re-issued with the same count: none is written", () => {
    const guardadas = new Map([[k(D, 20), 3]]);
    const vistos = new Map([[k(D, 20), 3]]);
    expect(novasQueCabem([nova("b1", D, 20), nova("b2", D, 20), nova("b3", D, 20)], guardadas, vistos)).toEqual([]);
  });

  it("one really new entry among ids that did not change: that one is written", () => {
    const guardadas = new Map([[k(D, 20), 2]]);
    const vistos = new Map([[k(D, 20), 3]]); // the 2 stored came back with their ids, plus 1
    expect(novasQueCabem([nova("n1", D, 20)], guardadas, vistos)).toEqual(["n1"]);
  });

  it("re-issue AND one late entry together: the day grows by exactly one", () => {
    const guardadas = new Map([[k(D, 15), 2]]);
    const vistos = new Map([[k(D, 15), 3]]);
    expect(novasQueCabem([nova("b1", D, 15), nova("b2", D, 15), nova("b3", D, 15)], guardadas, vistos)).toHaveLength(1);
  });

  it("nothing stored for that day+amount (first import): everything is written", () => {
    const vistos = new Map([[k(D, 10), 2], [k(D, 35.34), 1]]);
    expect(novasQueCabem([nova("a", D, 10), nova("b", D, 10), nova("c", D, 35.34)], new Map(), vistos)).toEqual(["a", "b", "c"]);
  });

  it("Pluggy returned fewer than stored (partial list): none is written", () => {
    const guardadas = new Map([[k(D, 20), 5]]);
    const vistos = new Map([[k(D, 20), 2]]);
    expect(novasQueCabem([nova("b1", D, 20), nova("b2", D, 20)], guardadas, vistos)).toEqual([]);
  });

  it("amounts are judged one by one", () => {
    const guardadas = new Map([[k(D, 20), 1]]);
    const vistos = new Map([[k(D, 20), 1], [k(D, 30), 1]]);
    expect(novasQueCabem([nova("b20", D, 20), nova("n30", D, 30)], guardadas, vistos)).toEqual(["n30"]);
  });
});

describe("contaNaMargem: only what Pluggy could have returned stands in the place of a returned entry", () => {
  const D = "2026-11-09";
  it("a date-only entry and an ordinary bank's entry of that day always count", () => {
    expect(contaNaMargem({ transacted_at: null }, D, 0)).toBe(true);
    expect(contaNaMargem({ transacted_at: "2026-11-09T03:00:00Z" }, D, 0)).toBe(true); // Mercado Pago: midnight in Brasília
    expect(contaNaMargem({ transacted_at: "2026-11-09T15:20:00Z" }, D, 0)).toBe(true);
  });
  it("PagBank stamps 6h early: a 00:41 Pix of that day was outside the asked window and does not count", () => {
    // stored (already shifted) 00:41 BRT = 03:41Z; PagBank had sent it as 21:41Z of the day before
    expect(contaNaMargem({ transacted_at: "2026-11-09T03:41:00Z" }, D, 6)).toBe(false);
    expect(contaNaMargem({ transacted_at: "2026-11-09T12:00:00Z" }, D, 6)).toBe(true);
  });
  it("guardadasPorChave leaves the not-expected ones out of the count", () => {
    const g = [
      { chave: k(D, 20), transacted_at: "2026-11-09T03:41:00Z" },
      { chave: k(D, 20), transacted_at: "2026-11-09T14:00:00Z" },
    ];
    expect(guardadasPorChave(g, D, 6).get(k(D, 20))).toBe(1);
    expect(guardadasPorChave(g, D, 0).get(k(D, 20))).toBe(2);
  });
});

/* ---- the whole importer, against a table in memory and a fake Pluggy ---- */
type Linha = Record<string, unknown> & { transaction_id: string; transaction_date: string; amount: number; bank_connection_id: string };

function bancoFalso(opts: { falharLeituraDoDia?: boolean } = {}) {
  const entradas: Linha[] = [];
  const from = (tabela: string) => {
    const filtros: ((r: Linha) => boolean)[] = [];
    let op: "select" | "delete" | "update" = "select";
    let leuDia = false;
    const q = {
      select: () => q,
      update: () => { op = "update"; return q; },
      delete: () => { op = "delete"; return q; },
      eq: (c: string, v: unknown) => { if (c === "transaction_date") leuDia = true; filtros.push((r) => String(r[c] ?? (c === "status" ? "pending" : "")) === String(v)); return q; },
      gt: (c: string, v: string) => { filtros.push((r) => String(r[c]) > v); return q; },
      in: (c: string, v: string[]) => { filtros.push((r) => v.includes(String(r[c]))); return q; },
      maybeSingle: () => Promise.resolve({ data: tabela === "bank_connections" ? { institution_name: "Mercado Pago" } : { cpf: "" }, error: null }),
      upsert: (linhas: Linha[]) => {
        for (const l of linhas) {
          const i = entradas.findIndex((e) => e.transaction_id === l.transaction_id);
          if (i >= 0) entradas[i] = { ...entradas[i], ...l }; else entradas.push({ ...l });
        }
        return Promise.resolve({ error: null });
      },
      then(res: (r: { data: unknown; error: unknown }) => unknown) {
        if (tabela !== "auto_detected_sales") return Promise.resolve({ data: null, error: null }).then(res);
        if (op === "select" && leuDia && opts.falharLeituraDoDia) return Promise.resolve({ data: null, error: { message: "timeout" } }).then(res);
        const alvo = entradas.filter((r) => filtros.every((f) => f(r)));
        if (op === "delete") for (const a of alvo) entradas.splice(entradas.indexOf(a), 1);
        return Promise.resolve({ data: alvo.map((a) => ({ ...a })), error: null }).then(res);
      },
    };
    return q;
  };
  const doDia = (dia: string) => entradas.filter((e) => e.transaction_date === dia);
  const total = (dia: string) => Math.round(doDia(dia).reduce((s, e) => s + e.amount, 0) * 100) / 100;
  return { admin: { from }, entradas, doDia, total };
}

type Tx = { id: string; amount: number; date: string };
const tx = (id: string, amount: number, dia: string): Tx => ({ id, amount, date: `${dia}T03:00:00.000Z` }); // Mercado Pago: midnight in Brasília
function pluggyDevolve(txs: Tx[]) {
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    const corpo = String(url).includes("/accounts")
      ? { results: [{ id: "conta-1", type: "BANK" }] }
      : { results: txs.map((t) => ({ ...t, type: "CREDIT", description: "Transferência PIX recebida" })) };
    return { ok: true, status: 200, json: async () => corpo, text: async () => "" } as unknown as Response;
  }));
}
const ler = (admin: unknown, dias = 2) => importarEntradas(admin, "chave", "item-1", "vendedor-1", "con-1", dias);

describe("importarEntradas: Mercado Pago re-issues the ids of a past day (production, 12-13/11/2026)", () => {
  beforeEach(() => { vi.useFakeTimers(); vi.spyOn(console, "log").mockImplementation(() => {}); });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

  const dia9 = (p: string) => [tx(`${p}1`, 14.99, "2026-11-09"), tx(`${p}2`, 20, "2026-11-09"), tx(`${p}3`, 20, "2026-11-09"), tx(`${p}4`, 30, "2026-11-09")];

  it("the day that reaches the edge of the window keeps its total when every id comes back new", async () => {
    const b = bancoFalso();
    vi.setSystemTime(new Date("2026-11-11T15:00:00Z")); // window starts 08/11: day 09 is inside it
    pluggyDevolve(dia9("a"));
    await ler(b.admin);
    expect(b.doDia("2026-11-09")).toHaveLength(4);
    expect(b.total("2026-11-09")).toBe(84.99);

    vi.setSystemTime(new Date("2026-11-13T01:10:00Z")); // 12/11 22:10 in Brasília: window starts 09/11
    pluggyDevolve(dia9("b")); // same Pix, new ids, no transactions/deleted
    await ler(b.admin);
    expect(b.doDia("2026-11-09")).toHaveLength(4); // before the fix: 8
    expect(b.total("2026-11-09")).toBe(84.99);     // before the fix: 169.98
  });

  it("inside the window nothing changes: the old twin still goes and the new id stays", async () => {
    const b = bancoFalso();
    vi.setSystemTime(new Date("2026-11-11T15:00:00Z"));
    pluggyDevolve(dia9("a"));
    await ler(b.admin);
    vi.setSystemTime(new Date("2026-11-12T02:00:00Z")); // 11/11 23:00 in Brasília: window still starts 08/11
    pluggyDevolve(dia9("b"));
    await ler(b.admin);
    expect(b.doDia("2026-11-09").map((e) => e.transaction_id).sort()).toEqual(["b1", "b2", "b3", "b4"]);
  });

  it("a Pix that really arrives late on the oldest day is still stored", async () => {
    const b = bancoFalso();
    vi.setSystemTime(new Date("2026-11-11T15:00:00Z"));
    pluggyDevolve(dia9("a"));
    await ler(b.admin);
    vi.setSystemTime(new Date("2026-11-13T01:10:00Z"));
    pluggyDevolve([...dia9("a"), tx("tardio", 20, "2026-11-09")]); // ids unchanged + one more of R$ 20
    await ler(b.admin);
    expect(b.doDia("2026-11-09")).toHaveLength(5);
    expect(b.total("2026-11-09")).toBe(104.99);
  });

  it("re-issued ids plus one late Pix: the day grows by that one only", async () => {
    const b = bancoFalso();
    vi.setSystemTime(new Date("2026-11-11T15:00:00Z"));
    pluggyDevolve(dia9("a"));
    await ler(b.admin);
    vi.setSystemTime(new Date("2026-11-13T01:10:00Z"));
    pluggyDevolve([...dia9("b"), tx("b5", 20, "2026-11-09")]);
    await ler(b.admin);
    expect(b.doDia("2026-11-09")).toHaveLength(5);
    expect(b.total("2026-11-09")).toBe(104.99);
  });

  it("first import: the oldest day comes in whole", async () => {
    const b = bancoFalso();
    vi.setSystemTime(new Date("2026-11-13T01:10:00Z"));
    pluggyDevolve([...dia9("a"), tx("x", 12, "2026-11-11")]);
    const r = await ler(b.admin);
    expect(b.doDia("2026-11-09")).toHaveLength(4);
    expect(r.gravadas).toBe(5);
  });

  it("when what is stored cannot be read, everything is written (an entry is never lost)", async () => {
    const b = bancoFalso({ falharLeituraDoDia: true });
    vi.setSystemTime(new Date("2026-11-13T01:10:00Z"));
    pluggyDevolve(dia9("a"));
    await ler(b.admin);
    expect(b.doDia("2026-11-09")).toHaveLength(4);
  });
});
