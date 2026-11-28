import { AcaoSchema, ConfigQuickSchema, type Acao, type Atividade, type ConfigQuick, type Painel } from "../types";

/** A tap older than this is not executed (the person is no longer waiting for it). */
export const VALIDADE_MS = 10 * 60_000;

export type Veredito =
  | { ok: true; acao: Acao; config: ConfigQuick | null }
  | { ok: false; motivo: "invalida" | "outra_conta" | "expirada" | "sem_defcon" | "sem_valor" | "ja_feita"; texto: string };

/** Everything a tap must pass before it reaches the DEFCON's own sale/approach code. The tap is data
    written by our own App Intent, but it is still checked: the account it was made for, how old it
    is, whether a DEFCON block is running, and the amount, which is ALWAYS the app's configuration. */
export function validarAcao(bruta: unknown, ctx: {
  conta: string | null; agora: number; rodando: boolean; config: unknown; jaFeita: (id: string) => boolean;
}): Veredito {
  const a = AcaoSchema.safeParse(bruta);
  if (!a.success) return { ok: false, motivo: "invalida", texto: "Toque do widget não reconhecido." };
  const acao = a.data;
  if (ctx.jaFeita(acao.id)) return { ok: false, motivo: "ja_feita", texto: "Este toque já foi registrado." };
  if (!ctx.conta || acao.conta !== ctx.conta) return { ok: false, motivo: "outra_conta", texto: "O toque foi feito com outra conta. Nada foi registrado." };
  if (acao.criadoEm > ctx.agora + 60_000 || ctx.agora - acao.criadoEm > VALIDADE_MS) {
    return { ok: false, motivo: "expirada", texto: "Toque antigo do widget. Nada foi registrado." };
  }
  if (!ctx.rodando) return { ok: false, motivo: "sem_defcon", texto: "Comece ou retome o bloco do DEFCON para registrar pelo widget." };
  if (acao.tipo === "abordagem") return { ok: true, acao, config: null };
  const config = ConfigQuickSchema.safeParse(ctx.config);
  if (!config.success) return { ok: false, motivo: "sem_valor", texto: "Defina o valor da venda rápida em Conta > VANT Quick." };
  return { ok: true, acao, config: config.data };
}

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
}): Atividade | null {
  if (!d.inicio || !d.fim || d.fim.getTime() <= d.inicio.getTime()) return null;
  return {
    conta: d.conta, inicio: d.inicio.getTime(), fim: d.fim.getTime(), bloco: d.bloco + 1, totalBlocos: Math.max(d.bloco + 1, d.totalBlocos),
    faturamentoBloco: reais(Math.max(0, d.faturamentoBloco)), metaHora: reais(Math.max(0, d.metaHora)),
    vendasBloco: Math.max(0, d.vendasBloco), pausado: d.pausado,
  };
}
