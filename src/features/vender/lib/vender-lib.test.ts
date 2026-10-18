import { describe, expect, it } from "vitest";
import { vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
import type { DiaConc } from "../types";
import { diaDoHeroi, estadoDoDia, falta, progresso, resumoSemana } from "./conciliacao";
import { statusDoBanco } from "./bancos";
import { dicasDoDia } from "./dicas";

const dia = (p: Partial<DiaConc>): DiaConc => ({ dia: "2026-10-17", fez: 300, dinheiro: 0, caiu: 300, depois: 0, pessoal: 0, qtd: 3, conferido: true, ...p });

describe("conciliação", () => {
  it("cash in hand is not expected in the bank (old hero bug)", () => {
    const d = dia({ fez: 300, dinheiro: 50, caiu: 250 });
    expect(falta(d)).toBe(0);
    expect(estadoDoDia(d)).toBe("ok");
    expect(progresso(d)).toBe(100);
  });

  it("names the five states", () => {
    expect(estadoDoDia(dia({ caiu: 300, depois: 40 }))).toBe("depois");
    expect(estadoDoDia(dia({ caiu: 200 }))).toBe("parcial");
    expect(estadoDoDia(dia({ caiu: 0 }))).toBe("nada");
    expect(estadoDoDia(dia({ caiu: 100, conferido: false }))).toBe("aguardando");
    expect(estadoDoDia(dia({ fez: 0 }))).toBe("sem_venda");
    expect(estadoDoDia(dia({ caiu: 299.5 }))).toBe("ok"); // R$ 1 tolerance
  });

  it("hero = today, or yesterday's Foco when today has no sales", () => {
    const dias = [dia({ dia: "2026-10-18", fez: 0, caiu: 20 }), dia({ dia: "2026-10-17" })];
    expect(diaDoHeroi(dias, "2026-10-18").dia).toBe("2026-10-17");
    expect(diaDoHeroi([], "2026-10-18")).toMatchObject({ dia: "2026-10-18", fez: 0 });
  });

  it("7-day summary counts cash as received", () => {
    expect(resumoSemana([dia({ fez: 300, dinheiro: 50, caiu: 200 }), dia({ fez: 0, caiu: 90 })]))
      .toEqual({ fez: 300, caiu: 250, diferenca: 50, dias: 1 });
  });
});

describe("bancos", () => {
  const agora = Date.parse("2026-10-18T15:00:00Z");
  it("every bank gets ATIVO, ATENÇÃO or DESCONECTADO", () => {
    expect(statusDoBanco("UPDATED", "2026-10-18T14:00:00Z", agora).rotulo).toBe("ATIVO");
    expect(statusDoBanco("WAITING_USER_INPUT", null, agora)).toMatchObject({ rotulo: "DESCONECTADO", autorizar: true });
    expect(statusDoBanco("OUTDATED", "2026-10-18T14:00:00Z", agora).rotulo).toBe("ATENÇÃO");
    expect(statusDoBanco("UPDATED", null, agora).rotulo).toBe("ATENÇÃO");
    expect(statusDoBanco("UPDATED", "2026-10-16T10:00:00Z", agora).rotulo).toBe("ATENÇÃO");
  });

  it("hints only when money is missing", () => {
    const b = [{ id: "1", item_id: "i", institution_name: "C6", institution_logo: null, status: "OUTDATED", last_synced_at: "2026-10-18T14:00:00Z" }];
    expect(dicasDoDia(dia({}), b)).toEqual([]);
    const h = dicasDoDia(dia({ caiu: 200, pessoal: 100 }), b);
    expect(h).toHaveLength(2);
    expect(h[0]).toMatch(/pessoal/);
  });
});
