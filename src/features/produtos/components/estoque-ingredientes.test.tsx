import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { CatalogoProducao } from "../lib/producao";

const ajustar = vi.hoisted(() => vi.fn());
vi.mock("../api/use-movimentos-ingrediente", () => ({ useMovimentosIngredienteQuery: () => ({ data: [], isLoading: false }) }));
vi.mock("../api/use-ajuste-estoque", () => ({ useAjusteDisponivel: () => ({ data: true }), useAjustarEstoqueMutation: () => ({ mutate: ajustar, isPending: false, isError: false }) }));
import { EstoqueIngredientes } from "./estoque-ingredientes";

const ing = (id: string, name: string, unit: string, stock: number, extra = {}) => ({ id, name, unit, stock_quantity: stock, pacote_qtd: 1, ...extra });
const c = { produtos: [], sabores: [], receitas: [], ingredientes: [
  ing("lc", "Leite condensado", "un", 114, { cost_per_unit: 3.79 }), ing("ad", "Adesivo", "un", 0), ing("prod", "Produção", "un", 0), ing("nut", "Nutella", "g", 350, { pacote_qtd: 650 }),
] } as unknown as CatalogoProducao;
const situacao = new Map([["lc", "disponivel"], ["ad", "esgotado"], ["prod", "esgotado"], ["nut", "disponivel"]] as const);

describe("Estoque → Ingredientes (25/11, Rick)", () => {
  it("'Produção' (custo) não aparece como ingrediente físico; nada de '0,54 embalagens'", () => {
    render(<EstoqueIngredientes c={c} situacao={situacao} usadoEm={() => []} />);
    expect(screen.queryByText("Produção")).toBeNull();
    expect(screen.queryByText(/parece custo/)).toBeNull();
    expect(screen.queryByText(/embalagens/)).toBeNull();
    expect(screen.getByText("Nutella")).toBeInTheDocument();
    expect(screen.getByLabelText("esgotado")).toBeInTheDocument();   // Adesivo 0 un: discreet dot
  });

  it("tocar em Leite condensado abre a ficha: estoque, unidade, conteúdo, último preço e ajuste com motivo", () => {
    render(<EstoqueIngredientes c={c} situacao={situacao} usadoEm={() => ["Cremo Maracujá"]} />);
    fireEvent.click(screen.getByLabelText("Abrir Leite condensado"));
    expect(screen.getByText("Estoque atual")).toBeInTheDocument();
    expect(screen.getByText("unidade (un)")).toBeInTheDocument();
    expect(screen.queryByText(/por embalagem/)).toBeNull();   // a box counted one by one has no package size
    expect(screen.getByText(/R\$\s?3,79 por un/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Ajustar estoque" }));
    fireEvent.change(screen.getByLabelText("Quantidade contada"), { target: { value: "110" } });
    expect(screen.getByText(/diferença -4/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Salvar ajuste" }));
    expect(ajustar).toHaveBeenCalledWith({ ingrediente: "lc", contado: 110, motivo: "Contei e é diferente" }, expect.anything());
  });

  it("Nutella 350 g de um pote de 650 g: conteúdo da embalagem aparece na ficha, não na lista", () => {
    render(<EstoqueIngredientes c={c} situacao={situacao} usadoEm={() => []} />);
    fireEvent.click(screen.getByLabelText("Abrir Nutella"));
    expect(screen.getByText("650 g por embalagem")).toBeInTheDocument();
  });
});
