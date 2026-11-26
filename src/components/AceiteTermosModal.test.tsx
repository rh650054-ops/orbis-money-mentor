import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const bd = vi.hoisted(() => ({ update: vi.fn(), responder: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { termos_aceitos_versao: "2026-07-28" } }) }) }),
      update: (v: unknown) => ({ eq: async () => { bd.update(v); return { error: null }; } }),
    }),
  },
}));
vi.mock("@/features/consentimento-ia", () => ({
  TextoIa: () => <p>detalhe da IA</p>,
  useResponderConsentimentoIa: () => ({ mutateAsync: async (v: boolean) => { bd.responder(v); return v; } }),
}));
import AceiteTermosModal from "./AceiteTermosModal";

const montar = () => render(
  <QueryClientProvider client={new QueryClient()}><MemoryRouter><AceiteTermosModal userId="u1" /></MemoryRouter></QueryClientProvider>,
);

describe("aceite dos Termos + permissão de IA na mesma tela", () => {
  beforeEach(() => { bd.update.mockReset(); bd.responder.mockReset(); });

  it("a caixa de IA começa desmarcada: só aceitar os Termos NÃO liga a IA", async () => {
    montar();
    const caixa = await screen.findByRole("checkbox");
    expect(caixa).not.toBeChecked();
    fireEvent.click(screen.getByText("Concordo e continuar"));
    await waitFor(() => expect(bd.responder).toHaveBeenCalledWith(false));
    expect(bd.update).toHaveBeenCalledWith(expect.objectContaining({ termos_aceitos_versao: "2026-11-26" }));
  });

  it("marcando a caixa, grava a permissão de IA", async () => {
    montar();
    fireEvent.click(await screen.findByRole("checkbox"));
    fireEvent.click(screen.getByText("Concordo e continuar"));
    await waitFor(() => expect(bd.responder).toHaveBeenCalledWith(true));
  });
});
