import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { RevisarFolha } from "./RevisarFolha";
import { escolherAlerta, referencia, type Analise, type CatAnalise } from "./tipos";

const mutate = vi.fn();
vi.mock("./use-categoria", () => ({ useCriarCategoria: () => ({ mutate: vi.fn(), isPending: false }), erroCategoria: () => "erro" }));
vi.mock("./use-analise", () => ({
  useCategoriasSaida: () => ({ data: [
    { slug: "mercado", rotulo: "Mercado / rancho", tipo: "saida", esfera_padrao: "pessoal", ordem: 13 },
    { slug: "pix_pessoas", rotulo: "Pix pra pessoas", tipo: "saida", esfera_padrao: "pessoal", ordem: 14 },
    { slug: "transferencia_propria", rotulo: "Entre minhas contas", tipo: "saida", esfera_padrao: "pessoal", ordem: 90 },
  ] }),
  useAcaoLancamento: () => ({ mutate, isPending: false }),
}));

const cat = (o: Partial<CatAnalise>): CatAnalise => ({
  categoria: "delivery", rotulo: "Delivery", total: 100, qtd: 2, normal: 300, esperado: 80, fixa: false,
  tem_teto: false, historico: 300, passado_mesmo_dia: 60, ...o,
});

const analise: Analise = {
  tem_dados: true, mes: "2026-10-01", corrente: true, dia: 5, dias_mes: 31, meses_historico: 3,
  gasto: 2269.15, normal_ate_hoje: 2832.28, normal_mes: 9000, media_mensal: 9000, projecao: 8500, mes_passado_mesmo_dia: 3000,
};

describe("Análise", () => {
  it("toda barra nomeia a referência: teto, média (conta fixa) ou ritmo", () => {
    expect(referencia(cat({ tem_teto: true, normal: 1500, total: 1168 }), true)).toMatchObject({ metrica: "Teto", texto: expect.stringMatching(/^de R\$\s1\.500$/) });
    expect(referencia(cat({ fixa: true, normal: 1365, esperado: 0 }), true)).toMatchObject({ metrica: "Média" });
    expect(referencia(cat({ total: 200, esperado: 100 }), true)).toMatchObject({ metrica: "Ritmo", cor: "#FF6B5E" });
    expect(referencia(cat({ esperado: 0, historico: 0 }), true).metrica).toBeNull();
  });

  it("Vant percebeu não repete a primeira categoria da lista", () => {
    const alertas = [{ categoria: "a", rotulo: "A", total: 10, esperado: 5, acima: 5 }, { categoria: "b", rotulo: "B", total: 9, esperado: 5, acima: 4 }];
    expect(escolherAlerta(alertas, "a")?.categoria).toBe("b");
    expect(escolherAlerta(alertas.slice(0, 1), "a")).toBeNull();
  });

  it("revisar: confirmar move o gasto, tira da fila e o contador desce", () => {
    vi.useFakeTimers();
    const pendentes = [
      { id: "p1", data: "2026-10-02", valor: 120, nome: "Fulano", banco: "Nubank", categoria: "pix_pessoas" },
      { id: "p2", data: "2026-10-03", valor: 50, nome: "Ciclano", banco: "Inter", categoria: "pix_pessoas" },
    ];
    render(<RevisarFolha aberta pendentes={pendentes} onFechar={() => {}} />);
    expect(screen.getByText("2 gastos pra confirmar")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Mercado / rancho" }));
    expect(mutate).toHaveBeenCalledWith({ tipo: "mover", id: "p1", categoria: "mercado", todos: false }, expect.anything());
    act(() => { vi.advanceTimersByTime(500); });
    expect(screen.getByText("1 gasto pra confirmar")).toBeTruthy();
    expect(screen.getByText("Ciclano")).toBeTruthy();
    vi.useRealTimers();
  });
});
