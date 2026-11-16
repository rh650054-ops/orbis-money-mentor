// The read-only checker of stored bank entries against Pluggy (16/11/2026): what evidence it
// produces for each pair, what it calls proven, and everything it must leave as ambiguous.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { conferirConexao, conferirDia, type DoExtrato, type Guardada, linhaDoExtrato, MAX_PERGUNTAS, type Portas } from "../../supabase/functions/_shared/pluggy-conferencia";
import { importarEntradas } from "../../supabase/functions/_shared/pluggy-entradas";
import { type Existe, impressao } from "../../supabase/functions/_shared/pluggy-margem";

const DIA = "2026-11-09";
const CON = "0e3796e0-1111-4111-8111-111111111111";
const CONTA = "c0c0c0c0-2222-4222-8222-222222222222";
const CEDO = "2026-11-09T15:00:00.000Z";   // the day itself
const TARDE = "2026-11-12T22:10:00.000Z";  // day + 3: when that day was the oldest of the window
const g = (id: string, amount: number, criada: string, extra: Partial<Guardada> = {}): Guardada => ({
  transaction_id: id, amount, description: "Transferência PIX recebida", transaction_date: DIA, transacted_at: `${DIA}T03:00:00.000Z`,
  is_pix: true, pagador_nome: null, pagador_doc: null, status: "pending", daily_sale_id: null, created_at: criada, ...extra,
});
const e = (id: string, amount: number, code: string, extra: Partial<DoExtrato> = {}): DoExtrato => ({
  id, conta: CONTA, ref: { tipo: "providerCode", valor: code }, amount, description: "Transferência PIX recebida", transaction_date: DIA,
  transacted_at: `${DIA}T03:00:00.000Z`, is_pix: true, pagador_nome: null, pagador_doc: null, ...extra,
});
const dia = (guardadas: Guardada[], extrato: DoExtrato[], o: { existe?: Record<string, Existe>; completo?: boolean; contas?: string[]; revisao?: string[] | null } = {}) =>
  conferirDia({
    conexao: CON, dia: DIA, guardadas, extrato, extratoCompleto: o.completo ?? true, contas: o.contas ?? [CONTA],
    existe: new Map(Object.entries(o.existe ?? {})), comRevisao: o.revisao === null ? null : new Set(o.revisao ?? []),
  });
const mortos = (...ids: string[]) => Object.fromEntries(ids.map((id) => [id, "nao_existe" as Existe]));

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("a pair proven by id: the old id is gone, the current one is listed, and the count matches", () => {
  const guardadas = [g("a1", 20, CEDO), g("a2", 20, CEDO), g("a3", 30, CEDO), g("b1", 20, TARDE), g("b2", 20, TARDE), g("b3", 30, TARDE)];
  const extrato = [e("b1", 20, "PROV-AAA"), e("b2", 20, "PROV-BBB"), e("b3", 30, "PROV-CCC")];
  const r = dia(guardadas, extrato, { existe: mortos("a1", "a2", "a3") });

  it("three real payments stored six times: three pairs, the dead ids go, the listed ones stay", () => {
    expect(r.pares.map((p) => [p.sai.transaction_id, p.classe]).sort()).toEqual([["a1", "comprovada_por_id"], ["a2", "comprovada_por_id"], ["a3", "comprovada_por_id"]]);
    expect(r.pares.every((p) => ["b1", "b2", "b3"].includes(p.fica.transaction_id) && p.fica.na_pluggy === "listada" && p.sai.na_pluggy === "nao_existe")).toBe(true);
    expect(r.resumo).toMatchObject({ guardadas: 6, no_extrato: 3, comprovadas_por_id: 3, valor_por_id: 70, ambiguas: 0, faltando: 0 });
  });
  it("every item of evidence asked for is in each pair", () => {
    const p = r.pares.find((x) => x.sai.transaction_id === "a3");
    expect(p).toMatchObject({
      conexao: "0e3796e0", conta: "c0c0c0c0", dia: DIA, valor: 30,
      sai: { criada_em: CEDO, na_pluggy: "nao_existe" }, fica: { transaction_id: "b3", criada_em: TARDE, na_pluggy: "listada" },
      contagem: { guardadas: 2, no_extrato: 1 },
      condicoes: { conta_identificada: true, atributos_iguais: true, copia_tardia: true, sai_nao_existe: true, fica_existe: true, contagem_confere: true, nao_usada: true },
      motivos: [],
    });
    expect(p?.fica.referencia).toMatchObject({ tipo: "providerCode" });
  });
  it("the report never carries a reference in full, a description, a name or a document", () => {
    const comPagador = dia(
      [g("a1", 20, CEDO, { pagador_nome: "Fulano de Tal", pagador_doc: "12345678901" }), g("b1", 20, TARDE, { pagador_nome: "Fulano de Tal", pagador_doc: "12345678901" })],
      [e("b1", 20, "PROV-AAA", { pagador_nome: "Fulano de Tal", pagador_doc: "12345678901" })], { existe: mortos("a1") });
    const texto = JSON.stringify([r, comPagador]);
    for (const proibido of ["PROV-AAA", "PROV-BBB", "Transferência", "Fulano", "12345678901", CONTA, CON]) expect(texto).not.toContain(proibido);
    expect(comPagador.pares[0]?.classe).toBe("comprovada_por_id");
  });
});

