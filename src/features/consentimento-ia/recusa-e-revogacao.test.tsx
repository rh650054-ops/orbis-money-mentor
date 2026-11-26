/* Refusal and revocation of the AI permission (26/11/2026, App Review 5.1.1(i) / 5.1.2(i)):
   "Agora não" on the first question and the switch in Minha Conta both record a refusal on the
   CURRENT disclosure version and close the app's own gate at once. */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { iaPermitida, VERSAO_DIVULGACAO_IA } from "@/shared/lib/consentimento-ia";

vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "u1" } }) }));
const bd = vi.hoisted(() => ({ linha: null as { permitido: boolean; versao?: string } | null, rpc: vi.fn() }));
vi.mock("@/shared/api", async () => {
  const { createQueryKeys } = await import("@/shared/api/query-keys");
  return {
    createQueryKeys,
    supabase: {
      from: (t: string) => ({
        select: () => ({ eq: () => ({ maybeSingle: async () => ({
          data: t === "profiles" ? { termos_aceitos_versao: "2026-11-26" } : bd.linha, error: null }) }) }),
      }),
      rpc: async (fn: string, a: { p_permitido: boolean; p_versao: string }) => { bd.rpc({ fn, ...a }); bd.linha = { permitido: a.p_permitido, versao: a.p_versao }; return { error: null }; },
    },
  };
});
vi.mock("@/shared/hooks/use-toast", () => ({ toast: vi.fn() }));
import { ConsentimentoIaGate } from "./components/consentimento-ia-gate";
import { IaContaCard } from "./components/ia-conta-card";

const montar = (ui: React.ReactNode) => render(
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MemoryRouter>{ui}</MemoryRouter>
  </QueryClientProvider>,
);
const RECUSA = { fn: "responder_consentimento_ia", p_permitido: false, p_versao: VERSAO_DIVULGACAO_IA };

describe("recusa e revogação da IA", () => {
  beforeEach(() => { bd.linha = null; bd.rpc.mockReset(); });

  it("recusa: 'Agora não' grava a recusa no texto atual, a IA fica fechada e a pergunta some", async () => {
    montar(<ConsentimentoIaGate />);
    expect(await screen.findByText("A VANT usa IA. Você autoriza?")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Agora não"));
    await waitFor(() => expect(bd.rpc).toHaveBeenCalledWith(expect.objectContaining(RECUSA)));
    expect(bd.rpc).toHaveBeenCalledTimes(1);
    expect(iaPermitida()).toBe(false);
    await waitFor(() => expect(screen.queryByText("A VANT usa IA. Você autoriza?")).not.toBeInTheDocument());
  });

  it("revogação: desligar em Minha Conta grava a recusa e fecha a IA na hora", async () => {
    bd.linha = { permitido: true, versao: VERSAO_DIVULGACAO_IA };
    montar(<IaContaCard />);
    const chave = await screen.findByRole("switch", { name: "Usar IA na VANT" });
    await waitFor(() => expect(chave).toHaveAttribute("aria-checked", "true"));
    await waitFor(() => expect(iaPermitida()).toBe(true));
    fireEvent.click(chave);
    await waitFor(() => expect(bd.rpc).toHaveBeenCalledWith(expect.objectContaining(RECUSA)));
    await waitFor(() => expect(iaPermitida()).toBe(false));
    await waitFor(() => expect(chave).toHaveAttribute("aria-checked", "false"));
    expect(screen.getByText(/Nada é enviado pra IA/)).toBeInTheDocument();
  });

  it("ligar de novo em Minha Conta grava a autorização no texto atual", async () => {
    bd.linha = { permitido: false, versao: VERSAO_DIVULGACAO_IA };
    montar(<IaContaCard />);
    const chave = await screen.findByRole("switch", { name: "Usar IA na VANT" });
    await waitFor(() => expect(chave).not.toBeDisabled());
    fireEvent.click(chave);
    await waitFor(() => expect(bd.rpc).toHaveBeenCalledWith(expect.objectContaining({ ...RECUSA, p_permitido: true })));
    await waitFor(() => expect(iaPermitida()).toBe(true));
  });

  it("autorização no texto anterior (26/11) aparece desligada em Minha Conta (nada é enviado)", async () => {
    bd.linha = { permitido: true, versao: "2026-11-26" };
    montar(<IaContaCard />);
    const chave = await screen.findByRole("switch", { name: "Usar IA na VANT" });
    await waitFor(() => expect(chave).not.toBeDisabled());
    expect(chave).toHaveAttribute("aria-checked", "false");
    expect(iaPermitida()).toBe(false);
  });
});
