// @vitest-environment node
/* Rick, 14/10: alerta laranja do INMET o dia todo + sol agora não pode virar
   "procura abrigo"; a decisão sai dos modelos e a IA só escreve em cima dela. */
import { beforeAll, describe, expect, it } from "vitest";

type Mod = typeof import("./index");
let m: Mod;
beforeAll(async () => {
  (globalThis as unknown as { Deno: unknown }).Deno = { env: { get: () => "x" }, serve: () => {} };
  m = await import("./index");
});

const ag = { hora: 11, minuto: "40", diaSemana: "quarta-feira", data: "2026-10-14", periodo: "manhã" };
const h = (hora: number, chance: number, codigo: number, rajada = 20, mm = 0.3) =>
  ({ hora, iso: `2026-10-14T${String(hora).padStart(2, "0")}:00`, fontes: 0, total: 6, mm, temp: 22, prob: chance, codigo, chance, rajada });
// células reais de São Paulo às 11h44 de 14/10
const horas = [h(11, 10, 1, 11.5), h(12, 9, 0, 15.5), h(13, 13, 51, 25), h(14, 32, 2, 28), h(15, 46, 51, 33), h(16, 94, 53, 29, 0.95), h(17, 54, 51, 32), h(18, 76, 51, 13)];
const alerta = (nivel: "amarelo" | "laranja" | "vermelho") =>
  ({ tipo: "Tempestade", severidade: "Perigo", nivel, inicio: "2026-01-01 00:00", fim: "2099-12-31 23:59", riscos: "", instrucoes: [] });
const tempo = (o: Record<string, unknown> = {}) => ({ estado: "sol", horas, oficiais: [alerta("laranja")], ...o }) as never;

describe("clima-vendedor · fatos do dia", () => {
  it("alerta laranja o dia todo e sol agora: vender até a chuva chegar, perto de abrigo", () => {
    const f = m.fatosDoDia(tempo(), ag);
    expect(f.decisao).toBe("vender_ate");
    expect(f.chuvaChega).toBe(16);
    expect(f.texto).toMatch(/VENDER ATÉ 16h/);
    expect(f.texto).toMatch(/alerta laranja de tempestade do INMET/);
  });
  it("alerta vermelho: parar", () => {
    expect(m.fatosDoDia(tempo({ oficiais: [alerta("vermelho")] }), ag).decisao).toBe("parar");
  });
  it("alerta laranja com tempestade nas próximas 2 h: parar", () => {
    const perto = [h(11, 80, 95, 60, 6), ...horas.slice(1)];
    expect(m.fatosDoDia(tempo({ horas: perto }), ag).decisao).toBe("parar");
  });
  it("fala que manda procurar abrigo some quando a decisão é vender", () => {
    expect(m.falaCoerente("Procura abrigo agora, tempestade.", "vender_ate")).toBe(false);
    expect(m.falaCoerente("Vende até 16h perto de abrigo e recolhe antes da chuva.", "vender_ate")).toBe(true);
    expect(m.falaCoerente("Procura abrigo agora.", "parar")).toBe(true);
  });
});
