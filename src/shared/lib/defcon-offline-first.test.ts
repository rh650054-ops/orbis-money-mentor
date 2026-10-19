/* DEFCON que funciona sem sinal (19/10/2026) — fila de verdade (fake-indexeddb) e um
   "servidor" de mentira que cai e volta. Os cenários são os da rua: sinal some no meio,
   vendedor exclui uma venda que ainda nem subiu, duas chamadas do carteiro ao mesmo tempo. */
import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const servidor = { vendas: new Map<string, number>(), blocos: new Map<string, number>(), apagadas: [] as string[], sessoes: new Map<string, unknown>() };
let semSinal = false;
const falha = { error: { message: "Failed to fetch" } };

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (tabela: string) => ({
      upsert: async (v: { id: string; amount?: number; achieved_amount?: number }) => {
        if (semSinal) return falha;
        if (tabela === "defcon_sales") servidor.vendas.set(v.id, Number(v.amount));
        if (tabela === "hourly_goal_blocks") servidor.blocos.set(v.id, Number(v.achieved_amount));
        return { error: null };
      },
      update: (patch: unknown) => ({ eq: async (_c: string, id: string) => {
        if (semSinal) return falha;
        servidor.sessoes.set(id, { ...(servidor.sessoes.get(id) as object ?? {}), ...(patch as object) });
        return { error: null };
      } }),
      delete: () => ({ eq: async (_c: string, id: string) => { if (semSinal) return falha; servidor.apagadas.push(id); servidor.vendas.delete(id); return { error: null }; } }),
    }),
    auth: { getUser: async () => ({ data: { user: null } }) },
  },
}));
vi.mock("@/utils/syncDailySales", () => ({ syncBlocksToDailySales: vi.fn() }));
vi.mock("./offline-day", () => ({ diasOfflinePendentes: () => [], marcarDiaSincronizado: vi.fn() }));

import { addOfflineRecord, getUnsynced } from "./offline-db";
import { syncAllPendingData } from "./offline-sync";
import { apagarVendaOffline, guardarVendaOffline, type LinhaVenda } from "./venda-offline";
import { aplicarFilaNosBlocos, filaAtualizar, juntarVendas, lerFilaDoDia, retratoValido, contarPendentes } from "./fila-defcon";

const venda = (id: string, amount: number): LinhaVenda => ({
  id, user_id: "u1", session_id: "s1", block_index: 0, amount, method: "pix", late: false, created_at: new Date().toISOString(),
});
const bloco = (valor: number) => ({
  id: "b1", store: "pending_sales", created_at: new Date().toISOString(), synced: false,
  data: { block_id: "b1", user_id: "u1", plan_id: "p1", plan_date: "2026-10-19", hour_index: 0, hour_label: "H1", target_amount: 100,
    achieved_amount: valor, valor_dinheiro: 0, valor_cartao: 0, valor_pix: valor, valor_calote: 0, valor_gorjeta: 0 },
});

async function limparFila() {
  for (const s of ["pending_sales", "pending_venda", "pending_defcon"] as const) {
    for (const r of await getUnsynced(s)) {
      const { removeOfflineRecord } = await import("./offline-db");
      await removeOfflineRecord(s, r.id);
    }
  }
}

beforeEach(async () => {
  servidor.vendas.clear(); servidor.blocos.clear(); servidor.apagadas = []; servidor.sessoes.clear();
  semSinal = false;
  await limparFila();
});

