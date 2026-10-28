/* 28/10 (Rick): "se ele define a meta de lucro, o app se molda a essa meta — modo foco e tudo".
   The server puts the mission into metas_dia.missao; the Foco says where the day's goal comes from. */
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { lerMetaDoDia } from "@/shared/lib/meta-viavel";
import { Input } from "@/shared/ui/input";
import { FocoHero, type HeroNumeros } from "./foco-hero";

const LINHA = {
  dia: "2026-10-28", ritmo: 600, amostra_dia: 3, precisa_dia: 400, dias_restantes: 10, vendido_mes: 7000,
  meta_mensal: 12000, falta_mes: 5000, meta: 950, minimo: 760, turbo: 1140, status: "folga", mes_viavel: 12000,
  ticket: 25, plano_maximo: null, curva: [], modo: "padrao", meta_adaptativa: 600, dias_vendidos: 30,
  missao: { id: "x", alvo: 5000, fim: "2026-11-10", lucro_feito: 0, precisa_lucro: 555.56, unid_meta: 53, faturar: 943.4, produto: "Batida" },
};

const N: HeroNumeros = {
  dailyGoal: 950, totalVendido: 0, totalCaiu: 0, faltaCair: 0, lucro: 0, workHours: 8, blocosTot: 0, projecao: 0,
  ontem: 0, pctOntem: 0, semana: 0, vendas: 0, abord: 0, conv: 0, rankPos: null, ligaCor: null, ligaLabel: "",
  horaInicio: null, ativoDesde: null,
};

const hero = (dailyGoal: number) => (
  <FocoHero estado="antes" meta={lerMetaDoDia(LINHA)} temFaixas={false} overnightOpen={false} exporting={false}
    onEditar={vi.fn()} onIrDefcon={vi.fn()} onPDF={vi.fn()} n={{ ...N, dailyGoal }} />
);

describe("missão de lucro no Foco", () => {
  it("lê a missão da meta do dia", () => {
    const m = lerMetaDoDia(LINHA);
    expect(m?.missao).toEqual({ alvo: 5000, fim: "2026-11-10", precisaLucro: 555.56, unidMeta: 53, faturar: 943.4, produto: "Batida" });
    expect(lerMetaDoDia({ ...LINHA, missao: null })?.missao).toBeNull();
  });

  it("o card do Foco diz que a meta é da missão e quanto ela pede hoje", () => {
    render(hero(950));
    expect(screen.getByText(/Meta da missão/)).toBeTruthy();
    expect(screen.getByText(/53 batidas/)).toBeTruthy();
  });

  it("DEFCON começado antes da missão (plano com outra meta): fica como estava", () => {
    render(hero(400));
    expect(screen.queryByText(/Meta da missão/)).toBeNull();
    expect(screen.queryByText(/53 batidas/)).toBeNull();
  });
});

describe("campo de valor grande", () => {
  it("tamanho próprio não é trocado por 14px em tela larga", () => {
    render(<Input aria-label="grande" className="text-[52px]" />);
    expect(screen.getByLabelText("grande").className).not.toContain("md:text-sm");
    render(<Input aria-label="padrao" />);
    expect(screen.getByLabelText("padrao").className).toContain("md:text-sm");
  });
});
