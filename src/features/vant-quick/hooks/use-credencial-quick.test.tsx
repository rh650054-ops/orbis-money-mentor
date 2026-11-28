import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const nativo: string[] = [];
let disponivel: boolean | undefined = true;
let emitir = vi.fn(async () => ({ token: "vq1_" + "a".repeat(64), expiraEm: Date.now() + 30 * 864e5 }));
vi.mock("../api/ponte", () => ({
  quick: {
    guardarCredencial: async (t: string, s: string) => { nativo.push(`keychain:${t.slice(0, 4)}:${s}`); return true; },
    definirInterativo: async (a: boolean) => { nativo.push(`interativo:${a}`); },
  },
}));
vi.mock("../api/credencial", () => ({
  useQuickDisponivel: () => ({ data: disponivel }),
  emitirCredencial: (...a: unknown[]) => emitir(...(a as [])),
  urlDoProjeto: () => "https://projeto.supabase.co",
}));

import { useCredencialQuick } from "./use-credencial-quick";
import { credencialExpiraEm, marcarCredencial } from "../lib/memoria";

const A = "6261573e-d339-466d-b7de-665d2b6c76f4";
beforeEach(() => { nativo.length = 0; localStorage.clear(); disponivel = true; emitir.mockClear(); });

describe("VANT Quick device credential", () => {
  it("allowed by the server: a credential goes to the Keychain (not to the web side), then the buttons turn on", async () => {
    renderHook(() => useCredencialQuick(A));
    await waitFor(() => expect(nativo).toEqual(["keychain:vq1_:https://projeto.supabase.co", "interativo:true"]));
    expect(credencialExpiraEm(A)).toBeGreaterThan(Date.now());
    expect(JSON.stringify(localStorage)).not.toMatch(/vq1_/);
  });
  it("a credential far from expiry is not re-issued", async () => {
    marcarCredencial(A, Date.now() + 20 * 864e5);
    renderHook(() => useCredencialQuick(A));
    await waitFor(() => expect(nativo).toEqual(["interativo:true"]));
    expect(emitir).not.toHaveBeenCalled();
  });
  it("renewed a week before it expires", async () => {
    marcarCredencial(A, Date.now() + 3 * 864e5);
    renderHook(() => useCredencialQuick(A));
    await waitFor(() => expect(emitir).toHaveBeenCalledTimes(1));
  });
  it("not allowed (switches off / account not switched on): buttons off, no credential issued", async () => {
    disponivel = false;
    renderHook(() => useCredencialQuick(A));
    await waitFor(() => expect(nativo).toEqual(["interativo:false"]));
    expect(emitir).not.toHaveBeenCalled();
  });
  it("issuing failed (offline): the buttons are NOT turned on", async () => {
    emitir = vi.fn(async () => { throw new Error("offline"); });
    renderHook(() => useCredencialQuick(A));
    await waitFor(() => expect(emitir).toHaveBeenCalled());
    expect(nativo).toEqual([]);
  });
});
