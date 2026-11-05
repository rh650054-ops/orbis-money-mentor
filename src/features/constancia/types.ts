/* Chama da constância (Rick, 05/11/2026) — shapes of constancia_minha(), validated at the boundary. */
import { z } from "zod";

const num = z.coerce.number().catch(0);
export const estadoSchema = z.enum(["acesa", "congelada", "perdeu", "resgate", "nunca"]).catch("nunca");
export type EstadoChama = z.infer<typeof estadoSchema>;

export const diaCalendarioSchema = z.object({
  d: z.string(),
  s: z.enum(["trabalhou", "faltou", "folga", "hoje", "futuro"]).catch("futuro"),
});
export type DiaCalendario = z.infer<typeof diaCalendarioSchema>;

export const constanciaSchema = z.object({
  dias: num,
  recorde: num,
  recorde_fim: z.string().nullable().catch(null),
  estado: estadoSchema,
  faltas: num,
  guardados: num,
  resgate: num,
  ultimo_trabalho: z.string().nullable().catch(null),
  hoje_trabalhou: z.boolean().catch(false),
  hoje_trabalha: z.boolean().catch(true),
  /** the state right before today's session counted — the end-of-day animation goes from it to `dias` */
  antes: z.object({ dias: num, estado: estadoSchema, resgate: num, guardados: num }).catch({ dias: 0, estado: "nunca", resgate: 0, guardados: 0 }),
  mes: z.array(diaCalendarioSchema).catch([]),
});
export type Constancia = z.infer<typeof constanciaSchema>;
