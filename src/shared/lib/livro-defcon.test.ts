/* DEFCON pelo livro-razão (ADR 0001, Fase 2): a fila do celular com lançamentos de id próprio
   e um "servidor" de mentira que soma, nunca repete um id, cai e volta. */
import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const servidor = { aplicados: new Set<string>(), chamadas: [] as Record<string, unknown>[], cair: false, recusar: "" };
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: async (nome: string, args: Record<string, unknown>) => {
      servidor.chamadas.push({ nome, ...args });
      if (servidor.cair) return { data: null, error: { message: "Failed to fetch" } };
      if (servidor.recusar) return { data: null, error: { message: servidor.recusar } };
      if (nome === "defcon_redistribuir_bloco") return { data: { livro: args.p_bloco_id === "b-livro" }, error: null };
      servidor.aplicados.add(`${args.p_tipo}:${args.p_id}`);
      return { data: { aplicado: true }, error: null };
    },
    from: () => ({}),
  },
}));
vi.mock("@/utils/syncDailySales", () => ({ syncBlocksToDailySales: vi.fn() }));
vi.mock("./offline-day", () => ({ diasOfflinePendentes: () => [], marcarDiaSincronizado: vi.fn() }));

import { getUnsynced, removeOfflineRecord } from "./offline-db";
import { syncAllPendingData } from "./offline-sync";
import { contarPendentes, lerFilaDoDia } from "./fila-defcon";
import {
  aplicarLivroNosBlocos, apagarVendaDoLivro, contadoresDoLivro, guardarLancamento, lancamentosPendentes, marcarSessaoLivro,
  redistribuirBloco, usaLivro, vendasDoLivro, type Lancamento,
} from "./livro-defcon";

const base = { sessao: "s1", plano: "p1", bloco: 0, criadoEm: "2026-11-28T12:00:00.000Z" };
const l = (x: Partial<Lancamento> & Pick<Lancamento, "id" | "tipo">): Lancamento => ({ ...base, ...x });
const bloco = (x: Partial<Record<string, number>> = {}) => ({ id: "b", achieved_amount: 0, valor_dinheiro: 0, valor_cartao: 0, valor_pix: 0, valor_calote: 0, valor_gorjeta: 0, ...x });

beforeEach(async () => {
  servidor.aplicados.clear(); servidor.chamadas = []; servidor.cair = false; servidor.recusar = "";
  for (const r of await getUnsynced("pending_venda")) await removeOfflineRecord("pending_venda", r.id);
  localStorage.clear();
});

describe("which sessions are the ledger's", () => {
  it("only what the server marked, remembered on the device (to reopen without signal)", () => {
    expect(usaLivro("s1")).toBe(false);
    marcarSessaoLivro("s1", true);
    expect(usaLivro("s1")).toBe(true);
    marcarSessaoLivro("s1", false);
    expect(usaLivro("s1")).toBe(false);
    expect(usaLivro(null)).toBe(false);
  });
});

