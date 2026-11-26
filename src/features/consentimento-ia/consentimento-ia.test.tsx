import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { iaPermitida } from "@/shared/lib/consentimento-ia";

vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "u1" } }) }));
const bd = vi.hoisted(() => ({ linha: null as { permitido: boolean; versao?: string } | null, upsert: vi.fn(), termos: "2026-11-26" }));
vi.mock("@/shared/api", async () => {
  const { createQueryKeys } = await import("@/shared/api/query-keys");
  return {
    createQueryKeys,
    supabase: {
      from: (t: string) => ({
        select: () => ({ eq: () => ({ maybeSingle: async () => ({
          data: t === "profiles" ? { termos_aceitos_versao: bd.termos } : bd.linha, error: null }) }) }),
      }),
      rpc: async (fn: string, a: { p_permitido: boolean; p_versao: string }) => { bd.upsert({ fn, ...a }); bd.linha = { permitido: a.p_permitido, versao: a.p_versao }; return { error: null }; },
    },
  };
});
vi.mock("@/shared/hooks/use-toast", () => ({ toast: vi.fn() }));
import { ConsentimentoIaGate } from "./components/consentimento-ia-gate";

const montar = (rota = "/") => render(
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MemoryRouter initialEntries={[rota]}><ConsentimentoIaGate /></MemoryRouter>
  </QueryClientProvider>,
);

describe("consentimento de IA", () => {
  beforeEach(() => { bd.linha = null; bd.termos = "2026-11-26"; bd.upsert.mockReset(); });

  it("quem ainda não respondeu vê a pergunta; Permitir salva e libera a IA", async () => {
    montar();
    expect(await screen.findByText("A VANT usa IA. Você autoriza?")).toBeInTheDocument();
    expect(screen.getAllByText(/Anthropic \(Claude\)/).length).toBeGreaterThan(0);
    expect(screen.getByText("Cerebras")).toBeInTheDocument();
    expect(screen.getByText("Comprovante do X1")).toBeInTheDocument();
    expect(iaPermitida()).toBe(false);
    fireEvent.click(screen.getByText("Permitir"));
    await waitFor(() => expect(bd.upsert).toHaveBeenCalledWith(expect.objectContaining({ fn: "responder_consentimento_ia", p_permitido: true, p_versao: "2026-11-26" })));
    await waitFor(() => expect(iaPermitida()).toBe(true));
  });

  it("com os Termos desatualizados não abre: a tela dos Termos pergunta as duas coisas juntas", async () => {
    bd.termos = "2026-07-28";
    montar();
    await waitFor(() => expect(iaPermitida()).toBe(false));
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryByText("A VANT usa IA. Você autoriza?")).not.toBeInTheDocument();
  });

  it("nunca abre por cima do onboarding (roubava o foco e o teclado do iPhone piscava)", async () => {
    montar("/onboarding-novo");
    await new Promise((r) => setTimeout(r, 30));
    expect(screen.queryByText("A VANT usa IA. Você autoriza?")).not.toBeInTheDocument();
  });

  it("autorização dada no texto antigo (sem Cerebras) não vale: pergunta de novo e a IA fica fechada", async () => {
    bd.linha = { permitido: true, versao: "2026-11-23" };
    montar();
    expect(await screen.findByText("A VANT usa IA. Você autoriza?")).toBeInTheDocument();
    expect(iaPermitida()).toBe(false);
  });

  it("quem já respondeu não vê a pergunta de novo", async () => {
    bd.linha = { permitido: false, versao: "2026-11-26" };
    montar();
    await waitFor(() => expect(iaPermitida()).toBe(false));
    expect(screen.queryByText("A VANT usa IA. Você autoriza?")).not.toBeInTheDocument();
  });
});
