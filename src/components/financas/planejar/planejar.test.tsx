import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ContasDoMes } from "./ContasDoMes";
import { VencidasCard } from "./VencidasCard";
import type { ContaVM } from "./tipos";

const conta = (o: Partial<ContaVM>): ContaVM => ({
  id: "c", nome: "Conta", valor: 100, guardado: 0, falta: 100, venceEm: 5, vencida: false, pagaCiclo: false,
  coberta: false, risco: "medio", cartao: false, faturaAberta: false, porDia: 20, diasUteis: 5, plano: null, ...o,
});

const acoes = { onAbrir: () => {}, onResolver: () => {}, onReabrir: () => {}, onAdicionar: () => {} };

describe("Planejar", () => {
  it("contas do mês: vencidas + 4 próximas, o resto atrás de 'Ver todas'", () => {
    const contas = [
      conta({ id: "v", nome: "Nubank Crédito", vencida: true, venceEm: -21 }),
      ...Array.from({ length: 6 }, (_, i) => conta({ id: `p${i}`, nome: `Conta ${i}`, venceEm: i + 1 })),
    ];
    render(<ContasDoMes contas={contas} onPaguei={async () => true} {...acoes} />);
    expect(screen.getByText("Venceu há 21 dias")).toBeTruthy();
    expect(screen.getByText("Conta 3")).toBeTruthy();
    expect(screen.queryByText("Conta 4")).toBeNull();
    expect(screen.getByText(/Ver todas as 7 contas/)).toBeTruthy();
  });

  it("Paguei mostra 'Pago' quando dá certo", async () => {
    const onPaguei = vi.fn(async () => true);
    render(<ContasDoMes contas={[conta({ id: "a", nome: "Aluguel", venceEm: 3 })]} onPaguei={onPaguei} {...acoes} />);
    fireEvent.click(screen.getByRole("button", { name: "Paguei" }));
    await waitFor(() => expect(screen.getAllByText("Pago").length).toBeGreaterThan(0));
    expect(onPaguei).toHaveBeenCalledWith("a");
  });

  it("vencidas: plano de quitação simula por dia útil e usa o prazo escolhido", async () => {
    const onPlano = vi.fn(async () => true);
    const simular = (falta: number, dias: number) => ({ porDia: falta / dias, quita: "08/10" });
    render(<VencidasCard contas={[conta({ id: "v", nome: "Cartão Mais", vencida: true, venceEm: -6, falta: 300 })]}
      onPlano={onPlano} onPaga={async () => true} simular={simular} />);
    fireEvent.click(screen.getByRole("button", { name: "Montar plano" }));
    fireEvent.click(screen.getByRole("button", { name: "10 dias" }));
    expect(screen.getByText("R$ 30,00")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Usar este plano" }));
    await waitFor(() => expect(onPlano).toHaveBeenCalledWith(["v"], 10));
  });
});
