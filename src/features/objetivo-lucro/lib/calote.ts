/* Calote source chosen by the seller (28/10/2026): the server returns both estimates (bank
   coverage vs what he registered in the app); switching here recomputes the cost per unit
   locally, the same way the server does when the mission is created with that source. */
import type { BaseLucro, FonteCalote } from "../types";

/** The same base with the other calote estimate applied (the seller's choice, 28/10). Cost per
 *  unit = recipe (or statement) cost + calote per unit of the chosen source. */
export function baseComCalote(b: BaseLucro, fonte: FonteCalote): BaseLucro {
  const c = b.calote;
  if (fonte === c.fonte) return b;
  if (fonte === "banco" && (c.estimado_banco === null || c.banco_unid === null)) return b;
  const caloteUnid = fonte === "banco" ? (c.banco_unid ?? 0) : c.app_unid;
  const semCalote = b.custo_unid - b.calote_unid;
  return {
    ...b,
    calote_unid: caloteUnid,
    custo_unid: Math.round((semCalote + caloteUnid) * 100) / 100,
    calote: {
      ...c, fonte,
      usado: fonte === "banco" ? (c.estimado_banco ?? 0) : c.perdido,
      por_dia: fonte === "banco" ? (c.banco_por_dia ?? 0) : c.app_por_dia,
      pct_pix: fonte === "banco"
        ? (c.app_pix_banco > 0 ? Math.round(((c.estimado_banco ?? 0) / c.app_pix_banco) * 1000) / 10 : 0)
        : (c.app_pix > 0 ? Math.round((c.perdido / c.app_pix) * 1000) / 10 : 0),
    },
  };
}
