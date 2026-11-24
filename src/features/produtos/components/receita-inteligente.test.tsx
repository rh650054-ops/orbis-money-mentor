import { describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { atalhoDoUso, resumoDoCusto, usoDoAtalho, type IngredienteRascunho } from "../lib/receitas";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("../api/use-ingredientes-guardados-query", () => ({ useIngredientesGuardadosQuery: () => ({ data: [] }) }));
import { EditorReceita } from "./editor-receita";

let ultimo: IngredienteRascunho[] = [];
function Harness({ inicial, rende = 5, precoVenda }: { inicial: IngredienteRascunho[]; rende?: number; precoVenda?: number }) {
  const [itens, setItens] = useState(inicial);
  const [r, setR] = useState(rende);
  ultimo = itens;
  return <EditorReceita itens={itens} rende={r} nomeProduto="garrafinhas" precoVenda={precoVenda} onItens={setItens} onRende={setR} />;
}
const ing = (m: Partial<IngredienteRascunho>): IngredienteRascunho => ({ nome: "", qtd: 0, unidade: "un", pacote: 1, precoPacote: 0, usa: true, ...m });

describe("VANT Receita Inteligente (24/11)", () => {
  it("atalhos usam a unidade da compra: caixa de 395 g inteira = 395 g, metade = 197,5 g, 'ainda não sei' fica pendente", () => {
    const caixa = { pacote: 395, qtd: 0 };
    expect(usoDoAtalho("inteira", caixa)).toEqual({ qtd: 395, aprender: false });
    expect(usoDoAtalho("metade", caixa)).toEqual({ qtd: 197.5, aprender: false });
    expect(usoDoAtalho("naosei", caixa)).toEqual({ qtd: 0, aprender: true });
    expect(atalhoDoUso({ pacote: 1, qtd: 1 })).toBe("inteira");
    expect(atalhoDoUso({ pacote: 1000, qtd: 200 })).toBe("informar");
  });

  it("custo ao vivo: leite condensado R$ 3,79 inteiro + leite 1 l R$ 4,89 usando 200 ml, rende 5", () => {
    const r = resumoDoCusto([ing({ nome: "Leite condensado", pacote: 1, precoPacote: 3.79, qtd: 1 }), ing({ nome: "Leite", unidade: "ml", pacote: 1000, precoPacote: 4.89, qtd: 200 })], 5);
    expect(r.total).toBeCloseTo(4.77, 2);  // R$ 3,79 + R$ 0,98 (each line in cents, as the screen shows)
    expect(r.porUnidade).toBeCloseTo(0.954, 3);
    expect(r.completo).toBe(true);
  });

  it("'Uso a embalagem inteira' preenche o uso; faltando quantidade o custo é parcial e diz o que falta; margem não é lucro", () => {
    render(<Harness precoVenda={12} inicial={[ing({ nome: "Leite condensado", precoPacote: 3.79 }), ing({ nome: "Maracujá", unidade: "g", pacote: 1000, precoPacote: 17.99 })]} />);
    fireEvent.click(screen.getAllByRole("button", { name: /Uso a embalagem inteira/ })[0]!);
    expect(ultimo[0]).toMatchObject({ qtd: 1, aprender: false });
    expect(screen.getByText("Custo parcial por unidade")).toBeInTheDocument();
    expect(screen.getByText(/Custo parcial — faltam ingredientes/)).toBeInTheDocument();
    expect(screen.getByText(/Falta quanto usa de Maracujá/)).toBeInTheDocument();
    expect(screen.getByText(/não é o lucro líquido/)).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "Ainda não sei" })[1]!);
    expect(ultimo[1]).toMatchObject({ aprender: true, qtd: 0 });
    expect(screen.getByText(/Fica pendente na receita/)).toBeInTheDocument();
  });

  it("maracujá: compra 2 kg, vieram 12 frutas → passa a usar por fruta (R$ 35,98 ÷ 12); sem o número nada muda", () => {
    render(<Harness inicial={[ing({ nome: "Maracujá", unidade: "g", pacote: 2000, precoPacote: 35.98 })]} />);
    fireEvent.click(screen.getByText(/compra por peso e usa por unidade/));
    fireEvent.click(screen.getByRole("button", { name: "Por fruta / unidade" }));
    expect(ultimo[0]).toMatchObject({ unidade: "g", pacote: 2000 });
    fireEvent.change(screen.getByLabelText("Quantas unidades vieram"), { target: { value: "12" } });
    expect(ultimo[0]).toMatchObject({ unidade: "un", pacote: 12, precoPacote: 35.98 });
    expect(screen.getByText("= R$ 3,00 cada")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Pelo peso da fruta" }));
    expect(ultimo[0]).toMatchObject({ unidade: "g", pacote: 2000 });
  });

  it("ingrediente já guardado em g não troca de medida (o estoque dele é contado em g)", () => {
    render(<Harness inicial={[ing({ id: "i1", nome: "Maracujá", unidade: "g", pacote: 1000 })]} />);
    const opcoes = [...(screen.getByLabelText("Unidade da compra") as HTMLSelectElement).options].map((o) => o.value);
    expect(opcoes).toEqual(["kg", "g"]);
    expect(screen.queryByText(/compra por peso e usa por unidade/)).toBeNull();
  });
});
