import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("../api/use-compra-detalhe-query", () => ({
  useCompraDetalheQuery: () => ({ isLoading: false, isError: false, data: {
    id: "c1", total: 412.5, criadaEm: "2026-10-26T13:00:00Z",
    itens: [{ nome: "Leite condensado", qtd: 57, unidade: "un", pacote: 1, total: 312.93, precoAntes: 6.9, precoAgora: 5.49 }],
    feitos: [{ id: "p1", nome: "Garrafinha", levas: 5, unidades: 100, custo: 2.13 }],
  } }),
}));
vi.mock("../api/use-sobra-estoque-query", () => ({
  useSobraEstoqueQuery: () => ({ data: { p1: [
    { nome: "Leite condensado", unidade: "un", pacote: 1, porLeva: 2, estoque: 47 },
    { nome: "Leite", unidade: "ml", pacote: 1, porLeva: 2000, estoque: 0 },
  ] } }),
}));
import { CompraDetalhe } from "./compra-detalhe";

describe("CompraDetalhe", () => {
  it("mostra o que virou estoque, o custo, a sobra e os itens", () => {
    const onEditar = vi.fn();
    render(<CompraDetalhe id="c1" onFechar={() => {}} onEditar={onEditar} />);
    expect(screen.getByText("+100")).toBeInTheDocument();
    expect(screen.getByText(/Custo de cada/)).toBeInTheDocument();
    expect(screen.getByText(/\+23 levas/)).toBeInTheDocument();
    expect(screen.getByText(/Pra próxima leva falta/)).toBeInTheDocument();
    expect(screen.getAllByText(/Leite condensado/).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "EDITAR COMPRA" }));
    expect(onEditar).toHaveBeenCalledWith("c1");
  });
});
