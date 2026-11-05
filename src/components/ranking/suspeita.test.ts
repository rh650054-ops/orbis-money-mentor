import { describe, expect, it } from "vitest";
import { rotuloSuspeita } from "./suspeita";

describe("admin suspicion chip says why (Rick, 04/11)", () => {
  it("sales spike", () => expect(rotuloSuspeita("pico de 2.1x acima da média dele")).toBe("pico 2,1x"));
  it("new account", () => expect(rotuloSuspeita("conta nova · R$900 em 1 dia(s)")).toBe("conta nova"));
  it("anything else", () => expect(rotuloSuspeita("outro")).toBe("revisar"));
});
