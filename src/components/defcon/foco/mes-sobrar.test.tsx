/* 29/10 (Rick): "a meta do mês continua faturamento, mas o objetivo é ter o lucro no bolso". */
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
import type { MetaDoDia } from "@/shared/lib/meta-viavel";
import type { SobrarMes } from "@/features/objetivo-lucro";
import { MesCard } from "./mes-card";
import { levaPraCasa } from "./mes-sobrar";

const META: MetaDoDia = {
  hoje: "2026-11-05", diaSemana: 4, ritmo: 400, amostraDia: 4, precisaDia: 500, diasRestantes: 10, vendidoMes: 7000,
  metaMensal: 12000, faltaMes: 5000, meta: 950, minimo: 760, turbo: 1140, status: "inviavel", mesViavel: 10500, ticket: 10,
  maximo: { diasExtra: ["wednesday", "wednesday"], blocos: 9, metaDia: 640, diasRestantes: 12, projecao: 11800, pct: 98, chega: false, vendasDia: 64, vendasHora: 7, vendasDiaRealista: 60 },
  curva: [], modo: "padrao", metaAdaptativa: 600, diasVendidos: 30, missao: null,
};
const SOBRAR: SobrarMes = {
  hoje: "2026-11-05", vendas_mes: 7000, unidades_mes: 700, dias_mes: 12, lucro_unid: 6.2, lucro_mes: 4100, ticket: 10,
  fonte_custo: "receita", produto_nome: "Batida", custo_corre_dia: 18, calote_pct: 6, calote_unid: 0.6, missao: null,
};

describe("Vender × Sobrar no card do mês", () => {
  it("mostra o que sobrou, por batida, e quanto leva pra casa no ritmo", () => {
    render(<MesCard m={META} onReplanejar={vi.fn()} sobrar={SOBRAR} onDefinirLucro={vi.fn()} onProduto={vi.fn()} />);
    expect(screen.getByText(/Sobrar · no bolso/)).toBeTruthy();
    expect(screen.getByText(/R\$ 4\.100/)).toBeTruthy();
    expect(screen.getByText(/R\$ 6,20 por batida/)).toBeTruthy();
    // fecha em 7000 + 400×10 = 11000 → +400 unid × 6,20 a mais
    expect(levaPraCasa(SOBRAR, 11000)).toBeCloseTo(4100 + 400 * 6.2, 0);
    expect(screen.getByText(/pra casa/)).toBeTruthy();
  });

  it("as dicas abrem o replanejar já na escolha; 'definir lucro' leva pra missão", () => {
    const onReplanejar = vi.fn(); const onDefinir = vi.fn();
    render(<MesCard m={META} onReplanejar={onReplanejar} sobrar={SOBRAR} onDefinirLucro={onDefinir} onProduto={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "+2 dias" }));
    expect(onReplanejar).toHaveBeenCalledWith("dias");
    fireEvent.click(screen.getByRole("button", { name: "+10/dia" })); // (500−400)/10
    expect(onReplanejar).toHaveBeenCalledWith("manter");
    fireEvent.click(screen.getByRole("button", { name: /definir lucro/ }));
    expect(onDefinir).toHaveBeenCalled();
  });

  it("sem custo do produto: o bolso vira pergunta e o botão é cadastrar", () => {
    const onProduto = vi.fn();
    render(<MesCard m={META} onReplanejar={vi.fn()} sobrar={{ ...SOBRAR, fonte_custo: "sem_custo" }} onDefinirLucro={vi.fn()} onProduto={onProduto} />);
    expect(screen.getByText(/Quanto é seu\?/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /cadastrar/ }));
    expect(onProduto).toHaveBeenCalled();
    expect(screen.queryByText(/R\$ 4\.100/)).toBeNull();
  });

  it("com missão ativa mostra o progresso dela em vez de 'definir lucro'", () => {
    render(<MesCard m={META} onReplanejar={vi.fn()} sobrar={{ ...SOBRAR, missao: { alvo: 3000, lucro: 1240, dia: 6, dias: 15 } }} onDefinirLucro={vi.fn()} onProduto={vi.fn()} />);
    expect(screen.getByText(/missão 41%/)).toBeTruthy();
    expect(screen.getByText(/dia 6\/15/)).toBeTruthy();
    expect(screen.queryByText(/definir lucro/)).toBeNull();
  });
});
