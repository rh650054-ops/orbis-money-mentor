/* ============================================================
   PLANO DO DESAFIO DE LUCRO (Rick, 27/10/2026) — pure math.
   "Quero R$ 5.000 de lucro em 15 dias": with the last 60 days the Vant
   says what the average delivers, how many units per day the goal needs
   and whether that fits the person's rhythm (average / record).
   Profit per unit = average ticket − cost per unit (bank statement or recipe).
   ============================================================ */
import type { BaseLucro } from "../types";

export type Nivel = "sem-historico" | "tranquilo" | "puxado" | "acima";

export interface PlanoLucro {
  lucroUnid: number;
  lucroDiaMedio: number;
  /** what the average delivers in the chosen work days */
  projecao: number;
  faltaNaMedia: number;
  precisaDia: number;
  unidDia: number | null;
  nivel: Nivel;
  /** work days needed keeping the average rhythm */
  diasNaMedia: number | null;
  totalUnid: number | null;
  produzir: number | null;
  custoProduzir: number | null;
}

export const lucroPorUnidade = (b: BaseLucro) => Math.max(0, b.ticket - b.custo_unid);

/** Work days the person usually does in a period (e.g. 63% of 15 → 9). */
export function diasSugeridos(b: BaseLucro, dias: number): number {
  if (b.dias_vendidos <= 0 || b.frequencia <= 0) return dias;
  return Math.min(dias, Math.max(1, Math.round(dias * b.frequencia)));
}

export function planoLucro(b: BaseLucro, alvo: number, diasTrabalho: number): PlanoLucro {
  const dias = Math.max(1, Math.round(diasTrabalho));
  const lucroUnid = lucroPorUnidade(b);
  const lucroDiaMedio = b.unid_dia * lucroUnid;
  const projecao = lucroDiaMedio * dias;
  const precisaDia = alvo / dias;
  const unidDia = lucroUnid > 0 ? Math.ceil(precisaDia / lucroUnid) : null;
  const totalUnid = unidDia === null ? null : unidDia * dias;
  const produzir = totalUnid === null ? null : Math.max(0, totalUnid - b.estoque);
  return {
    lucroUnid,
    lucroDiaMedio,
    projecao,
    faltaNaMedia: Math.max(0, alvo - projecao),
    precisaDia,
    unidDia,
    nivel: nivelDe(b, unidDia),
    diasNaMedia: lucroDiaMedio > 0 ? Math.ceil(alvo / lucroDiaMedio) : null,
    totalUnid,
    produzir,
    custoProduzir: produzir === null ? null : produzir * b.custo_receita,
  };
}

function nivelDe(b: BaseLucro, unidDia: number | null): Nivel {
  if (unidDia === null || b.dias_vendidos <= 0 || b.unid_dia <= 0) return "sem-historico";
  if (unidDia <= b.unid_dia * 1.05) return "tranquilo";
  if (unidDia <= b.recorde_dia) return "puxado";
  return "acima";
}

/** "Batida" → "batidas"; no single product → "unidades". */
export function nomeUnidade(produto: string | null | undefined, n = 2): string {
  const nome = (produto ?? "").trim().toLowerCase();
  if (!nome) return n === 1 ? "unidade" : "unidades";
  if (n === 1 || nome.endsWith("s")) return nome;
  return `${nome}s`;
}
