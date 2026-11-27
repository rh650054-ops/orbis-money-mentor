/* 27/11/2026: a paid purchase the server could not confirm is sent again by itself while the screen
   is open (only re-sent: never a new purchase), and stops as soon as the access is released. */
import { act, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fluxo = { comprar: vi.fn(), recuperar: vi.fn(), restaurar: vi.fn(), processar: vi.fn() };
vi.mock("./fluxo-do-app", () => ({ fluxoDoApp: () => fluxo }));
vi.mock("../lib/ponte", () => ({ ponteApple: () => null }));

import { ESPERAS_DA_CONFIRMACAO_MS, useCompraApple } from "./use-compra-apple";

const embrulho = ({ children }: { children: ReactNode }) => <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>;

describe("useCompraApple: automatic confirmation", () => {
  beforeEach(() => { vi.useFakeTimers(); Object.values(fluxo).forEach((f) => f.mockReset()); });
  afterEach(() => vi.useRealTimers());

  it("retries by itself after the first wait and stops once released; never buys again", async () => {
    fluxo.comprar.mockResolvedValue({ estado: "aguardando_servidor", produto: "p", motivo: "servidor" });
    fluxo.recuperar.mockResolvedValueOnce([{ estado: "aguardando_servidor", produto: "p", motivo: "servidor" }])
      .mockResolvedValueOnce([{ estado: "liberada", produto: "p" }]);
    const { result } = renderHook(() => useCompraApple(), { wrapper: embrulho });
    await act(async () => { await result.current.comprar("p"); });
    expect(result.current.resultado?.estado).toBe("aguardando_servidor");
    await act(async () => { await vi.advanceTimersByTimeAsync(ESPERAS_DA_CONFIRMACAO_MS[0]!); });
    expect(fluxo.recuperar).toHaveBeenCalledTimes(1);
    await act(async () => { await vi.advanceTimersByTimeAsync(ESPERAS_DA_CONFIRMACAO_MS[1]!); });
    expect(fluxo.recuperar).toHaveBeenCalledTimes(2);
    expect(result.current.resultado?.estado).toBe("liberada");
    await act(async () => { await vi.advanceTimersByTimeAsync(120_000); });
    expect(fluxo.recuperar).toHaveBeenCalledTimes(2);
    expect(fluxo.comprar).toHaveBeenCalledTimes(1);
  });

  it("gives up after the last wait (the background recovery keeps the purchase safe)", async () => {
    fluxo.comprar.mockResolvedValue({ estado: "aguardando_servidor", produto: "p", motivo: "servidor" });
    fluxo.recuperar.mockResolvedValue([{ estado: "aguardando_servidor", produto: "p", motivo: "servidor" }]);
    const { result } = renderHook(() => useCompraApple(), { wrapper: embrulho });
    await act(async () => { await result.current.comprar("p"); });
    for (const espera of [...ESPERAS_DA_CONFIRMACAO_MS, 60_000, 60_000]) await act(async () => { await vi.advanceTimersByTimeAsync(espera); });
    expect(fluxo.recuperar).toHaveBeenCalledTimes(ESPERAS_DA_CONFIRMACAO_MS.length);
  });
});
