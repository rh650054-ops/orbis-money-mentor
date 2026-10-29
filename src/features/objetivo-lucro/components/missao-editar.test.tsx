/* 29/10 (Rick): período digitável; faixa da missão no Foco abre editar/apagar. */
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { PassoMeta } from "./passo-meta";
import { FaixaMissao } from "@/components/defcon/foco/foco-hero-partes";

describe("missão: editar", () => {
  it("o número de dias aceita digitar (limite 90)", () => {
    const onDias = vi.fn();
    render(<PassoMeta alvo={3000} dias={15} onAlvo={vi.fn()} onDias={onDias} onAnalisar={vi.fn()} />);
    const campo = screen.getByLabelText("Quantos dias");
    fireEvent.change(campo, { target: { value: "22" } });
    expect(onDias).toHaveBeenCalledWith(22);
    fireEvent.change(campo, { target: { value: "200" } });
    expect(onDias).toHaveBeenCalledWith(90);
  });

  it("a faixa da missão no Foco é tocável", () => {
    const onAbrir = vi.fn();
    render(<FaixaMissao onAbrir={onAbrir} m={{ alvo: 3000, fim: "2026-11-10", precisaLucro: 200, unidMeta: 32, faturar: 600, produto: "Batida", trabalha: true, dia: 2, diasPeriodo: 15, ritmo: null, atraso: null }} />);
    fireEvent.click(screen.getByRole("button", { name: /editar ou apagar/ }));
    expect(onAbrir).toHaveBeenCalled();
  });
});
