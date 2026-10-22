// Vant — quais bancos o widget da Pluggy mostra (puro: testado no vitest).
/** Conectores diretos que pedem QR Code ou nao funcionam no celular do vendedor. */
export const CONECTORES_FORA = new Set<number>([215]);

/** Ids dos conectores que o widget pode mostrar (todos os do Brasil menos CONECTORES_FORA), ou null se a Pluggy nao respondeu. */
export function filtrarConectores(lista: unknown): number[] | null {
  if (!Array.isArray(lista)) return null;
  const ids = lista.map((c) => Number((c as { id?: unknown })?.id)).filter((id) => Number.isFinite(id) && !CONECTORES_FORA.has(id));
  return ids.length > 0 ? ids : null;
}

