/* Profit challenge ("Bater um lucro") — API shapes, validated at the boundary. */
import { z } from "zod";

const num = z.coerce.number().catch(0);

export const baseSchema = z.object({
  janela_dias: num,
  dias_vendidos: num,
  unidades: num,
  unid_dia: num,
  recorde_dia: num,
  recorde_data: z.string().nullable().catch(null),
  ticket: num,
  custo_unid: num,
  custo_receita: num,
  custo_extrato: z.coerce.number().nullable().catch(null),
  gastos_corre: num,
  entradas_corre: num,
  gastos_pessoais: num,
  categorias: z.array(z.object({ categoria: z.string(), valor: num, n: num })).catch([]),
  fonte_custo: z.enum(["extrato", "receita"]).catch("receita"),
  banco: z.boolean().catch(false),
  estoque: num,
  produto_nome: z.string().nullable().catch(null),
  frequencia: num,
  semana: z.array(z.object({ dow: num, unid_dia: num, dias: num })).catch([]),
  quinzenas: z.object({ ultimos15: num, anteriores15: num }).catch({ ultimos15: 0, anteriores15: 0 }),
  calote: z.object({ valor: num, unidades: num, dias: num, recuperado: num, perdido: num, pct: num })
    .catch({ valor: 0, unidades: 0, dias: 0, recuperado: 0, perdido: 0, pct: 0 }),
  transporte: num,
  alimentacao: num,
});
export type BaseLucro = z.infer<typeof baseSchema>;

/** What the AI answers (objetivo-lucro-ia). */
export const iaSchema = z.object({
  veredito: z.enum(["tranquilo", "puxado", "acima"]).catch("puxado"),
  titulo: z.string().catch(""),
  resumo: z.string().catch(""),
  unid_dia: z.coerce.number().nullable().catch(null),
  dias_trabalho: z.coerce.number().nullable().catch(null),
  melhores_dias: z.array(z.string()).catch([]),
  passos: z.array(z.object({ titulo: z.string(), texto: z.string() })).catch([]),
  alerta: z.string().nullable().catch(null),
  fonte: z.string().catch("ia"),
});
export type PlanoIa = z.infer<typeof iaSchema>;

export const desafioSchema = z.object({
  id: z.string(),
  alvo: num,
  inicio: z.string(),
  fim: z.string(),
  status: z.enum(["ativo", "concluido", "encerrado"]).catch("ativo"),
  dias_periodo: num,
  dia_atual: num,
  dias_trabalho: num,
  dias_trabalhados: num,
  custo_unid: num,
  lucro_unid: num,
  lucro: num,
  vendas: num,
  unidades: num,
  hoje: z.object({ precisa: num, unid_meta: z.coerce.number().nullable().catch(null), unid: num, lucro: num }),
  dias: z.array(z.object({ dia: z.string(), unid: num, lucro: num })).catch([]),
  analise: baseSchema.partial().extend({ ia: iaSchema.optional() }).catch({}),
});
export type Desafio = z.infer<typeof desafioSchema>;
