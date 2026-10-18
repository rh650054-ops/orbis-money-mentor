import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { AcoesRapidas } from "./acoes-rapidas";
import { MercadoriaDoDia } from "./mercadoria-do-dia";
import { projecaoDoMes } from "./mes-card";

describe("Foco — redesign", () => {
  it("ações rápidas: cada atalho chama o seu caminho (e custo não repete aqui)", () => {
    const fns = { onComprar: vi.fn(), onEstoque: vi.fn(), onAjustarOntem: vi.fn() };
    render(<AcoesRapidas {...fns} />);
    expect(screen.queryByRole("button", { name: /custo/i })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Comprar/ }));
    fireEvent.click(screen.getByRole("button", { name: /Ajustar/ }));
    expect(fns.onComprar).toHaveBeenCalledTimes(1);
    expect(fns.onAjustarOntem).toHaveBeenCalledTimes(1);
    expect(fns.onEstoque).not.toHaveBeenCalled();
  });

  it("mercadoria: vazio útil com botão; com carga mostra status e o 'Repor' do que acabou", () => {
    const onVerEstoque = vi.fn();
    const onRepor = vi.fn();
    const { rerender } = render(<MercadoriaDoDia estado="antes" carga={[]} editando={false} onVerEstoque={onVerEstoque} onRepor={onRepor} />);
    fireEvent.click(screen.getByText(/Quer que a Vant controle seu estoque/));
    expect(onVerEstoque).toHaveBeenCalled();

    rerender(<MercadoriaDoDia estado="encerrado" editando={false} onVerEstoque={onVerEstoque} onRepor={onRepor}
      carga={[{ nome: "Maracujá", levou: 250, vendeu: 100, preco: 25, custo: 5.34 }, { nome: "Morango", levou: 40, vendeu: 40, preco: 25, custo: 5.1 }]} />);
    expect(screen.getByText("acabou")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Repor morango/ }));
    expect(onRepor).toHaveBeenCalledWith("Morango");
  });

  it("seu mês: projeção no ritmo real diz se bate a meta e por quanto", () => {
    const bate = projecaoDoMes({ vendidoMes: 14467, metaMensal: 30000, ritmo: 1400, diasRestantes: 12 });
    expect(bate.fecha).toBe(14467 + 1400 * 12);
    expect(bate.bate).toBe(true);
    const falta = projecaoDoMes({ vendidoMes: 14467, metaMensal: 30000, ritmo: 980, diasRestantes: 12 });
    expect(falta.bate).toBe(false);
    expect(Math.round(-falta.diferenca)).toBe(30000 - (14467 + 980 * 12));
  });
});
