import { describe, expect, it, vi } from "vitest";
import { carimboDeLeitura, coberturaDoItem, importarComCarimbo, type ItemPluggy } from "../../supabase/functions/_shared/pluggy-cobertura";

// F-02 (audit 10/11/2026). Times in UTC; 03:00Z is midnight in Brasília.
const ok = (em: string): ItemPluggy => ({ status: "UPDATED", executionStatus: "SUCCESS", lastUpdatedAt: em, statusDetail: null });
const agora = new Date("2026-11-10T19:30:00Z"); // 10/11 16:30 BRT, when we read Pluggy

describe("bank-read stamp = Pluggy's last real sync with the bank (F-02)", () => {
  it("the proven case: item OUTDATED since 09/11 08:57, read at 10/11 16:30 → no stamp", () => {
    const item = { status: "OUTDATED", executionStatus: "CONNECTION_ERROR", lastUpdatedAt: "2026-11-09T11:57:00Z" };
    expect(coberturaDoItem(item, agora)).toBeNull();
    expect(carimboDeLeitura({ completa: true, antes: item, depois: item, atual: "2026-11-09T11:57:00Z", agora })).toBeNull();
  });

  it("healthy item synced at 15:00, read at 16:30 → stamped 15:00, not 16:30", () => {
    const item = ok("2026-11-10T18:00:00Z");
    expect(carimboDeLeitura({ completa: true, antes: item, depois: item, atual: "2026-11-10T12:00:00Z", agora })).toBe("2026-11-10T18:00:00.000Z");
  });

  it("reading Pluggy after midnight does not check yesterday if Pluggy last synced before midnight", () => {
    const item = ok("2026-11-11T01:40:00Z"); // 10/11 22:40 BRT
    const carimbo = carimboDeLeitura({ completa: true, antes: item, depois: item, atual: null, agora: new Date("2026-11-11T03:10:00Z") });
    expect(carimbo).toBe("2026-11-11T01:40:00.000Z");
    expect(Date.parse(carimbo!)).toBeLessThan(Date.parse("2026-11-11T03:00:00Z")); // before the day closed
  });

  it("once Pluggy syncs after midnight, the closed day is covered", () => {
    const item = ok("2026-11-11T09:05:00Z");
    const carimbo = carimboDeLeitura({ completa: true, antes: item, depois: item, atual: "2026-11-11T01:40:00Z", agora: new Date("2026-11-11T09:06:00Z") });
    expect(Date.parse(carimbo!)).toBeGreaterThanOrEqual(Date.parse("2026-11-11T03:00:00Z"));
  });

  it("never moves backwards: an older sync date leaves the stored stamp alone", () => {
    const item = ok("2026-11-09T11:57:00Z");
    expect(carimboDeLeitura({ completa: true, antes: item, depois: item, atual: "2026-11-10T19:30:00Z", agora })).toBeNull();
  });

  it("an incomplete read of Pluggy never stamps, whatever the item says", () => {
    const item = ok("2026-11-10T19:29:00Z");
    expect(carimboDeLeitura({ completa: false, antes: item, depois: item, atual: null, agora })).toBeNull();
  });

  it.each(["OUTDATED", "LOGIN_ERROR", "WAITING_USER_INPUT", "UPDATING", "", null])("item %s → no stamp", (status) => {
    expect(coberturaDoItem({ status, executionStatus: "SUCCESS", lastUpdatedAt: "2026-11-10T19:00:00Z" }, agora)).toBeNull();
  });

  it("Pluggy did not answer, or sent no usable date → no stamp", () => {
    expect(carimboDeLeitura({ completa: true, antes: null, depois: null, atual: null, agora })).toBeNull();
    expect(coberturaDoItem({ status: "UPDATED", executionStatus: "SUCCESS" }, agora)).toBeNull();
    expect(coberturaDoItem({ status: "UPDATED", executionStatus: "SUCCESS", lastUpdatedAt: "ontem" }, agora)).toBeNull();
  });

  it("a date ahead of our clock is cut to now", () => {
    expect(coberturaDoItem(ok("2026-11-10T23:00:00Z"), agora)?.toISOString()).toBe(agora.toISOString());
  });
});

