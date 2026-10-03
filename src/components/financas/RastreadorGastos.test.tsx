import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("react-router-dom", () => ({ useNavigate: () => () => {} }));
import { RastreadorView, type Rastreador } from "./RastreadorGastos";

const base: Rastreador = {
  tem_dados: true, fonte: "banco", mes: "2026-10-01", dia: 18, dias_mes: 31,
  gasto: 900, mes_passado_mesmo_dia: 700, normal_mes: 1240, normal_ate_hoje: 720, projecao: 1550,
  semana: { atual: 300, anterior: 200 },
  categorias: [
    { categoria: "delivery", rotulo: "Delivery", icone: "🍔", total: 320, qtd: 9, normal: 310, esperado: 180 },
    { categoria: "mercado", rotulo: "Mercado / rancho", icone: "🛒", total: 250, qtd: 4, normal: 500, esperado: 290 },
  ],
  alerta: { rotulo: "Delivery", icone: "🍔", total: 320, esperado: 180, acima: 140 },
  ultimos: [],
};

describe("RastreadorView", () => {
  it("mostra o gasto do mês, o desvio do normal e o alerta", () => {
    render(<RastreadorView r={base} onVerTudo={() => {}} />);
    expect(screen.getByText(/gastou até hoje/)).toBeTruthy();
    expect(screen.getByText(/acima do seu normal/)).toBeTruthy();
    expect(screen.getByText(/Delivery passou do seu normal/)).toBeTruthy();
    expect(screen.getByText(/Ver cada gasto no Raio-X/)).toBeTruthy();
  });

  it("sem dados, convida a lançar ou ligar o banco", () => {
    render(<RastreadorView r={{ tem_dados: false, mes: "2026-10-01", dia: 3, dias_mes: 31 }} onVerTudo={() => {}} />);
    expect(screen.getByText(/Ainda não tem gasto pra rastrear/)).toBeTruthy();
  });
});
