import { describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { receitaDoRascunho, rascunhoDaReceita, type IngredienteRascunho } from "../lib/receitas";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
const guardados = vi.hoisted(() => ({ lista: [] as { id: string; nome: string; unidade: "un" | "g" | "ml"; pacote: number; precoPacote: number }[] }));
vi.mock("../api/use-ingredientes-guardados-query", () => ({ useIngredientesGuardadosQuery: () => ({ data: guardados.lista }) }));
import { EditorReceita } from "./editor-receita";

let ultimo: { itens: IngredienteRascunho[]; rende: number } = { itens: [], rende: 0 };
function Harness({ inicial, rende: r0 = 20 }: { inicial: IngredienteRascunho[]; rende?: number }) {
  // real state: the editor returns items and yield, the screen keeps them
  const [itens, setItens] = useState(inicial);
  const [rende, setRende] = useState(r0);
  ultimo = { itens, rende };
  return <EditorReceita itens={itens} rende={rende} nomeProduto="garrafinhas" onItens={setItens} onRende={setRende} />;
}
const ing = (m: Partial<IngredienteRascunho>): IngredienteRascunho => ({ nome: "", qtd: 0, unidade: "un", pacote: 1, precoPacote: 0, usa: true, ...m });

describe("EditorReceita — rendimento é do vendedor (Etapa 2, 22/11)", () => {
  it("rendimento válido: ele digita quanto rende; o custo é a leva ÷ esse número", () => {
    render(<Harness rende={0} inicial={[ing({ nome: "Leite em pó", unidade: "g", pacote: 1000, precoPacote: 35.99, qtd: 200 })]} />);
    expect(screen.getByText(/Diga quantas saem de uma leva/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Quanto a receita rende"), { target: { value: "20" } });
    // 200 g of a 1 kg pack at R$ 35,99 = R$ 7,20 per batch ÷ 20 = R$ 0,36
    expect(screen.getByText("R$ 0,36")).toBeInTheDocument();
    expect(ultimo.rende).toBe(20);
  });

  it("o maior 'dá pra' NÃO muda o rendimento (antes: a leva virava 100)", () => {
    render(<Harness rende={20} inicial={[ing({ nome: "Leite em pó", unidade: "g", pacote: 1000, precoPacote: 35.99 })]} />);
    fireEvent.change(screen.getByLabelText("Dá pra quantas garrafinhas"), { target: { value: "100" } });
    expect(ultimo.rende).toBe(20);                          // his yield stays
    expect(ultimo.itens[0]!.qtd).toBe(200);                 // the shortcut only filled "Uso": 1000 g × 20 ÷ 100
    expect(screen.getByLabelText("Quanto usa na leva")).toHaveValue("200");
  });

  it("comprado, usado, preço e rendimento são campos separados", () => {
    render(<Harness rende={20} inicial={[ing({ nome: "Copo" })]} />);
    fireEvent.change(screen.getByLabelText("Quanto compra"), { target: { value: "100" } });
    fireEvent.change(screen.getByLabelText("Quanto paga nessa compra"), { target: { value: "12" } });
    fireEvent.change(screen.getByLabelText("Quanto usa na leva"), { target: { value: "20" } });
    expect(ultimo.itens[0]).toMatchObject({ pacote: 100, precoPacote: 12, qtd: 20 });
    expect(ultimo.rende).toBe(20);
    expect(screen.getByText("R$ 0,12")).toBeInTheDocument();   // 20 × R$ 0,12 = R$ 2,40 ÷ 20
  });

  it("receita salva abre exatamente como está (antes: rende 20 / 1 lata virava rende 100 / 5 latas)", () => {
    const salva = [{ nome: "Leite condensado", qtd: 1, preco: 6.5, unidade: "un" as const, pacote: 1 },
      { nome: "Leite em pó", qtd: 200, preco: 0.03599, unidade: "g" as const, pacote: 1000 }];
    render(<Harness rende={20} inicial={rascunhoDaReceita(salva, 20)} />);
    expect(ultimo.rende).toBe(20);
    expect(receitaDoRascunho(ultimo.itens).map((i) => i.qtd)).toEqual([1, 200]);
  });

  it("preço é opcional: sem preço a receita continua e o custo vem do mercado depois", () => {
    render(<Harness rende={20} inicial={[ing({ nome: "Maracujá", qtd: 500, unidade: "g", pacote: 1000 })]} />);
    expect(screen.getByText(/o custo aparece quando você anotar a compra/)).toBeInTheDocument();
  });

  it("ingrediente sem quantidade aparece como rascunho e é salvo como rascunho, sem consumo", () => {
    render(<Harness rende={20} inicial={[ing({ nome: "Fruta / polpa" })]} />);
    expect(screen.getByText(/rascunho: falta quanto usa/)).toBeInTheDocument();
    expect(receitaDoRascunho(ultimo.itens)).toEqual([expect.objectContaining({ nome: "Fruta / polpa", qtd: 0, aprender: true })]);
  });
});

describe("EditorReceita — ingredientes compartilhados, sem duplicar", () => {
  it("nome escrito diferente usa o ingrediente que ele já tem (mesmo id, mesmo nome)", () => {
    guardados.lista = [{ id: "ing-1", nome: "Leite condensado", unidade: "un", pacote: 1, precoPacote: 6.5 }];
    render(<Harness rende={20} inicial={[ing({})]} />);
    const campo = screen.getByLabelText("Ingrediente");
    fireEvent.focus(campo);
    fireEvent.change(campo, { target: { value: "  Leites  CONDENSADOS " } });
    fireEvent.blur(campo);
    expect(ultimo.itens[0]).toMatchObject({ id: "ing-1", nome: "Leite condensado", precoPacote: 6.5 });
    guardados.lista = [];
  });

  it("nome só parecido NÃO é juntado ('leite' ≠ 'leite condensado')", () => {
    guardados.lista = [{ id: "ing-1", nome: "Leite condensado", unidade: "un", pacote: 1, precoPacote: 6.5 }];
    render(<Harness rende={20} inicial={[ing({})]} />);
    const campo = screen.getByLabelText("Ingrediente");
    fireEvent.change(campo, { target: { value: "Leite" } });
    fireEvent.blur(campo);
    expect(ultimo.itens[0]!.id).toBeUndefined();
    guardados.lista = [];
  });

  it("o mesmo ingrediente duas vezes na receita é avisado", () => {
    render(<Harness rende={20} inicial={[ing({ nome: "Açúcar", qtd: 1 }), ing({ nome: "acucar", qtd: 2 })]} />);
    expect(screen.getByText("esse ingrediente já está na receita")).toBeInTheDocument();
  });
});

describe("campos continuam livres (12/11)", () => {
  it("o que aparece nos campos é o que entra na conta, mesmo quando o valor muda por fora", () => {
    const a = ing({ nome: "Maracujá", precoPacote: 18, qtd: 2 });
    const props = { rende: 120, nomeProduto: "batidas", onItens: () => {}, onRende: () => {} };
    const { rerender } = render(<EditorReceita itens={[a]} {...props} />);
    rerender(<EditorReceita itens={[{ ...a, precoPacote: 25, qtd: 3 }]} {...props} />);
    expect(screen.getByLabelText("Quanto paga nessa compra")).toHaveValue("25");
    expect(screen.getByLabelText("Quanto usa na leva")).toHaveValue("3");
  });

  it("digitar '0,' não é apagado enquanto ele digita", () => {
    render(<Harness inicial={[ing({ nome: "Leite" })]} />);
    const uso = screen.getByLabelText("Quanto usa na leva");
    fireEvent.change(uso, { target: { value: "0," } });
    expect(uso).toHaveValue("0,");
  });
});

describe("conversão de unidades na linha do ingrediente (kg/g e L/ml)", () => {
  it("compra em kg: 1 kg vira 1000 g; uso 200 g de R$ 35,99 = R$ 7,20 na leva", () => {
    render(<Harness rende={20} inicial={[ing({ nome: "Leite em pó" })]} />);
    fireEvent.change(screen.getByLabelText("Unidade da compra"), { target: { value: "kg" } });
    expect(ultimo.itens[0]).toMatchObject({ unidade: "g", pacote: 1000 });
    fireEvent.change(screen.getByLabelText("Quanto paga nessa compra"), { target: { value: "35,99" } });
    fireEvent.change(screen.getByLabelText("Quanto usa na leva"), { target: { value: "200" } });
    expect(screen.getByText("= R$ 7,20 na leva")).toBeInTheDocument();
    expect(receitaDoRascunho(ultimo.itens)[0]).toMatchObject({ unidade: "g", pacote: 1000, qtd: 200, preco: 0.03599, precoEditado: true });
  });

  it("compra em litro: 1,5 l vira 1500 ml; uso 300 ml de R$ 9 = R$ 1,80", () => {
    render(<Harness rende={20} inicial={[ing({ nome: "Leite" })]} />);
    fireEvent.change(screen.getByLabelText("Unidade da compra"), { target: { value: "l" } });
    fireEvent.change(screen.getByLabelText("Quanto compra"), { target: { value: "1,5" } });
    expect(ultimo.itens[0]).toMatchObject({ unidade: "ml", pacote: 1500 });
    fireEvent.change(screen.getByLabelText("Quanto paga nessa compra"), { target: { value: "9" } });
    fireEvent.change(screen.getByLabelText("Quanto usa na leva"), { target: { value: "300" } });
    expect(screen.getByText("= R$ 1,80 na leva")).toBeInTheDocument();
  });

  it("compra pequena fica na unidade pequena (500 g não vira 0,5 kg); ml idem", () => {
    render(<Harness rende={20} inicial={[ing({ nome: "Morango", unidade: "g", pacote: 500 }), ing({ nome: "Essência", unidade: "ml", pacote: 30 })]} />);
    const unidades = screen.getAllByLabelText("Unidade da compra");
    expect(unidades[0]).toHaveValue("g");
    expect(unidades[1]).toHaveValue("ml");
    expect(screen.getAllByLabelText("Quanto compra")[0]).toHaveValue("500");
  });

  it("ida e volta pelo banco: o que foi salvo em kg e em l volta igual, sem reescalar", () => {
    const tela = [ing({ nome: "Leite em pó", unidade: "g", pacote: 1000, precoPacote: 35.99, qtd: 200 }),
      ing({ nome: "Leite", unidade: "ml", pacote: 1500, precoPacote: 9, qtd: 300 })];
    const salvo = receitaDoRascunho(tela);
    const volta = rascunhoDaReceita(salvo, 20);
    expect(volta.map((i) => [i.unidade, i.pacote, i.qtd])).toEqual([["g", 1000, 200], ["ml", 1500, 300]]);
    // 23/11 (approved): full precision — R$ 35,99 per kg comes back as R$ 35,99 (it was R$ 36,00)
    expect(volta.map((i) => i.precoPacote)).toEqual([35.99, 9]);
    render(<Harness rende={20} inicial={volta} />);
    expect(screen.getAllByLabelText("Unidade da compra").map((s) => (s as HTMLSelectElement).value)).toEqual(["kg", "l"]);
    expect(screen.getAllByLabelText("Quanto compra").map((s) => (s as HTMLInputElement).value)).toEqual(["1", "1,5"]);
  });
});
