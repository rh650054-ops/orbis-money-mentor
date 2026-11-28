import { z } from "zod";

/** One tap on the home-screen widget, written by the App Intent into the App Group (iOS).
    It carries NO amount: the amount is always the one configured in the app. */
export const AcaoSchema = z.object({
  id: z.string().uuid(),
  tipo: z.enum(["venda", "abordagem"]),
  /** ms since epoch, when the tap happened */
  criadoEm: z.number().int().positive(),
  /** the VANT account stamped by the app in the App Group when the tap happened (null = none signed in) */
  conta: z.string().uuid().nullable(),
});
export type Acao = z.infer<typeof AcaoSchema>;

/** The quick sale configured by the user, kept per account on this device. */
export const ConfigQuickSchema = z.object({
  valor: z.number().positive().max(5000),
  metodo: z.enum(["dinheiro", "pix", "cartao"]),
});
export type ConfigQuick = z.infer<typeof ConfigQuickSchema>;

/** Numbers shown by the performance widget. Display only: no token, nothing sensitive. */
export interface Painel {
  conta: string;
  /** Brazil date of these numbers (YYYY-MM-DD): another day means "no DEFCON today" on the widget */
  data: string;
  faturamento: number;
  meta: number;
  restante: number;
  /** 0..1 */
  progresso: number;
  vendas: number;
  abordagens: number;
  /** sales ÷ approaches, 0..1, null when there is no approach yet */
  conversao: number | null;
  /** ms since epoch */
  atualizadoEm: number;
}

/** The current DEFCON block, for the Live Activity (lock screen and Dynamic Island). */
export interface Atividade {
  conta: string;
  inicio: number;
  fim: number;
  bloco: number;
  totalBlocos: number;
  faturamentoBloco: number;
  metaHora: number;
  vendasBloco: number;
  pausado: boolean;
}

/** What the widget shows about the last tap. */
export type EstadoAcao = "pendente_sync" | "confirmada" | "recusada";
