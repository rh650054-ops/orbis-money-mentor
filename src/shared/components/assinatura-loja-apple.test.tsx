/* iPhone with native billing ("apple" mode, 27/11/2026): everything that used to send the person to
   the site now shows Apple's plans screen, and the Hotmart checkout is never opened. */
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const modo = vi.fn(() => "apple");
vi.mock("@/shared/lib/platform", () => ({ plataforma: () => (modo() === "web" ? "web" : "ios"), ehAppDaLoja: () => modo() !== "web", podeUsarCheckoutWeb: () => modo() === "web" }));
vi.mock("@/features/assinatura-apple", () => ({ PlanosApple: () => <div data-testid="planos-apple">planos nativos</div> }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
const abrirSite = vi.fn();
vi.mock("@/shared/lib/assinar-no-site", () => ({ abrirAssinarNoSite: () => abrirSite(), abrirRenovarNoSite: () => abrirSite() }));

import { AvisoAssinaturaLoja, soComAssinatura } from "./assinatura-loja";
import { abrirCheckout } from "@/shared/lib/checkout";
import { EVENTO_ASSINATURA_LOJA } from "@/shared/lib/cobranca-loja";

describe("store app in apple mode", () => {
  beforeEach(() => { modo.mockReturnValue("apple"); vi.stubEnv("VITE_COBRANCA_LOJA", "apple"); });
  afterEach(() => { vi.unstubAllEnvs(); abrirSite.mockReset(); });

  it("the store notice is Apple's native plans screen: no link to the site, no Hotmart price", async () => {
    render(<AvisoAssinaturaLoja />);
    expect(await screen.findByTestId("planos-apple")).toBeInTheDocument();
    expect(screen.queryByText(/VER PLANOS E ASSINAR|RENOVAR ASSINATURA/)).toBeNull();
  });

  it("a Hotmart sales component wrapped for the store never renders; the native screen takes its place", async () => {
    const Venda = soComAssinatura(() => <a href="https://pay.hotmart.com/x">ASSINAR MENSAL · R$ 49,90</a>);
    render(<Venda />);
    expect(await screen.findByTestId("planos-apple")).toBeInTheDocument();
    expect(screen.queryByText(/hotmart|R\$ 49,90/i)).toBeNull();
  });

  it("abrirCheckout never opens the site or Hotmart: it asks for the native screen", () => {
    const pedido = vi.fn();
    window.addEventListener(EVENTO_ASSINATURA_LOJA, pedido);
    const abrir = vi.spyOn(window, "open").mockImplementation(() => null);
    abrirCheckout("https://pay.hotmart.com/qualquer");
    expect(pedido).toHaveBeenCalledTimes(1);
    expect(abrir).not.toHaveBeenCalled();
    expect(abrirSite).not.toHaveBeenCalled();
    window.removeEventListener(EVENTO_ASSINATURA_LOJA, pedido);
    abrir.mockRestore();
  });

  it("with the default build (link) nothing changes: the site button is still what shows", () => {
    vi.stubEnv("VITE_COBRANCA_LOJA", "link");
    render(<AvisoAssinaturaLoja />);
    expect(screen.getByText("VER PLANOS E ASSINAR")).toBeInTheDocument();
    expect(screen.queryByTestId("planos-apple")).toBeNull();
  });
});
