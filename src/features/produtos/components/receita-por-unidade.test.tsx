import { describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import {
  pacoteDaCompra, rascunhoDaReceita, receitaDoRascunho, resumoDoCusto, totalDaReceita,
  type CustoExtra, type IngredienteRascunho,
} from "../lib/receitas";
import { custoDoSabor } from "../lib/sabores";

vi.mock("../api/use-medidas", () => ({ useMedidaDeUsoDisponivel: () => ({ data: false }) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
const porUnidade = vi.hoisted(() => ({ v: true }));
vi.mock("../api/use-receita-por-unidade", () => ({ useReceitaPorUnidadeDisponivel: () => ({ data: porUnidade.v }) }));
vi.mock("../api/use-ingredientes-guardados-query", () => ({ useIngredientesGuardadosQuery: () => ({ data: [] }) }));
import { EditorReceita } from "./editor-receita";

const ing = (nome: string, qtd: number, precoPacote: number, pacote = 1, m: Partial<IngredienteRascunho> = {}): IngredienteRascunho =>
  ({ nome, qtd, unidade: "un", pacote, precoPacote, usa: true, por: "receita", ...m });

/* The Cremo case (25/11): prices chosen to reproduce the reference of the original registration
   (R$ 14,93 → about R$ 24,89 for 5 bottles). They are test data, not values in the code. */
const lote = [
  ing("Leite condensado", 1, 6.49),
  ing("Creme de leite", 1, 3.29),
  ing("Leite", 200, 4.89, 1000, { unidade: "ml" }),       // 1 l por R$ 4,89, uso 200 ml
  ing("Morango", 200, 8.41, 1000, { unidade: "g" }),      // 1 kg por R$ 8,41, uso 200 g
];
const embalagens = (por: "receita" | "unidade") => [
  ing("Garrafa", 1, 13, 10, { por }), ing("Adesivo", 1, 40, 100, { por }), ing("Canudo", 1, 9, 100, { por }),
];

describe("Receita Inteligente — custos por receita e por unidade (25/11)", () => {
  it("caso Cremo: antes R$ 14,93 (garrafa, adesivo, canudo e mão de obra contados 1 vez); depois ≈ R$ 24,89 e R$ 4,98 cada", () => {
    const antes = resumoDoCusto([...lote, ...embalagens("receita"), ing("Mão de obra", 1, 0.7)], 5);
    expect(antes.total).toBe(14.93);
    expect(Math.round(antes.porUnidade * 100) / 100).toBe(2.99);
    const maoDeObra: CustoExtra[] = [{ nome: "Mão de obra", valor: 0.7, por: "unidade" }];
    const depois = resumoDoCusto([...lote, ...embalagens("unidade")], 5, maoDeObra);
    expect(depois.lote).toBe(12.44);
    expect(depois.unidades).toBe(8.95);        // (1,30 + 0,40 + 0,09) × 5
    expect(depois.extras).toBe(3.5);           // 0,70 × 5, no stock
    expect(depois.total).toBe(24.89);
    expect(Math.round(depois.porUnidade * 100) / 100).toBe(4.98);
    expect(depois.completo).toBe(true);
  });

  it("5 garrafas numa receita que rende 5: 1 por unidade conta 5, não 1", () => {
    expect(totalDaReceita([ing("Garrafa", 1, 13, 10, { por: "unidade" })], 5)).toBe(6.5);
    expect(totalDaReceita([ing("Garrafa", 1, 13, 10, { por: "receita" })], 5)).toBe(1.3);
  });

  it("conversões: 1 kg = 1000 g, 1 l = 1000 ml; nunca g ↔ ml", () => {
    expect(pacoteDaCompra(1, "kg", "g")).toBe(1000);
    expect(pacoteDaCompra(1.5, "l", "ml")).toBe(1500);
    expect(pacoteDaCompra(1, "kg", "ml")).toBe(1);   // no gram ↔ millilitre conversion is invented
  });

  it("rendimento zero ou inválido: não divide, custo fica parcial", () => {
    const r = resumoDoCusto([...lote, ...embalagens("unidade")], 0);
    expect(r.porUnidade).toBe(0);
    expect(r.completo).toBe(false);
    expect(r.unidades).toBe(0);                      // per-unit lines need a yield
  });

  it("sabor com rendimento próprio: a garrafa continua 1 por unidade; mão de obra também", () => {
    const base = [ing("Leite condensado", 1, 6.49), ing("Garrafa", 1, 13, 10, { por: "unidade" })];
    const extras: CustoExtra[] = [{ nome: "Mão de obra", valor: 0.7, por: "unidade" }];
    // rende 4 (own) instead of 5: (6,49 + 1,30 × 4) ÷ 4 + 0,70 = 3,62
    expect(custoDoSabor(base, { nome: "Grande", emoji: "🥤", itens: [], rende: 4 }, 5, extras)).toBe(3.62);
  });

  it("linha antiga: só a que parece por unidade pede confirmação; sem resposta continua como estava (por receita)", () => {
    const salvas = [{ id: "a", nome: "Leite condensado", qtd: 1, preco: 6.49, unidade: "un" as const, pacote: 1 }, { id: "b", nome: "Garrafa", qtd: 1, preco: 1.3, unidade: "un" as const, pacote: 1 }];
    const r = rascunhoDaReceita(salvas, 5, { confirmarAntigas: true });
    expect(r.map((i) => !!i.confirmar)).toEqual([false, true]);
    expect(resumoDoCusto(r, 5).completo).toBe(false);
    const enviado = receitaDoRascunho(r);
    expect(enviado[1]!.por).toBeUndefined();         // unanswered: nothing is reclassified
    expect(enviado[0]!.por).toBe("receita");
    // before the migration nothing is asked at all
    expect(rascunhoDaReceita(salvas, 5).some((i) => i.confirmar)).toBe(false);
  });
});

function Harness({ inicial, preco = 20 }: { inicial: IngredienteRascunho[]; preco?: number }) {
  const [itens, setItens] = useState(inicial);
  const [extras, setExtras] = useState<CustoExtra[]>([]);
  const [rende, setRende] = useState(5);
  return <EditorReceita itens={itens} rende={rende} nomeProduto="garrafinhas" precoVenda={preco} onItens={setItens} onRende={setRende} extras={extras} onExtras={setExtras} />;
}

describe("Editor — três etapas e duas listas (25/11)", () => {
  it("mostra as 3 etapas; mover a garrafa para 'cada unidade' muda o custo sem digitar de novo; mão de obra entra no custo", () => {
    render(<Harness inicial={[...lote, ...embalagens("receita")]} />);
    for (const t of ["Seu produto", "Receita Inteligente", "Seu resultado", "INGREDIENTES DA RECEITA", "CUSTOS DE CADA UNIDADE", "CUSTOS SEM ESTOQUE"]) expect(screen.getByText(t)).toBeInTheDocument();
    for (const nome of ["Garrafa", "Adesivo", "Canudo"]) fireEvent.click(screen.getAllByRole("button", { name: "Mover para custos de cada unidade" })[4]!);
    expect(screen.getAllByRole("button", { name: "Mover para ingredientes da receita" })).toHaveLength(3);
    fireEvent.click(screen.getByRole("button", { name: /Mão de obra/ }));
    fireEvent.change(screen.getByLabelText("Valor de Mão de obra"), { target: { value: "0,70" } });
    // 12,44 + 8,95 + 3,50 = 24,89 → 4,98 each; sold at 20 = 15,02 left (75,1%)
    const resultado = screen.getByText("SEU RESULTADO").parentElement!;
    expect(within(resultado).getByText("R$ 24,89")).toBeInTheDocument();
    expect(within(resultado).getByText("R$ 4,98")).toBeInTheDocument();
    expect(within(resultado).getByText("R$ 15,02")).toBeInTheDocument();
    expect(within(resultado).getByText("75,1%")).toBeInTheDocument();
    expect(within(resultado).getByText(/não é o lucro líquido/)).toBeInTheDocument();
    fireEvent.click(within(resultado).getByRole("button", { name: /Ver detalhes/ }));
    expect(within(resultado).getByText("R$ 8,95")).toBeInTheDocument();
    expect(within(resultado).getByText("R$ 3,50")).toBeInTheDocument();
  });

  it("receita incompleta: diz 'Custo parcial — faltam informações…' e não mostra sobra", () => {
    render(<Harness inicial={[...lote, ing("Garrafa", 1, 0, 10, { por: "unidade" })]} />);
    expect(screen.getByText(/Custo parcial — faltam informações para calcular sua margem real/)).toBeInTheDocument();
    expect(screen.queryByText("Sobra por unidade")).toBeNull();
  });

  it("'Produção' digitada como ingrediente vira custo sem estoque com um toque (R$ 0,70 × 5 = R$ 3,50 → R$ 0,70 por unidade)", () => {
    render(<Harness inicial={[...lote, ing("Produção", 5, 0.7)]} />);
    fireEvent.click(screen.getByRole("button", { name: /Produção é custo, não ingrediente/ }));
    expect(screen.getByLabelText("Valor de Produção")).toHaveValue("0,70");
    expect(screen.queryByDisplayValue("Produção")).toHaveAttribute("aria-label", "Nome do custo");
  });
});
