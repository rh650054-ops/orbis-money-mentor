/* 05/11 (Rick): tap a bar or a day card of the mission → how that day went. */
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { desafioSchema, type DiaMissao } from "../types";
import { FaixaDias } from "./faixa-dias";
import { DiaADia } from "./dia-a-dia";

const dia: DiaMissao = {
  dia: "2026-11-04", hoje: false, futuro: false, trabalha: true, plano_unid: 59, plano_lucro: 335,
  unid: 53, vendas: 40, vendido: 1054, recebido: 1000, dinheiro: 300, pix: 700, cartao: 54, gorjeta: 0, fiado: 0,
  calote: 54, custo: 301, custo_unid: 5.68, lucro: 699, bateu: false, fonte: "banco",
  inicio: "2026-11-04T11:00:00Z", fim: "2026-11-04T19:30:00Z", minutos: 480,
  horas: [{ h: 8, unid: 10, valor: 200 }, { h: 9, unid: 20, valor: 400 }], melhor_hora: 9,
};
vi.mock("../api/use-dia-missao", () => ({ useDiaMissaoQuery: () => ({ data: dia, isLoading: false }) }));
import { DiaDetalheSheet } from "./dia-detalhe-sheet";

const d = desafioSchema.parse({
  id: "m1", alvo: 10000, inicio: "2026-11-01", fim: "2026-11-30", status: "ativo", dias_periodo: 30, dia_atual: 5,
  dias_trabalho: 25, dias_trabalhados: 3, custo_unid: 5.68, lucro_unid: 5.5, lucro: 698, vendas: 2215, unidades: 95,
  hoje: { precisa: 304, unid_meta: 35, unid: 0, lucro: 0, trabalha: true, ritmo: "atrasado", atraso: 381 },
  dias: [{ dia: "2026-11-01", unid: 30, lucro: 291 }, { dia: "2026-11-04", unid: 53, lucro: 335 }],
  plano: [{ d: "2026-11-01", t: true, u: 39 }, { d: "2026-11-02", t: false, u: 0 }, { d: "2026-11-04", t: true, u: 59 }],
  calote_fonte: "banco", analise: { produto_nome: "batida" },
});

describe("como foi o dia", () => {
  it("every bar and every day card is a button that opens the day", () => {
    const onDia = vi.fn();
    render(<FaixaDias d={d} onDia={onDia} />);
    fireEvent.click(screen.getByRole("button", { name: /^04\/11 · plano 59/ }));
    expect(onDia).toHaveBeenCalledWith("2026-11-04");
    render(<DiaADia d={d} onDia={onDia} />);
    fireEvent.click(screen.getByRole("button", { name: "SEG 2 — ver o dia" }));
    expect(onDia).toHaveBeenLastCalledWith("2026-11-02");
  });

  it("the sheet shows plan vs real, what fell in, calote, cost and profit", () => {
    render(<DiaDetalheSheet d={d} dia="2026-11-04" onFechar={vi.fn()} />);
    expect(screen.getByText("quarta, 04/11")).toBeTruthy();
    expect(screen.getByText(/plano era 59 · faltaram 6/)).toBeTruthy();
    expect(screen.getByText("Caiu de verdade (banco)")).toBeTruthy();
    expect(screen.getByText("Calote")).toBeTruthy();
    expect(screen.getByText(/Foco das/)).toBeTruthy();
    expect(screen.getByText(/melhor hora: 9h/)).toBeTruthy();
  });
});
