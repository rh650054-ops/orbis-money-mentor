import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { HomeFinancas } from "@/components/financas/FinancasHome";
import { PrioridadeHoje, explicacao, type PrioridadeProps } from "./prioridade-hoje";
import { MeuNegocio, custosEMargem } from "./meu-negocio";
import { FolegoFinanceiro, FluxoDeCaixa } from "./folego-fluxo";

const casa = (o: Partial<HomeFinancas> = {}): HomeFinancas => ({
  tem_banco: true, tem_saldo: true, saldo: 1000, bancos: [{ banco: "A", saldo: 600 }, { banco: "B", saldo: 400 }],
  atualizado: "2026-11-28T14:02:00Z", fixas_mes: 1500, folego_dias: 20, entrou: 3000, saiu: 2500, sobrou: 500,
  alerta: null, causas: null, piloto: { lancamentos: 0, conferir: 0 }, saldo_trabalho: 600, saldo_pessoal: 400, ...o,
});
const prioridade = (o: Partial<PrioridadeProps> = {}): PrioridadeProps => ({
  carregando: false, temPlanejamento: true, diaFechado: false, diaDeTrabalho: true, restante: 120, contas: 120, objetivos: 0,
  guardouHoje: 0, sequencia: 0, pctDoLucro: null, podeDesfazer: false,
  onGuardei: vi.fn(), onDesfazer: vi.fn(), onPlanejar: vi.fn(), ...o,
});
const negocio = { carregando: false, faturamento: 1000, lucro: 600, vendidoHoje: 80, lucroHoje: 50, mediaDiaria: 40, fiadoHoje: 0 };

describe("pure rules (no calculation was changed: the same formulas as before)", () => {
  it("costs and margin keep the old card's formulas", () => {
    expect(custosEMargem(1000, 600)).toEqual({ custos: 400, margem: 60 });
    expect(custosEMargem(0, 0)).toEqual({ custos: 0, margem: 0 });
    expect(custosEMargem(1000, -200)).toEqual({ custos: 1200, margem: 0 });
  });
  it("explains what the amount is for", () => {
    expect(explicacao({ contas: 10, objetivos: 0 })).toBe("Para manter suas contas em dia");
    expect(explicacao({ contas: 0, objetivos: 5 })).toBe("Para seus objetivos andarem no prazo");
    expect(explicacao({ contas: 10, objetivos: 5 })).toContain("objetivos");
  });
});

describe("Prioridade de hoje", () => {
  it("keeps the GUARDEI action and the way to Planejar", () => {
    const p = prioridade();
    render(<PrioridadeHoje {...p} />);
    expect(screen.getByText("R$ 120")).toBeTruthy();
    fireEvent.click(screen.getByText(/GUARDEI/));
    expect(p.onGuardei).toHaveBeenCalled();
    fireEvent.click(screen.getByText("Ver planejamento"));
    expect(p.onPlanejar).toHaveBeenCalled();
  });
  it("planning not configured asks to configure it", () => {
    const p = prioridade({ temPlanejamento: false });
    render(<PrioridadeHoje {...p} />);
    fireEvent.click(screen.getByText("Configurar planejamento"));
    expect(p.onPlanejar).toHaveBeenCalled();
    expect(screen.queryByText(/GUARDEI/)).toBeNull();
  });
  it("closed day shows what was saved and can be undone", () => {
    const p = prioridade({ diaFechado: true, guardouHoje: 120 });
    render(<PrioridadeHoje {...p} />);
    expect(screen.getByText("Guardou R$ 120")).toBeTruthy();
    fireEvent.click(screen.getByLabelText("Reverter o guardar de hoje"));
    expect(p.onDesfazer).toHaveBeenCalled();
  });
  it("loading shows a placeholder, not a zero", () => {
    render(<PrioridadeHoje {...prioridade({ carregando: true })} />);
    expect(screen.queryByText("R$ 120")).toBeNull();
  });
  it("rest day offers no GUARDEI", () => {
    render(<PrioridadeHoje {...prioridade({ diaDeTrabalho: false })} />);
    expect(screen.getByText("Hoje é seu descanso")).toBeTruthy();
    expect(screen.queryByText(/GUARDEI/)).toBeNull();
  });
});

describe("Meu negócio", () => {
  it("profit, margin, revenue, costs, sold today and daily average", () => {
    render(<MeuNegocio {...negocio} />);
    expect(screen.getByText("R$ 600")).toBeTruthy();
    expect(screen.getByRole("img", { name: "Margem de 60%" })).toBeTruthy();
    expect(screen.getByText("R$ 400")).toBeTruthy();
    expect(screen.getByText("R$ 80")).toBeTruthy();
    expect(screen.getByText("R$ 40")).toBeTruthy();
  });
  it("a month with loss is red and says prejuízo", () => {
    render(<MeuNegocio {...negocio} lucro={-200} />);
    expect(screen.getByText("Prejuízo do mês")).toBeTruthy();
    expect(screen.getByText("− R$ 200")).toBeTruthy();
  });
  it("zeroed month shows zeros without breaking", () => {
    render(<MeuNegocio {...negocio} faturamento={0} lucro={0} vendidoHoje={0} lucroHoje={0} mediaDiaria={0} />);
    expect(screen.getByRole("img", { name: "Margem de 0%" })).toBeTruthy();
  });
});

describe("Fôlego and Fluxo de caixa", () => {
  it("fôlego shows the days and the existing methodology", () => {
    render(<FolegoFinanceiro h={casa()} onPlanejar={vi.fn()} />);
    expect(screen.getByText("20 dias")).toBeTruthy();
    fireEvent.click(screen.getByText("Como calculamos?"));
    expect(screen.getByText(/R\$ 1.500 no mês ÷ 30/)).toBeTruthy();
  });
  it("fôlego without fixed bills sends to Planejar", () => {
    const planejar = vi.fn();
    render(<FolegoFinanceiro h={casa({ folego_dias: null, fixas_mes: 0 })} onPlanejar={planejar} />);
    fireEvent.click(screen.getByText("Cadastrar contas fixas"));
    expect(planejar).toHaveBeenCalled();
  });
  it("fôlego with negative balance explains why there is no number", () => {
    render(<FolegoFinanceiro h={casa({ folego_dias: null, saldo: -10 })} onPlanejar={vi.fn()} />);
    expect(screen.getByText(/Sem saldo positivo/)).toBeTruthy();
  });
  it("cash flow shows a negative difference in red with a minus sign", () => {
    const ver = vi.fn();
    render(<FluxoDeCaixa h={casa({ entrou: 1000, saiu: 1500 })} onVer={ver} />);
    expect(screen.getByText("− R$ 500")).toBeTruthy();
    fireEvent.click(screen.getByText("Ver movimentações"));
    expect(ver).toHaveBeenCalled();
  });
});
