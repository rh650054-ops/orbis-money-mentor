/* Faixa do dia (Mínimo · Meta · Turbo) — a parte PURA, sem Supabase, pra tela e testes.
   A escolha mora na coluna `mood` do daily_goal_plans: 'minimo' | 'normal' (= Meta) | 'turbo'. */
import type { MetaDoDia } from "@/shared/lib/meta-viavel";

export type FaixaDoDia = "minimo" | "normal" | "turbo";

export function lerFaixa(mood: unknown): FaixaDoDia {
  return mood === "minimo" || mood === "turbo" ? mood : "normal";
}

/** Valor da meta do dia conforme a faixa escolhida. */
export function metaDaFaixa(m: Pick<MetaDoDia, "minimo" | "meta" | "turbo">, faixa: FaixaDoDia): number {
  return faixa === "minimo" ? m.minimo : faixa === "turbo" ? m.turbo : m.meta;
}
