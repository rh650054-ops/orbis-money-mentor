import { describe, expect, it } from "vitest";
import { contasAbertas, diasParaVencer, proximoVencimento } from "./contas";

const luz = { name: "Luz", amount: 100, due_date: "2026-09-10", paid: false, recurring: true, paid_cycle: "2026-10" };

describe("contas: próximo vencimento igual ao Financeiro", () => {
  it("recorrente paga em outubro: em 01/11 vence dia 10/11, não 'hoje' (Rick, 01/11)", () => {
    expect(proximoVencimento(luz, "2026-11-01")).toBe("2026-11-10");
    expect(diasParaVencer(luz, "2026-11-01")).toBe(9);
  });
  it("recorrente já paga neste mês mira o mês que vem", () => {
    expect(proximoVencimento({ ...luz, paid_cycle: "2026-11" }, "2026-11-12")).toBe("2026-12-10");
  });
  it("recorrente não paga e dia já passou: atrasada", () => {
    expect(diasParaVencer({ ...luz, paid_cycle: "2026-09" }, "2026-11-12")).toBe(-2);
  });
  it("dia 31 em mês de 30", () => {
    expect(proximoVencimento({ ...luz, due_date: "2026-08-31", paid_cycle: "2026-10" }, "2026-11-01")).toBe("2026-11-30");
  });
  it("avulsa: a própria data; paga some; duração encerrada some", () => {
    expect(proximoVencimento({ name: "Multa", amount: 50, due_date: "2026-11-03", paid: false }, "2026-11-01")).toBe("2026-11-03");
    expect(proximoVencimento({ name: "Multa", amount: 50, due_date: "2026-11-03", paid: true }, "2026-11-01")).toBeNull();
    expect(proximoVencimento({ ...luz, duration_months: 2, cycles_paid: 2 }, "2026-11-01")).toBeNull();
  });
  it("contasAbertas: janela de 7 dias, até 3 atrasada, mais perto primeiro", () => {
    const c6 = { name: "C6", amount: 609, due_date: "2026-11-01", paid: false, recurring: true, paid_cycle: "2026-10" };
    const velha = { name: "Velha", amount: 10, due_date: "2026-10-20", paid: false, recurring: false };
    const r = contasAbertas([luz, c6, velha], "2026-11-01");
    expect(r.map((x) => [x.name, x.dias])).toEqual([["C6", 0]]);
    expect(contasAbertas([luz], "2026-11-05").map((x) => x.dias)).toEqual([5]);
  });
});
