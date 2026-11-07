import { beforeEach, describe, expect, it } from "vitest";
import { fimDoDiaPendente, limparFimDoDia, marcarFimDoDia } from "./fim-do-dia";

describe("fim do dia (06/11: plays once)", () => {
  beforeEach(() => localStorage.clear());
  it("plays after the DEFCON closes, never again after it opened", () => {
    marcarFimDoDia("u");
    expect(fimDoDiaPendente("u")).toBe(true);
    limparFimDoDia("u"); // the Home clears it as soon as the screen opens
    expect(fimDoDiaPendente("u")).toBe(false);
  });
  it("a second Foco closed the same day does not replay it", () => {
    marcarFimDoDia("u");
    limparFimDoDia("u");
    marcarFimDoDia("u");
    expect(fimDoDiaPendente("u")).toBe(false);
  });
});