describe("a 404 alone approves nothing", () => {
  it("one stored id is gone, but the statement lists as many payments as are stored: no pair at all", () => {
    const r = dia([g("a1", 20, CEDO), g("a2", 20, TARDE)], [e("a2", 20, "X1"), e("zz", 20, "X2")], { existe: mortos("a1") });
    expect(r.pares).toEqual([]);
    expect(r.resumo).toMatchObject({ guardadas: 2, no_extrato: 2, faltando: 0 });
  });
  it("gone, identical to a listed one, but the statement did not come whole: ambiguous", () => {
    const r = dia([g("a1", 20, CEDO), g("b1", 20, TARDE)], [e("b1", 20, "X1")], { existe: mortos("a1"), completo: false });
    expect(r.pares[0]).toMatchObject({ classe: "ambigua", motivos: ["contagem_confere"] });
  });
  it("gone, but nothing like it is in the statement: nothing to compare with, no pair", () => {
    const r = dia([g("a1", 20, CEDO), g("a2", 20, TARDE)], [], { existe: mortos("a1", "a2") });
    expect(r.pares).toEqual([]);
    expect(r.resumo.sem_extrato).toBe(2);
  });
  it("gone and in excess, but no entry of the pair was created late: not the known mechanism, ambiguous", () => {
    const r = dia([g("a1", 20, CEDO), g("b1", 20, "2026-11-10T02:00:00.000Z")], [e("b1", 20, "X1")], { existe: mortos("a1") });
    expect(r.pares[0]).toMatchObject({ classe: "ambigua", motivos: ["copia_tardia"] });
  });
});

