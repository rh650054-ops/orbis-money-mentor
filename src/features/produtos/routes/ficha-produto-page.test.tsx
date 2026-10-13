import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { Ficha } from "../lib/ficha";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "u1" } }) }));
vi.mock("@/shared/hooks/use-toast", () => ({ toast: vi.fn() }));
vi.mock("../api/use-produtos-query", () => ({
  useProdutosQuery: () => ({
    isError: false, isFetchedAfterMount: true,
    data: [{
      id: "b", name: "Batida", photo_url: null, cost: 0.9, sale_price: 20, stock_quantity: 479, stock_min: 10,
      open_price: false, recipe_mode: "batch", batch_yield: 50, origem: "faz", emoji: "🥤", controla_estoque: true,
      faixas: [{ qty: 2, price: 35 }],
    }],
  }),
}));
vi.mock("../api/use-receita-query", () => ({
  useReceitaQuery: () => ({ isError: false, data: [{ id: "lc", nome: "Leite condensado", qtd: 1, preco: 6.5, estoque: 4 }] }),
}));
vi.mock("../api/use-mercado-query", () => ({ useMercadoQuery: () => ({ data: undefined }) }));
const salvar = vi.fn();
vi.mock("../api/use-salvar-ficha-mutation", () => ({ useSalvarFichaMutation: () => ({ mutate: salvar, isPending: false }) }));
vi.mock("../api/use-subir-foto-mutation", () => ({ useSubirFotoMutation: () => ({ mutate: vi.fn(), isPending: false }) }));
vi.mock("../api/use-produto-mutations", () => ({ useApagarProdutoMutation: () => ({ mutate: vi.fn() }) }));

import FichaProdutoPage from "./ficha-produto-page";

describe("ficha do produto", () => {
  it("mostra tudo numa tela (preço, combo, receita, estoque) e salva o que mudou", () => {
    render(<MemoryRouter initialEntries={["/products/b"]}><Routes><Route path="/products/:id" element={<FichaProdutoPage />} /></Routes></MemoryRouter>);
    expect(screen.getByDisplayValue("Batida")).toBeTruthy();
    expect(screen.getByText("QUANTO VOCÊ COBRA")).toBeTruthy();
    expect(screen.getByDisplayValue("Leite condensado")).toBeTruthy();
    expect(screen.getByText("tem 4 no estoque")).toBeTruthy();
    expect(screen.getByText(/dá pra mais 4 levas \(200 un\)/)).toBeTruthy();

    // "5" no preço é R$ 5,00 (não R$ 0,05)
    fireEvent.change(screen.getByLabelText("Preço de 1 unidade"), { target: { value: "25" } });
    fireEvent.click(screen.getByText("SALVAR"));
    const enviado = salvar.mock.calls[0]?.[0] as Ficha;
    expect(enviado.preco).toBe(25);
    expect(enviado.combos).toEqual([{ qty: 2, price: 35 }]);
    expect(enviado.itens[0]).toMatchObject({ nome: "Leite condensado", qtd: 1 });
  });
});
