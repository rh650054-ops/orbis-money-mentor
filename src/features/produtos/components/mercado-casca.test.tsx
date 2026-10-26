import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { MercadoCasca } from "./mercado-casca";

describe("MercadoCasca", () => {
  it("o rodapé para de flutuar enquanto digita num campo da lista", () => {
    vi.useFakeTimers();
    Element.prototype.scrollIntoView = vi.fn();
    render(<MercadoCasca titulo="Tô no mercado" onVoltar={() => {}} rodape={<button type="button">CONCLUIR</button>}><input aria-label="qtd" /></MercadoCasca>);
    const rodape = () => screen.getByText("CONCLUIR").parentElement as HTMLElement;
    expect(rodape().className).toContain("sticky");
    fireEvent.focus(screen.getByLabelText("qtd"));
    expect(rodape().className).not.toContain("sticky");
    act(() => { vi.runAllTimers(); });
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
    fireEvent.blur(screen.getByLabelText("qtd"));
    act(() => { vi.runAllTimers(); });
    expect(rodape().className).toContain("sticky");
    vi.useRealTimers();
  });
});
