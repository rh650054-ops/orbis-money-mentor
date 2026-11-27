/* iPhone with native billing ("apple" mode, 27/11/2026): everything that used to send the person to
   the site now shows Apple's plans screen, and the Hotmart checkout is never opened. */
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const modo = vi.fn(() => "apple");
vi.mock("@/shared/lib/platform", () => ({ plataforma: () => (modo() === "web" ? "web" : "ios"), ehAppDaLoja: () => modo() !== "web", podeUsarCheckoutWeb: () => modo() === "web" }));
vi.mock("@/features/assinatura-apple", () => ({ PlanosApple: () => <div data-testid="planos-apple">planos nativos</div> }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
const abrirSite = vi.fn();
vi.mock("@/shared/lib/assinar-no-site", () => ({ abrirAssinarNoSite: () => abrirSite(), abrirRenovarNoSite: () => abrirSite() }));

import { AvisoAssinaturaLoja, OuvinteAssinaturaLoja, TelaAssinarPelaApple, soComAssinatura } from "./assinatura-loja";
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

  it("full-screen paywall (V3): a fixed column that never scrolls itself, with the body that scrolls inside it, and the exits (verify access, sign out)", async () => {
    const verificar = vi.fn(); const sair = vi.fn();
    render(<TelaAssinarPelaApple telaCheia onVerificar={verificar} onSair={sair} />);
    const tela = screen.getByRole("dialog", { name: "Planos da VANT" });
    expect(tela).toContainElement(await screen.findByTestId("planos-apple"));
    expect(tela.className).toContain("fixed inset-0");
    expect(tela.className).toContain("flex-col");
    // the frame itself is not the scroller (builds 17 and 18 did not scroll on the iPhone)
    expect(tela.className).not.toContain("overflow-y-auto");
    // no dialog library and no hand-made page lock under it
    expect(document.body.hasAttribute("data-scroll-locked")).toBe(false);
    expect(document.body.style.overflow).toBe("");
    fireEvent.click(screen.getByRole("button", { name: "Já paguei, verificar acesso" }));
    fireEvent.click(screen.getByRole("button", { name: "Sair da conta" }));
    expect(verificar).toHaveBeenCalledTimes(1);
    expect(sair).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: "Fechar" })).toBeNull();
  });

  it("an 'assinar' tap anywhere opens the full-screen paywall, and the X closes it", async () => {
    render(<OuvinteAssinaturaLoja />);
    act(() => { window.dispatchEvent(new Event(EVENTO_ASSINATURA_LOJA)); });
    expect(await screen.findByTestId("planos-apple")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Fechar" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

});
