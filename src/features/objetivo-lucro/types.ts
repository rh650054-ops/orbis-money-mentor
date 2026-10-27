/* Profit challenge ("Bater um lucro") — API shapes, validated at the boundary. */
import { z } from "zod";

const num = z.coerce.number().catch(0);

export const baseSchema = z.object({
  janela_dias: num,
  dias_vendidos: num,
  unidades: num,
  unid_dia: num,
  recorde_dia: num,
  ticket: num,
  custo_unid: num,
  custo_receita: num,
  custo_extrato: z.coerce.number().nullable().catch(null),
  gastos_corre: num,
  fonte_custo: z.enum(["extrato", "receita"]).catch("receita"),
  banco: z.boolean().catch(false),
  estoque: num,
  produto_nome: z.string().nullable().catch(null),
  frequencia: num,
});
export type BaseLucro = z.infer<typeof baseSchema>;

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
  analise: baseSchema.partial().catch({}),
});
export type Desafio = z.infer<typeof desafioSchema>;
