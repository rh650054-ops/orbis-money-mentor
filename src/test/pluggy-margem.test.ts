// The oldest day of a read window: a returned id that is not stored yet is a payment, a re-issue
// or — without an answer from Pluggy — a case to check again. Nothing is decided by day+amount.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { importarEntradas, MAX_CONFERIR } from "../../supabase/functions/_shared/pluggy-entradas";
import { contaNaMargem, impressao, parearComSumidas, vereditoDoPar, type EntradaDaMargem } from "../../supabase/functions/_shared/pluggy-margem";
import { carimboDeLeitura } from "../../supabase/functions/_shared/pluggy-cobertura";

const D = "2026-11-09";
const e = (id: string, amount: number, extra: Partial<EntradaDaMargem> = {}): EntradaDaMargem => ({
  transaction_id: id, amount, description: "Transferência PIX recebida", transaction_date: D,
  transacted_at: `${D}T03:00:00.000Z`, is_pix: true, pagador_nome: null, pagador_doc: null, ...extra,
});

describe("impressao: every stored attribute, never only day and amount", () => {
  it("same day and amount from different payers are different entries", () => {
    expect(impressao(e("a", 20, { pagador_doc: "11111111111" }))).not.toBe(impressao(e("b", 20, { pagador_doc: "22222222222" })));
    expect(impressao(e("a", 20, { pagador_nome: "Ana" }))).not.toBe(impressao(e("b", 20, { pagador_nome: "Bia" })));
  });
  it("same day and amount at different times are different entries", () => {
    expect(impressao(e("a", 19.85, { transacted_at: `${D}T21:28:14Z` }))).not.toBe(impressao(e("b", 19.85, { transacted_at: `${D}T21:30:07Z` })));
  });
  it("a different description or kind is a different entry", () => {
    expect(impressao(e("a", 20))).not.toBe(impressao(e("b", 20, { description: "Venda: Produto" })));
    expect(impressao(e("a", 20))).not.toBe(impressao(e("b", 20, { is_pix: false })));
  });
  it("identical attributes under another id compare equal (the only case that is ever asked of Pluggy)", () => {
    expect(impressao(e("a", 20))).toBe(impressao(e("b", 20)));
  });
});

describe("parearComSumidas: a new id is only suspect when its exact twin is MISSING from the read", () => {
  it("two payments of the same amount on the same day, the stored one came back: the new one is a payment", () => {
    const r = parearComSumidas([e("n2", 20)], [e("o1", 20)], new Set(["o1", "n2"]), D, 0);
    expect(r).toEqual({ legitimas: ["n2"], pares: [] });
  });
  it("same amount and day, different payer, the stored one missing: still a payment, never paired", () => {
    const r = parearComSumidas([e("n", 20, { pagador_doc: "22222222222" })], [e("o", 20, { pagador_doc: "11111111111" })], new Set(["n"]), D, 0);
    expect(r).toEqual({ legitimas: ["n"], pares: [] });
  });
  it("identical attributes and the stored one missing: tied to that one id, to be asked", () => {
    expect(parearComSumidas([e("n", 20)], [e("o", 20)], new Set(["n"]), D, 0)).toEqual({ legitimas: [], pares: [{ nova: "n", antiga: "o" }] });
  });
  it("three new, two missing twins: two pairs and one payment", () => {
    const r = parearComSumidas([e("n1", 20), e("n2", 20), e("n3", 20)], [e("o1", 20), e("o2", 20)], new Set(["n1", "n2", "n3"]), D, 0);
    expect(r.pares).toHaveLength(2);
    expect(r.legitimas).toEqual(["n3"]);
  });
  it("PagBank stamps 6h early: a stored 00:41 Pix was not asked for and is never taken for a twin", () => {
    const madrugada = { transacted_at: `${D}T03:41:00Z` };
    expect(contaNaMargem(madrugada, D, 6)).toBe(false);
    expect(contaNaMargem(madrugada, D, 0)).toBe(true);
    expect(parearComSumidas([e("n", 20, madrugada)], [e("o", 20, madrugada)], new Set(["n"]), D, 6)).toEqual({ legitimas: ["n"], pares: [] });
  });
});

