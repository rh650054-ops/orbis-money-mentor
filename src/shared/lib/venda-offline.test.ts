/* Venda sem internet: a venda INDIVIDUAL (produto, qtd, forma) vai pra fila com id
   próprio e sobe uma vez só — mesmo se for enfileirada/reenviada mais de uma vez. */
import { beforeEach, describe, expect, it, vi } from "vitest";

// ---- IndexedDB em memória
const lojas = new Map<string, Map<string, { id: string; data: Record<string, unknown>; synced: boolean }>>();
const loja = (n: string) => { if (!lojas.has(n)) lojas.set(n, new Map()); return lojas.get(n)!; };
vi.mock("./offline-db", () => ({
  addOfflineRecord: async (s: string, r: { id: string; data: Record<string, unknown>; synced: boolean }) => { loja(s).set(r.id, { ...r }); },
  removeOfflineRecord: async (s: string, id: string) => { loja(s).delete(id); },
  getUnsynced: async (s: string) => [...loja(s).values()].filter((r) => !r.synced),
  markSynced: async (s: string, id: string) => { const r = loja(s).get(id); if (r) r.synced = true; },
  clearSynced: async (s: string) => { for (const [k, r] of loja(s)) if (r.synced) loja(s).delete(k); },
}));

// ---- banco falso: defcon_sales com id único + "gatilho" de estoque
const banco = {
  vendas: new Map<string, Record<string, unknown>>(),
  estoque: 10,
  totalSessao: 0,
  falharVendas: null as null | { code: string },
  sessaoSumiu: false,
};
function inserirVenda(v: Record<string, unknown>, ignorarDuplicado: boolean) {
  if (banco.falharVendas) return { error: banco.falharVendas };
  if (banco.sessaoSumiu) return { error: { code: "23503", message: "fk" } };
  if (banco.vendas.has(String(v.id))) return ignorarDuplicado ? { error: null } : { error: { code: "23505", message: "dup" } };
  banco.vendas.set(String(v.id), v);
  if (v.product_id) banco.estoque -= Number(v.qty ?? 1); // gatilho defcon_venda_estoque
  return { error: null };
}
const upsertSpy = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (t: string) => ({
      insert: async (v: Record<string, unknown>) => inserirVenda(v, false),
      upsert: async (v: Record<string, unknown>, o: { ignoreDuplicates?: boolean; onConflict?: string }) => {
        upsertSpy(t, o);
        return t === "defcon_sales" ? inserirVenda(v, !!o.ignoreDuplicates) : { error: null };
      },
      update: (v: { total_sold?: number }) => ({
        eq: async () => { if (t === "challenge_sessions") banco.totalSessao = Number(v.total_sold); return { error: null }; },
      }),
    }),
    auth: { getUser: async () => ({ data: { user: null } }) },
  },
}));
vi.mock("@/utils/syncDailySales", () => ({ syncBlocksToDailySales: vi.fn() }));
vi.mock("./offline-day", () => ({ diasOfflinePendentes: () => [], marcarDiaSincronizado: vi.fn() }));

import {
  novaLinhaVenda, gravarLinhaVenda, guardarVendaOffline, esquecerTotalSessaoOffline,
} from "./venda-offline";
import { syncAllPendingData } from "./offline-sync";

const venda = () =>
  novaLinhaVenda({
    user_id: "u1", session_id: "s1", block_index: 2, amount: 15, method: "pix", late: false,
    product_id: "p1", qty: 3,
  });

beforeEach(() => {
  lojas.clear();
  banco.vendas.clear();
  banco.estoque = 10;
  banco.totalSessao = 0;
  banco.falharVendas = null;
  banco.sessaoSumiu = false;
  upsertSpy.mockClear();
});

describe("venda offline", () => {
  it("cada venda nasce com id e hora próprios", () => {
    const a = venda(), b = venda();
    expect(a.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(a.id).not.toBe(b.id);
    expect(Date.parse(a.created_at)).not.toBeNaN();
  });

  it("sem internet: guarda a venda inteira (produto, qtd, forma) e o total da sessão; sobe ao reconectar", async () => {
    const v = venda();
    await guardarVendaOffline(v, 115);
    expect(banco.vendas.size).toBe(0);

    await syncAllPendingData();

    expect(banco.vendas.get(v.id)).toMatchObject({ product_id: "p1", qty: 3, method: "pix", amount: 15, block_index: 2 });
    expect(banco.estoque).toBe(7); // baixou o estoque
    expect(banco.totalSessao).toBe(115);
    expect(upsertSpy).toHaveBeenCalledWith("defcon_sales", { onConflict: "id", ignoreDuplicates: true });
    expect(loja("pending_venda").size).toBe(0); // fila limpa
  });

  it("rede caiu DEPOIS da venda gravar: a fila reenvia a mesma venda e nada duplica (nem o estoque)", async () => {
    const v = venda();
    await gravarLinhaVenda(v); // gravou online…
    await guardarVendaOffline(v, 115); // …mas um passo seguinte falhou e caiu no fallback
    await syncAllPendingData();
    await guardarVendaOffline(v, 115); // e até reenfileirada de novo
    await syncAllPendingData();

    expect(banco.vendas.size).toBe(1);
    expect(banco.estoque).toBe(7);
  });

  it("gravar online de novo a mesma venda (id repetido) não é erro", async () => {
    const v = venda();
    await gravarLinhaVenda(v);
    await expect(gravarLinhaVenda(v)).resolves.toBeUndefined();
    expect(banco.vendas.size).toBe(1);
  });

  it("falha de verdade online sobe como erro (pra cair na fila)", async () => {
    banco.falharVendas = { code: "08006" };
    await expect(gravarLinhaVenda(venda())).rejects.toBeTruthy();
  });

  it("banco fora do ar na sincronização: a venda continua na fila pra próxima tentativa", async () => {
    const v = venda();
    await guardarVendaOffline(v, 115);
    banco.falharVendas = { code: "08006" };
    await syncAllPendingData();
    expect(loja("pending_venda").has(v.id)).toBe(true);

    banco.falharVendas = null;
    await syncAllPendingData();
    expect(banco.vendas.has(v.id)).toBe(true);
    expect(loja("pending_venda").size).toBe(0);
  });

  it("sessão apagada nesse meio-tempo: descarta a venda em vez de travar a fila pra sempre", async () => {
    await guardarVendaOffline(venda(), 115);
    banco.sessaoSumiu = true;
    await syncAllPendingData();
    expect(loja("pending_venda").size).toBe(0);
  });

  it("total da sessão subiu online depois: o total velho da fila é descartado", async () => {
    await guardarVendaOffline(venda(), 115);
    banco.totalSessao = 140; // venda seguinte já gravou online
    await esquecerTotalSessaoOffline("s1");
    await syncAllPendingData();
    expect(banco.totalSessao).toBe(140);
  });
});
