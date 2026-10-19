import type { Relatorio } from "../types";

export interface GastosBanco { mercadoria: number; transporte: number; alimentacao: number }

/** Quem tem Open Finance: mercadoria, transporte e alimentação vêm do banco (+ o que foi
 *  anotado à mão), no lugar do custo-por-venda (Rick, 19/10). "Outros" continua o manual.
 *  Troca no período atual e no anterior, pra comparação ficar na mesma régua. */
export function comGastosBanco(rel: Relatorio, atual: GastosBanco | null | undefined, anterior: GastosBanco | null | undefined): Relatorio {
  const troca = (b: Relatorio["atual"], g: GastosBanco | null | undefined): Relatorio["atual"] => {
    if (!g) return b;
    const gastos = g.mercadoria + g.transporte + g.alimentacao + b.dinheiro.outros;
    return { ...b, dinheiro: { ...b.dinheiro, ...g, gastos, sobrou: b.dinheiro.caiu - gastos } };
  };
  return { ...rel, atual: troca(rel.atual, atual), anterior: troca(rel.anterior, anterior) };
}
