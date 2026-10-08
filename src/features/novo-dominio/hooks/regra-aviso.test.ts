import { describe, expect, it } from "vitest";
import { deveMostrarAviso, aparelhoDe, linkNovoDominio, passeDoHash, ADIAR_MS } from "./regra-aviso";

describe("aviso do novo domínio", () => {
  const agora = Date.parse("2026-11-01T12:00:00Z");

  it("shows on the old address once Rick turns it on", () => {
    expect(deveMostrarAviso({ host: "app.orbis.inf.br", ligado: true, adiadoEm: null, agora })).toBe(true);
  });

  it("never shows while it is off, nor on the new address", () => {
    expect(deveMostrarAviso({ host: "app.orbis.inf.br", ligado: false, adiadoEm: null, agora })).toBe(false);
    expect(deveMostrarAviso({ host: "app.vantapp.com.br", ligado: true, adiadoEm: null, agora })).toBe(false);
  });

  it("'Lembrar amanhã' hides it for a day", () => {
    expect(deveMostrarAviso({ host: "app.orbis.inf.br", ligado: true, adiadoEm: agora - 3600_000, agora })).toBe(false);
    expect(deveMostrarAviso({ host: "app.orbis.inf.br", ligado: true, adiadoEm: agora - ADIAR_MS - 1, agora })).toBe(true);
  });

  it("install steps follow the phone; the button goes to the new address", () => {
    expect(aparelhoDe("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)")).toBe("ios");
    expect(aparelhoDe("Mozilla/5.0 (Linux; Android 14; SM-A146M)")).toBe("android");
    expect(linkNovoDominio()).toBe("https://app.vantapp.com.br/install?de=orbis");
    expect(linkNovoDominio("a".repeat(43))).toBe(`https://app.vantapp.com.br/entrar#passe=${"a".repeat(43)}`);
  });

  it("reads only a well-formed passe from the fragment", () => {
    const c = "Ab9_-".repeat(9);
    expect(passeDoHash(`#passe=${c}`)).toBe(c);
    expect(passeDoHash("#passe=curto")).toBeNull();
    expect(passeDoHash("#passe=<script>")).toBeNull();
    expect(passeDoHash("")).toBeNull();
  });
});
