/* Profit challenge ("Bater um lucro") — API shapes, validated at the boundary. */
import { z } from "zod";

const num = z.coerce.number().catch(0);

export const baseSchema = z.object({
  apelido: z.string().nullable().catch(null),
  janela_dias: num,
  dias_vendidos: num,
  unidades: num,
  vendas: num,
  unid_dia: num,
  recorde_dia: num,
  recorde_data: z.string().nullable().catch(null),
  ticket: num,
  custo_unid: num,
  custo_receita: num,
  calote_unid: num,
  custo_extrato: z.coerce.number().nullable().catch(null),
  gastos_corre: num,
  entradas_corre: num,
  gastos_pessoais: num,
  categorias: z.array(z.object({ categoria: z.string(), valor: num, n: num })).catch([]),
  fonte_custo: z.enum(["extrato", "receita", "sem_custo"]).catch("receita"),
  banco: z.boolean().catch(false),
  estoque: num,
  produto_nome: z.string().nullable().catch(null),
  frequencia: num,
  semana: z.array(z.object({ dow: num, unid_dia: num, dias: num })).catch([]),
  quinzenas: z.object({ ultimos15: num, anteriores15: num }).catch({ ultimos15: 0, anteriores15: 0 }),
  calote: z.object({
    valor: num, unidades: num, dias: num, recuperado: num, perdido: num, pct: num,
    estimado_banco: z.coerce.number().nullable().catch(null), app_pix: num, usado: num,
    fonte: z.enum(["banco", "app"]).catch("app"), por_dia: num, pct_pix: num,
    /** 28/10: bank coverage (from the day the bank was connected) + both estimates */
    desde: z.string().nullable().catch(null), dias_banco: num, app_pix_banco: num, banco_recebido: num, teto: num,
    banco_unid: z.coerce.number().nullable().catch(null), banco_por_dia: z.coerce.number().nullable().catch(null),
    app_unid: num, app_por_dia: num,
    tabela: z.array(z.object({ dia: z.string(), app: num, banco: num, dif: num })).catch([]),
  }).catch({ valor: 0, unidades: 0, dias: 0, recuperado: 0, perdido: 0, pct: 0, estimado_banco: null, app_pix: 0, usado: 0, fonte: "app", por_dia: 0, pct_pix: 0,
    desde: null, dias_banco: 0, app_pix_banco: 0, banco_recebido: 0, teto: 0, banco_unid: null, banco_por_dia: null, app_unid: 0, app_por_dia: 0, tabela: [] }),
  transporte: num,
  alimentacao: num,
  /** combo mix: % of sales with 1 / 2 / 3+ units, and units per sale */
  combos: z.object({ um: num, dois: num, tres: num, preco_um: num, preco_dois: num, unid_por_venda: num, ticket_venda: num })
    .catch({ um: 100, dois: 0, tres: 0, preco_um: 0, preco_dois: 0, unid_por_venda: 1, ticket_venda: 0 }),
  vendas_dia: num,
  preco_tabela: num,
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
  hoje: z.object({
    precisa: num, unid_meta: z.coerce.number().nullable().catch(null), unid: num, lucro: num,
    /** 28/10: from the stored plan — is today a work day, and is he ahead/behind it */
    trabalha: z.boolean().catch(true),
    ritmo: z.enum(["adiantado", "no_plano", "atrasado"]).nullable().catch(null),
    atraso: z.coerce.number().nullable().catch(null),
  }),
  dias: z.array(z.object({ dia: z.string(), unid: num, lucro: num })).catch([]),
  /** 28/10: the day-by-day plan he accepted (empty for missions created before) */
  plano: z.array(z.object({ d: z.string(), t: z.boolean().catch(false), u: num })).catch([]),
  calote_fonte: z.enum(["banco", "app"]).nullable().catch(null),
  analise: baseSchema.partial().extend({ ia: iaSchema.optional() }).catch({}),
});
export type Desafio = z.infer<typeof desafioSchema>;
export type FonteCalote = "banco" | "app";