describe("what keeps a pair ambiguous", () => {
  const extrato = [e("b1", 20, "X1")];
  it("Pluggy did not answer about the id that would go", () => {
    expect(dia([g("a1", 20, CEDO), g("b1", 20, TARDE)], extrato, { existe: { a1: "sem_resposta" } }).pares[0]).toMatchObject({ classe: "ambigua", motivos: ["sai_nao_existe"] });
    expect(dia([g("a1", 20, CEDO), g("b1", 20, TARDE)], extrato).pares[0]?.motivos).toEqual(["sai_nao_existe"]); // never asked = no answer
  });
  it("the id that would go still exists at Pluggy (only missing from the list)", () => {
    const r = dia([g("a1", 20, CEDO), g("b1", 20, TARDE)], extrato, { existe: { a1: "existe" } });
    expect(r.pares[0]).toMatchObject({ classe: "ambigua", motivos: ["sai_nao_existe"] });
  });
  it("an entry the seller used stays; when every extra one was used, the pair is ambiguous", () => {
    const usada = dia([g("a1", 20, CEDO, { status: "ignored" }), g("b1", 20, TARDE)], extrato, { existe: mortos("a1") });
    expect(usada.pares[0]).toMatchObject({ sai: { transaction_id: "a1" }, classe: "ambigua", motivos: ["nao_usada"] });
    const ligada = dia([g("a1", 20, CEDO, { daily_sale_id: "venda-1" }), g("b1", 20, TARDE)], extrato, { existe: mortos("a1") });
    expect(ligada.pares[0]?.motivos).toEqual(["nao_usada"]);
    const decidida = dia([g("a1", 20, CEDO), g("b1", 20, TARDE)], extrato, { existe: mortos("a1"), revisao: ["a1"] });
    expect(decidida.pares[0]?.motivos).toEqual(["nao_usada"]);
  });
  it("the review decisions could not be read: every entry counts as used", () => {
    expect(dia([g("a1", 20, CEDO), g("b1", 20, TARDE)], extrato, { existe: mortos("a1"), revisao: null }).pares[0]?.motivos).toEqual(["nao_usada"]);
  });
  it("two accounts in the connection and a row stored without its account: the account cannot be proven", () => {
    const r = dia([g("a1", 20, CEDO), g("b1", 20, TARDE)], extrato, { existe: mortos("a1"), contas: [CONTA, "outra-conta"] });
    expect(r.pares[0]).toMatchObject({ classe: "ambigua", motivos: ["conta_identificada"] });
    const comConta = dia([g("a1", 20, CEDO, { conta_id: CONTA }), g("b1", 20, TARDE)], extrato, { existe: mortos("a1"), contas: [CONTA, "outra-conta"] });
    expect(comConta.pares[0]?.classe).toBe("comprovada_por_id");
    const deOutra = dia([g("a1", 20, CEDO, { conta_id: "outra-conta" }), g("b1", 20, TARDE)], extrato, { existe: mortos("a1"), contas: [CONTA, "outra-conta"] });
    expect(deOutra.pares[0]?.motivos).toEqual(["conta_identificada"]);
  });
});

describe("real payments are never paired", () => {
  it("another description, another instant or another payer is another group", () => {
    const r = dia(
      [g("a1", 20, CEDO), g("a2", 20, TARDE, { description: "Venda: Produto" }), g("a3", 20, TARDE, { transacted_at: `${DIA}T21:28:14.000Z` }), g("a4", 20, TARDE, { pagador_doc: "999" })],
      [e("a1", 20, "X1")], { existe: mortos("a2", "a3", "a4") });
    expect(r.pares).toEqual([]);
    expect(r.resumo.sem_extrato).toBe(3);
  });
  it("ten Pix of R$ 20 stored and ten listed: nothing, whatever their ids", () => {
    const dez = Array.from({ length: 10 }, (_, i) => g(`a${i}`, 20, i < 5 ? CEDO : TARDE));
    const r = dia(dez, Array.from({ length: 10 }, (_, i) => e(`n${i}`, 20, `K${i}`)), { existe: mortos(...dez.map((x) => x.transaction_id)) });
    expect(r.pares).toEqual([]);
  });
  it("the statement lists a payment that is NOT stored: reported as missing, never compensated by a copy elsewhere", () => {
    const r = dia([g("a1", 20, CEDO), g("b1", 20, TARDE), g("c1", 30, CEDO)], [e("b1", 20, "X1"), e("c1", 30, "X2"), e("c2", 30, "X3")], { existe: mortos("a1") });
    expect(r.resumo).toMatchObject({ comprovadas_por_id: 1, faltando: 1 });
  });
});

