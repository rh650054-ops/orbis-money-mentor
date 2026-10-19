import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { BaseMercado } from "../lib/mercado";
import type { ConcluirCompra, ResultadoCompra } from "../api/use-concluir-compra-mutation";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "u1" } }) }));
vi.mock("@/shared/hooks/use-toast", () => ({ toast: vi.fn() }));

const base: BaseMercado = {
  ingredientes: [
    { id: "lc", name: "Leite condensado", unit: "un", stock_quantity: 0, cost_per_unit: 4.5 },
    { id: "cl", name: "Creme de leite", unit: "un", stock_quantity: 0, cost_per_unit: 2.29 },
  ],
  receitas: [
    { product_id: "b", ingredient_id: "lc", quantity: 1 },
    { product_id: "b", ingredient_id: "cl", quantity: 1 },
  ],
  produtos: [
    { id: "b", name: "Batida", emoji: "🥤", cost: 0.6, stock_quantity: 0, recipe_mode: "batch", batch_yield: 20, origem: "faz", sale_price: 8 },
    { id: "t", name: "Trufa", emoji: "🍫", cost: 0, stock_quantity: 0, recipe_mode: "none", batch_yield: 0, origem: "faz", sale_price: 5 },
  ],
  ultimos: { lc: 4.79 },
};
vi.mock("../api/use-mercado-query", () => ({
  useMercadoQuery: () => ({ data: base, isLoading: false, isError: false, refetch: vi.fn() }),
}));
vi.mock("../api/use-banco-compra", () => ({
  useBancoDaCompra: () => ({
    isLoading: false, isFetching: false, refetch: vi.fn(),
    data: { temBanco: true, candidatos: [{ id: "s1", comerciante: "Atacadão", descricao: null, valor: 415.06, data: "2026-10-14", hora: "10:12:00", banco: "Nubank", pluggy_tx_id: "p1" }] },
  }),
  useConfirmarBancoMutation: () => ({ mutate: vi.fn(), isPending: false }),
}));

const mutate = vi.fn((_c: ConcluirCompra, opts: { onSuccess: (r: ResultadoCompra) => void }) =>
  opts.onSuccess({
    compra_id: "c1", total: 415.06,
    produtos: [{ id: "b", nome: "Batida", receitas: 57, unidades: 1140, custo_antes: 0.6, custo_depois: 0.36 }],
  }));
vi.mock("../api/use-compra-mercado", () => ({
  useCompraAbertaQuery: () => ({ data: null, isLoading: false }),
}));
vi.mock("../api/use-concluir-compra-mutation", () => ({
  useConcluirCompraMutation: () => ({ mutate, isPending: false }),
}));

import MercadoPage from "./mercado-page";

const preencher = (rotulo: string, valores: string[]) =>
  screen.getAllByLabelText(rotulo).forEach((el, i) => fireEvent.change(el, { target: { value: valores[i] ?? valores[0] } }));

describe("Tô no mercado", () => {
  beforeEach(() => { mutate.mockClear(); });

  it("escolhe o produto, a receita traz os ingredientes, mostra custo e preço da última vez, e conclui", () => {
    render(<MemoryRouter><MercadoPage /></MemoryRouter>);
    expect(screen.getByText("CONCLUIR COMPRA").closest("button")?.disabled).toBe(true);

    fireEvent.click(screen.getByText(/🥤 Batida/));
    expect(screen.getByText("Leite condensado")).toBeTruthy();
    expect(screen.getByText("Creme de leite")).toBeTruthy();

    preencher("Quantos", ["57"]);
    preencher("Preço de 1 (opcional)", ["4,99", "2,29"]);
    expect(screen.getByText(/Batida · 57 receitas/)).toBeTruthy();
    expect(screen.getByText(/mais caro \(4%\)/)).toBeTruthy();
    expect(screen.getByText("TOTAL DA COMPRA")).toBeTruthy();
    expect(screen.getAllByText(/414,96/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Cada um sai a/)).toBeTruthy();

    // fim da compra: "Teve algum desconto?" → teve R$ 40 (clube)
    fireEvent.click(screen.getByText("CONCLUIR COMPRA"));
    expect(screen.getByText("Teve algum desconto?")).toBeTruthy();
    fireEvent.click(screen.getByText("Teve"));
    fireEvent.change(screen.getByLabelText("Quanto foi o desconto? (tá na notinha)"), { target: { value: "40" } });
    expect(screen.getByText("R$ 374,96")).toBeTruthy();
    fireEvent.click(screen.getByText("PRONTO, CONCLUIR"));
    const enviado = mutate.mock.calls[0]?.[0];
    expect(enviado?.desconto).toBe(40);
    const pago = (enviado?.itens ?? []).reduce((t, i) => t + i.qtd * (i.preco_unit ?? 0), 0);
    expect(Math.abs(pago - 374.96)).toBeLessThan(0.05);
    expect(enviado?.itensOrig).toEqual([
      { tipo: "ingrediente", id: "lc", nome: "Leite condensado", qtd: 57, preco_unit: 4.99, para: ["b"] },
      { tipo: "ingrediente", id: "cl", nome: "Creme de leite", qtd: 57, preco_unit: 2.29, para: ["b"] },
    ]);
    expect(enviado?.novaReceita).toBeNull();
    expect(screen.getByText("COMPRA ANOTADA")).toBeTruthy();
    expect(screen.getByText("+1.140")).toBeTruthy();
    expect(screen.getByText(/sobra R\$ 7,64 por venda/)).toBeTruthy();
    expect(screen.getByText("Achei no seu extrato. É essa?")).toBeTruthy();
    expect(screen.getByText("Atacadão")).toBeTruthy();
  });

  it("1ª compra de um produto sem receita: pergunta quanto rende e manda a receita junto", () => {
    render(<MemoryRouter><MercadoPage /></MemoryRouter>);
    fireEvent.click(screen.getByText(/🍫 Trufa/));
    expect(screen.getByText(/Primeira compra pra Trufa/)).toBeTruthy();
    fireEvent.click(screen.getByText("+ outro item"));
    fireEvent.change(screen.getByLabelText("Outro item"), { target: { value: "Chocolate 1kg" } });
    fireEvent.click(screen.getByText("Pôr"));
    preencher("Quantos", ["2"]);
    preencher("Preço de 1 (opcional)", ["30"]);
    fireEvent.change(screen.getByLabelText("Com essa compra, dá pra fazer quantas Trufa?"), { target: { value: "60" } });
    expect(screen.getAllByText(/1,00/).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByText("CONCLUIR COMPRA"));
    fireEvent.click(screen.getByText("Não teve"));
    expect(mutate.mock.calls[0]?.[0]?.desconto).toBe(0);
    expect(mutate.mock.calls[0]?.[0]?.novaReceita).toEqual({ produto: "t", rende: 60, itens: [{ nome: "Chocolate 1kg", qtd: 2, preco: 30 }] });
  });
});
