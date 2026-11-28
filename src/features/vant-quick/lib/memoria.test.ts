import { beforeEach, describe, expect, it } from "vitest";
import { credencialExpiraEm, esquecerConta, idDoAparelho, lerConfig, marcarCredencial, salvarConfig } from "./memoria";

const A = "6261573e-d339-466d-b7de-665d2b6c76f4", B = "071d204d-6e19-4cbd-ad0a-6345da37858b";
beforeEach(() => localStorage.clear());

describe("VANT Quick memory on the device, per account", () => {
  it("the quick sale is kept per account, rounded to cents, and an invalid one is not saved", () => {
    salvarConfig(A, { valor: 12.345, metodo: "pix" });
    expect(lerConfig(A)).toEqual({ valor: 12.35, metodo: "pix" });
    expect(lerConfig(B)).toBeNull();
    expect(() => salvarConfig(A, { valor: 0, metodo: "pix" })).toThrow();
    expect(() => salvarConfig(A, { valor: 9_999, metodo: "pix" })).toThrow();
    localStorage.setItem(`vant_quick_config:${A}`, "{lixo");
    expect(lerConfig(A)).toBeNull();
  });
  it("only the credential's EXPIRY is kept here (the token lives in the Keychain), per account", () => {
    marcarCredencial(A, 123);
    expect(credencialExpiraEm(A)).toBe(123);
    expect(credencialExpiraEm(B)).toBeNull();
    expect(JSON.stringify(localStorage)).not.toMatch(/vq1_/);
  });
  it("leaving the account forgets its config and credential mark", () => {
    salvarConfig(A, { valor: 10, metodo: "dinheiro" }); marcarCredencial(A, 123);
    esquecerConta(A);
    expect(lerConfig(A)).toBeNull();
    expect(credencialExpiraEm(A)).toBeNull();
  });
  it("one stable id per installation", () => {
    const id = idDoAparelho();
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    expect(idDoAparelho()).toBe(id);
  });
});
