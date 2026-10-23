import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
import { act, renderHook } from "@testing-library/react";

const toast = vi.fn();
vi.mock("@/shared/hooks/use-toast", () => ({ toast: (...a: unknown[]) => toast(...a) }));
import { useVoltaDoCheckout, POLL_MS, JANELA_POLL_MS, ATRASO_LIBERAR_MS } from "./useVoltaDoCheckout";
import { checkoutAbertoEm, limparCheckoutAberto } from "@/shared/lib/checkout";

const marcarClique = () => {
  localStorage.setItem("vant_checkout_aberto_em", String(Date.now()));
  window.dispatchEvent(new CustomEvent("vant:checkout-aberto"));
};
const flush = async () => { await act(async () => { await Promise.resolve(); }); };

describe("useVoltaDoCheckout", () => {
  beforeEach(() => { vi.useFakeTimers(); toast.mockClear(); limparCheckoutAberto(); });
  afterEach(() => { vi.useRealTimers(); limparCheckoutAberto(); });

  it("does nothing until a checkout link was tapped", async () => {
    const verificar = vi.fn().mockResolvedValue(true);
    renderHook(() => useVoltaDoCheckout({ ativo: true, verificar, aoLiberar: vi.fn() }));
    await act(async () => { vi.advanceTimersByTime(POLL_MS * 3); });
    window.dispatchEvent(new Event("focus"));
    await flush();
    expect(verificar).not.toHaveBeenCalled();
  });

  it("polls every 5s after the tap and releases on success", async () => {
    let pago = false;
    const verificar = vi.fn(async () => pago);
    const aoLiberar = vi.fn();
    renderHook(() => useVoltaDoCheckout({ ativo: true, verificar, aoLiberar }));
    act(() => marcarClique());

    await act(async () => { vi.advanceTimersByTime(POLL_MS); });
    expect(verificar).toHaveBeenCalledTimes(1);
    expect(aoLiberar).not.toHaveBeenCalled();

    pago = true;
    await act(async () => { vi.advanceTimersByTime(POLL_MS); });
    await flush();
    expect(toast).toHaveBeenCalledWith({ title: "Pagamento confirmado! Liberando o app…" });
    expect(checkoutAbertoEm()).toBeNull();
    await act(async () => { vi.advanceTimersByTime(ATRASO_LIBERAR_MS); });
    expect(aoLiberar).toHaveBeenCalledTimes(1);

    await act(async () => { vi.advanceTimersByTime(POLL_MS * 4); });
    expect(verificar).toHaveBeenCalledTimes(2); // stopped after success
  });

  it("re-checks when the app comes back to the front", async () => {
    const verificar = vi.fn().mockResolvedValue(false);
    renderHook(() => useVoltaDoCheckout({ ativo: true, verificar, aoLiberar: vi.fn() }));
    act(() => marcarClique());
    window.dispatchEvent(new Event("focus"));
    await flush();
    document.dispatchEvent(new Event("visibilitychange"));
    await flush();
    expect(verificar).toHaveBeenCalledTimes(2);
  });

  it("stops polling after 10 minutes and on unmount", async () => {
    const verificar = vi.fn().mockResolvedValue(false);
    const { unmount } = renderHook(() => useVoltaDoCheckout({ ativo: true, verificar, aoLiberar: vi.fn() }));
    act(() => marcarClique());
    await act(async () => { await vi.advanceTimersByTimeAsync(JANELA_POLL_MS + POLL_MS * 2); });
    const n = verificar.mock.calls.length;
    expect(n).toBeGreaterThanOrEqual(JANELA_POLL_MS / POLL_MS - 1);
    expect(n).toBeLessThanOrEqual(JANELA_POLL_MS / POLL_MS);
    await act(async () => { vi.advanceTimersByTime(POLL_MS * 5); });
    expect(verificar).toHaveBeenCalledTimes(n);

    unmount();
    window.dispatchEvent(new Event("focus"));
    await flush();
    expect(verificar).toHaveBeenCalledTimes(n);
  });

  it("stays quiet while the paywall is not on screen", async () => {
    const verificar = vi.fn().mockResolvedValue(true);
    renderHook(() => useVoltaDoCheckout({ ativo: false, verificar, aoLiberar: vi.fn() }));
    act(() => marcarClique());
    await act(async () => { vi.advanceTimersByTime(POLL_MS * 3); });
    expect(verificar).not.toHaveBeenCalled();
  });
});