describe("every stored id is gone (re-issued again after the day left the window): only the count is left", () => {
  const guardadas = [g("a1", 20, CEDO), g("a2", 20, CEDO), g("b1", 20, TARDE), g("b2", 20, TARDE)];
  it("Pluggy lists two under other ids: the two created late go, the two oldest stay — a class of its own", () => {
    const r = dia(guardadas, [e("n1", 20, "X1"), e("n2", 20, "X2")], { existe: mortos("a1", "a2", "b1", "b2") });
    expect(r.pares.map((p) => [p.sai.transaction_id, p.fica.transaction_id, p.classe]).sort()).toEqual([["b1", "a1", "comprovada_por_contagem"], ["b2", "a2", "comprovada_por_contagem"]]);
    expect(r.pares[0]?.condicoes).toMatchObject({ sai_nao_existe: true, fica_existe: false, contagem_confere: true });
    expect(r.resumo).toMatchObject({ comprovadas_por_id: 0, comprovadas_por_contagem: 2, valor_por_contagem: 40 });
  });
  it("if Pluggy was not sure about the id that stays, it is ambiguous", () => {
    const r = dia(guardadas, [e("n1", 20, "X1"), e("n2", 20, "X2")], { existe: { ...mortos("b1", "b2", "a1"), a2: "sem_resposta" } });
    expect(r.pares.map((p) => p.classe).sort()).toEqual(["ambigua", "comprovada_por_contagem"]);
  });
});

const paresDe = (r: unknown) => (r as { pares?: { classe: string }[] }).pares ?? [];

describe("the whole call", () => {
  const portas = (o: Partial<Portas> & { perguntas?: string[]; janelas?: string[] } = {}): Portas => ({
    conexao: async () => ({ id: CON, item_id: "item-1", institution_name: "Mercado Pago" }),
    contas: async () => [CONTA],
    extrato: async (_c, de, ate) => { o.janelas?.push(`${de}..${ate}`); return { txs: [e("b1", 20, "X1")], completo: true }; },
    guardadas: async () => [g("a1", 20, CEDO), g("b1", 20, TARDE)],
    comRevisao: async () => new Set<string>(),
    existe: async (id) => { o.perguntas?.push(id); return "nao_existe"; },
    ...o,
  });
  it("asks Pluggy one day before and after, asks one by one only about ids it did not list, and reports the pair", async () => {
    const perguntas: string[] = []; const janelas: string[] = [];
    const r = await conferirConexao(portas({ perguntas, janelas }), { conexao: CON, de: DIA, ate: DIA });
    expect(janelas).toEqual(["2026-11-08..2026-11-10"]);
    expect(perguntas).toEqual(["a1"]);
    expect(r).toMatchObject({ conexao: "0e3796e0", contas: 1, extrato_completo: true, perguntadas_por_id: 1, revisoes_lidas: true });
    expect(paresDe(r)[0]?.classe).toBe("comprovada_por_id");
  });
  it("refuses a malformed request or more than 7 days", async () => {
    for (const pedido of [{}, { conexao: "x", de: DIA, ate: DIA }, { conexao: CON, de: "09/11", ate: DIA }, { conexao: CON, de: DIA, ate: "2026-11-08" }, { conexao: CON, de: DIA, ate: "2026-11-16" }]) {
      expect(await conferirConexao(portas(), pedido)).toMatchObject({ erro: "pedido_invalido" });
    }
    expect(await conferirConexao(portas(), { conexao: CON, de: DIA, ate: "2026-11-15" })).not.toHaveProperty("erro");
  });
  it("a failed read is an error, never an empty report", async () => {
    expect(await conferirConexao(portas({ conexao: async () => null }), { conexao: CON, de: DIA, ate: DIA })).toMatchObject({ erro: "conexao_nao_encontrada" });
    expect(await conferirConexao(portas({ contas: async () => null }), { conexao: CON, de: DIA, ate: DIA })).toMatchObject({ erro: "leitura_falhou" });
    expect(await conferirConexao(portas({ guardadas: async () => null }), { conexao: CON, de: DIA, ate: DIA })).toMatchObject({ erro: "leitura_falhou" });
  });
  it("beyond the limit of questions the rest has no answer, so it is ambiguous — and the report says the limit was hit", async () => {
    const muitas = Array.from({ length: MAX_PERGUNTAS + 3 }, (_, i) => g(`a${i}`, 20, CEDO));
    const r = await conferirConexao(portas({ guardadas: async () => [...muitas, g("b1", 20, TARDE)] }), { conexao: CON, de: DIA, ate: DIA });
    expect(r).toMatchObject({ perguntadas_por_id: MAX_PERGUNTAS, limite_de_perguntas_atingido: true });
    expect(paresDe(r).filter((p) => p.classe === "ambigua")).toHaveLength(3);
  });
});

