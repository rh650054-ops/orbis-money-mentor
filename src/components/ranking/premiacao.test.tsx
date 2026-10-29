import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { lerAba, premioDaAba, rotuloSemana } from "./premiacao";
import { RankingAbas } from "./RankingAbas";

describe("ranking semanal + premiação de novembro", () => {
  it("a aba vem da URL", () => {
    expect(lerAba("semana")).toBe("semanal");
    expect(lerAba(null)).toBe("mensal");
  });
  it("semanas de novembro numeradas (domingo a sábado)", () => {
    expect(rotuloSemana("2026-11-01", "2026-11-07")).toBe("Semana 1 · 01/11 a 07/11");
    expect(rotuloSemana("2026-11-29", "2026-12-05")).toBe("Semana 5 · 29/11 a 05/12");
    expect(rotuloSemana("2026-10-25", "2026-10-31")).toBe("25/10 a 31/10");
  });
  it("prêmio: R$ 500 no mês, R$ 50 na semana; antes de 1/11 avisa que começa; depois de 30/11 some", () => {
    expect(premioDaAba("mensal", "2026-11-10")).toEqual({ valor: 500, texto: "pro 1º lugar de novembro", antes: false });
    expect(premioDaAba("semanal", "2026-10-29")?.antes).toBe(true);
    expect(premioDaAba("semanal", "2026-12-01")).toBeNull();
  });
  it("as abas trocam e o semanal mostra o período", () => {
    const onAba = vi.fn();
    const { rerender } = render(<RankingAbas aba="mensal" onAba={onAba} hoje="2026-11-03" periodoSemana="Semana 1 · 01/11 a 07/11" />);
    expect(screen.getByText(/R\$ 500/)).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: "Semanal" }));
    expect(onAba).toHaveBeenCalledWith("semanal");
    rerender(<RankingAbas aba="semanal" onAba={onAba} hoje="2026-11-03" periodoSemana="Semana 1 · 01/11 a 07/11" />);
    expect(screen.getByText(/R\$ 50\b/)).toBeTruthy();
    expect(screen.getByText(/Semana 1 · 01\/11 a 07\/11/)).toBeTruthy();
  });
});
