import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { GastosMes } from "./GastosMes";
import { OndeGastou } from "./OndeGastou";
import { ParaRevisar } from "./ParaRevisar";
import { RevisarFolha } from "./RevisarFolha";
import { escolherAlerta, referencia, type Analise, type CatAnalise } from "./tipos";

const mutate = vi.fn();
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
  it("gastos do mês: hero, abaixo do ritmo em verde, legenda da barra e conclusão", () => {
    render(<GastosMes a={analise} podeVoltar onMes={() => {}} negocio={0} />);
    expect(screen.getByText("Gastos em outubro")).toBeTruthy();
    expect(screen.getByText(/R\$\s?563,13 abaixo do seu ritmo/)).toBeTruthy();
    expect(screen.getByText("gasto até hoje · dia 5")).toBeTruthy();
    expect(screen.getByText("Seu gasto")).toBeTruthy();
    expect(screen.getByText("Ritmo esperado")).toBeTruthy();
    expect(screen.getByText("Você está gastando menos que o esperado até agora.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Próximo mês" })).toHaveProperty("disabled", true);
  });

  it("toda barra nomeia a referência: teto, média (conta fixa) ou ritmo", () => {
    expect(referencia(cat({ tem_teto: true, normal: 1500, total: 1168 }), true)).toMatchObject({ metrica: "Teto", texto: expect.stringMatching(/^de R\$\s1\.500$/) });
    expect(referencia(cat({ fixa: true, normal: 1365, esperado: 0 }), true)).toMatchObject({ metrica: "Média" });
    expect(referencia(cat({ total: 200, esperado: 100 }), true)).toMatchObject({ metrica: "Ritmo", cor: "#FF6B5E" });
    expect(referencia(cat({ esperado: 0, historico: 0 }), true).metrica).toBeNull();
  });

  it("onde você gastou: top 5, % dos gastos, negócio à parte e 'Ver todas'", () => {
    const cats = Array.from({ length: 7 }, (_, i) => cat({ categoria: `c${i}`, rotulo: `Cat ${i}`, total: 700 - i * 100 }));
    const onAbrir = vi.fn();
    render(<OndeGastou cats={cats} gasto={2800} corrente pendentesPorCat={{}} onAbrir={onAbrir} onNegocio={() => {}} onTetos={() => {}}
      negocio={{ total: 198, media_mensal: 300, categorias: [{ categoria: "mercadoria", rotulo: "Mercadoria", total: 198, qtd: 1 }] }} />);
    expect(screen.getByText("Cat 4")).toBeTruthy();
    expect(screen.queryByText("Cat 5")).toBeNull();
    expect(screen.getByText("25% dos seus gastos")).toBeTruthy();
    expect(screen.getByText("Custos do negócio")).toBeTruthy();
    expect(screen.getByText(/Ver todas as 7 categorias/)).toBeTruthy();
    fireEvent.click(screen.getByText("Cat 0"));
    expect(onAbrir).toHaveBeenCalledWith(expect.objectContaining({ categoria: "c0" }));
  });

  it("Vant percebeu não repete a primeira categoria da lista", () => {
    const alertas = [{ categoria: "a", rotulo: "A", total: 10, esperado: 5, acima: 5 }, { categoria: "b", rotulo: "B", total: 9, esperado: 5, acima: 4 }];
    expect(escolherAlerta(alertas, "a")?.categoria).toBe("b");
    expect(escolherAlerta(alertas.slice(0, 1), "a")).toBeNull();
  });

  it("para revisar: com pendência pede confirmação; sem, mostra tudo organizado", () => {
    const { rerender } = render(<ParaRevisar r={{ pendentes: [], total_pendentes: 1, organizados: 49, perguntas: 0 }} onRevisar={() => {}} onPerguntas={() => {}} />);
    expect(screen.getByText("1 gasto precisa da sua confirmação")).toBeTruthy();
    expect(screen.getByText("49 outros foram organizados automaticamente")).toBeTruthy();
    rerender(<ParaRevisar r={{ pendentes: [], total_pendentes: 0, organizados: 50, perguntas: 0 }} onRevisar={() => {}} onPerguntas={() => {}} />);
    expect(screen.getByText("Tudo organizado")).toBeTruthy();
    expect(screen.getByText("50 gastos categorizados automaticamente")).toBeTruthy();
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
