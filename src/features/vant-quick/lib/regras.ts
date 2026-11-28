import type { Atividade, Painel } from "../types";

const limitar = (x: number) => Math.min(1, Math.max(0, x));
const reais = (x: number) => Math.round(x * 100) / 100;

/** The day as the performance widget shows it. */
export function painelDoDia(d: { conta: string; data: string; faturamento: number; meta: number; vendas: number; abordagens: number; agora: number }): Painel {
  const faturamento = reais(Math.max(0, d.faturamento));
  const meta = reais(Math.max(0, d.meta));
  return {
    conta: d.conta, data: d.data, faturamento, meta,
    restante: reais(Math.max(0, meta - faturamento)),
    progresso: meta > 0 ? limitar(faturamento / meta) : 0,
    vendas: Math.max(0, d.vendas), abordagens: Math.max(0, d.abordagens),
    conversao: d.abordagens > 0 ? limitar(d.vendas / d.abordagens) : null,
    atualizadoEm: d.agora,
  };
}

/** The current block as the Live Activity shows it; null when there is no block to show. */
export function atividadeDoBloco(d: {
  conta: string; inicio: Date | null; fim: Date | null; bloco: number; totalBlocos: number;
  faturamentoBloco: number; metaHora: number; vendasBloco: number; pausado: boolean;
  faturamentoDia: number; metaDia: number; vendasDia: number; abordagensDia: number; rapidaValor: number | null;
  sessao?: string | null;
}): Atividade | null {
  if (!d.inicio || !d.fim || d.fim.getTime() <= d.inicio.getTime()) return null;
  return {
    conta: d.conta, inicio: d.inicio.getTime(), fim: d.fim.getTime(), bloco: d.bloco + 1, totalBlocos: Math.max(d.bloco + 1, d.totalBlocos),
    faturamentoBloco: reais(Math.max(0, d.faturamentoBloco)), metaHora: reais(Math.max(0, d.metaHora)),
    vendasBloco: Math.max(0, d.vendasBloco), pausado: d.pausado,
    faturamentoDia: reais(Math.max(0, d.faturamentoDia)), metaDia: reais(Math.max(0, d.metaDia)),
    vendasDia: Math.max(0, d.vendasDia), abordagensDia: Math.max(0, d.abordagensDia),
    rapidaValor: d.rapidaValor !== null && d.rapidaValor > 0 ? reais(d.rapidaValor) : null,
    sessao: d.sessao ?? null,
  };
}
