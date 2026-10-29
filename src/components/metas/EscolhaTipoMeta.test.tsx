/* 29/10 (Rick): "Editar planejamento" tem que perguntar lucro ou faturamento, igual ao Bater um lucro. */
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { EscolhaTipoMeta } from "./EscolhaTipoMeta";

describe("Qual é a sua meta?", () => {
  it("lucro no bolso abre a missão; faturamento abre o formulário de sempre", () => {
    const onLucro = vi.fn(); const onFat = vi.fn();
    render(<EscolhaTipoMeta onLucro={onLucro} onFaturamento={onFat} />);
    fireEvent.click(screen.getByRole("button", { name: /Lucro no bolso/ }));
    expect(onLucro).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /Faturamento do mês/ }));
    expect(onFat).toHaveBeenCalled();
  });

  it("Essencial: lucro no bolso vem com cadeado e leva pro Pro", () => {
    const onLucro = vi.fn(); const onPro = vi.fn();
    render(<EscolhaTipoMeta onLucro={onLucro} onFaturamento={vi.fn()} proTravado onPro={onPro} />);
    fireEvent.click(screen.getByRole("button", { name: /Lucro no bolso/ }));
    expect(onPro).toHaveBeenCalled();
    expect(onLucro).not.toHaveBeenCalled();
    expect(screen.getByText(/Ver o VANT Pro/)).toBeTruthy();
  });
});
