import { afterEach, describe, expect, it, vi } from "vitest";

const plataforma = vi.fn(() => "web");
vi.mock("./platform", () => ({ plataforma: () => plataforma() }));

import { assinaPeloSite, modoCobranca, podeMostrarAssinatura } from "./cobranca-loja";
import * as loja from "./cobranca-loja";

describe("cobrança no app da loja", () => {
  afterEach(() => plataforma.mockReset());
  it("site segue com a Hotmart e os 3 planos na tela", () => {
    plataforma.mockReturnValue("web");
    expect(modoCobranca("link")).toBe("web");
    expect(podeMostrarAssinatura()).toBe(true);
    expect(assinaPeloSite()).toBe(false);
  });
  it("app da loja: modelo Néctar por padrão (Rick, 23/10/2026), sem preço dentro do app", () => {
    plataforma.mockReturnValue("ios");
    expect(modoCobranca(undefined)).toBe("link");
    expect(modoCobranca("qualquer")).toBe("link");
    expect(podeMostrarAssinatura()).toBe(false);
    expect(assinaPeloSite()).toBe(true);
  });
  it("reserva: sem botão nenhum com VITE_COBRANCA_LOJA=fora", () => {
    plataforma.mockReturnValue("android");
    expect(modoCobranca("fora")).toBe("fora");
  });
  it("fallback do Assinar é /assinar (paga a conta que já existe), não a landing de teste grátis", async () => {
    const { LINK_ASSINAR_SITE } = await import("./cobranca-loja");
    expect(LINK_ASSINAR_SITE).toBe("https://app.vantapp.com.br/assinar");
  });
  it("assinatura nativa da Apple (27/11/2026): só no iPhone e só quando o build pede; o padrão continua o link", () => {
    plataforma.mockReturnValue("ios");
    expect(modoCobranca("apple")).toBe("apple");
    expect(modoCobranca(undefined)).toBe("link");
    plataforma.mockReturnValue("android");
    expect(modoCobranca("apple")).toBe("link");
    plataforma.mockReturnValue("web");
    expect(modoCobranca("apple")).toBe("web");
  });
  it("no modo apple nada manda para o site nem mostra a venda da Hotmart", () => {
    plataforma.mockReturnValue("ios");
    vi.stubEnv("VITE_COBRANCA_LOJA", "apple");
    expect(loja.assinaPelaApple()).toBe(true);
    expect(assinaPeloSite()).toBe(false);
    expect(podeMostrarAssinatura()).toBe(false);
    vi.unstubAllEnvs();
    expect(loja.assinaPelaApple()).toBe(false);
  });
});
