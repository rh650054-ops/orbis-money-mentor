import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: null }) }));
import { AcoesRapidas } from "./acoes-rapidas";
import { CustoRapido } from "./custo-rapido";
import { MercadoriaDoDia } from "./mercadoria-do-dia";
import { projecaoDoMes } from "./mes-card";

describe("Foco — redesign", () => {
  it("ações rápidas: um botão só, o Tô no mercado (sem comprar/estoque/ajustar ontem)", () => {
    const onMercado = vi.fn();
    render(<AcoesRapidas onMercado={onMercado} />);
    expect(screen.queryByRole("button", { name: /Ajustar/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Comprar/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Tô no mercado/ }));
    expect(onMercado).toHaveBeenCalledTimes(1);
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

  it("custo rápido: com Mercadoria; 'Outro' pede com o que gastou antes de lançar", () => {
    const onLancar = vi.fn();
    const zero = { mercadoria: 0, transporte: 0, alimentacao: 0, outro: 0 };
    const props = { estado: "rodando" as const, valor: "15", hoje: zero, ontem: zero, onCategoria: vi.fn(), onValor: vi.fn(), onDescricao: vi.fn(), onLancar, onRepetir: vi.fn(), onChanged: vi.fn() };
    const { rerender } = render(<CustoRapido {...props} categoria="outro" descricao="" />);
    expect(screen.getByRole("tab", { name: /Mercadoria/ })).toBeTruthy(); // back on 21/10 (Mohamed)
    expect(screen.getByRole("tab", { name: /Outro/ })).toBeTruthy();
    expect((screen.getByRole("button", { name: /Lançar/ }) as HTMLButtonElement).disabled).toBe(true);
    rerender(<CustoRapido {...props} categoria="outro" descricao="gelo" />);
    fireEvent.click(screen.getByRole("button", { name: /Lançar/ }));
    expect(onLancar).toHaveBeenCalledTimes(1);
  });
});
