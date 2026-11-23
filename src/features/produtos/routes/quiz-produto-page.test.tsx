import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { RascunhoProduto } from "../types";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "u1" } }) }));
vi.mock("@/shared/hooks/use-toast", () => ({ toast: vi.fn() }));
vi.mock("../api/use-produtos-query", () => ({ useProdutosQuery: () => ({ isError: false, isFetchedAfterMount: true, data: [] }) }));
vi.mock("../api/use-ingredientes-guardados-query", () => ({ useIngredientesGuardadosQuery: () => ({ data: [] }) }));
vi.mock("../api/use-subir-foto-mutation", () => ({ useSubirFotoMutation: () => ({ mutate: vi.fn(), isPending: false }) }));
const salvar = vi.fn(async (r: RascunhoProduto) => r.id ?? r.novoId ?? "novo-1");
vi.mock("../api/use-produto-mutations", () => ({ useSalvarProdutoMutation: () => ({ mutateAsync: salvar, isPending: false }) }));
const salvarSabores = vi.fn(async (_: { produtoId: string; sabores: unknown[] }) => {});
vi.mock("../api/use-salvar-sabores-mutation", () => ({ useSalvarSaboresMutation: () => ({ mutateAsync: salvarSabores, isPending: false }) }));

import QuizProdutoPage from "./quiz-produto-page";

const abrir = () => render(<MemoryRouter initialEntries={["/products/novo"]}><Routes><Route path="/products/novo" element={<QuizProdutoPage />} /></Routes></MemoryRouter>);
const clicar = (t: string | RegExp) => fireEvent.click(screen.getAllByText(t)[0]!);
const digitar = (rotulo: string, v: string, i = 0) => fireEvent.change(screen.getAllByLabelText(rotulo)[i]!, { target: { value: v } });
const enviado = () => salvar.mock.calls.at(-1)![0];
const nome = (n: string) => { digitar("Nome do produto", n); clicar("CONTINUAR"); };
const precoERevisao = (v: string) => { digitar("Valor", v); clicar("CONTINUAR"); };

beforeEach(() => { localStorage.clear(); salvar.mockClear(); salvarSabores.mockReset(); salvarSabores.mockImplementation(async () => {}); });
const salvarProduto = async () => { await act(async () => { clicar(/SALVAR PRODUTO|TENTAR DE NOVO/); }); };

