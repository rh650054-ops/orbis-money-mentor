import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { PlanoCard } from "./plano-card";
import { planoLucro } from "../lib/plano";
import type { BaseLucro } from "../types";

const b: BaseLucro = {
  janela_dias: 60, dias_vendidos: 38, unidades: 807, unid_dia: 21.2, recorde_dia: 76, ticket: 22.92,
  custo_unid: 8.98, custo_receita: 5.68, custo_extrato: 8.98, gastos_corre: 7246.78,
  fonte_custo: "extrato", banco: true, estoque: 125, produto_nome: "Batida", frequencia: 0.633,
};

describe("PlanoCard", () => {
  it("shows the gap on the average and the units per day", () => {
    render(<PlanoCard b={b} p={planoLucro(b, 5000, 9)} alvo={5000} dias={15} diasTrabalho={9} onDiasTrabalho={() => {}} />);
    expect(screen.getByText(/Faltam R\$\s?2\.340/)).toBeInTheDocument();
    expect(screen.getByText("40")).toBeInTheDocument();
    expect(screen.getByText(/Puxado, mas você já fez isso/)).toBeInTheDocument();
    expect(screen.getByText("235")).toBeInTheDocument(); // 360 total − 125 in stock
  });
});
