import { z } from "zod";

/** Shape returned by the `relatorio_periodo` RPC (see migration 20261018150000). */

const num = z.coerce.number().catch(0);
const numOrNull = z.coerce.number().nullable().catch(null);

const diaMinSchema = z.object({ dia: z.string(), min: num }).nullable().catch(null);

export const blocoSchema = z.object({
  de: z.string(),
  ate: z.string(),
  dias_na_rua: num,
  dias_com_registro: num,
  dinheiro: z.object({
    caiu: num, faltou: num, vendeu: num,
    dinheiro: num, pix: num, cartao: num, gorjetas_dia: num,
    mercadoria: num, transporte: num, alimentacao: num, outros: num,
    gastos: num, sobrou: num,
  }),
  vendas: z.object({
    abordagens: num, vendas: num, valor: num,
    /** 27/10: only days where approaches were really tapped (sales < 90% of approaches).
     *  Missing (older server) → falls back to the totals. */
    abordagens_conv: numOrNull, vendas_conv: numOrNull,
    conversao: numOrNull, abordagens_por_venda: numOrNull, ticket: numOrNull,
    metodos: z.record(z.object({ n: num, valor: num })).catch({}),
    gorjeta: z.object({ n: num, total: num, maior: num }),
  }),
  tempo: z.object({
    worked_min: num, pausa_min: num, parado_min: num, ativo_min: num,
    pausas: z.record(z.object({ n: num, min: num })).catch({}),
    maior_dia: diaMinSchema, menor_dia: diaMinSchema,
    melhor_ritmo: diaMinSchema,
  }),
  calote: z.object({
    valor: num, unidades: num, recuperado: num, recuperado_n: num, perdido: num,
    pct_vendeu: num, taxa_recuperacao: numOrNull,
  }),
  dias: z.array(z.object({
    dia: z.string(), abordagens: num, vendas: num, conv_ok: z.boolean().catch(true), caiu: num, faltou: num,
    worked_min: num, pausa_min: num, parado_min: num,
  })).catch([]),
  horas: z.array(z.object({ h: num, vendas: num, valor: num, abordagens: num, vendas_conv: numOrNull, abordagens_conv: numOrNull })).catch([]),
});

export const relatorioSchema = z.object({
  atual: blocoSchema,
  anterior: blocoSchema,
  normal: blocoSchema,
});

export type Bloco = z.infer<typeof blocoSchema>;
export type Relatorio = z.infer<typeof relatorioSchema>;
export type DiaRel = Bloco["dias"][number];
export type HoraRel = Bloco["horas"][number];

/** Period presets shown as chips at the top of the screen. */
export type Preset = "hoje" | "ontem" | "semana" | "mes" | "7d" | "30d" | "custom";

export interface Periodo {
  preset: Preset;
  de: string;  // YYYY-MM-DD (Brazil calendar)
  ate: string; // YYYY-MM-DD
}

/** One row of the bank check (banco_conferencia), already parsed by the legacy hook. */
export interface DiaBanco {
  dia: string; lancou: number; pix_cartao: number; dinheiro: number; caiu: number; maquininha: number; conta_ranking: number; faltou: number;
}
