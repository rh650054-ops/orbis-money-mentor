import { describe, expect, it } from "vitest";
import { atividadeDoBloco, painelDoDia } from "./regras";

const CONTA = "6261573e-d339-466d-b7de-665d2b6c76f4";
const OUTRA = "071d204d-6e19-4cbd-ad0a-6345da37858b";
const AGORA = 1_800_000_000_000;
const DIA = { faturamentoDia: 120, metaDia: 300, vendasDia: 6, abordagensDia: 20, rapidaValor: 20 };

describe("what the widgets show", () => {
  it("the day: left to reach the goal, progress capped at 100%, conversion = sales ÷ approaches", () => {
    const p = painelDoDia({ conta: CONTA, data: "2026-11-27", faturamento: 180.5, meta: 300, vendas: 6, abordagens: 20, agora: AGORA });
    expect(p).toMatchObject({ faturamento: 180.5, meta: 300, restante: 119.5, vendas: 6, abordagens: 20, conversao: 0.3 });
    expect(p.progresso).toBeCloseTo(0.6017, 3);
    expect(painelDoDia({ conta: CONTA, data: "2026-11-27", faturamento: 400, meta: 300, vendas: 1, abordagens: 0, agora: AGORA }))
      .toMatchObject({ restante: 0, progresso: 1, conversao: null });
    expect(painelDoDia({ conta: CONTA, data: "2026-11-27", faturamento: 50, meta: 0, vendas: 0, abordagens: 0, agora: AGORA }).progresso).toBe(0);
  });
  it("the block: numbered from 1, never without its start and end", () => {
    const inicio = new Date(AGORA), fim = new Date(AGORA + 3_600_000);
    expect(atividadeDoBloco({ conta: CONTA, inicio, fim, bloco: 2, totalBlocos: 8, faturamentoBloco: 42.3, metaHora: 37.5, vendasBloco: 4, pausado: false, ...DIA }))
      .toMatchObject({ bloco: 3, totalBlocos: 8, inicio: AGORA, fim: AGORA + 3_600_000, faturamentoBloco: 42.3, metaHora: 37.5, vendasBloco: 4, ...DIA });
    expect(atividadeDoBloco({ conta: CONTA, inicio, fim, bloco: 0, totalBlocos: 8, faturamentoBloco: 0, metaHora: 0, vendasBloco: 0, pausado: false, ...DIA, rapidaValor: 0 })!.rapidaValor).toBeNull();
    expect(atividadeDoBloco({ conta: CONTA, inicio: null, fim, bloco: 0, totalBlocos: 8, faturamentoBloco: 0, metaHora: 0, vendasBloco: 0, pausado: false, ...DIA })).toBeNull();
    expect(atividadeDoBloco({ conta: CONTA, inicio: fim, fim: inicio, bloco: 0, totalBlocos: 8, faturamentoBloco: 0, metaHora: 0, vendasBloco: 0, pausado: false, ...DIA })).toBeNull();
  });
  it("review 28/11: the Live Activity is told which DEFCON session it shows (late answers of another are dropped)", () => {
    const inicio = new Date(AGORA), fim = new Date(AGORA + 3_600_000);
    const base = { conta: CONTA, inicio, fim, bloco: 0, totalBlocos: 8, faturamentoBloco: 0, metaHora: 0, vendasBloco: 0, pausado: false, ...DIA };
    expect(atividadeDoBloco({ ...base, sessao: "8c88a596" })!.sessao).toBe("8c88a596");
    expect(atividadeDoBloco(base)!.sessao).toBeNull();
  });
});
