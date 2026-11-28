import { z } from "zod";

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
  /** the day, as the app shows it (the iPhone replaces it with the server's after a widget tap) */
  faturamentoDia: number;
  metaDia: number;
  vendasDia: number;
  abordagensDia: number;
  /** the VANT Quick sale value, null when not set */
  rapidaValor: number | null;
}