describe("cadastro inteligente (Etapa 2)", () => {
  it("fabricação: receita com rendimento dele, sabores com receitas diferentes, revisão e salvar", async () => {
    abrir();
    nome("Batida");
    clicar("Eu mesmo produzo");
    clicar("Montar minha receita");
    digitar("Quanto a receita rende", "20");
    // the suggested names come without quantity: fill the first, leave the others as draft
    digitar("Quanto usa na leva", "1");
    digitar("Quanto paga nessa compra", "6,50");
    clicar("CONTINUAR");
    clicar("Sim, tem mais de um");
    digitar("Nome do sabor", "Morango");
    clicar("CONTINUAR");
    precoERevisao("8");
    // 23/11: 1 ingredient with quantity and 3 without is NOT "ready": it says what is missing
    expect(screen.getByText("RECEITA PARCIALMENTE CONFIGURADA")).toBeInTheDocument();
    expect(screen.getByText(/Falta informar a quantidade de 3 ingredientes/)).toBeInTheDocument();
    expect(screen.getByText("Completar receita")).toBeInTheDocument();
    await salvarProduto();
    const r = enviado();
    expect(r).toMatchObject({ nome: "Batida", origem: "faz", rende: 20, preco: 8, novoId: expect.any(String) });
    expect(r.receita![0]).toMatchObject({ nome: "Leite condensado", qtd: 1, preco: 6.5 });
    expect(r.receita!.filter((i) => i.aprender).length).toBe(3);         // drafts kept, no consumption invented
    // the second, unnamed flavour line is dropped by the save (saboresParaSalvar)
    expect(salvarSabores.mock.calls[0]![0]).toMatchObject({ produtoId: r.novoId, sabores: expect.arrayContaining([expect.objectContaining({ nome: "Morango" })]) });
    expect(screen.getByText("PRODUTO CADASTRADO")).toBeInTheDocument();
    expect(localStorage.getItem("vant_cadastro_rascunho_v1:u1")).toBeNull();   // saved → draft cleared
  });

  it("revenda: não pede receita; custo de 1 e preço; sem receita no que vai pro banco", async () => {
    abrir();
    nome("Água");
    clicar("Compro pronto para revender");
    expect(screen.queryByText("Montar minha receita")).toBeNull();
    clicar("Sei o preço de 1");
    digitar("Quanto pagou em 1", "1,20");
    clicar("CONTINUAR");
    clicar("Não, é um só");
    precoERevisao("3");
    expect(screen.getByText("REVENDA")).toBeInTheDocument();
    expect(screen.getByText(/O estoque entra quando você registra a compra/)).toBeInTheDocument();
    digitar("Quantidade", "24");
    await salvarProduto();
    expect(enviado()).toMatchObject({ origem: "compra", receita: null, custo: 1.2, preco: 3, estoque: 24 });
    expect(salvarSabores).not.toHaveBeenCalled();
  });

  it("configurar depois: pula a pergunta 3, salva vendável e diz que a produção fica desligada", async () => {
    abrir();
    nome("Trufa");
    clicar("Configurar depois");
    expect(screen.getByText(/tem outros sabores ou versões/)).toBeInTheDocument();   // question 3 skipped
    clicar("Não, é um só");
    precoERevisao("5");
    expect(screen.getByText("CONFIGURAR DEPOIS")).toBeInTheDocument();
    expect(screen.getByText(/produção automática ficam desligados/)).toBeInTheDocument();
    await salvarProduto();
    expect(enviado()).toMatchObject({ origem: null, receita: null, rende: 0, preco: 5 });
  });

  it("voltar e sair não perdem nada: o rascunho volta na mesma pergunta", async () => {
    const tela = abrir();
    nome("Brigadeiro");
    clicar("Eu mesmo produzo");
    clicar("Montar minha receita");
    digitar("Quanto a receita rende", "30");
    clicar("CONTINUAR");
    fireEvent.click(screen.getByLabelText("Voltar")); // back to the recipe: what he typed is there
    expect(screen.getByLabelText("Quanto a receita rende")).toHaveValue("30");
    clicar("CONTINUAR");
    tela.unmount();   // he leaves the app
    abrir();
    expect(screen.getByText(/Brigadeiro tem outros sabores/)).toBeInTheDocument();
    clicar("Não, é um só");
    precoERevisao("2");
    await salvarProduto();
    expect(enviado()).toMatchObject({ nome: "Brigadeiro", origem: "faz", rende: 30 });
  });

  it("rascunho: sair NO MEIO da receita (sem CONTINUAR) e voltar mantém rendimento, quantidades e ingredientes", async () => {
    const tela = abrir();
    nome("Geladinho");
    clicar("Eu mesmo produzo");
    clicar("Montar minha receita");
    digitar("Quanto a receita rende", "40");
    digitar("Quanto usa na leva", "2");
    digitar("Quanto paga nessa compra", "6,50");
    tela.unmount();   // phone call, app closed, no CONTINUAR pressed
    abrir();
    expect(screen.getByLabelText("Quanto a receita rende")).toHaveValue("40");
    expect(screen.getAllByLabelText("Quanto usa na leva")[0]).toHaveValue("2");
    expect(screen.getAllByLabelText("Quanto paga nessa compra")[0]).toHaveValue("6,50");
    // the lines he had not filled are still there as drafts (no quantity invented)
    expect(screen.getAllByLabelText("Ingrediente").length).toBeGreaterThan(1);
    clicar("CONTINUAR");
    clicar("Não, é um só");
    precoERevisao("3");
    expect(screen.getByText("RECEITA PARCIALMENTE CONFIGURADA")).toBeInTheDocument();
  });

  it("rascunho: sair na pergunta dos sabores mantém os sabores digitados", async () => {
    const tela = abrir();
    nome("Água");
    clicar("Compro pronto para revender");
    clicar("Sei o preço de 1");
    digitar("Quanto pagou em 1", "1");
    clicar("CONTINUAR");
    clicar("Sim, tem mais de um");
    digitar("Versão 1", "500 ml");
    digitar("Versão 2", "1,5 L");
    tela.unmount();
    abrir();
    expect(screen.getByLabelText("Versão 1")).toHaveValue("500 ml");
    expect(screen.getByLabelText("Versão 2")).toHaveValue("1,5 L");
  });

  it("rascunho é de cada usuário e some depois de salvar", async () => {
    abrir();
    nome("Trufa");
    expect(localStorage.getItem("vant_cadastro_rascunho_v1:u1")).toContain("Trufa");
    expect(localStorage.getItem("vant_cadastro_rascunho_v1:u2")).toBeNull();
    clicar("Configurar depois");
    clicar("Não, é um só");
    precoERevisao("4");
    await salvarProduto();
    expect(localStorage.getItem("vant_cadastro_rascunho_v1:u1")).toBeNull();
  });

  it("sabores que repetem um ingrediente da base: aviso e não segue (o banco recusaria e os sabores se perderiam)", async () => {
    abrir();
    nome("Batida");
    clicar("Eu mesmo produzo");
    clicar("Montar minha receita");
    digitar("Quanto a receita rende", "20");
    digitar("Quanto usa na leva", "1");
    clicar("CONTINUAR");
    clicar("Sim, tem mais de um");
    digitar("Nome do sabor", "Morango");
    clicar(/ingrediente do Morango/);            // "+ ingrediente do Morango"
    const campos = screen.getAllByLabelText("Ingrediente");
    fireEvent.change(campos[campos.length - 1]!, { target: { value: "Leite condensado" } });
    expect(screen.getByText(/já está na receita base ou em outro sabor/)).toBeInTheDocument();
    expect(screen.getByText("TIRE O INGREDIENTE REPETIDO").closest("button")).toBeDisabled();
  });

  it("receita com TODOS os ingredientes com quantidade e rendimento: pronta", async () => {
    abrir();
    nome("Brigadeiro");
    clicar("Eu mesmo produzo");
    clicar("Montar minha receita");
    digitar("Quanto a receita rende", "20");
    screen.getAllByLabelText("Quanto usa na leva").forEach((c, i) => fireEvent.change(c, { target: { value: String(i + 1) } }));
    clicar("CONTINUAR");
    clicar("Não, é um só");
    precoERevisao("2");
    expect(screen.getByText("RECEITA PRONTA")).toBeInTheDocument();
    expect(screen.queryByText("Completar receita")).toBeNull();
  });

  it("sabores falham: NÃO mostra 'cadastrado', guarda o rascunho e a nova tentativa não duplica o produto", async () => {
    salvarSabores.mockImplementationOnce(async () => { throw new Error("rede caiu"); });
    const tela = abrir();
    nome("Geladinho");
    clicar("Compro pronto para revender");
    clicar("Sei o preço de 1");
    digitar("Quanto pagou em 1", "1");
    clicar("CONTINUAR");
    clicar("Sim, tem mais de um");
    digitar("Versão 1", "Uva");
    clicar("CONTINUAR");
    precoERevisao("3");
    await salvarProduto();
    expect(screen.queryByText("PRODUTO CADASTRADO")).toBeNull();
    expect(screen.getByRole("alert")).toHaveTextContent("Não salvou tudo");
    expect(screen.getByText("TENTAR DE NOVO")).toBeInTheDocument();
    const primeiro = salvar.mock.calls[0]![0];
    expect(localStorage.getItem("vant_cadastro_rascunho_v1:u1")).toContain(primeiro.novoId!);   // draft kept, with its id
    tela.unmount(); abrir();                                // even leaving the app and coming back
    await salvarProduto();
    expect(salvar.mock.calls[1]![0].novoId).toBe(primeiro.novoId);   // same product id: the mutation updates, never inserts twice
    expect(salvarSabores).toHaveBeenCalledTimes(2);
    expect(screen.getByText("PRODUTO CADASTRADO")).toBeInTheDocument();
    expect(localStorage.getItem("vant_cadastro_rascunho_v1:u1")).toBeNull();
  });

  it("produto falha: nada é dado como salvo e os sabores nem são tentados", async () => {
    salvar.mockImplementationOnce(async () => { throw new Error("sem internet"); });
    abrir();
    nome("Pastel");
    clicar("Configurar depois");
    clicar("Não, é um só");
    precoERevisao("6");
    await salvarProduto();
    expect(screen.queryByText("PRODUTO CADASTRADO")).toBeNull();
    expect(salvarSabores).not.toHaveBeenCalled();
    expect(localStorage.getItem("vant_cadastro_rascunho_v1:u1")).toContain("Pastel");
  });
});
