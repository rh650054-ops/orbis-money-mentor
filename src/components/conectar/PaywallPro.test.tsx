import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "3f2b8c1e-9a7d-4e21-b6c3-0d5e4f6a7b8c", email: "rick@vant.com" } }),
}));
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
  it("opens the checkout in a new tab with the buyer prefilled (never replaces the app)", () => {
    const open = vi.spyOn(window, "open").mockReturnValue({ opener: {} } as Window);
    render(<PaywallPro />);
    const cta = screen.getByText("ASSINAR ANUAL · R$ 418,80").closest("a");
    expect(cta?.getAttribute("target")).toBe("_blank");
    const href = cta?.getAttribute("href") ?? "";
    expect(href).toContain("email=rick%40vant.com");
    expect(href).toContain("xcod=3f2b8c1e-9a7d-4e21-b6c3-0d5e4f6a7b8c");
    fireEvent.click(cta!);
    expect(open).toHaveBeenCalledWith(href, "_blank");
    open.mockRestore();
  });
  it("lists the 8 Pro benefits Rick asked for", () => {
    expect(SO_PRO.map((b) => b.nome)).toEqual([
      "Selo Verificado", "Pix contado na rua", "Arena Pro", "Caça-Sinal",
      "IA de Ganhos", "Financeiro Completo", "Estoque de Produtos", "Comprovante de renda",
    ]);
    expect(ECONOMIA_ANUAL).toBe(180);
  });
});

describe("PaywallPro for someone who does not subscribe yet (22/10/2026)", () => {
  it("also offers the VANT Essencial at R$ 29,90 and links to its checkout", () => {
    render(<PaywallPro comEssencial />);
    fireEvent.click(screen.getByText("VANT Essencial"));
    const cta = screen.getByText("ASSINAR O ESSENCIAL · R$ 29,90").closest("a");
    expect(cta?.getAttribute("href")).toContain("pay.hotmart.com");
    expect(cta?.getAttribute("href")).not.toContain("off=ew11enu0");
    expect(cta?.getAttribute("href")).not.toContain("off=5y86n311");
  });
  it("hides the Essencial for someone who already subscribes (upgrade only)", () => {
    render(<PaywallPro />);
    expect(screen.queryByText("VANT Essencial")).toBeNull();
  });
});
