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
  it("app da loja não vende por padrão", () => {
    plataforma.mockReturnValue("ios");
    expect(modoCobranca(undefined)).toBe("fora");
    expect(modoCobranca("qualquer")).toBe("fora");
  });
  it("modelo Néctar só com a chave ligada", () => {
    plataforma.mockReturnValue("android");
    expect(modoCobranca("link")).toBe("link");
  });
});
