import { describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import type { IngredienteRascunho } from "../lib/receitas";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("../api/use-ingredientes-guardados-query", () => ({ useIngredientesGuardadosQuery: () => ({ data: [] }) }));
import { EditorReceita } from "./editor-receita";

function Harness({ inicial }: { inicial: IngredienteRascunho[] }) {
  // estado real: o editor devolve itens e rende, a tela guarda
  const [itens, setItens] = useState(inicial);
  const [rende, setRende] = useState(20);
  return <EditorReceita itens={itens} rende={rende} nomeProduto="garrafinhas" onItens={setItens} onRende={setRende} />;
}

describe("EditorReceita — do jeito que o Rick pensa", () => {
  it("leite em pó: compro 1 kg por R$ 35,99 e dá pra 100 → R$ 0,36 cada; a leva vira 100", () => {
    render(<Harness inicial={[{ nome: "Leite em pó", qtd: 1, unidade: "un", pacote: 1, precoPacote: 0, usa: true }]} />);
    fireEvent.change(screen.getByLabelText("Unidade da compra"), { target: { value: "kg" } });
    fireEvent.change(screen.getByLabelText("Quanto paga nessa compra"), { target: { value: "35,99" } });
    fireEvent.change(screen.getByLabelText("Dá pra quantas garrafinhas"), { target: { value: "100" } });
    expect(screen.getByText("→ R$ 0,36 cada")).toBeInTheDocument();
    expect(screen.getByText(/numa leva de 100 vai 1000 g/)).toBeInTheDocument();
    expect(screen.getByText(/100 garrafinhas por R\$ 35,99/)).toBeInTheDocument();
  });

  it("leite condensado 1 un por R$ 3,39 dá pra 5 + leite em pó pra 100: custo soma certo", () => {
    render(<Harness inicial={[
      { nome: "Leite condensado", qtd: 0, unidade: "un", pacote: 1, precoPacote: 3.39, usa: true, daPra: 5 },
      { nome: "Leite em pó", qtd: 0, unidade: "g", pacote: 1000, precoPacote: 35.99, usa: true, daPra: 100 },
    ]} />);
    // as quantidades por leva (de 100) vêm sozinhas do "dá pra": 20 latas e 1000 g
    // 3,39 ÷ 5 = 0,678 + 35,99 ÷ 100 = 0,36 → R$ 1,04 cada
    expect(screen.getAllByText(/1,04/).length).toBeGreaterThan(0);
  });

  it("12/11: o que aparece nos campos é o que entra na conta, mesmo quando o valor muda por fora", () => {
    // caso real: a linha mostrava "1 un por R$ 18 e dá pra 12" mas a conta usava R$ 25 e dá pra 0,01
    // (valor que veio da receita salva) → "R$ 2.500,00 cada". O campo guardava o texto antigo.
    const a: IngredienteRascunho = { nome: "Maracujá", qtd: 0, unidade: "un", pacote: 1, precoPacote: 18, usa: true, daPra: 12 };
    const b: IngredienteRascunho = { ...a, precoPacote: 25, daPra: 0.01 };
    const props = { rende: 120, nomeProduto: "batidas", onItens: () => {}, onRende: () => {} };
    const { rerender } = render(<EditorReceita itens={[a]} {...props} />);
    rerender(<EditorReceita itens={[b]} {...props} />);
    expect(screen.getByLabelText("Quanto paga nessa compra")).toHaveValue("25");
    expect(screen.getByLabelText("Dá pra quantas batidas")).toHaveValue("0,01");
  });

  it("digitar continua livre: '0,' não é apagado enquanto ele digita", () => {
    render(<Harness inicial={[{ nome: "Leite", qtd: 0, unidade: "un", pacote: 1, precoPacote: 0, usa: true }]} />);
    const daPra = screen.getByLabelText("Dá pra quantas garrafinhas");
    fireEvent.change(daPra, { target: { value: "0," } });
    expect(daPra).toHaveValue("0,");
    fireEvent.change(screen.getByLabelText("Quanto paga nessa compra"), { target: { value: "5," } });
    expect(screen.getByLabelText("Quanto paga nessa compra")).toHaveValue("5,");
  });
});
