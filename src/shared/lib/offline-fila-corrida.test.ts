/* Corrida na fila offline (IndexedDB de verdade, via fake-indexeddb):
   uma venda nova regrava a chave DURANTE o envio da versão anterior. A versão nova
   não pode ser marcada como enviada nem apagada pela limpeza. */
import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";

// "servidor": guarda o último valor absoluto recebido por bloco
const servidor = new Map<string, number>();
let durante: null | (() => Promise<void>) = null;

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      upsert: async (v: { id: string; achieved_amount: number }) => {
        if (durante) { const f = durante; durante = null; await f(); } // venda nova no meio do envio
        servidor.set(v.id, v.achieved_amount);
        return { error: null };
      },
      update: () => ({ eq: async () => ({ error: null }) }),
    }),
    auth: { getUser: async () => ({ data: { user: null } }) },
  },
}));
vi.mock("@/utils/syncDailySales", () => ({ syncBlocksToDailySales: vi.fn() }));
vi.mock("./offline-day", () => ({ diasOfflinePendentes: () => [], marcarDiaSincronizado: vi.fn() }));

import { addOfflineRecord, getUnsynced } from "./offline-db";
import { syncAllPendingData } from "./offline-sync";

const bloco = (valor: number) => ({
  id: "bloco-1",
  store: "pending_sales",
  data: { block_id: "bloco-1", user_id: "u1", plan_id: "p1", hour_index: 0, hour_label: "08h",
          target_amount: 100, achieved_amount: valor, valor_dinheiro: valor, valor_cartao: 0,
          valor_pix: 0, valor_calote: 0, valor_gorjeta: 0 },
  created_at: new Date().toISOString(),
  synced: false,
});

beforeEach(() => {
  servidor.clear();
  durante = null;
});

describe("fila offline: versão mais nova não se perde", () => {
  it("venda de R$ 120 gravada enquanto R$ 100 subia continua pendente e sobe na próxima sync", async () => {
    await addOfflineRecord("pending_sales", bloco(100));
    durante = () => addOfflineRecord("pending_sales", bloco(120));

    await syncAllPendingData();
    expect(servidor.get("bloco-1")).toBe(100); // a versão antiga subiu…

    const pendentes = await getUnsynced("pending_sales");
    expect(pendentes).toHaveLength(1); // …mas a nova NÃO foi marcada nem apagada
    expect(pendentes[0]!.data.achieved_amount).toBe(120);

    await syncAllPendingData();
    expect(servidor.get("bloco-1")).toBe(120);
    expect(await getUnsynced("pending_sales")).toHaveLength(0);
  });

  it("sem corrida, envia e limpa normalmente", async () => {
    await addOfflineRecord("pending_sales", bloco(50));
    await syncAllPendingData();
    expect(servidor.get("bloco-1")).toBe(50);
    expect(await getUnsynced("pending_sales")).toHaveLength(0);
  });
});
