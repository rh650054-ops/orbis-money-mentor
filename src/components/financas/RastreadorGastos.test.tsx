import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

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

  it("com teto definido, compara com o teto e abre a categoria ao tocar", () => {
    const onCategoria = vi.fn();
    const onTetos = vi.fn();
    const r: Rastreador = {
      ...base, tem_tetos: true,
      categorias: [{ categoria: "restaurante", rotulo: "Bares e lanches", icone: "🍟", total: 175, qtd: 6, normal: 150, esperado: 24, tem_teto: true, historico: 92 }],
      alerta: { rotulo: "Bares e lanches", icone: "🍟", total: 175, esperado: 24, acima: 151, tem_teto: true },
    };
    render(<RastreadorView r={r} onVerTudo={() => {}} onCategoria={onCategoria} onTetos={onTetos} />);
    expect(screen.getByText(/de R\$ 150 teto/)).toBeTruthy();
    expect(screen.getByText(/Bares e lanches passou do teto/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Bares e lanches: ver e mover/ }));
    expect(onCategoria).toHaveBeenCalledWith("restaurante");
    fireEvent.click(screen.getByRole("button", { name: "Ajustar tetos" }));
    expect(onTetos).toHaveBeenCalled();
  });
});
