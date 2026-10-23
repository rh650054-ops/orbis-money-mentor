import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const rpc = vi.hoisted(() => vi.fn());
vi.mock("@/shared/api", () => ({
  supabase: { rpc },
  createQueryKeys: (n: string) => ({ all: [n], list: (f: unknown) => [n, f], byUser: (u: string) => [n, u] }),
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
import AssinarPage from "./assinar-page";

const abrir = (url: string) => render(
  <QueryClientProvider client={new QueryClient()}><MemoryRouter initialEntries={[url]}><AssinarPage /></MemoryRouter></QueryClientProvider>,
);

describe("/assinar (opened from the store app, 23/10/2026)", () => {
  it("shows the 3 plans and sends the Pro monthly to its Hotmart offer", () => {
    abrir("/assinar");
    expect(screen.getByText("VANT Essencial")).toBeTruthy();
    const cta = screen.getByText("Assinar por R$ 49,90/mês").closest("a");
    expect(cta?.getAttribute("href")).toContain("off=5y86n311");
    fireEvent.click(screen.getByText("VANT Pro Anual"));
    expect(screen.getByText("Assinar por R$ 418,80/ano").closest("a")?.getAttribute("href")).toContain("off=ew11enu0");
  });
  it("with a token: knows who is subscribing and prefills Hotmart", async () => {
    rpc.mockResolvedValueOnce({ data: [{ nome: "Zé", email: "ze@x.com", telefone: "11999990000", user_id: "u1", plano_atual: null }], error: null });
    abrir("/assinar?t=abc");
    await waitFor(() => expect(screen.getByText("Zé")).toBeTruthy());
    const href = screen.getByText("Assinar por R$ 49,90/mês").closest("a")?.getAttribute("href") ?? "";
    expect(href).toContain("email=ze%40x.com");
    expect(href).toContain("xcod=u1");
  });
  it("Essencial subscriber: upgrade only, no Essencial card", async () => {
    rpc.mockResolvedValueOnce({ data: [{ nome: "Zé", email: null, telefone: null, user_id: "u1", plano_atual: "essencial" }], error: null });
    abrir("/assinar?t=abc");
    await waitFor(() => expect(screen.getByText("Suba pro VANT Pro")).toBeTruthy());
    expect(screen.queryByText("VANT Essencial")).toBeNull();
  });
});
