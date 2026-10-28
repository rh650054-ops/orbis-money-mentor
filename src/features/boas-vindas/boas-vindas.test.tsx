import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { BoasVindas } from "./components/boas-vindas";
import { deveMostrarBoasVindas, jaViuBoasVindas, marcarBoasVindasVista } from "./lib/visto";

describe("boas-vindas do app da loja", () => {
  beforeEach(() => localStorage.clear());

  it("aparece só no app nativo e só uma vez por instalação", () => {
    expect(deveMostrarBoasVindas(false)).toBe(false); // web/PWA keeps its own flow
    expect(deveMostrarBoasVindas(true)).toBe(true);
    marcarBoasVindasVista();
    expect(jaViuBoasVindas()).toBe(true);
    expect(deveMostrarBoasVindas(true)).toBe(false);
  });

  it("passa pelas telas e termina em Começar; Pular encerra a qualquer momento", () => {
    const onFim = vi.fn();
    const { unmount } = render(<BoasVindas onFim={onFim} />);
    fireEvent.click(screen.getByRole("button", { name: /Conhecer a VANT/ }));
    for (let i = 0; i < 3; i++) fireEvent.click(screen.getByRole("button", { name: /Próximo/ }));
    expect(screen.queryByRole("button", { name: /Pular/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Começar/ }));
    expect(onFim).toHaveBeenCalledTimes(1);
    unmount();

    const pular = vi.fn();
    render(<BoasVindas onFim={pular} />);
    fireEvent.click(screen.getByRole("button", { name: /Pular/ }));
    expect(pular).toHaveBeenCalledTimes(1);
  });
});
