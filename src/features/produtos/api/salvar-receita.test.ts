import { beforeEach, describe, expect, it, vi } from "vitest";
import { rascunhoDaReceita, receitaDoRascunho, novoIngrediente } from "../lib/receitas";

const chamadas = vi.hoisted(() => [] as { fn: string; args: Record<string, unknown> }[]);
vi.mock("@/shared/api", () => ({
  supabase: { rpc: (fn: string, args: Record<string, unknown>) => { chamadas.push({ fn, args }); return Promise.resolve({ data: null, error: null }); } },
}));
import { precoParaGravar, salvarReceita } from "./salvar-receita";

type Linha = { nome: string; preco: number };
const enviado = () => (chamadas.find((c) => c.fn === "produto_salvar_receita")!.args.p_itens as Linha[]);
beforeEach(() => { chamadas.length = 0; });

describe("salvarReceita", () => {
  it("converte a compra (un → g) antes da receita e acerta os ingredientes novos depois", async () => {
    await salvarReceita("p1", [{ nome: "Nutella", qtd: 30, preco: 0.078, unidade: "g", pacote: 650 }], 6);
    expect(chamadas.map((c) => c.fn)).toEqual(["ingredientes_definir_compra", "produto_salvar_receita", "ingredientes_definir_compra"]);
  });
});

describe("precisão do preço (23/11): o que ele digita é o que fica", () => {
  const tela = (precoPacote: number, pacote: number) => ({ ...novoIngrediente("Leite em pó", 200), unidade: "g" as const, pacote, precoPacote, precoEditado: true });
  it.each([
    ["1 kg por R$ 35,99", 35.99, 1000, 0.03599],
    ["25 kg por R$ 129,90", 129.9, 25000, 0.005196],
    ["395 g por R$ 6,49", 6.49, 395, 0.0164303797],
    ["1,5 l por R$ 9,00", 9, 1500, 0.006],
  ])("%s: grava o preço de 1 com precisão e volta igual", async (_, precoPacote, pacote, porUnidade) => {
    const salvo = receitaDoRascunho([tela(precoPacote, pacote)]);
    expect(salvo[0]!.preco).toBe(porUnidade);
    await salvarReceita("p1", salvo, 20);
    expect(enviado()[0]!.preco).toBe(porUnidade);
    // what the database returns (cost_per_unit) opened again on the screen
    expect(rascunhoDaReceita([{ ...salvo[0]!, preco: porUnidade, precoEditado: undefined }])[0]!.precoPacote).toBe(precoPacote);
  });
  it("antes: R$ 35,99 voltava R$ 36,00 e R$ 129,90 voltava R$ 130,00 (4 casas)", () => {
    const antigo = (pp: number, pac: number) => Math.round(Math.round((pp / pac) * 10000) / 10000 * pac * 100) / 100;
    expect([antigo(35.99, 1000), antigo(129.9, 25000)]).toEqual([36, 130]);
  });
});

describe("salvar a receita não sobrescreve um preço mais novo do Mercado (23/11)", () => {
  it("preço que veio do banco e não foi mexido vai como 0 (= o banco mantém o dele)", async () => {
    // screen opened with R$ 30,00/kg; meanwhile a Market purchase moved it to R$ 32,00; he only edits the quantity
    const aberta = rascunhoDaReceita([{ id: "ing-1", nome: "Leite em pó", qtd: 200, preco: 0.03, unidade: "g", pacote: 1000 }]);
    const editada = aberta.map((i) => ({ ...i, qtd: 250 }));
    await salvarReceita("p1", receitaDoRascunho(editada), 20);
    expect(enviado()[0]).toMatchObject({ id: "ing-1", qtd: 250, preco: 0 });
  });
  it("preço digitado na tela é enviado (intenção dele)", async () => {
    const aberta = rascunhoDaReceita([{ id: "ing-1", nome: "Leite em pó", qtd: 200, preco: 0.03, unidade: "g", pacote: 1000 }]);
    const editada = aberta.map((i) => ({ ...i, precoPacote: 33.5, precoEditado: true }));
    await salvarReceita("p1", receitaDoRascunho(editada), 20);
    expect(enviado()[0]!.preco).toBe(0.0335);
  });
  it("a marca de 'editado' sobrevive ao rascunho guardado (sair e voltar ao cadastro)", () => {
    const salvo = receitaDoRascunho([{ ...novoIngrediente("Polpa", 300), unidade: "g", pacote: 1000, precoPacote: 18, precoEditado: true }]);
    const json = JSON.parse(JSON.stringify(salvo)) as typeof salvo;   // localStorage round trip
    const volta = receitaDoRascunho(rascunhoDaReceita(json));
    expect(precoParaGravar(volta[0]!)).toBe(0.018);
  });
  it("ingrediente novo sem preço digitado é criado com custo 0, como antes", () => {
    expect(precoParaGravar({ preco: 0, precoEditado: undefined })).toBe(0);
    expect(precoParaGravar({ preco: 0.02, precoEditado: undefined })).toBe(0);
  });
});
