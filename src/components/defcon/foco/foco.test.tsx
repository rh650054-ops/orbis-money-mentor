import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { FaixasEscolha } from "./faixas-escolha";
import { AcoesRapidas } from "./acoes-rapidas";
import { MercadoriaDoDia } from "./mercadoria-do-dia";
import { lerFaixa, metaDaFaixa } from "@/shared/lib/faixa-do-dia";

const faixas = { minimo: 400, meta: 600, turbo: 850 };

describe("Foco — redesign", () => {
  it("faixas: a escolhida vem marcada e tocar em outra devolve a chave certa", () => {
    const onEscolher = vi.fn();
    render(<FaixasEscolha m={faixas} escolhida="normal" salvando={false} oculto={false} onEscolher={onEscolher} />);
    const meta = screen.getByRole("radio", { name: /Meta/ });
    expect(meta.getAttribute("aria-checked")).toBe("true");
    fireEvent.click(screen.getByRole("radio", { name: /Turbo/ }));
    expect(onEscolher).toHaveBeenCalledWith("turbo");
    fireEvent.click(meta); // já escolhida: não dispara de novo
    expect(onEscolher).toHaveBeenCalledTimes(1);
  });

  it("faixa escolhida vira a meta do dia (mood → valor)", () => {
    expect(lerFaixa("normal")).toBe("normal");
    expect(lerFaixa("turbo")).toBe("turbo");
    expect(lerFaixa("qualquer coisa")).toBe("normal");
    expect(metaDaFaixa(faixas, "minimo")).toBe(400);
    expect(metaDaFaixa(faixas, "turbo")).toBe(850);
  });

  it("ações rápidas: cada atalho chama o seu caminho", () => {
    const fns = { onLancarCusto: vi.fn(), onComprar: vi.fn(), onEstoque: vi.fn(), onAjustarOntem: vi.fn() };
    render(<AcoesRapidas {...fns} />);
    fireEvent.click(screen.getByRole("button", { name: /Comprar/ }));
    fireEvent.click(screen.getByRole("button", { name: /Ajustar/ }));
    expect(fns.onComprar).toHaveBeenCalledTimes(1);
    expect(fns.onAjustarOntem).toHaveBeenCalledTimes(1);
    expect(fns.onLancarCusto).not.toHaveBeenCalled();
  });

  it("mercadoria: vazio útil com botão; com carga mostra status e o 'Repor' do que acabou", () => {
    const onVerEstoque = vi.fn();
    const onRepor = vi.fn();
    const { rerender } = render(<MercadoriaDoDia estado="antes" carga={[]} editando={false} onEditar={() => {}} onVerEstoque={onVerEstoque} onRepor={onRepor} />);
    fireEvent.click(screen.getByText(/Quer que a Vant controle seu estoque/));
    expect(onVerEstoque).toHaveBeenCalled();

    rerender(<MercadoriaDoDia estado="encerrado" editando={false} onEditar={() => {}} onVerEstoque={onVerEstoque} onRepor={onRepor}
      carga={[{ nome: "Maracujá", levou: 250, vendeu: 100, preco: 25, custo: 5.34 }, { nome: "Morango", levou: 40, vendeu: 40, preco: 25, custo: 5.1 }]} />);
    expect(screen.getByText("acabou")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Repor morango/ }));
    expect(onRepor).toHaveBeenCalledWith("Morango");
  });
});