describe("transactions left behind by a partial sync (owner's review, risk 2)", () => {
  const parcial = (tx: unknown): ItemPluggy => ({
    status: "UPDATED", executionStatus: "PARTIAL_SUCCESS", lastUpdatedAt: "2026-11-10T19:00:00Z",
    statusDetail: { transactions: tx as never },
  });

  it("the documented shape: isUpdated false with its own older date → that date, never the item's", () => {
    const item = parcial({ warnings: [], isUpdated: false, lastUpdatedAt: "2026-11-08T22:39:00Z" });
    expect(coberturaDoItem(item, agora)?.toISOString()).toBe("2026-11-08T22:39:00.000Z");
  });

  it.each([
    ["no date", { isUpdated: false }],
    ["null date", { isUpdated: false, lastUpdatedAt: null }],
    ["empty date", { isUpdated: false, lastUpdatedAt: "" }],
    ["garbage date", { isUpdated: false, lastUpdatedAt: "n/a" }],
  ])("isUpdated false and %s → NO stamp (the item's general date is not used)", (_nome, tx) => {
    const item = parcial(tx);
    expect(coberturaDoItem(item, agora)).toBeNull();
    expect(carimboDeLeitura({ completa: true, antes: item, depois: item, atual: null, agora })).toBeNull();
  });

  it("detail present without a date → no stamp even when it says isUpdated true", () => {
    expect(coberturaDoItem(parcial({ isUpdated: true }), agora)).toBeNull();
  });

  it("PARTIAL_SUCCESS that does not say how transactions went → no stamp", () => {
    expect(coberturaDoItem(parcial(null), agora)).toBeNull();
    expect(coberturaDoItem({ status: "UPDATED", executionStatus: "PARTIAL_SUCCESS", lastUpdatedAt: "2026-11-10T19:00:00Z" }, agora)).toBeNull();
  });

  it("UPDATED without an execution status we know → no stamp", () => {
    expect(coberturaDoItem({ status: "UPDATED", lastUpdatedAt: "2026-11-10T19:00:00Z" }, agora)).toBeNull();
    expect(coberturaDoItem({ status: "UPDATED", executionStatus: "ERROR", lastUpdatedAt: "2026-11-10T19:00:00Z" }, agora)).toBeNull();
  });

  it("isUpdated true with its own date → that date", () => {
    expect(coberturaDoItem(parcial({ isUpdated: true, lastUpdatedAt: "2026-11-10T18:59:00Z" }), agora)?.toISOString()).toBe("2026-11-10T18:59:00.000Z");
  });
});

