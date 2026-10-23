import { afterEach, describe, expect, it, vi } from "vitest";

const plataforma = vi.fn(() => "web");
vi.mock("./platform", () => ({ plataforma: () => plataforma() }));

import { assinaPeloSite, modoCobranca, podeMostrarAssinatura } from "./cobranca-loja";

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
});
