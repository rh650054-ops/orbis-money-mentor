import { describe, it, expect, beforeEach } from "vitest";
import { lerSimulacao, simular, gravarPassoSimulado, passosSimulados, zerarSimulacao } from "./simulador";

describe("simulador do teste", () => {
  beforeEach(() => localStorage.clear());

  it("só vale pra conta que ligou", () => {
    simular("admin", 2);
    expect(lerSimulacao("admin")).toBe(2);
    expect(lerSimulacao("outro")).toBeNull();
    simular("admin", null);
    expect(lerSimulacao("admin")).toBeNull();
  });

  it("guarda passos à parte e zera junto com as ofertas vistas", () => {
    localStorage.setItem("vant_oferta_admin_1", "1");
    gravarPassoSimulado("admin", "foco");
    gravarPassoSimulado("admin", "foco");
    expect(passosSimulados("admin")).toEqual(["foco"]);
    zerarSimulacao("admin");
    expect(passosSimulados("admin")).toEqual([]);
    expect(localStorage.getItem("vant_oferta_admin_1")).toBeNull();
  });
});
