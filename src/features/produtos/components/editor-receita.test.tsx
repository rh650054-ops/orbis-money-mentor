import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { IngredienteRascunho } from "../lib/receitas";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("../api/use-ingredientes-guardados-query", () => ({ useIngredientesGuardadosQuery: () => ({ data: [] }) }));
import { EditorReceita } from "./editor-receita";

describe("EditorReceita — fruta em gramas", () => {
  it("trocar pra g deixa a compra em 1 kg; 200 g de polpa a R$ 9,90 o quilo custa R$ 1,98 na leva", () => {
    let itens: IngredienteRascunho[] = [{ nome: "Fruta / polpa", qtd: 1, unidade: "un", pacote: 1, precoPacote: 9.9, usa: true }];
    const onItens = vi.fn((n: IngredienteRascunho[]) => { itens = n; });
    const { rerender } = render(<EditorReceita itens={itens} rende={5} onItens={onItens} onRende={() => {}} />);
    fireEvent.change(screen.getByLabelText("Unidade"), { target: { value: "g" } });
    expect(itens[0]).toMatchObject({ unidade: "g", pacote: 1000 });
    rerender(<EditorReceita itens={itens} rende={5} onItens={onItens} onRende={() => {}} />);
    expect(screen.getByLabelText("Unidade da compra")).toHaveValue("kg");
    expect(screen.getByLabelText("Quanto vem na compra")).toHaveValue("1");
    fireEvent.change(screen.getByLabelText("Quantidade na leva"), { target: { value: "200" } });
    rerender(<EditorReceita itens={itens} rende={5} onItens={onItens} onRende={() => {}} />);
    // leva de R$ 1,98 ÷ 5 = R$ 0,40 cada
    expect(screen.getByText(/leva de R\$ 1,98/)).toBeInTheDocument();
  });
});

describe("EditorReceita — item em unidade", () => {
  it('pergunta "cada un custa" e o pacote é opcional: 100 por R$ 119 = R$ 1,19 cada', () => {
    let itens: IngredienteRascunho[] = [{ nome: "Garrafa 300ml", qtd: 5, unidade: "un", pacote: 1, precoPacote: 0, usa: true }];
    const onItens = vi.fn((n: IngredienteRascunho[]) => { itens = n; });
    const { rerender } = render(<EditorReceita itens={itens} rende={5} onItens={onItens} onRende={() => {}} />);
    expect(screen.queryByLabelText("Quanto vem na compra")).toBeNull();
    fireEvent.change(screen.getByLabelText("Preço de 1 un do ingrediente"), { target: { value: "1,19" } });
    expect(itens[0]?.precoPacote).toBe(1.19);
    rerender(<EditorReceita itens={itens} rende={5} onItens={onItens} onRende={() => {}} />);
    // leva de 5 × 1,19 = 5,95 ÷ 5 = 1,19 cada
    expect(screen.getByText(/leva de R\$ 5,95/)).toBeInTheDocument();
    fireEvent.click(screen.getByText("vem em pacote?"));
    fireEvent.change(screen.getByLabelText("Quanto vem na compra"), { target: { value: "100" } });
    rerender(<EditorReceita itens={itens} rende={5} onItens={onItens} onRende={() => {}} />);
    fireEvent.change(screen.getByLabelText("Quanto paga nessa compra"), { target: { value: "119" } });
    expect(itens[0]).toMatchObject({ pacote: 100, precoPacote: 119 });
  });
});
