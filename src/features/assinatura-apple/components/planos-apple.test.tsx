/* The account already has its Apple plan (27/11/2026, first Sandbox purchase recovered in the
   background): on the blocking end-of-trial screen it is told so and continues; it is never offered
   to "change" to the plan it already has. */
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PRODUTO } from "../types";

vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "u1" } }) }));
const oferta = { plano: "trocar", banco: "bloqueado", apple: { produto: "app.vant.vendas.pro.anual" } };
vi.mock("../api/use-apple-queries", () => ({
  useOfertaAppleQuery: () => ({ data: oferta, isLoading: false, isError: false, refetch: vi.fn() }),
  useProdutosAppleQuery: () => ({
    data: [
      { id: "app.vant.vendas.essencial.mensal", nome: "", descricao: "", preco: "29.9", precoFormatado: "R$ 29,90", moeda: "BRL", periodo: { unidade: "mes", valor: 1 } },
      { id: "app.vant.vendas.pro.mensal", nome: "", descricao: "", preco: "49.9", precoFormatado: "R$ 49,90", moeda: "BRL", periodo: { unidade: "mes", valor: 1 } },
      { id: "app.vant.vendas.pro.anual", nome: "", descricao: "", preco: "399.9", precoFormatado: "R$ 399,90", moeda: "BRL", periodo: { unidade: "ano", valor: 1 } },
    ], isLoading: false, isError: false, refetch: vi.fn(),
  }),
}));
vi.mock("../api/use-compra-apple", () => ({
  useCompraApple: () => ({ fase: "parado", resultado: null, aviso: null, comprar: vi.fn(), tentarDeNovo: vi.fn(), restaurar: vi.fn(), gerenciar: vi.fn(), fechar: vi.fn() }),
}));

import { PlanosApple } from "./planos-apple";

describe("an account whose Apple plan is already on", () => {
  it("on the blocking screen: 'your subscription is active' and Continue, no plans to buy", () => {
    const continuar = vi.fn();
    render(<PlanosApple aoTerPlano={continuar} />);
    expect(screen.getByRole("status").textContent).toContain("Sua assinatura está ativa");
    expect(screen.getByRole("status").textContent).toContain("O Pro anual pela Apple já está liberado");
    expect(screen.queryByRole("region", { name: "Escolha seu plano" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    expect(continuar).toHaveBeenCalledTimes(1);
  });

  it("elsewhere (changing plan): its own plan is marked; its details say 'Seu plano atual' (off); another plan's details offer 'Trocar para'", () => {
    render(<PlanosApple />);
    const anual = screen.getByRole("button", { name: /^Pro anual,/ });
    expect(anual.textContent).toContain("SEU PLANO");
    fireEvent.click(anual);
    expect(screen.getByRole("button", { name: /^Seu plano atual/ })).toBeDisabled();
    expect(screen.queryByRole("button", { name: /^Trocar para Pro anual/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Escolher outro plano/ }));
    fireEvent.click(screen.getByRole("button", { name: /^Essencial,/ }));
    expect(screen.getByRole("button", { name: /^Trocar para Essencial/ })).toBeEnabled();
    expect(PRODUTO.proAnual).toBe("app.vant.vendas.pro.anual");
  });

});
