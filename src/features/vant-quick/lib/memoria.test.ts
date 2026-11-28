import { beforeEach, describe, expect, it } from "vitest";
import { esquecerConta, jaFeita, lerConfig, marcarFeita, salvarConfig } from "./memoria";

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
  it("a tap delivered twice is executed once; two different taps (two real sales in a row) both run", () => {
    marcarFeita(A, "id-1");
    expect(jaFeita(A, "id-1")).toBe(true);
    expect(jaFeita(A, "id-2")).toBe(false);
    expect(jaFeita(B, "id-1")).toBe(false);
  });
  it("forgotten after 24 h, and when the account leaves", () => {
    const agora = Date.now();
    marcarFeita(A, "velho", agora - 25 * 3_600_000);
    expect(jaFeita(A, "velho", agora)).toBe(false);
    salvarConfig(A, { valor: 10, metodo: "dinheiro" }); marcarFeita(A, "id-1");
    esquecerConta(A);
    expect(lerConfig(A)).toBeNull();
    expect(jaFeita(A, "id-1")).toBe(false);
  });
});
