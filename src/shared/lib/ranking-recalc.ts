import { supabase } from "@/integrations/supabase/client";

/*
 * TRAVA do recálculo do ranking (08/10/2026).
 * recalculate_ranking_positions reordena o mês INTEIRO de todo mundo. Antes cada
 * venda sincronizada em cada celular disparava um (~1.600/dia com poucos
 * usuários; com o Desafio Avante viraria pico no banco). Agora cada aparelho
 * pede no máximo 1 a cada 2 min — as vendas continuam sendo gravadas na hora,
 * só a posição de todo mundo é reordenada com esse intervalo.
 */
const INTERVALO_MS = 2 * 60_000;
const CHAVE = "vant_ranking_recalc_em";
let ultimoNaMemoria = 0;

function ultimoPedido(): number {
  try {
    return Math.max(ultimoNaMemoria, Number(localStorage.getItem(CHAVE) || "0"));
  } catch {
    return ultimoNaMemoria;
  }
}

/** true quando este aparelho já pode pedir um novo recálculo. */
export function podeRecalcularRanking(agora = Date.now()): boolean {
  return agora - ultimoPedido() >= INTERVALO_MS;
}

/**
 * Pede o recálculo das posições do mês, respeitando a trava.
 * `forcar` é só para telas de admin (correção manual).
 */
export async function recalcularRanking(mes: string, forcar = false): Promise<{ error: unknown | null; pulou: boolean }> {
  if (!forcar && !podeRecalcularRanking()) return { error: null, pulou: true };
  ultimoNaMemoria = Date.now();
  try {
    localStorage.setItem(CHAVE, String(ultimoNaMemoria));
  } catch {
    /* sem armazenamento: a trava fica só na memória desta aba */
  }
  const { error } = await supabase.rpc("recalculate_ranking_positions", { target_month: mes });
  return { error: error ?? null, pulou: false };
}
