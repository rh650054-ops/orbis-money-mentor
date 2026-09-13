/**
 * A API corta TODA resposta em 1.000 linhas, mesmo com `.limit(3000)`.
 * Quem vende muito estourava esse teto e a tela mostrava conta errada sem avisar
 * ninguém (caso real: 12/09/2026, a semana do vendedor aparecia toda com "×"
 * porque as vendas mais recentes ficavam de fora do pacote).
 *
 * `buscarTudo` pede a mesma consulta em pedaços de 1.000 até acabar.
 * Use SEMPRE que a consulta puder passar de mil linhas (vendas, blocos, logs).
 * Quando dá pra contar no banco (uma RPC), prefira a RPC — é mais rápido ainda.
 */
const PAGINA = 1000;

export async function buscarTudo<T>(
  monta: (de: number, ate: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
  maximo = 20000,
): Promise<T[]> {
  const tudo: T[] = [];
  for (let de = 0; de < maximo; de += PAGINA) {
    const { data, error } = await monta(de, de + PAGINA - 1);
    if (error) {
      // Já tem página anterior? Devolve o que deu — meia conta é melhor que tela quebrada.
      if (tudo.length > 0) break;
      throw error;
    }
    const lote = data ?? [];
    tudo.push(...lote);
    if (lote.length < PAGINA) break;
  }
  return tudo;
}
