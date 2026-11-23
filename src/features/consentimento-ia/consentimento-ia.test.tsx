import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { iaPermitida } from "@/shared/lib/consentimento-ia";

vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "u1" } }) }));
const bd = vi.hoisted(() => ({ linha: null as { permitido: boolean } | null, upsert: vi.fn(), termos: "2026-11-23" }));
vi.mock("@/shared/api", async () => {
  const { createQueryKeys } = await import("@/shared/api/query-keys");
  return {
    createQueryKeys,
    supabase: {
      from: (t: string) => ({
        select: () => ({ eq: () => ({ maybeSingle: async () => ({
          data: t === "profiles" ? { termos_aceitos_versao: bd.termos } : bd.linha, error: null }) }) }),
        upsert: async (v: { permitido: boolean }) => { bd.upsert(v); bd.linha = { permitido: v.permitido }; return { error: null }; },
      }),
    },
  };
});
vi.mock("@/shared/hooks/use-toast", () => ({ toast: vi.fn() }));
import { ConsentimentoIaGate } from "./components/consentimento-ia-gate";

const montar = () => render(
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MemoryRouter><ConsentimentoIaGate /></MemoryRouter>
  </QueryClientProvider>,
);

describe("consentimento de IA", () => {
  beforeEach(() => { bd.linha = null; bd.termos = "2026-11-23"; bd.upsert.mockReset(); });

  it("quem ainda não respondeu vê a pergunta; Permitir salva e libera a IA", async () => {
    montar();
    expect(await screen.findByText("A VANT usa IA. Você autoriza?")).toBeInTheDocument();
    expect(screen.getByText(/Anthropic \(Claude\)/)).toBeInTheDocument();
    expect(iaPermitida()).toBe(false);
    fireEvent.click(screen.getByText("Permitir"));
    await waitFor(() => expect(bd.upsert).toHaveBeenCalledWith(expect.objectContaining({ user_id: "u1", permitido: true })));
    await waitFor(() => expect(iaPermitida()).toBe(true));
  });

  it("com os Termos desatualizados não abre: a tela dos Termos pergunta as duas coisas juntas", async () => {
    bd.termos = "2026-07-28";
    montar();
    await waitFor(() => expect(iaPermitida()).toBe(false));
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryByText("A VANT usa IA. Você autoriza?")).not.toBeInTheDocument();
  });

  it("quem já respondeu não vê a pergunta de novo", async () => {
    bd.linha = { permitido: false };
    montar();
    await waitFor(() => expect(iaPermitida()).toBe(false));
    expect(screen.queryByText("A VANT usa IA. Você autoriza?")).not.toBeInTheDocument();
  });
});
