import { afterEach, describe, expect, it, vi } from "vitest";

const plataforma = vi.fn(() => "web");
vi.mock("./platform", () => ({ plataforma: () => plataforma() }));

import { modoCobranca, podeMostrarAssinatura } from "./cobranca-loja";

describe("cobrança no app da loja", () => {
  afterEach(() => plataforma.mockReset());
  it("site segue com a Hotmart", () => {
    plataforma.mockReturnValue("web");
    expect(modoCobranca("link")).toBe("web");
    expect(podeMostrarAssinatura()).toBe(true);
  });
  it("app da loja usa o modelo Néctar por padrão (botão abre a Hotmart)", () => {
    plataforma.mockReturnValue("ios");
    expect(modoCobranca(undefined)).toBe("link");
    expect(modoCobranca("qualquer")).toBe("link");
  });
  it("plano B: a chave 'fora' tira a venda do app da loja", () => {
    plataforma.mockReturnValue("android");
    expect(modoCobranca("fora")).toBe("fora");
  });
});