describe("the queue", () => {
  it("a sale goes up with ITS id, its product and its hour; the queue empties", async () => {
    await guardarLancamento(l({ id: "v1", tipo: "venda", valor: 10, metodo: "pix", produto: "prod", qtd: 3 }));
    await syncAllPendingData();
    expect(servidor.chamadas).toEqual([expect.objectContaining({ nome: "defcon_lancar", p_id: "v1", p_tipo: "venda", p_valor: 10, p_metodo: "pix",
      p_produto: "prod", p_qtd: 3, p_origem: "app", p_criado_em: base.criadoEm })]);
    expect(await lancamentosPendentes({ sessao: "s1" })).toEqual([]);
  });

  it("no signal: stays on the phone and goes up later with the SAME id (never a second sale)", async () => {
    servidor.cair = true;
    await guardarLancamento(l({ id: "v2", tipo: "venda", valor: 5, metodo: "dinheiro" }));
    await syncAllPendingData();
    expect(await lancamentosPendentes({ sessao: "s1" })).toHaveLength(1);
    servidor.cair = false;
    await syncAllPendingData();
    expect(servidor.chamadas.filter((c) => c.p_id === "v2")).toHaveLength(2);   // tried twice, same id
    expect([...servidor.aplicados]).toEqual(["venda:v2"]);
  });

  it("deleting a sale that never went up: it just leaves the queue (the server never sees either)", async () => {
    servidor.cair = true;
    await guardarLancamento(l({ id: "v3", tipo: "venda", valor: 7, metodo: "cartao" }));
    await apagarVendaDoLivro({ ...base, id: "v3", tipoVenda: "venda", valor: 7, metodo: "cartao" });
    servidor.cair = false;
    await syncAllPendingData();
    expect(servidor.chamadas.filter((c) => c.nome === "defcon_lancar")).toEqual([]);
  });

  it("deleting a sale that already went up: one 'apagar_venda' with that sale's id", async () => {
    await guardarLancamento(l({ id: "v4", tipo: "gorjeta", valor: 2, metodo: "gorjeta" }));
    await syncAllPendingData();
    await apagarVendaDoLivro({ ...base, id: "v4", tipoVenda: "gorjeta", valor: 2, metodo: "gorjeta" });
    await syncAllPendingData();
    expect(servidor.chamadas.map((c) => `${c.p_tipo}:${c.p_id}`)).toEqual(["gorjeta:v4", "apagar_venda:v4"]);
  });

  it("a definitive refusal (session deleted) leaves the queue; a network error does not", async () => {
    servidor.recusar = "sessao_invalida";
    await guardarLancamento(l({ id: "v5", tipo: "abordagem" }));
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    await syncAllPendingData();
    expect(await lancamentosPendentes({ sessao: "s1" })).toEqual([]);
  });

  it("the banner counts ledger sales as sales; the old counters overlay ignores count-less block closes", async () => {
    servidor.cair = true;
    await guardarLancamento(l({ id: "v6", tipo: "venda", valor: 1, metodo: "pix" }));
    await guardarLancamento(l({ id: "a6", tipo: "abordagem" }));
    expect(await contarPendentes()).toBe(1);
    expect((await lerFilaDoDia(null, "s1")).contadores.size).toBe(0);
  });
});

describe("what has not gone up yet, on the screen (same rules the server derives)", () => {
  const fila = [
    l({ id: "1", tipo: "venda", valor: 10, metodo: "dinheiro" }),
    l({ id: "2", tipo: "venda", valor: 6, metodo: "cartao" }),
    l({ id: "3", tipo: "venda_tardia", valor: 8 }),
    l({ id: "4", tipo: "gorjeta", valor: 2, metodo: "gorjeta" }),
    l({ id: "5", tipo: "abordagem" }),
    l({ id: "6", tipo: "abordagem", bloco: 1 }),
    l({ id: "2", tipo: "apagar_venda", valor: 6, metodo: "cartao" }),
  ];
  it("money per method: cash 10 + tip 2, card 6 - 6, late Pix 8; achieved = the split", () => {
    const [b0, b1] = aplicarLivroNosBlocos([bloco({ valor_pix: 1, achieved_amount: 1 }), bloco()], fila);
    expect(b0).toMatchObject({ valor_dinheiro: 12, valor_gorjeta: 2, valor_cartao: 0, valor_pix: 9, achieved_amount: 21 });
    expect(b1).toMatchObject({ achieved_amount: 0 });
  });
  it("counters: a sale = 1 sale + 1 approach; late Pix and tip count nothing; delete takes its sale and approach back", () => {
    expect(contadoresDoLivro(fila).get(0)).toEqual({ vendas: 1, abordagens: 2 });
    expect(contadoresDoLivro(fila).get(1)).toEqual({ vendas: 0, abordagens: 1 });
  });
  it("the sales list: the deleted one is not shown; late Pix shows as Pix", () => {
    const v = vendasDoLivro(fila, "u1");
    expect(v.map((x) => x.id)).toEqual(["1", "3", "4"]);
    expect(v[1]).toMatchObject({ method: "pix", late: true });
  });
});

describe("Como recebeu through the ledger", () => {
  it("a ledger block: done by the server (true); any other block: today's path (false)", async () => {
    expect(await redistribuirBloco("b-livro", { dinheiro: 1, cartao: 0, pix: 1, calote: 0 })).toBe(true);
    expect(await redistribuirBloco("b-outro", { dinheiro: 1, cartao: 0, pix: 1, calote: 0 })).toBe(false);
  });
  it("database without the migration yet: today's path, nothing breaks", async () => {
    servidor.recusar = "Could not find the function public.defcon_redistribuir_bloco";
    expect(await redistribuirBloco("b-livro", { dinheiro: 1, cartao: 0, pix: 1, calote: 0 })).toBe(false);
  });
  it("the block total changed meanwhile (a new sale): a clear error, nothing saved", async () => {
    servidor.recusar = "redistribuicao_muda_total";
    await expect(redistribuirBloco("b-livro", { dinheiro: 1, cartao: 0, pix: 1, calote: 0 })).rejects.toThrow("valores_mudaram");
  });
});