describe("vereditoDoPar: only Pluggy's explicit answer about the old id decides", () => {
  it("gone = re-issue, still there = two payments, no answer = check again", () => {
    expect(vereditoDoPar("nao_existe")).toBe("duplicada");
    expect(vereditoDoPar("existe")).toBe("legitima");
    expect(vereditoDoPar("sem_resposta")).toBe("a_conferir");
  });
});

/* ---- the whole importer, against a table in memory and a fake Pluggy ---- */
type Linha = Record<string, unknown> & { transaction_id: string; transaction_date: string; amount: number; bank_connection_id: string };

function bancoFalso() {
  const entradas: Linha[] = [];
  const falhar = { leituraDoDia: false, upsert: false };
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
        if (falhar.upsert) return Promise.resolve({ error: { message: "timeout" } });
        for (const l of linhas) {
          const i = entradas.findIndex((x) => x.transaction_id === l.transaction_id);
          if (i >= 0) entradas[i] = { ...entradas[i], ...l }; else entradas.push({ ...l });
        }
        return Promise.resolve({ error: null });
      },
      then(res: (r: { data: unknown; error: unknown }) => unknown) {
        if (tabela !== "auto_detected_sales") return Promise.resolve({ data: null, error: null }).then(res);
        if (op === "select" && leuDia && falhar.leituraDoDia) return Promise.resolve({ data: null, error: { message: "timeout" } }).then(res);
        const alvo = entradas.filter((r) => filtros.every((f) => f(r)));
        if (op === "delete") for (const a of alvo) entradas.splice(entradas.indexOf(a), 1);
        return Promise.resolve({ data: alvo.map((a) => ({ ...a })), error: null }).then(res);
      },
    };
    return q;
  };
  const doDia = (dia: string, con = "con-1") => entradas.filter((x) => x.transaction_date === dia && x.bank_connection_id === con);
  const total = (dia: string, con = "con-1") => Math.round(doDia(dia, con).reduce((s, x) => s + x.amount, 0) * 100) / 100;
  return { admin: { from }, entradas, falhar, doDia, total };
}

type Tx = { id: string; amount: number; date: string; description?: string; paymentData?: unknown };
const mp = (id: string, amount: number, dia: string, description = "Transferência PIX recebida"): Tx => ({ id, amount, date: `${dia}T03:00:00.000Z`, description });
const comHora = (id: string, amount: number, quando: string, description: string): Tx => ({ id, amount, date: quando, description });

/** What Pluggy lists now, and what it answers when asked for one id. Ids in the list exist;
 *  `aindaExistem` are ids that left the list but still answer; `porIdFora` = that question fails. */
function pluggy(lista: Tx[], o: { aindaExistem?: string[]; porIdFora?: boolean } = {}) {
  const perguntados: string[] = [];
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    const u = String(url);
    const responder = (status: number, corpo: unknown) => ({ ok: status >= 200 && status < 300, status, json: async () => corpo, text: async () => "" }) as unknown as Response;
    if (u.includes("/accounts")) return responder(200, { results: [{ id: "conta-1", type: "BANK" }] });
    const porId = u.match(/api\.pluggy\.ai\/transactions\/([^/?]+)$/);
    if (porId) {
      const id = decodeURIComponent(porId[1] ?? "");
      perguntados.push(id);
      if (o.porIdFora) return responder(500, {});
      const existe = lista.some((t) => t.id === id) || (o.aindaExistem ?? []).includes(id);
      return existe ? responder(200, { id }) : responder(404, { message: "not found" });
    }
    return responder(200, { results: lista.map((t) => ({ description: "Transferência PIX recebida", ...t, type: "CREDIT" })) });
  }));
  return { perguntados };
}
const ler = (admin: unknown, con = "con-1", dias = 2) => importarEntradas(admin, "chave", "item-1", "vendedor-1", con, dias);
const NA_JANELA = new Date("2026-11-11T15:00:00Z");  // window starts 08/11
const NA_BORDA_09 = new Date("2026-11-13T01:10:00Z"); // 12/11 22:10 in Brasília: window starts 09/11
const NA_BORDA_10 = new Date("2026-11-13T04:50:00Z"); // 13/11 01:50 in Brasília: window starts 10/11

