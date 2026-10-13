import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { BaseMercado } from "../lib/mercado";
import type { ConcluirCompra, ResultadoCompra } from "../api/use-concluir-compra-mutation";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "u1" } }) }));
vi.mock("@/shared/hooks/use-toast", () => ({ toast: vi.fn() }));

const base: BaseMercado = {
  ingredientes: [
    { id: "lc", name: "Leite condensado", unit: "un", stock_quantity: 0, cost_per_unit: 0 },
    { id: "cl", name: "Creme de leite", unit: "un", stock_quantity: 0, cost_per_unit: 0 },
  ],
  receitas: [
    { product_id: "b", ingredient_id: "lc", quantity: 1 },
    { product_id: "b", ingredient_id: "cl", quantity: 1 },
  ],
  produtos: [{ id: "b", name: "Batida", emoji: "🥤", cost: 0, stock_quantity: 0, recipe_mode: "batch", batch_yield: 20, origem: "faz" }],
};
vi.mock("../api/use-mercado-query", () => ({
  useMercadoQuery: () => ({ data: base, isLoading: false, isError: false, refetch: vi.fn() }),
}));

const mutate = vi.fn((_c: ConcluirCompra, opts: { onSuccess: (r: ResultadoCompra) => void }) =>
  opts.onSuccess({
    compra_id: "c1", total: 570,
    produtos: [{ id: "b", nome: "Batida", receitas: 57, unidades: 1140, custo_antes: 0, custo_depois: 0.5 }],
  }));
vi.mock("../api/use-concluir-compra-mutation", () => ({
  useConcluirCompraMutation: () => ({ mutate, isPending: false }),
}));

import MercadoPage from "./mercado-page";

describe("Tô no mercado", () => {
  it("shows the live preview and concludes the purchase", () => {
    render(<MemoryRouter><MercadoPage /></MemoryRouter>);
    expect(screen.getByText("Tô no mercado")).toBeTruthy();
    const concluir = screen.getByText("CONCLUIR COMPRA");
    expect(concluir.closest("button")?.disabled).toBe(true);

    fireEvent.click(screen.getByText("+ Leite condensado"));
    fireEvent.click(screen.getByText("+ Creme de leite"));
    const qtds = screen.getAllByLabelText("Quantos");
    for (const q of qtds) fireEvent.change(q, { target: { value: "57" } });

    expect(screen.getByText(/Batida · 57 receitas/)).toBeTruthy();
    expect(screen.getByText(/1\.140 un/)).toBeTruthy();

    fireEvent.click(screen.getByText("CONCLUIR COMPRA"));
    expect(mutate).toHaveBeenCalledTimes(1);
    const enviado = mutate.mock.calls[0]?.[0];
    expect(enviado?.itens).toEqual([
      { tipo: "ingrediente", id: "lc", nome: "Leite condensado", qtd: 57, preco_unit: null, para: ["b"] },
      { tipo: "ingrediente", id: "cl", nome: "Creme de leite", qtd: 57, preco_unit: null, para: ["b"] },
    ]);
    expect(screen.getByText("Compra anotada ✅")).toBeTruthy();
    expect(screen.getByText("+1.140 Batida no estoque")).toBeTruthy();
  });
});
