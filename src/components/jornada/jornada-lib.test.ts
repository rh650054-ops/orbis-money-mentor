import { describe, it, expect } from "vitest";
import { diaDoTeste, diasEntre, jornadaDoDia, seloTeste, JORNADA } from "./jornada-lib";

describe("jornada do teste", () => {
  it("counts calendar days without timezone drift", () => {
    expect(diasEntre("2026-10-06", "2026-10-06")).toBe(0);
    expect(diasEntre("2026-10-30", "2026-11-02")).toBe(3);
  });
  it("maps signup day to 0 and the last trial day to 3; outside is null", () => {
    expect(diaDoTeste("2026-10-06", "2026-10-06")).toBe(0);
    expect(diaDoTeste("2026-10-06", "2026-10-09")).toBe(3);
    expect(diaDoTeste("2026-10-06", "2026-10-10")).toBeNull();
    expect(diaDoTeste("2026-10-07", "2026-10-06")).toBeNull();
    expect(diaDoTeste(null, "2026-10-06")).toBeNull();
  });
  it("has one mission per day with Essencial on day 1, Pro on day 2 and plans on day 3", () => {
    expect(JORNADA.map((j) => j.oferta)).toEqual(["nenhuma", "essencial", "pro", "planos"]);
    expect(jornadaDoDia(2)?.passos.map((p) => p.id)).toEqual(["foco", "custo"]);
  });
  it("writes the trial badge in plain Portuguese", () => {
    expect(seloTeste(0)).toBe("Teste grátis · faltam 3 dias");
    expect(seloTeste(2)).toBe("Teste grátis · falta 1 dia");
    expect(seloTeste(3)).toBe("Último dia do teste");
  });
});
