import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: vi.fn(), functions: { invoke: vi.fn() } } }));
import { precisaDesviar, definirUsuarioDoCaminho, carregarCaminho, EVENTO_CAMINHO, type Caminho } from "./caminho-assinatura";
import { supabase } from "@/integrations/supabase/client";
import { abrirCheckout, PRO_CHECKOUT, BANCO_EXTRA_CHECKOUT } from "./checkout";
import { HOTMART_CHECKOUT_URL as HOTMART_CHECKOUT_URL_PARA_TESTE } from "./constants";

const ESSENCIAL = HOTMART_CHECKOUT_URL_PARA_TESTE;
const c = (acao: Caminho["acao"], oferta = "8qbxvm9p", plano = "VANT Essencial"): Caminho => ({ acao, oferta, plano, assinatura: "S1" });

describe("renewal path (26/11): no new checkout Hotmart would refuse", () => {
  it("1 active subscriber: the same plan is not sold again; an upgrade to Pro is", () => {
    expect(precisaDesviar(c("em_dia"), ESSENCIAL)).toBe(true);
    expect(precisaDesviar(c("em_dia"), PRO_CHECKOUT.mensal)).toBe(false);
  });
  it("2 overdue: the same plan goes to the existing charge (any plan that is not a Pro upgrade)", () => {
    expect(precisaDesviar(c("regularizar"), ESSENCIAL)).toBe(true);
    expect(precisaDesviar(c("regularizar", "5y86n311", "VANT Pro Mensal"), PRO_CHECKOUT.mensal)).toBe(true);
    expect(precisaDesviar(c("regularizar", "5y86n311", "VANT Pro Mensal"), PRO_CHECKOUT.anual)).toBe(true);
    expect(precisaDesviar(c("regularizar"), PRO_CHECKOUT.anual)).toBe(false);
  });
  it("3 cancelled / 5 new client: a normal checkout (nova)", () => {
    expect(precisaDesviar(c("nova"), ESSENCIAL)).toBe(false);
    expect(precisaDesviar(null, ESSENCIAL)).toBe(false);
  });
  it("4 paid but blocked and first payment open: checked, never a second subscription", () => {
    expect(precisaDesviar(c("conciliar"), ESSENCIAL)).toBe(true);
    expect(precisaDesviar(c("pendente"), ESSENCIAL)).toBe(true);
  });
  it("the extra-bank add-on is never blocked by the plan", () => {
    expect(precisaDesviar(c("regularizar"), BANCO_EXTRA_CHECKOUT!)).toBe(false);
  });
});

describe("abrirCheckout asks the path at the tap", () => {
  afterEach(() => { definirUsuarioDoCaminho(null); vi.restoreAllMocks(); });
  it("logged in and overdue: the path sheet opens, no Hotmart checkout", async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: c("regularizar"), error: null } as never);
    definirUsuarioDoCaminho("u1");
    await carregarCaminho();
    const abrir = vi.spyOn(window, "open").mockReturnValue(null);
    const ouvinte = vi.fn();
    window.addEventListener(EVENTO_CAMINHO, ouvinte);
    abrirCheckout(ESSENCIAL);
    expect(ouvinte).toHaveBeenCalledTimes(1);
    expect(abrir).not.toHaveBeenCalled();
    window.removeEventListener(EVENTO_CAMINHO, ouvinte);
  });
  it("logged in, new subscription valid: the checkout opens as before", async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: c("nova"), error: null } as never);
    definirUsuarioDoCaminho("u1");
    await carregarCaminho();
    const abrir = vi.spyOn(window, "open").mockReturnValue({ opener: null } as unknown as Window);
    abrirCheckout(ESSENCIAL);
    expect(abrir).toHaveBeenCalledWith(ESSENCIAL, "_blank");
  });
  it("old database (function missing): the checkout opens as before", async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: { code: "PGRST202" } } as never);
    definirUsuarioDoCaminho("u1");
    await carregarCaminho();
    const abrir = vi.spyOn(window, "open").mockReturnValue({ opener: null } as unknown as Window);
    abrirCheckout(ESSENCIAL);
    expect(abrir).toHaveBeenCalled();
  });
  it("not logged in (landing): the checkout opens as before", () => {
    const abrir = vi.spyOn(window, "open").mockReturnValue({ opener: null } as unknown as Window);
    abrirCheckout(ESSENCIAL);
    expect(abrir).toHaveBeenCalled();
  });
});