beforeEach(() => { vi.useFakeTimers(); vi.spyOn(console, "log").mockImplementation(() => {}); vi.spyOn(console, "error").mockImplementation(() => {}); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("production, 12-13/11/2026: the 37 copies are not stored again and no payment is lost", () => {
  // the real amounts of the two connection-days (ids and people are not reproduced)
  const A = [14.99, ...Array(6).fill(15), ...Array(18).fill(20), 30, 30, 30] as number[]; // 28 entries, R$ 554.99
  const B = [10, 10, 10, 10, 10, 11.99, 11.99, 12, 12];                                   // 9 entries, R$ 97.98
  const dia = (p: string, valores: number[], d: string) => valores.map((v, i) => mp(`${p}${i}`, v, d, i % 5 === 0 ? "PIX recebido de (XXXXXXXXXXX)" : "Transferência PIX recebida"));

  it("connection A, 09/11: 28 entries stay 28 (old code: 56) and the day keeps R$ 554.99 (old code: R$ 1,109.98)", async () => {
    const b = bancoFalso();
    vi.setSystemTime(NA_JANELA);
    pluggy(dia("a", A, "2026-11-09"));
    await ler(b.admin);
    expect(b.total("2026-11-09")).toBe(554.99);

    vi.setSystemTime(NA_BORDA_09);
    const p = pluggy(dia("b", A, "2026-11-09")); // every id new, no transactions/deleted; the old ids are gone
    const r = await ler(b.admin);
    expect(b.doDia("2026-11-09")).toHaveLength(28);
    expect(b.total("2026-11-09")).toBe(554.99);
    expect(r.margem).toEqual({ legitimas: 0, duplicadas: 28, aConferir: 0 });
    expect(p.perguntados).toHaveLength(28); // each verdict came from Pluggy's answer about one old id
    expect(r.completa).toBe(true);
  });

  it("connection B, 10/11: 9 entries stay 9 and the day keeps R$ 97.98", async () => {
    const b = bancoFalso();
    vi.setSystemTime(NA_JANELA);
    pluggy(dia("a", B, "2026-11-10"));
    await ler(b.admin);
    vi.setSystemTime(NA_BORDA_10);
    pluggy(dia("b", B, "2026-11-10"));
    const r = await ler(b.admin);
    expect(b.doDia("2026-11-10")).toHaveLength(9);
    expect(b.total("2026-11-10")).toBe(97.98);
    expect(r.margem.duplicadas).toBe(9);
  });

  // third case of the first report: 7 "copies" that were 7 distinct releases of money
  const jaGuardadas: [number, string][] = [[22.33, "16:50:10"], [127.05, "19:14:02"], [19.85, "21:09:41"], [19.85, "21:54:12"], [39.7, "22:03:30"], [19.85, "22:13:05"],
    [19.85, "22:15:44"], [19.85, "22:18:20"], [19.85, "22:24:51"], [37.72, "22:27:09"], [24.81, "22:34:33"], [39.7, "23:08:17"]];
  const tardias: [number, string][] = [[19.85, "16:21:57"], [24.81, "21:18:40"], [19.85, "21:28:14"], [19.85, "21:30:07"], [19.85, "21:37:10"], [19.85, "21:45:30"], [39.7, "22:05:56"]];
  const liberacoes = (p: string, itens: [number, string][]) => itens.map(([v, h], i) => comHora(`${p}${i}`, v, `2026-11-10T${h}.000Z`, "Liberação de dinheiro"));

  it("connection C, 10/11: the 7 late releases with their own times are ALL stored (they were never copies)", async () => {
    const b = bancoFalso();
    vi.setSystemTime(NA_JANELA);
    pluggy(liberacoes("g", jaGuardadas));
    await ler(b.admin);
    expect(b.doDia("2026-11-10")).toHaveLength(12);

    vi.setSystemTime(NA_BORDA_10);
    const p = pluggy([...liberacoes("g", jaGuardadas), ...liberacoes("t", tardias)]);
    const r = await ler(b.admin);
    expect(b.doDia("2026-11-10")).toHaveLength(19);
    expect(b.total("2026-11-10")).toBe(574.17);
    expect(r.margem).toEqual({ legitimas: 7, duplicadas: 0, aConferir: 0 });
    expect(p.perguntados).toHaveLength(0); // nothing was even suspect: no stored twin was missing
  });

  it("connection C with every old id re-issued at the same time: 12 re-issues out, 7 payments in", async () => {
    const b = bancoFalso();
    vi.setSystemTime(NA_JANELA);
    pluggy(liberacoes("g", jaGuardadas));
    await ler(b.admin);
    vi.setSystemTime(NA_BORDA_10);
    pluggy([...liberacoes("novo", jaGuardadas), ...liberacoes("t", tardias)]);
    const r = await ler(b.admin);
    expect(b.doDia("2026-11-10")).toHaveLength(19);
    expect(r.margem).toEqual({ legitimas: 7, duplicadas: 12, aConferir: 0 });
  });
});

describe("two different payments are never taken for one", () => {
  it("same amount, same day, no payer and no time (Mercado Pago), both on Pluggy: both stored", async () => {
    const b = bancoFalso();
    vi.setSystemTime(NA_JANELA);
    pluggy([mp("o1", 20, "2026-11-09")]);
    await ler(b.admin);
    vi.setSystemTime(NA_BORDA_09);
    pluggy([mp("o1", 20, "2026-11-09"), mp("n2", 20, "2026-11-09")]);
    const r = await ler(b.admin);
    expect(b.doDia("2026-11-09").map((x) => x.transaction_id).sort()).toEqual(["n2", "o1"]);
    expect(r.margem).toEqual({ legitimas: 1, duplicadas: 0, aConferir: 0 });
  });

  it("same amount and day from different payers, the first one missing from the list: the second is stored, the first is kept", async () => {
    const pagador = (doc: string) => ({ paymentMethod: "PIX", payer: { name: "", documentNumber: { type: "CPF", value: doc } } });
    const b = bancoFalso();
    vi.setSystemTime(NA_JANELA);
    pluggy([{ ...comHora("o1", 20, "2026-11-09T15:00:00.000Z", "Pix recebido"), paymentData: pagador("111.111.111-11") }]);
    await ler(b.admin);
    vi.setSystemTime(NA_BORDA_09);
    const p = pluggy([{ ...comHora("n2", 20, "2026-11-09T15:00:00.000Z", "Pix recebido"), paymentData: pagador("222.222.222-22") }]);
    const r = await ler(b.admin);
    expect(b.doDia("2026-11-09")).toHaveLength(2);
    expect(r.margem.legitimas).toBe(1);
    expect(p.perguntados).toHaveLength(0);
  });

  it("identical attributes, old id missing from the list but still on Pluggy: two payments, both stored", async () => {
    const b = bancoFalso();
    vi.setSystemTime(NA_JANELA);
    pluggy([mp("o1", 20, "2026-11-09")]);
    await ler(b.admin);
    vi.setSystemTime(NA_BORDA_09);
    pluggy([mp("n2", 20, "2026-11-09")], { aindaExistem: ["o1"] }); // partial list: o1 was left out, and it exists
    const r = await ler(b.admin);
    expect(b.doDia("2026-11-09")).toHaveLength(2);
    expect(r.margem).toEqual({ legitimas: 1, duplicadas: 0, aConferir: 0 });
  });
});

describe("late payments and partial lists", () => {
  const cinco = (p: string) => [1, 2, 3, 4, 5].map((i) => mp(`${p}${i}`, 20, "2026-11-09"));

  it("a payment that arrives 3 days late among ids that did not change is stored", async () => {
    const b = bancoFalso();
    vi.setSystemTime(NA_JANELA);
    pluggy(cinco("o"));
    await ler(b.admin);
    vi.setSystemTime(NA_BORDA_09);
    pluggy([...cinco("o"), mp("tardio", 20, "2026-11-09")]);
    await ler(b.admin);
    expect(b.doDia("2026-11-09")).toHaveLength(6);
  });

  it("partial list (1 of 6) carrying only the late payment, the 5 old ids still on Pluggy: stored, nothing removed", async () => {
    const b = bancoFalso();
    vi.setSystemTime(NA_JANELA);
    pluggy(cinco("o"));
    await ler(b.admin);
    vi.setSystemTime(NA_BORDA_09);
    pluggy([mp("tardio", 20, "2026-11-09")], { aindaExistem: ["o1", "o2", "o3", "o4", "o5"] });
    const r = await ler(b.admin);
    expect(b.doDia("2026-11-09")).toHaveLength(6);
    expect(r.margem.legitimas).toBe(1);
  });

  it("partial list (2 of 5) of re-issued ids: no copy stored and none of the 5 removed", async () => {
    const b = bancoFalso();
    vi.setSystemTime(NA_JANELA);
    pluggy(cinco("o"));
    await ler(b.admin);
    vi.setSystemTime(NA_BORDA_09);
    pluggy([mp("n1", 20, "2026-11-09"), mp("n2", 20, "2026-11-09")]);
    const r = await ler(b.admin);
    expect(b.doDia("2026-11-09").map((x) => x.transaction_id).sort()).toEqual(["o1", "o2", "o3", "o4", "o5"]);
    expect(r.margem).toEqual({ legitimas: 0, duplicadas: 2, aConferir: 0 });
  });

  it("re-issued ids plus one late payment: the day grows by that one only", async () => {
    const b = bancoFalso();
    vi.setSystemTime(NA_JANELA);
    pluggy(cinco("o"));
    await ler(b.admin);
    vi.setSystemTime(NA_BORDA_09);
    pluggy([...cinco("n"), mp("n6", 20, "2026-11-09")]);
    const r = await ler(b.admin);
    expect(b.doDia("2026-11-09")).toHaveLength(6);
    expect(r.margem).toEqual({ legitimas: 1, duplicadas: 5, aConferir: 0 });
  });
});

describe("no evidence, no conclusion — and no read stamp", () => {
  const item = { status: "UPDATED", lastUpdatedAt: "2026-11-13T01:09:00Z" };
  const carimbo = (completa: boolean) => carimboDeLeitura({ completa, antes: item, depois: item, atual: null });

  it("Pluggy does not answer about the old id: not stored now, counted as to-check, the read gets no stamp", async () => {
    const b = bancoFalso();
    vi.setSystemTime(NA_JANELA);
    pluggy([mp("o1", 20, "2026-11-09")]);
    await ler(b.admin);
    vi.setSystemTime(NA_BORDA_09);
    pluggy([mp("n1", 20, "2026-11-09")], { porIdFora: true });
    const r = await ler(b.admin);
    expect(b.doDia("2026-11-09").map((x) => x.transaction_id)).toEqual(["o1"]); // no copy, nothing removed
    expect(r.margem).toEqual({ legitimas: 0, duplicadas: 0, aConferir: 1 });
    expect(r.completa).toBe(false);
    expect(carimbo(r.completa)).toBeNull();

    pluggy([mp("n1", 20, "2026-11-09")], { aindaExistem: ["o1"] }); // next read: Pluggy answers, both exist
    const depois = await ler(b.admin);
    expect(b.doDia("2026-11-09")).toHaveLength(2); // the payment held back was not lost
    expect(depois.completa).toBe(true); // only now may the caller stamp the read
  });

  it("the stored entries cannot be read: nothing of that day is written, so no copy; and the read is not proven", async () => {
    const b = bancoFalso();
    vi.setSystemTime(NA_JANELA);
    pluggy([mp("o1", 20, "2026-11-09"), mp("o2", 30, "2026-11-09")]);
    await ler(b.admin);
    vi.setSystemTime(NA_BORDA_09);
    b.falhar.leituraDoDia = true;
    pluggy([mp("n1", 20, "2026-11-09"), mp("n2", 30, "2026-11-09")]);
    const r = await ler(b.admin);
    expect(b.doDia("2026-11-09")).toHaveLength(2); // old code wrote everything here: 4 rows
    expect(r.completa).toBe(false);
    expect(r.margem.aConferir).toBe(2);
    expect(carimbo(r.completa)).toBeNull();

    b.falhar.leituraDoDia = false; // next read: readable again, decided on evidence
    const depois = await ler(b.admin);
    expect(b.doDia("2026-11-09")).toHaveLength(2);
    expect(depois.margem.duplicadas).toBe(2);
    expect(depois.completa).toBe(true);
  });

  it("an entry that could not be written is never followed by a stamp (oldest day and inside the window)", async () => {
    const b = bancoFalso();
    b.falhar.upsert = true;
    vi.setSystemTime(NA_BORDA_09);
    pluggy([mp("a", 20, "2026-11-09")]);
    expect((await ler(b.admin)).completa).toBe(false);
    pluggy([mp("b", 20, "2026-11-11")]);
    expect((await ler(b.admin)).completa).toBe(false);
    expect(b.entradas).toHaveLength(0);
  });

  it(`more than ${MAX_CONFERIR} suspects in one read: the rest waits, unstamped, for the next read`, async () => {
    const muitos = (p: string) => Array.from({ length: MAX_CONFERIR + 10 }, (_, i) => mp(`${p}${i}`, 20, "2026-11-09"));
    const b = bancoFalso();
    vi.setSystemTime(NA_JANELA);
    pluggy(muitos("o"));
    await ler(b.admin);
    vi.setSystemTime(NA_BORDA_09);
    const p = pluggy(muitos("n"));
    const r = await ler(b.admin);
    expect(p.perguntados).toHaveLength(MAX_CONFERIR);
    expect(r.margem).toEqual({ legitimas: 0, duplicadas: MAX_CONFERIR, aConferir: 10 });
    expect(r.completa).toBe(false);
    expect(b.doDia("2026-11-09")).toHaveLength(MAX_CONFERIR + 10);
  });
});

describe("other accounts, other banks, the rest of the window", () => {
  it("two connections of the same bank: the other connection's entries are never taken for twins", async () => {
    const b = bancoFalso();
    vi.setSystemTime(NA_JANELA);
    pluggy([mp("x1", 20, "2026-11-09")]);
    await ler(b.admin, "con-2"); // another account of the same bank, same day and amount
    vi.setSystemTime(NA_BORDA_09);
    const p = pluggy([mp("n1", 20, "2026-11-09")]);
    const r = await ler(b.admin, "con-1");
    expect(b.doDia("2026-11-09", "con-1")).toHaveLength(1);
    expect(b.doDia("2026-11-09", "con-2")).toHaveLength(1);
    expect(r.margem.legitimas).toBe(1);
    expect(p.perguntados).toHaveLength(0);
  });

  it("a bank whose ids do not change (any bank with times): nothing is asked, nothing changes", async () => {
    const itens = [comHora("a", 50, "2026-11-09T14:00:00.000Z", "Pix recebido"), comHora("b", 50, "2026-11-09T14:00:05.000Z", "Pix recebido")];
    const b = bancoFalso();
    vi.setSystemTime(NA_JANELA);
    pluggy(itens);
    await ler(b.admin);
    vi.setSystemTime(NA_BORDA_09);
    const p = pluggy(itens);
    const r = await ler(b.admin);
    expect(b.doDia("2026-11-09")).toHaveLength(2);
    expect(r.gravadas).toBe(0);
    expect(p.perguntados).toHaveLength(0);
    expect(r.completa).toBe(true);
  });

  it("inside the window nothing changes: the old twin still goes and the new id stays", async () => {
    const b = bancoFalso();
    vi.setSystemTime(NA_JANELA);
    pluggy([mp("a1", 20, "2026-11-09"), mp("a2", 30, "2026-11-09")]);
    await ler(b.admin);
    vi.setSystemTime(new Date("2026-11-12T02:00:00Z")); // 11/11 23:00 in Brasília: window still starts 08/11
    pluggy([mp("b1", 20, "2026-11-09"), mp("b2", 30, "2026-11-09")]);
    await ler(b.admin);
    expect(b.doDia("2026-11-09").map((x) => x.transaction_id).sort()).toEqual(["b1", "b2"]);
  });

  it("first import: the oldest day comes in whole", async () => {
    const b = bancoFalso();
    vi.setSystemTime(NA_BORDA_09);
    pluggy([mp("a", 20, "2026-11-09"), mp("b", 20, "2026-11-09"), mp("x", 12, "2026-11-11")]);
    const r = await ler(b.admin);
    expect(b.entradas).toHaveLength(3);
    expect(r.completa).toBe(true);
  });
});
