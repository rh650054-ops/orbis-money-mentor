import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { SaborRascunho } from "../lib/sabores";
import type { IngredienteRascunho } from "../lib/receitas";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("../api/use-ingredientes-guardados-query", () => ({ useIngredientesGuardadosQuery: () => ({ data: [] }) }));
import { EditorSabores } from "./editor-sabores";

const base: IngredienteRascunho[] = [{ nome: "Leite condensado", qtd: 2, unidade: "un", pacote: 1, precoPacote: 6, usa: true }];

describe("EditorSabores", () => {
  it("adiciona um sabor, sugere o emoji pelo nome e mostra o custo por sabor", () => {
    let atual: SaborRascunho[] = [];
    const onMudar = vi.fn((s: SaborRascunho[]) => { atual = s; });
    const { rerender } = render(<EditorSabores sabores={atual} base={base} rende={20} preco={10} onMudar={onMudar} />);
    fireEvent.click(screen.getByRole("button", { name: /sabor/ }));
    expect(atual).toHaveLength(1);
    rerender(<EditorSabores sabores={atual} base={base} rende={20} preco={10} onMudar={onMudar} />);
    fireEvent.change(screen.getByLabelText("Nome do sabor"), { target: { value: "Morango" } });
    expect(atual[0]).toMatchObject({ nome: "Morango", emoji: "🍓" });
    rerender(<EditorSabores sabores={atual} base={base} rende={20} preco={10} onMudar={onMudar} />);
    // base 12 ÷ 20 = 0,60 por unidade; sobra 9,40
    expect(screen.getByText("R$ 0,60")).toBeInTheDocument();
    expect(screen.getByText(/sobra R\$ 9,40/)).toBeInTheDocument();
  });
});
