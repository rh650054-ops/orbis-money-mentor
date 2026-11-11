// A1 — what the vendor is told, and what the app does, for each way the bank screen can end.
// SIMULATED: ligarBanco (the Pluggy screen) and salvarBanco (the server) are stand-ins.
import type { ReactNode } from "react";
import { act, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

const ligarBanco = vi.fn();
const salvarBanco = vi.fn();
const toast = vi.fn();
const tentativaPendente = vi.fn(() => false);
const limparTentativa = vi.fn();
vi.mock("@/components/conectar/pluggy", () => ({
  ligarBanco: (...a: unknown[]) => ligarBanco(...a), salvarBanco: (...a: unknown[]) => salvarBanco(...a),
  tentativaPendente: () => tentativaPendente(), limparTentativa: () => limparTentativa(),
}));
vi.mock("@/shared/hooks/use-toast", () => ({ toast: (...a: unknown[]) => toast(...a) }));
vi.mock("./keys", () => ({ venderKeys: { all: ["vender"] } }));

import { AVISO_DO_ERRO, useLigarBanco } from "./use-ligar-banco";
import { RELEITURAS_MS, useRetornoDoBanco } from "./use-retorno-do-banco";

let qc: QueryClient;
let releu: ReturnType<typeof vi.spyOn>;
const envolto = ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>;

beforeEach(() => {
  ligarBanco.mockReset(); salvarBanco.mockReset(); toast.mockReset(); tentativaPendente.mockReset(); limparTentativa.mockReset();
  tentativaPendente.mockReturnValue(false);
  qc = new QueryClient();
  releu = vi.spyOn(qc, "invalidateQueries").mockResolvedValue(undefined);
});

describe("useLigarBanco", () => {
  it("first bank connected: saves it, re-reads the list and says so", async () => {
    ligarBanco.mockResolvedValue({ itemId: "item-1" });
    salvarBanco.mockResolvedValue({ ok: true, banco: "Nubank", verificado: false, entradas: 0 });
    const { result } = renderHook(() => useLigarBanco(false), { wrapper: envolto });
    await act(() => result.current.ligar());
    expect(salvarBanco).toHaveBeenCalledWith("item-1");
    expect(releu).toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Nubank conectado" }));
    expect(result.current.ligando).toBe(false);
  });

  it("second bank connected: asks what it is for", async () => {
    ligarBanco.mockResolvedValue({ itemId: "item-2" });
    salvarBanco.mockResolvedValue({ ok: true, banco: "Itaú", verificado: true, entradas: 0 });
    const { result } = renderHook(() => useLigarBanco(true), { wrapper: envolto });
    await act(() => result.current.ligar());
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Itaú conectado · diga pra que serve" }));
  });

  it("reauthorised: passes the item on and does not call it a new connection", async () => {
    ligarBanco.mockResolvedValue({ itemId: "item-7" });
    salvarBanco.mockResolvedValue({ ok: true, banco: "Cora", verificado: true, entradas: 0 });
    const { result } = renderHook(() => useLigarBanco(true), { wrapper: envolto });
    await act(() => result.current.ligar("item-7"));
    expect(ligarBanco).toHaveBeenCalledWith(expect.any(Function), "item-7");
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Cora autorizado de novo" }));
  });

  it("no slot: shows the extra-bank offer, no error toast", async () => {
    ligarBanco.mockResolvedValue({ erro: "precisa_banco_extra" });
    const { result } = renderHook(() => useLigarBanco(true), { wrapper: envolto });
    await act(() => result.current.ligar());
    expect(result.current.precisaExtra).toBe(true);
    expect(toast).not.toHaveBeenCalled();
    act(() => result.current.fecharExtra());
    expect(result.current.precisaExtra).toBe(false);
  });

  it("cancelled: silent, only re-reads the list", async () => {
    ligarBanco.mockResolvedValue({ erro: "cancelou" });
    const { result } = renderHook(() => useLigarBanco(false), { wrapper: envolto });
    await act(() => result.current.ligar());
    expect(toast).not.toHaveBeenCalled();
    expect(salvarBanco).not.toHaveBeenCalled();
    expect(releu).toHaveBeenCalled();
  });

  it.each(["precisa_pro", "sem_internet", "sem_login", "provedor_fora", "nao_concluiu", "pluggy_nao_configurado"] as const)(
    "%s: its own message, nothing saved", async (erro) => {
      ligarBanco.mockResolvedValue({ erro });
      const { result } = renderHook(() => useLigarBanco(false), { wrapper: envolto });
      await act(() => result.current.ligar());
      expect(toast).toHaveBeenCalledWith({ title: AVISO_DO_ERRO[erro]!.titulo, description: AVISO_DO_ERRO[erro]!.texto, variant: "destructive" });
      expect(salvarBanco).not.toHaveBeenCalled();
      expect(result.current.ligando).toBe(false);
    });

  it("each cause has a different text, and none tells the vendor to disconnect or reconnect", () => {
    const textos = Object.values(AVISO_DO_ERRO).map((a) => `${a!.titulo} ${a!.texto}`);
    expect(new Set(textos).size).toBe(textos.length);
    for (const t of textos) expect(t).not.toMatch(/desconect|reconect|conect[ae] de novo/i);
  });

  it("the bank is no longer the vendor's: says so and re-reads the list", async () => {
    ligarBanco.mockResolvedValue({ erro: "banco_nao_encontrado" });
    const { result } = renderHook(() => useLigarBanco(true), { wrapper: envolto });
    await act(() => result.current.ligar("item-velho"));
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Esse banco não está mais ligado aqui" }));
    expect(releu).toHaveBeenCalled();
  });

  it("unknown error: generic message", async () => {
    ligarBanco.mockResolvedValue({ erro: "erro" });
    const { result } = renderHook(() => useLigarBanco(false), { wrapper: envolto });
    await act(() => result.current.ligar());
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Não deu certo", description: "Tenta de novo em instantes." }));
  });

  it("already open (repeated tap): nothing at all", async () => {
    ligarBanco.mockResolvedValue({ erro: "ja_aberto" });
    const { result } = renderHook(() => useLigarBanco(false), { wrapper: envolto });
    await act(() => result.current.ligar());
    expect(toast).not.toHaveBeenCalled();
    expect(releu).not.toHaveBeenCalled();
  });

  it("two taps before the screen re-renders: the Pluggy screen is asked for once", async () => {
    let terminar: (v: unknown) => void = () => {};
    ligarBanco.mockReturnValue(new Promise((r) => { terminar = r; }));
    const { result } = renderHook(() => useLigarBanco(false), { wrapper: envolto });
    let a: Promise<void>, b: Promise<void>;
    act(() => { a = result.current.ligar(); b = result.current.ligar(); });
    expect(ligarBanco).toHaveBeenCalledTimes(1);
    await act(async () => { terminar({ erro: "cancelou" }); await a; await b; });
    await act(() => result.current.ligar()); // and it works again afterwards
    expect(ligarBanco).toHaveBeenCalledTimes(2);
  });

  it("the button is released as soon as the Pluggy screen is in front", async () => {
    let terminar: (v: unknown) => void = () => {};
    ligarBanco.mockImplementation((aoAbrir: () => void) => { aoAbrir(); return new Promise((r) => { terminar = r; }); });
    const { result } = renderHook(() => useLigarBanco(false), { wrapper: envolto });
    let p: Promise<void>;
    act(() => { p = result.current.ligar(); });
    expect(result.current.ligando).toBe(false);
    await act(async () => { terminar({ erro: "cancelou" }); await p; });
  });

  it("the screen throws: generic message, button released", async () => {
    ligarBanco.mockRejectedValue(new Error("boom"));
    const { result } = renderHook(() => useLigarBanco(false), { wrapper: envolto });
    await act(() => result.current.ligar());
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Não deu certo" }));
    expect(result.current.ligando).toBe(false);
  });

  it("connected at Pluggy but saving failed: says it could not save, and still re-reads the list", async () => {
    ligarBanco.mockResolvedValue({ itemId: "item-1" });
    salvarBanco.mockResolvedValue({ ok: false, erro: "erro" });
    const { result } = renderHook(() => useLigarBanco(false), { wrapper: envolto });
    await act(() => result.current.ligar());
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Não deu pra salvar" }));
    expect(releu).toHaveBeenCalled();
  });
});

describe("useRetornoDoBanco: coming back from the bank's app", () => {
  it("a connection was in progress: re-reads the list now and twice more, then forgets it", async () => {
    vi.useFakeTimers();
    tentativaPendente.mockReturnValue(true);
    renderHook(() => useRetornoDoBanco(true), { wrapper: envolto });
    await vi.advanceTimersByTimeAsync(0);
    expect(releu).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(Math.max(...RELEITURAS_MS));
    expect(releu).toHaveBeenCalledTimes(RELEITURAS_MS.length);
    expect(limparTentativa).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it("nothing was in progress: reads nothing extra", async () => {
    vi.useFakeTimers();
    renderHook(() => useRetornoDoBanco(true), { wrapper: envolto });
    await vi.advanceTimersByTimeAsync(30_000);
    expect(releu).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("the app comes back to the front later: checks then", async () => {
    vi.useFakeTimers();
    renderHook(() => useRetornoDoBanco(true), { wrapper: envolto });
    tentativaPendente.mockReturnValue(true);
    document.dispatchEvent(new Event("visibilitychange"));
    await vi.advanceTimersByTimeAsync(0);
    expect(releu).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it("not logged in: does nothing", async () => {
    vi.useFakeTimers();
    tentativaPendente.mockReturnValue(true);
    renderHook(() => useRetornoDoBanco(false), { wrapper: envolto });
    await vi.advanceTimersByTimeAsync(30_000);
    expect(releu).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("leaving the screen cancels the pending re-reads", async () => {
    vi.useFakeTimers();
    tentativaPendente.mockReturnValue(true);
    const { unmount } = renderHook(() => useRetornoDoBanco(true), { wrapper: envolto });
    await vi.advanceTimersByTimeAsync(0);
    unmount();
    await vi.advanceTimersByTimeAsync(30_000);
    expect(releu).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});