describe("read-only, by construction", () => {
  const fonte = (f: string) => readFileSync(join(process.cwd(), "supabase/functions", f), "utf8");
  it("neither file can write to the database or send anything but a GET to Pluggy", () => {
    for (const f of ["pluggy-conferir/index.ts", "_shared/pluggy-conferencia.ts"]) {
      const codigo = fonte(f).split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");
      for (const proibido of [".insert(", ".update(", ".upsert(", ".delete(", ".rpc(", "method:", "PATCH", "importarEntradas", "pedirAtualizacao"]) {
        expect(codigo, `${f} must not contain ${proibido}`).not.toContain(proibido);
      }
    }
  });
  it("the function is gated by the cron token before anything else is read", () => {
    const codigo = fonte("pluggy-conferir/index.ts");
    expect(codigo.indexOf("nao_autorizado")).toBeGreaterThan(0);
    expect(codigo.indexOf("nao_autorizado")).toBeLessThan(codigo.indexOf("pluggyKey()"));
  });
});

describe("the checker sees a Pluggy transaction exactly as the importer stores it", () => {
  it("same fingerprint on both sides, for a dateless Mercado Pago Pix and for an entry with time and payer", async () => {
    const txs = [
      { id: "t1", type: "CREDIT", amount: 20, date: `${DIA}T03:00:00.000Z`, description: "Transferência PIX recebida", providerCode: "K1" },
      { id: "t2", type: "CREDIT", amount: 19.85, date: `${DIA}T21:28:14.000Z`, description: "Pix recebido Fulano", providerId: "900",
        paymentData: { paymentMethod: "PIX", payer: { name: "Fulano de Tal", documentNumber: { value: "123.456.789-01" } } } },
    ];
    const gravadas: Record<string, unknown>[] = [];
    const tabela = (nome: string): unknown => new Proxy({}, { get: (_alvo, chave) => {
      if (chave === "then") return (res: (r: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(res);
      if (chave === "maybeSingle") return () => Promise.resolve({ data: nome === "bank_connections" ? { institution_name: "Mercado Pago" } : { cpf: "" }, error: null });
      if (chave === "upsert") return (linhas: Record<string, unknown>[]) => { if (nome === "auto_detected_sales") gravadas.push(...linhas); return Promise.resolve({ error: null }); };
      return () => tabela(nome);
    } });
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-11-10T15:00:00Z"));
    vi.spyOn(console, "log").mockImplementation(() => {}); vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      const corpo = String(url).includes("/accounts") ? { results: [{ id: CONTA, type: "BANK" }] } : { results: txs, next: null };
      return { ok: true, status: 200, json: async () => corpo, text: async () => "" } as unknown as Response;
    }));
    await importarEntradas({ from: tabela }, "chave", "item-1", "vendedor-1", CON, 2);
    vi.useRealTimers();
    expect(gravadas).toHaveLength(2);
    for (const t of txs) {
      const guardada = gravadas.find((x) => x.transaction_id === t.id) as unknown as Guardada;
      const lida = linhaDoExtrato(t, CONTA, 0);
      expect(impressao({ ...lida, transaction_id: lida.id })).toBe(impressao(guardada));
    }
  });
});
