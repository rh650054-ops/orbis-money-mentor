/* The bank add-on is out of the first iPhone version (27/11/2026): the card says so, with no price,
   no purchase button and no link to the website. */
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "u1" } }) }));
vi.mock("../api/use-apple-queries", () => ({
  useOfertaAppleQuery: () => ({ data: { plano: "livre", motivo: null, apple: null, banco: "livre" }, isLoading: false }),
  useProdutosAppleQuery: () => ({ data: [], isLoading: false }),
}));
vi.mock("../api/use-compra-apple", () => ({ useCompraApple: () => ({ resultado: null, fase: "parado", comprar: vi.fn() }) }));

import { BancoAdicionalApple } from "./banco-adicional-apple";

describe("BancoAdicionalApple", () => {
  it("does not sell the add-on on the iPhone yet, even when the server would say it is free", () => {
    render(<BancoAdicionalApple usados={1} onFechar={() => {}} />);
    expect(screen.getByText("O banco adicional ainda não está disponível no iPhone.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Adicionar banco/ })).toBeNull();
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByRole("button", { name: "agora não" })).toBeInTheDocument();
  });
});
