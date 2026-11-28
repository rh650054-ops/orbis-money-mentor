import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const CONTA = "6261573e-d339-466d-b7de-665d2b6c76f4", OUTRA = "071d204d-6e19-4cbd-ad0a-6345da37858b";
const fila: unknown[] = [];
const concluidas: { id: string; estado: string; texto?: string }[] = [];
let ouvinte: (() => void) | null = null;
let noServidor: string[] = [];

vi.mock("../api/ponte", () => ({
  temQuick: () => true,
  quick: {
    pendentes: async () => [...fila],
    concluir: async (id: string, estado: string, texto?: string) => { concluidas.push({ id, estado, texto }); const i = fila.findIndex((a) => (a as { id: string }).id === id); if (i >= 0) fila.splice(i, 1); },
    aoTocarNoWidget: async (f: () => void) => { ouvinte = f; return { remove: async () => { ouvinte = null; } }; },
  },
}));
vi.mock("@capacitor/app", () => ({ App: { addListener: async () => ({ remove: async () => undefined }) } }));
vi.mock("../api/confirmacao", () => ({ useConfirmacaoVendas: (_c: string | null, ids: string[]) => ({ data: noServidor.filter((x) => ids.includes(x)) }) }));
const toast = vi.fn();
vi.mock("@/shared/hooks/use-toast", () => ({ toast: (...a: unknown[]) => toast(...a) }));

import { salvarConfig } from "../lib/memoria";
import { useProcessarQuick, type DefconParaQuick } from "./use-processar-quick";

let n = 0;
const toque = (x: Record<string, unknown> = {}) => ({ id: `0b7d7a2e-6a5f-4b8e-9d0c-${String(++n).padStart(12, "0")}`, tipo: "venda", criadoEm: Date.now() - 1_000, conta: CONTA, ...x });
function defcon(x: Partial<DefconParaQuick> = {}): DefconParaQuick {
  const vendas: { id?: string }[] = [];
  return {
    phase: "running", sessionSales: vendas,
    addSale: vi.fn(async (_v, _m, _p, id) => { vendas.push({ id }); }),
    addApproach: vi.fn(async () => undefined), ...x,
  };
}

beforeEach(() => { fila.length = 0; concluidas.length = 0; noServidor = []; localStorage.clear(); toast.mockClear(); salvarConfig(CONTA, { valor: 12.5, metodo: "pix" }); });

describe("widget taps run through the DEFCON's own code", () => {
  it("two real sales in a row: two sales, each with the CONFIGURED amount and its own tap id", async () => {
    const d = defcon(); const a = toque(), b = toque();
    fila.push(a, b);
    renderHook(() => useProcessarQuick(CONTA, d));
    await waitFor(() => expect(d.addSale).toHaveBeenCalledTimes(2));
    expect(d.addSale).toHaveBeenNthCalledWith(1, 12.5, "pix", null, a.id);
    expect(d.addSale).toHaveBeenNthCalledWith(2, 12.5, "pix", null, b.id);
    expect(concluidas.map((c) => c.estado)).toEqual(["pendente_sync", "pendente_sync"]);
  });

  it("the same tap delivered again (cold start, the listener, coming back to the app): ONE sale", async () => {
    const d = defcon(); const a = toque();
    fila.push(a);
    const { rerender } = renderHook(() => useProcessarQuick(CONTA, d));
    await waitFor(() => expect(d.addSale).toHaveBeenCalledTimes(1));
    fila.push(a);                       // the native side hands the same tap again
    await act(async () => { ouvinte?.(); });
    rerender();
    await waitFor(() => expect(fila).toHaveLength(0));
    expect(d.addSale).toHaveBeenCalledTimes(1);
  });

  it("'confirmada' only once the database has the sale; before that 'salva, sincronizando'", async () => {
    const d = defcon(); const a = toque();
    fila.push(a);
    const { rerender } = renderHook(() => useProcessarQuick(CONTA, d));
    await waitFor(() => expect(concluidas).toEqual([{ id: a.id, estado: "pendente_sync", texto: undefined }]));
    noServidor = [a.id];
    rerender();
    await waitFor(() => expect(concluidas.at(-1)).toEqual({ id: a.id, estado: "confirmada", texto: undefined }));
  });

  it.each([
    ["no DEFCON block running", { phase: "break" }, toque(), "sem_defcon"],
    ["a tap of another account", {}, toque({ conta: OUTRA }), "outra_conta"],
  ])("%s: nothing registered, the widget says why", async (_n, extra, t, _m) => {
    const d = defcon(extra as Partial<DefconParaQuick>);
    fila.push(t);
    renderHook(() => useProcessarQuick(CONTA, d));
    await waitFor(() => expect(concluidas[0]?.estado).toBe("recusada"));
    expect(d.addSale).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalled();
  });

  it("no quick sale configured: refused, the person is told where to set it", async () => {
    localStorage.clear();
    const d = defcon(); fila.push(toque());
    renderHook(() => useProcessarQuick(CONTA, d));
    await waitFor(() => expect(concluidas[0]?.texto).toMatch(/Conta > VANT Quick/));
    expect(d.addSale).not.toHaveBeenCalled();
  });

  it("an approach tap goes through the DEFCON's approach, once", async () => {
    const d = defcon(); const t = toque({ tipo: "abordagem" });
    fila.push(t, t);
    renderHook(() => useProcessarQuick(CONTA, d));
    await waitFor(() => expect(fila).toHaveLength(0));
    expect(d.addApproach).toHaveBeenCalledTimes(1);
    expect(d.addSale).not.toHaveBeenCalled();
  });

  it("signed out (no account): nothing is read nor executed", async () => {
    const d = defcon(); fila.push(toque());
    renderHook(() => useProcessarQuick(null, d));
    await new Promise((r) => setTimeout(r, 30));
    expect(d.addSale).not.toHaveBeenCalled();
    expect(concluidas).toEqual([]);
  });
});
