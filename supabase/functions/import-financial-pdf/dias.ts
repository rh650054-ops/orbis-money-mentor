// VANT — import-financial-pdf: what the AI answered → the rows the app reviews. Pure (no imports),
// tested by the app's vitest suite. Same arithmetic the production function had before 26/11:
// money rounded to cents, units to whole numbers, days with nothing dropped, and "faturamento"
// rebuilt from dinheiro + pix + gorjeta when the AI left it at 0.

export interface DiaImportado {
  data: string; faturamento: number; dinheiro: number; pix: number; gorjeta: number; calote: number;
  custo: number; transporte: number; alimentacao: number; unidades_iniciais: number; unidades_nao_pagas: number;
}

const num = (v: unknown): number => { const n = Number(v); return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0; };

/** The JSON object inside the AI's answer (it may come wrapped in a code fence or in prose). */
export function lerJsonDaIa(texto: string): { resumo?: unknown; dias?: unknown } | null {
  try {
    const m = texto.match(/\{[\s\S]*\}/);
    const o = JSON.parse(m ? m[0] : texto);
    return o && typeof o === "object" ? o as { resumo?: unknown; dias?: unknown } : null;
  } catch {
    return null;
  }
}

export function limparDias(dias: unknown): DiaImportado[] {
  const lista = Array.isArray(dias) ? dias : [];
  return lista
    .map((d: Record<string, unknown> | null | undefined) => ({
      data: String(d?.data ?? "").slice(0, 10),
      faturamento: num(d?.faturamento),
      dinheiro: num(d?.dinheiro),
      pix: num(d?.pix),
      gorjeta: num(d?.gorjeta),
      calote: num(d?.calote),
      custo: num(d?.custo),
      transporte: num(d?.transporte),
      alimentacao: num(d?.alimentacao),
      unidades_iniciais: Math.round(num(d?.unidades_iniciais)),
      unidades_nao_pagas: Math.round(num(d?.unidades_nao_pagas)),
    }))
    .filter((d) => d.faturamento > 0 || d.dinheiro > 0 || d.pix > 0 || d.custo > 0)
    .map((d) => ({ ...d, faturamento: d.faturamento > 0 ? d.faturamento : Math.round((d.dinheiro + d.pix + d.gorjeta) * 100) / 100 }));
}
