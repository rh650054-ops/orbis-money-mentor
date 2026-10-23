import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const rpc = vi.hoisted(() => vi.fn().mockResolvedValue({ error: null }));
const insert = vi.hoisted(() => vi.fn().mockResolvedValue({ error: null }));
vi.mock("@/shared/api", () => ({
  supabase: { rpc, from: () => ({ insert }) },
  createQueryKeys: (n: string) => ({ all: [n], byUser: (u: string) => [n, u], list: (f: unknown) => [n, f] }),
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "eu" } }) }));
import { MenuDenuncia } from "./menu-denuncia";

const wrap = (ui: React.ReactNode) => render(<QueryClientProvider client={new QueryClient()}>{ui}</QueryClientProvider>);

describe("MenuDenuncia (report and block, 23/10/2026)", () => {
  it("reports a post with the chosen reason", async () => {
    wrap(<MenuDenuncia autorId="ele" autorNome="Zé" postId="p1" />);
    fireEvent.click(screen.getByLabelText("Mais opções"));
    fireEvent.click(screen.getByText("Denunciar post"));
    fireEvent.click(screen.getByText("Golpe ou fraude"));
    await waitFor(() => expect(rpc).toHaveBeenCalledWith("community_denunciar", { p_post: "p1", p_comment: null, p_motivo: "golpe", p_detalhe: null }));
  });
  it("blocks the author", async () => {
    const onBloqueou = vi.fn();
    wrap(<MenuDenuncia autorId="ele" autorNome="Zé" commentId="c1" onBloqueou={onBloqueou} />);
    fireEvent.click(screen.getByLabelText("Mais opções"));
    fireEvent.click(screen.getByText("Bloquear Zé"));
    await waitFor(() => expect(insert).toHaveBeenCalledWith({ quem: "eu", bloqueado: "ele" }));
    await waitFor(() => expect(onBloqueou).toHaveBeenCalled());
  });
});