describe("DEFCON offline-first", () => {
  it("sem sinal nada se perde: fica no celular e sobe inteiro quando o sinal volta", async () => {
    semSinal = true;
    await guardarVendaOffline(venda("v1", 20), 20);
    await addOfflineRecord("pending_sales", bloco(20));
    await guardarVendaOffline(venda("v2", 15), 35);
    await addOfflineRecord("pending_sales", bloco(35));
    await syncAllPendingData();
    expect(servidor.vendas.size).toBe(0);
    expect(await contarPendentes()).toBe(2); // 2 vendas esperando sinal

    semSinal = false;
    await syncAllPendingData();
    expect([...servidor.vendas.entries()]).toEqual([["v1", 20], ["v2", 15]]);
    expect(servidor.blocos.get("b1")).toBe(35); // o total mais novo do bloco
    expect((servidor.sessoes.get("s1") as { total_sold: number }).total_sold).toBe(35);
    expect(await contarPendentes()).toBe(0);
  });

  it("excluir uma venda que ainda não subiu: ela sai da fila e nunca chega no servidor", async () => {
    semSinal = true;
    await guardarVendaOffline(venda("v9", 50), 50);
    await apagarVendaOffline("v9");
    semSinal = false;
    await syncAllPendingData();
    expect(servidor.vendas.has("v9")).toBe(false);
    expect(servidor.apagadas).toEqual([]); // nem precisou pedir pra apagar
  });

  it("excluir uma venda que já subiu: o pedido de apagar vai pela fila", async () => {
    await guardarVendaOffline(venda("v3", 10), 10);
    await syncAllPendingData();
    expect(servidor.vendas.has("v3")).toBe(true);
    semSinal = true;
    await apagarVendaOffline("v3");
    await syncAllPendingData();
    expect(servidor.vendas.has("v3")).toBe(true); // sem sinal, ainda lá
    semSinal = false;
    await syncAllPendingData();
    expect(servidor.apagadas).toEqual(["v3"]);
  });

  it("carteiro chamado duas vezes ao mesmo tempo: dá mais uma volta e leva o que chegou no meio", async () => {
    await guardarVendaOffline(venda("a", 10), 10);
    const primeira = syncAllPendingData();
    await guardarVendaOffline(venda("b", 12), 22);
    const segunda = syncAllPendingData(); // pega o carteiro trabalhando
    await Promise.all([primeira, segunda]);
    expect(servidor.vendas.has("a")).toBe(true);
    expect(servidor.vendas.has("b")).toBe(true);
    expect(await contarPendentes()).toBe(0);
  });

  it("alterações da mesma linha se juntam (avançar bloco + encerrar)", async () => {
    semSinal = true;
    await filaAtualizar("challenge_sessions", "s1", { current_block_index: 2 });
    await filaAtualizar("challenge_sessions", "s1", { status: "abandoned", ended_at: "2026-10-19T18:00:00Z" });
    semSinal = false;
    await syncAllPendingData();
    expect(servidor.sessoes.get("s1")).toEqual({ current_block_index: 2, status: "abandoned", ended_at: "2026-10-19T18:00:00Z" });
  });

  it("a tela soma o que está na fila por cima do servidor", async () => {
    semSinal = true;
    await guardarVendaOffline(venda("x", 30), 130);
    await addOfflineRecord("pending_sales", bloco(130));
    const fila = await lerFilaDoDia("p1", "s1");
    const blocos = aplicarFilaNosBlocos([{ id: "b1", achieved_amount: 100, valor_pix: 100 }, { id: "b2", achieved_amount: 0, valor_pix: 0 }], fila.blocos);
    expect(blocos[0]!.achieved_amount).toBe(130);
    expect(blocos[1]!.achieved_amount).toBe(0);
    expect(fila.totalSessao).toBe(130);
    const lista = juntarVendas([{ id: "antiga", created_at: "2026-10-19T10:00:00Z" }], fila.vendas);
    expect(lista.map((v) => v.id)).toEqual(["antiga", "x"]);
  });
});

describe("retrato do DEFCON", () => {
  const r = { data: "2026-10-19", fase: "running" } as Parameters<typeof retratoValido>[0];
  it("vale hoje; de ontem só na madrugada e com o DEFCON rodando", () => {
    expect(retratoValido(r, "2026-10-19", "2026-10-18", false)).toBe(true);
    expect(retratoValido({ ...r!, data: "2026-10-18" }, "2026-10-19", "2026-10-18", true)).toBe(true);
    expect(retratoValido({ ...r!, data: "2026-10-18" }, "2026-10-19", "2026-10-18", false)).toBe(false);
    expect(retratoValido({ ...r!, data: "2026-10-18", fase: "finished" }, "2026-10-19", "2026-10-18", true)).toBe(false);
    expect(retratoValido(null, "2026-10-19", "2026-10-18", false)).toBe(false);
  });
});