describe("Pluggy syncs while we are reading (owner's review, risk 1)", () => {
  vi.spyOn(console, "log").mockImplementation(() => {});
  const s1 = ok("2026-11-10T12:00:00Z"); // sync that was there when we started
  const s2 = ok("2026-11-10T18:00:00Z"); // sync that lands during / right after our read

  // A tiny Pluggy: the item, and the transactions each sync made visible.
  function pluggy() {
    const estado = { item: s1 as ItemPluggy | null, txs: ["pix-manha"] };
    return {
      estado,
      buscar: vi.fn(async () => estado.item),
      sincronizar: () => { estado.txs = ["pix-manha", "pix-tarde"]; estado.item = s2; },
    };
  }

  it("old order (read, then ask the item): the stamp would claim a sync we did not import", async () => {
    const p = pluggy();
    const importadas = [...p.estado.txs]; // we read the transactions…
    p.sincronizar();                       // …Pluggy syncs…
    const depois = await p.buscar();       // …and only now we ask the item
    // what PR 2's first version did: trust the item fetched after the read
    expect(carimboDeLeitura({ completa: true, antes: depois, depois, atual: null, agora })).toBe("2026-11-10T18:00:00.000Z");
    expect(importadas).not.toContain("pix-tarde"); // stamped 15:00 without the afternoon Pix: the bug
  });

  it("protected: sync between the read and the second look → NO stamp this time", async () => {
    const p = pluggy();
    let importadas: string[] = [];
    const { carimbo } = await importarComCarimbo({
      buscar: p.buscar,
      importar: async () => { importadas = [...p.estado.txs]; p.sincronizar(); return { completa: true }; },
      atual: "2026-11-10T09:00:00Z",
    });
    expect(importadas).toEqual(["pix-manha"]);
    expect(carimbo).toBeNull();
    expect(p.buscar).toHaveBeenCalledTimes(2);
  });

  it("the next read, with Pluggy quiet, imports everything and stamps the new sync", async () => {
    const p = pluggy();
    p.sincronizar();
    let importadas: string[] = [];
    const { carimbo } = await importarComCarimbo({
      buscar: p.buscar, importar: async () => { importadas = [...p.estado.txs]; return { completa: true }; }, atual: "2026-11-10T12:00:00Z",
    });
    expect(importadas).toContain("pix-tarde");
    expect(carimbo).toBe("2026-11-10T18:00:00.000Z");
  });

  it("sync lands BEFORE our read starts but after the first look → no stamp either (dates differ)", async () => {
    const p = pluggy();
    const { carimbo } = await importarComCarimbo({
      buscar: p.buscar, importar: async () => { p.sincronizar(); return { completa: true }; }, atual: null,
    });
    expect(carimbo).toBeNull();
  });

  it("a sync still running at the second look (UPDATING) → no stamp", async () => {
    const p = pluggy();
    const { carimbo } = await importarComCarimbo({
      buscar: p.buscar,
      importar: async () => { p.estado.item = { status: "UPDATING", executionStatus: "MERGING", lastUpdatedAt: "2026-11-10T12:00:00Z" }; return { completa: true }; },
      atual: null,
    });
    expect(carimbo).toBeNull();
  });

  it("Pluggy does not answer the second look → no stamp", async () => {
    const p = pluggy();
    const { carimbo } = await importarComCarimbo({
      buscar: p.buscar, importar: async () => { p.estado.item = null; return { completa: true }; }, atual: null,
    });
    expect(carimbo).toBeNull();
  });

  it("nothing to stamp (item OUTDATED or read incomplete) → the item is not asked a second time", async () => {
    const p = pluggy();
    p.estado.item = { status: "OUTDATED", executionStatus: "ERROR", lastUpdatedAt: "2026-11-09T11:57:00Z" };
    await importarComCarimbo({ buscar: p.buscar, importar: async () => ({ completa: true }), atual: null });
    expect(p.buscar).toHaveBeenCalledTimes(1);
    const q = pluggy();
    const { carimbo } = await importarComCarimbo({ buscar: q.buscar, importar: async () => ({ completa: false }), atual: null });
    expect(carimbo).toBeNull();
    expect(q.buscar).toHaveBeenCalledTimes(1);
  });

  it("webhook path: the item it already fetched is the first look; quiet Pluggy → stamped", async () => {
    const p = pluggy();
    const { carimbo } = await importarComCarimbo({ buscar: p.buscar, importar: async () => ({ completa: true }), atual: null, antes: s1 });
    expect(carimbo).toBe("2026-11-10T12:00:00.000Z");
    expect(p.buscar).toHaveBeenCalledTimes(1); // only the second look
  });

  it("an import that throws still throws (the callers keep their own error handling)", async () => {
    const p = pluggy();
    await expect(importarComCarimbo({ buscar: p.buscar, importar: async () => { throw new Error("pluggy fora"); }, atual: null })).rejects.toThrow("pluggy fora");
  });
});
