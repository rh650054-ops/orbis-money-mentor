import { describe, expect, it, vi } from "vitest";

// o número do prêmio conta de 0 até o valor (requestAnimationFrame): no teste, chega na hora
vi.stubGlobal("requestAnimationFrame", (cb: (t: number) => void) => { cb(performance.now() + 10_000); return 1; });
vi.stubGlobal("cancelAnimationFrame", () => {});
import { act, fireEvent, render, screen } from "@testing-library/react";
import { lerAba, premioDaAba, rotuloSemana } from "./premiacao";
import { RankingAbas } from "./RankingAbas";

describe("ranking semanal + premiação de novembro", () => {
  it("a aba vem da URL", () => {
    expect(lerAba("semana")).toBe("semanal");
    expect(lerAba(null)).toBe("mensal");
  });
  it("semanas de novembro numeradas (segunda a domingo, Semana 1 = 02/11)", () => {
    expect(rotuloSemana("2026-11-02", "2026-11-08")).toBe("Semana 1 · 02/11 a 08/11");
    expect(rotuloSemana("2026-11-30", "2026-12-06")).toBe("Semana 5 · 30/11 a 06/12");
    expect(rotuloSemana("2026-11-01", "2026-11-07")).toBe("01/11 a 07/11"); // regra antiga: sem número
    expect(rotuloSemana("2026-10-25", "2026-10-31")).toBe("25/10 a 31/10");
  });
  it("prêmio: R$ 500 no mês, R$ 50 na semana; antes de 1/11 avisa que começa; depois de 30/11 some", () => {
    expect(premioDaAba("mensal", "2026-11-10")).toEqual({ valor: 500, texto: "pro 1º lugar de novembro", antes: false });
    expect(premioDaAba("semanal", "2026-10-29")?.antes).toBe(true);
    expect(premioDaAba("semanal", "2026-12-01")).toBeNull();
  });
  it("as abas trocam e o semanal mostra o período", () => {
    const onAba = vi.fn();
    const { rerender } = render(<RankingAbas aba="mensal" onAba={onAba} hoje="2026-11-03" periodoSemana="Semana 1 · 01/11 a 07/11" fimSemana="2026-11-07" />);
    act(() => {});
    expect(screen.getByText(/R\$ 500/)).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: "Semanal" }));
    expect(onAba).toHaveBeenCalledWith("semanal");
    rerender(<RankingAbas aba="semanal" onAba={onAba} hoje="2026-11-03" periodoSemana="Semana 1 · 01/11 a 07/11" fimSemana="2026-11-07" />);
    act(() => {});
    expect(screen.getByText(/R\$ 50\b/)).toBeTruthy();
    expect(screen.getByText(/SEMANA 1/)).toBeTruthy();
    expect(screen.getByText(/01\/11 a 07\/11/)).toBeTruthy();
  });
});

import { liderDoPremio } from "./premiacao";
describe("quem leva o prêmio (Rick, 02/11)", () => {
  const r = [
    { user_id: "a", verificado: false, faturamento_total_mes: 1557 },
    { user_id: "b", verificado: false, faturamento_total_mes: 1422 },
    { user_id: "c", verificado: true, faturamento_total_mes: 734 },
    { user_id: "d", verificado: true, faturamento_total_mes: 725 },
  ];
  it("é o verificado mais bem colocado", () => {
    expect(liderDoPremio(r)).toMatchObject({ pos: 3, entry: { user_id: "c" } });
  });
  it("ninguém verificado → null", () => {
    expect(liderDoPremio(r.slice(0, 2))).toBeNull();
  });
});
