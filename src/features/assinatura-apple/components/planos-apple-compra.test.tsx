/* Paywall V3 with its real data path (offer from the server, prices from StoreKit, Apple's purchase
   hook): a free account picks each plan on the first screen and buys it on the second one. The
   product sent to Apple is always the plan's own identifier, never the bank add-on. */
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PRODUTO } from "../types";

vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "u1" } }) }));
vi.mock("../api/use-apple-queries", () => ({
  useOfertaAppleQuery: () => ({ data: { plano: "livre", banco: "bloqueado", apple: null }, isLoading: false, isError: false, refetch: vi.fn() }),
  useProdutosAppleQuery: () => ({
    data: [
      { id: "app.vant.vendas.essencial.mensal", nome: "", descricao: "", preco: "29.9", precoFormatado: "R$ 29,90", moeda: "BRL", periodo: { unidade: "mes", valor: 1 } },
      { id: "app.vant.vendas.pro.mensal", nome: "", descricao: "", preco: "49.9", precoFormatado: "R$ 49,90", moeda: "BRL", periodo: { unidade: "mes", valor: 1 } },
      { id: "app.vant.vendas.pro.anual", nome: "", descricao: "", preco: "399.9", precoFormatado: "R$ 399,90", moeda: "BRL", periodo: { unidade: "ano", valor: 1 } },
    ], isLoading: false, isError: false, refetch: vi.fn(),
  }),
}));
const comprar = vi.fn(async () => undefined);
const restaurar = vi.fn(async () => undefined);
vi.mock("../api/use-compra-apple", () => ({
  useCompraApple: () => ({ fase: "parado", resultado: null, aviso: null, comprar, tentarDeNovo: vi.fn(), restaurar, gerenciar: vi.fn(), fechar: vi.fn() }),
}));

import { PlanosApple } from "./planos-apple";

describe("buying from the Paywall V3", () => {
  beforeEach(() => { comprar.mockClear(); restaurar.mockClear(); });

  it.each([["Pro anual", PRODUTO.proAnual], ["Pro mensal", PRODUTO.proMensal], ["Essencial", PRODUTO.essencial]])(
    "%s: card → details → Apple's purchase with the plan's own product id", (titulo, produto) => {
      render(<PlanosApple />);
      fireEvent.click(screen.getByRole("button", { name: new RegExp(`^${titulo},`) }));
      fireEvent.click(screen.getByRole("button", { name: new RegExp(`^Assinar ${titulo}`) }));
      expect(comprar).toHaveBeenCalledTimes(1);
      expect(comprar).toHaveBeenCalledWith(produto);
      expect(comprar).not.toHaveBeenCalledWith(PRODUTO.banco);
    });

  it("going back and choosing another plan buys the new one", () => {
    render(<PlanosApple />);
    fireEvent.click(screen.getByRole("button", { name: /^Pro anual,/ }));
    fireEvent.click(screen.getByRole("button", { name: /Escolher outro plano/ }));
    fireEvent.click(screen.getByRole("button", { name: /^Essencial,/ }));
    fireEvent.click(screen.getByRole("button", { name: /^Assinar Essencial/ }));
    expect(comprar).toHaveBeenCalledWith(PRODUTO.essencial);
  });

  it("restore from either screen", () => {
    render(<PlanosApple />);
    fireEvent.click(screen.getByRole("button", { name: "Restaurar compras" }));
    fireEvent.click(screen.getByRole("button", { name: /^Pro mensal,/ }));
    fireEvent.click(screen.getByRole("button", { name: "Restaurar compras" }));
    expect(restaurar).toHaveBeenCalledTimes(2);
    expect(comprar).not.toHaveBeenCalled();
  });
});
