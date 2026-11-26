/* Profit mission when the AI is out (26/11/2026: Cerebras and Gemini out of quota in production).
   The mission must still open with the app's own numbers: no error on screen, just no AI text. */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

const bd = vi.hoisted(() => ({ invoke: vi.fn(), rpc: vi.fn() }));
vi.mock("@/shared/api", async () => {
  const { createQueryKeys } = await import("@/shared/api/query-keys");
  return { createQueryKeys, supabase: { functions: { invoke: bd.invoke }, rpc: bd.rpc } };
});
import { useAnalisarComIaMutation } from "./use-objetivo-lucro";

const BASE = { apelido: "Teste", janela_dias: 60, dias_vendidos: 20, unidades: 400, vendas: 4000, unid_dia: 20, ticket: 10, custo_unid: 4 };
const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>;
const analisar = async () => {
  const { result } = renderHook(() => useAnalisarComIaMutation(), { wrapper });
  result.current.mutate({ alvo: 1000, dias: 15 });
  await waitFor(() => expect(result.current.isSuccess || result.current.isError).toBe(true));
  return result.current;
};

describe("missão de lucro com a IA fora do ar", () => {
  beforeEach(() => { bd.invoke.mockReset(); bd.rpc.mockReset(); });

  it("função devolve erro (502): lê os números direto do banco e segue sem o texto da IA", async () => {
    bd.invoke.mockResolvedValue({ data: null, error: new Error("Edge Function returned a non-2xx status code") });
    bd.rpc.mockResolvedValue({ data: BASE, error: null });
    const r = await analisar();
    expect(r.isSuccess).toBe(true);
    expect(bd.rpc).toHaveBeenCalledWith("objetivo_lucro_analise", { p_calote_fonte: null });
    expect(r.data).toMatchObject({ ia: null, limite: false, diasTrabalho: null });
    expect(r.data?.base.unid_dia).toBe(20);
  });

  it("função responde com os números mas sem IA: usa os números dela, sem segunda leitura", async () => {
    bd.invoke.mockResolvedValue({ data: { base: BASE, dias_trabalho: 9 }, error: null });
    const r = await analisar();
    expect(r.data).toMatchObject({ ia: null, diasTrabalho: 9 });
    expect(bd.rpc).not.toHaveBeenCalled();
  });

  it("com a IA respondendo, o plano dela vem junto", async () => {
    bd.invoke.mockResolvedValue({ data: { base: BASE, dias_trabalho: 9, ia: { veredito: "puxado", titulo: "Dá", resumo: "ok", unid_dia: 25, passos: [{ titulo: "a", texto: "b" }], fonte: "gemini" } }, error: null });
    const r = await analisar();
    expect(r.data?.ia).toMatchObject({ veredito: "puxado", unid_dia: 25, fonte: "gemini" });
  });

  it("sem IA e sem banco de dados: aí sim é erro", async () => {
    bd.invoke.mockResolvedValue({ data: null, error: new Error("offline") });
    bd.rpc.mockResolvedValue({ data: null, error: new Error("offline") });
    const r = await analisar();
    expect(r.isError).toBe(true);
  });
});
