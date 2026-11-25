/* VANT Receita Inteligente — how the seller MEASURES what he uses (25/11/2026, Rick).
   The ingredient has ONE stock unit (its "base": un, g or ml). A recipe line is always stored in that
   base, so stock, cost, Mercado and Produção never convert anything. Here, and only here, what he
   typed ("200 g") becomes the base ("0,5063 caixinha" of 395 g) — and only between compatible
   measures: g ↔ kg, ml ↔ L, un ↔ g/ml when the content of one unit is known. Never 1 un = 1 g,
   never 1 g = 1 ml. */
import type { Unidade } from "../types";

export type UnidadeUso = "un" | "g" | "kg" | "ml" | "l";
export interface Conteudo { qtd: number; unidade: "g" | "ml" }

const DIM: Record<UnidadeUso, "un" | "g" | "ml"> = { un: "un", g: "g", kg: "g", ml: "ml", l: "ml" };
const FATOR: Record<UnidadeUso, number> = { un: 1, g: 1, kg: 1000, ml: 1, l: 1000 };
const uso = (u: Unidade): UnidadeUso => u;

export type Conversao =
  | { ok: true; qtd: number }
  /** un ↔ g/ml without knowing what one unit holds: ask "quanto vem em cada caixinha?" */
  | { ok: false; motivo: "conteudo"; dim: "g" | "ml" }
  /** g ↔ ml, or a g/ml ingredient used by the piece: no conversion is valid */
  | { ok: false; motivo: "incompativel" };

/** What he typed (v in u) in the ingredient's base unit. */
export function paraBase(v: number, u: UnidadeUso, base: Unidade, conteudo?: Conteudo | null): Conversao {
  const b = uso(base);
  if (DIM[u] === DIM[b]) return { ok: true, qtd: (v * FATOR[u]) / FATOR[b] };
  if (DIM[b] === "un" && DIM[u] !== "un") {
    const dim = DIM[u] as "g" | "ml";
    if (!conteudo || !(conteudo.qtd > 0)) return { ok: false, motivo: "conteudo", dim };
    if (conteudo.unidade !== dim) return { ok: false, motivo: "incompativel" };
    return { ok: true, qtd: (v * FATOR[u]) / conteudo.qtd };
  }
  return { ok: false, motivo: "incompativel" };
}

/** The stored base quantity shown back in the unit he typed (null when it cannot be). Rounded only
 *  for the screen (3 decimals), so 200/395 of a box comes back as "200 g". */
export function daBase(qtd: number, u: UnidadeUso, base: Unidade, conteudo?: Conteudo | null): number | null {
  const um = paraBase(1, u, base, conteudo);
  return um.ok && um.qtd > 0 ? Math.round((qtd / um.qtd) * 1000) / 1000 : null;
}

/** Units offered for "Quanto usa?": a box (un) can be used in g/kg/ml/L once its content is told;
 *  something bought by weight is used by weight, by volume by volume. */
export function unidadesDeUso(base: Unidade): UnidadeUso[] {
  const d = DIM[uso(base)];
  return d === "un" ? ["un", "g", "kg", "ml", "l"] : d === "g" ? ["g", "kg"] : ["ml", "l"];
}

/** Commercial package names (wording only: the stock is still counted one by one). */
export const EMBALAGENS = ["caixinha", "lata", "pacote", "garrafa", "sachê", "pote"] as const;

/** How the seller names one unit of a "un" ingredient: "caixinha", or "un". */
export const nomeDaUnidade = (u: UnidadeUso, embalagem?: string | null) => (u === "un" && embalagem ? embalagem : u === "l" ? "L" : u);
