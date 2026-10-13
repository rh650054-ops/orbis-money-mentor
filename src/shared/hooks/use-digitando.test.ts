import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDigitando } from "./use-digitando";

const TEXTO = "Fechou! Vou fazer um esboço pra gente olhar junto.\n[[adesivo:https://x.co/a.png]]";

describe("useDigitando", () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it("começa vazio, vai aparecendo e termina com o texto inteiro em menos de 3s", () => {
    const { result } = renderHook(() => useDigitando(TEXTO, true));
    expect(result.current.visivel).toBe("");
    act(() => { vi.advanceTimersByTime(200); });
    expect(result.current.visivel.length).toBeGreaterThan(0);
    expect(result.current.visivel).not.toContain("[[adesivo");
    act(() => { vi.advanceTimersByTime(3000); });
    expect(result.current.visivel).toBe(TEXTO);
    expect(result.current.digitando).toBe(false);
  });

  it("histórico (inativo) aparece pronto", () => {
    const { result } = renderHook(() => useDigitando(TEXTO, false));
    expect(result.current.visivel).toBe(TEXTO);
  });

  it("tocar pula pro fim", () => {
    const { result } = renderHook(() => useDigitando(TEXTO, true));
    act(() => { result.current.pular(); });
    expect(result.current.visivel).toBe(TEXTO);
  });
});
