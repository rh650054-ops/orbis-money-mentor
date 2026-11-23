/* Yield per flavour (23/11/2026): what the OLD product sheet (/products/ficha) can no longer handle.
 * That sheet only knows the product's yield and one row per ingredient. A product whose flavours
 * have their own yield or skip the base, or with an ingredient repeated (base + flavour, or two
 * flavours), is produced and edited only by the new screens. Every product that exists today
 * returns false here, so the old sheet keeps working for them exactly as before. */
export type VarianteReceita = { batch_yield?: number | string | null; usa_base?: boolean | null };

export function temReceitaPorSabor(variantes: readonly VarianteReceita[]): boolean {
  return variantes.some((v) => (v.batch_yield !== null && v.batch_yield !== undefined) || v.usa_base === false);
}

export function temIngredienteRepetido(linhas: readonly { ingredient_id: string }[]): boolean {
  const vistos = new Set<string>();
  for (const l of linhas) {
    if (vistos.has(l.ingredient_id)) return true;
    vistos.add(l.ingredient_id);
  }
  return false;
}

export const AVISO_RECEITA_POR_SABOR =
  "Este produto tem rendimento ou receita própria por sabor. Edite e registre a produção pelo cadastro novo.";
