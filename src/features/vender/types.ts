import { z } from "zod";

const num = z.coerce.number().catch(0);

export const diaSchema = z.object({
  dia: z.string(),
  fez: num,
  dinheiro: num,
  caiu: z.coerce.number().nullable().catch(null),
  depois: num.default(0),
  pessoal: num.default(0),
  qtd: num.default(0),
  conferido: z.coerce.boolean().catch(false),
});
export type DiaConc = z.infer<typeof diaSchema>;

export const conciliacaoSchema = z.object({
  hoje: z.string(),
  tem_banco: z.coerce.boolean().catch(false),
  ultima_leitura: z.string().nullable().catch(null),
  dias: z.array(diaSchema).catch([]),
});
export type Conciliacao = z.infer<typeof conciliacaoSchema>;

/** How a day stands against the bank. */
export type Estado = "ok" | "depois" | "parcial" | "nada" | "aguardando" | "sem_venda";
