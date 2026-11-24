import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { CatalogoProducao } from "../lib/producao";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "u1" } }) }));
const toast = vi.fn();
vi.mock("@/shared/hooks/use-toast", () => ({ toast: (...a: unknown[]) => toast(...a) }));

const catalogo: CatalogoProducao = {
  produtos: [
    { id: "bat", name: "Batida", emoji: "🥤", recipe_mode: "batch", batch_yield: 10, origem: "faz", stock_quantity: 0 },
    { id: "tru", name: "Trufa", emoji: "🍫", recipe_mode: "batch", batch_yield: 10, origem: "faz", stock_quantity: 0 },
  ],
  sabores: [
    { id: "mor", product_id: "bat", name: "Morango", emoji: "🍓", stock_quantity: 0, batch_yield: 6, usa_base: true },
    { id: "mar", product_id: "bat", name: "Maracujá", emoji: "🥭", stock_quantity: 0, batch_yield: 5, usa_base: true },
  ],
  receitas: [
    { product_id: "bat", variant_id: null, ingredient_id: "lc", quantity: 1, aprender: false },
    { product_id: "bat", variant_id: "mor", ingredient_id: "morango", quantity: 300, aprender: false },
    { product_id: "bat", variant_id: "mar", ingredient_id: "polpa", quantity: 200, aprender: false },
    { product_id: "tru", variant_id: null, ingredient_id: "lc", quantity: 1, aprender: false },
    { product_id: "tru", variant_id: null, ingredient_id: "choc", quantity: 0, aprender: false },
  ],
  ingredientes: [],
};
vi.mock("../api/use-catalogo-producao-query", () => ({ useCatalogoProducaoQuery: () => ({ data: catalogo, isLoading: false, isError: false }) }));
vi.mock("../api/use-producao-query", () => ({
  useSimularProducaoQuery: () => ({ data: { consumo: [{ ingrediente: "lc", nome: "Leite condensado", unidade: "un", receita: 4, real: 4 }], faltas: [], avisos: [] }, isFetching: false, error: null }),
  useProducaoRecentesQuery: () => ({ data: [] }),
}));
const mutate = vi.fn();
vi.mock("../api/use-producao-escrita", () => ({
  useRegistrarProducaoMutation: () => ({ mutate, isPending: false }),
  useCorrigirProducaoMutation: () => ({ mutate: vi.fn(), isPending: false }),
  useDesfazerProducaoMutation: () => ({ mutate: vi.fn(), isPending: false }),
}));

import ProducaoPage from "./producao-page";

const abrir = () => render(<MemoryRouter><ProducaoPage /></MemoryRouter>);
const campos = () => screen.getAllByPlaceholderText("0");

describe("Produzir — vários produtos e sabores", () => {
  beforeEach(() => { mutate.mockReset(); toast.mockReset(); localStorage.clear(); });

  it("um contador por sabor; receita incompleta orienta a completar em vez de produzir", () => {
    abrir();
    expect(screen.getByText("🍓 Morango")).toBeInTheDocument();
    expect(screen.getByText(/rende 6 por leva/)).toBeInTheDocument();
    expect(screen.getByText(/Falta saber quanto usa/)).toBeInTheDocument();
    expect(screen.getByText("Completar receita ›")).toBeInTheDocument();
    expect(campos()).toHaveLength(2);   // Trufa has no counter
  });

  it("registra 12 morango + 10 maracujá com uma chave; sem rede, reenviar usa a MESMA chave", () => {
    abrir();
    fireEvent.change(campos()[0]!, { target: { value: "12" } });
    fireEvent.change(campos()[1]!, { target: { value: "10" } });
    expect(screen.getByText("VAI SAIR DO ESTOQUE")).toBeInTheDocument();
    fireEvent.click(screen.getByText("REGISTRAR PRODUÇÃO"));
    const [v, opts] = mutate.mock.calls[0]!;
    expect(v.itens).toEqual([{ produto: "bat", sabor: "mar", unidades: 10 }, { produto: "bat", sabor: "mor", unidades: 12 }]);
    expect(v.chave).toMatch(/^prod:/);
    act(() => opts.onError({ message: "Failed to fetch" }));
    expect(screen.getByText("Uma produção ficou sem confirmação.")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Reenviar"));
    expect(mutate.mock.calls[1]![0].chave).toBe(v.chave);
    act(() => mutate.mock.calls[1]![1].onSuccess({ registro_id: "r1", status: "ativa", versao: 1, repetido: true, itens: [], consumo: [] }));
    expect(screen.queryByText("Uma produção ficou sem confirmação.")).toBeNull();
    expect(toast).toHaveBeenLastCalledWith(expect.objectContaining({ title: "Essa produção já estava registrada" }));
  });

  it("receita reduzida: pede o motivo e manda de novo com a justificativa", () => {
    abrir();
    fireEvent.change(campos()[0]!, { target: { value: "6" } });
    fireEvent.click(screen.getByText("REGISTRAR PRODUÇÃO"));
    act(() => mutate.mock.calls[0]![1].onError({ hint: "VANT_RECEITA_REDUZIDA", message: "A receita de Batida foi alterada" }));
    // opened above the full-screen shell (z-60), never hidden behind it
    expect(screen.getByRole("dialog").className).toContain("z-[70]");
    fireEvent.change(screen.getByLabelText("Motivo"), { target: { value: "forma nova rende mais" } });
    fireEvent.click(screen.getByText("REGISTRAR"));
    expect(mutate.mock.calls[1]![0].justificativa).toBe("forma nova rende mais");
  });
});
