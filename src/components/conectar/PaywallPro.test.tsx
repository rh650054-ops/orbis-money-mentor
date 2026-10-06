import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PaywallPro } from "./PaywallPro";
import { SO_PRO, ECONOMIA_ANUAL } from "./pro-lib";

describe("PaywallPro", () => {
  it("opens on the annual offer and swaps to monthly from the link", () => {
    render(<PaywallPro />);
    const cta = screen.getByText("ASSINAR ANUAL · R$ 418,80").closest("a");
    expect(cta?.getAttribute("href")).toContain("off=ew11enu0");
    fireEvent.click(screen.getByText("prefiro o mensal, R$ 49,90"));
    const mensal = screen.getByText("ASSINAR MENSAL · R$ 49,90").closest("a");
    expect(mensal?.getAttribute("href")).toContain("off=5y86n311");
  });
  it("lists the 8 Pro benefits Rick asked for", () => {
    expect(SO_PRO.map((b) => b.nome)).toEqual([
      "Selo Verificado", "Pix contado na rua", "Arena Pro", "Caça-Sinal",
      "IA de Ganhos", "Financeiro Completo", "Estoque de Produtos", "Comprovante de renda",
    ]);
    expect(ECONOMIA_ANUAL).toBe(180);
  });
});
