/* 29/10 (Rick): Pro de cortesia sem banco pago compra o banco avulso, não o Pro. */
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("@/hooks/useCheckoutUrl", () => ({ useCheckoutUrl: () => (url: string) => url }));
vi.mock("@/shared/lib/cobranca-loja", () => ({ podeMostrarAssinatura: () => true }));
import { VitrineCortesia } from "./components/vitrine/vitrine-cortesia";

describe("vitrine da cortesia", () => {
  it("mostra o banco avulso com o link da Hotmart, sem os planos do Pro", () => {
    render(<VitrineCortesia email="x@y.com" />);
    const a = screen.getByRole("link", { name: /LIGAR UM BANCO/ });
    expect(a.getAttribute("href")).toContain("sck=banco_extra");
    expect(screen.getByText(/3 assinaturas de banco/)).toBeTruthy();
    expect(screen.queryByText(/Escolha seu plano/)).toBeNull();
  });
});
