/* What hotmart-conciliar WOULD do with one subscription (26/11/2026) — same rule (decidir), as a
   label for the simulation's counts. Pure, tested. */
import { decidir, mesmoTitular, type NaHotmart, type NossaAssinatura } from "../hotmart-conciliar/regras.ts";
export type { NossaAssinatura } from "../hotmart-conciliar/regras.ts";

export function classificar(nossa: NossaAssinatura, real: NaHotmart, agora = new Date()): string {
  const st = (real.status ?? "").toUpperCase();
  if (decidir(nossa, real, false, agora).liberarAte) return "liberaria_pago_confirmado";
  if (st === "ACTIVE" && !mesmoTitular(nossa.email, real.email)) return "pago_mas_titular_nao_confere";
  if (st === "ACTIVE") return "ativa_sem_proxima_cobranca_futura";
  if (st === "DELAYED" || st === "OVERDUE" || st === "PAST_DUE") return "continua_atrasada";
  if (st === "STARTED") return "primeiro_pagamento_ainda_aberto";
  if (st.startsWith("CANCEL") || st === "INACTIVE") return "encerrada_pode_assinar_de_novo";
  return `outro:${st || "vazio"}`;
}
