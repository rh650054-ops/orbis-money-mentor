import { describe, expect, it } from "vitest";
import { atividadeDoBloco, painelDoDia, validarAcao, VALIDADE_MS } from "./regras";

const CONTA = "6261573e-d339-466d-b7de-665d2b6c76f4";
const OUTRA = "071d204d-6e19-4cbd-ad0a-6345da37858b";
const AGORA = 1_800_000_000_000;
const acao = (x: Record<string, unknown> = {}) => ({ id: "0b7d7a2e-6a5f-4b8e-9d0c-0d6d7e1a2b3c", tipo: "venda", criadoEm: AGORA - 2_000, conta: CONTA, ...x });
const ctx = (x: Record<string, unknown> = {}) => ({ conta: CONTA, agora: AGORA, rodando: true, config: { valor: 10, metodo: "dinheiro" }, jaFeita: () => false, ...x });

describe("a widget tap is checked before it reaches the DEFCON", () => {
  it("a sale tap of the signed-in account, during a running block: ok, with the amount of the APP's configuration", () => {
    const v = validarAcao(acao({ valor: 999 }), ctx());
    expect(v).toMatchObject({ ok: true, config: { valor: 10, metodo: "dinheiro" } });
  });
  it("an approach tap needs no amount", () => {
    expect(validarAcao(acao({ tipo: "abordagem" }), ctx({ config: null }))).toMatchObject({ ok: true, config: null });
  });
  it.each([
    ["not our shape", { id: "x" }, {}, "invalida"],
    ["unknown kind", acao({ tipo: "estorno" }), {}, "invalida"],
    ["another account's tap", acao({ conta: OUTRA }), {}, "outra_conta"],
    ["a tap with no account", acao({ conta: null }), {}, "outra_conta"],
    ["nobody signed in", acao(), { conta: null }, "outra_conta"],
    ["older than 10 minutes", acao({ criadoEm: AGORA - VALIDADE_MS - 1 }), {}, "expirada"],
    ["from the future", acao({ criadoEm: AGORA + 120_000 }), {}, "expirada"],
    ["no block running (idle, pause, finished)", acao(), { rodando: false }, "sem_defcon"],
    ["no quick sale configured", acao(), { config: null }, "sem_valor"],
    ["a configured amount that is not valid", acao(), { config: { valor: 0, metodo: "dinheiro" } }, "sem_valor"],
    ["the same tap delivered again", acao(), { jaFeita: () => true }, "ja_feita"],
  ])("%s: refused (%s)", (_n, bruta, extra, motivo) => {
    expect(validarAcao(bruta, ctx(extra))).toMatchObject({ ok: false, motivo });
  });
});

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
    expect(atividadeDoBloco({ conta: CONTA, inicio, fim, bloco: 2, totalBlocos: 8, faturamentoBloco: 42.3, metaHora: 37.5, vendasBloco: 4, pausado: false }))
      .toMatchObject({ bloco: 3, totalBlocos: 8, inicio: AGORA, fim: AGORA + 3_600_000, faturamentoBloco: 42.3, metaHora: 37.5, vendasBloco: 4 });
    expect(atividadeDoBloco({ conta: CONTA, inicio: null, fim, bloco: 0, totalBlocos: 8, faturamentoBloco: 0, metaHora: 0, vendasBloco: 0, pausado: false })).toBeNull();
    expect(atividadeDoBloco({ conta: CONTA, inicio: fim, fim: inicio, bloco: 0, totalBlocos: 8, faturamentoBloco: 0, metaHora: 0, vendasBloco: 0, pausado: false })).toBeNull();
  });
});
