// VANT — only what the AI disclosure lists goes to an AI provider (26/11/2026, Rick: "cortar no
// servidor"). The disclosure text shipped in the store build (src/features/consentimento-ia →
// texto-ia.tsx, version 2026-11-28) is the promise; when a function was sending more than its row
// says, the function is cut here, on the server, instead of changing a text that is already in a
// build. Pure, no imports: tested by the app's vitest suite.
//
// Mentor row: "o que você escreve ou fala, seu apelido e, quando você pergunta, suas vendas,
// estoque, finanças e ranking" → no city, no selling spot, and never another vendor's name.

/** The context line the app builds is "- Nome: X. Vende: Y. Onde: Z. Cidade: C/UF.": drops from
 *  "Onde:" (or "Cidade:") to the end of that line. Every other line is kept as it came. */
export function contextoSemLocal(contexto: unknown): string {
  return String(contexto ?? "")
    .split("\n")
    .map((linha) => (/^\s*-\s*Nome:/.test(linha) ? linha.replace(/\s+(?:Onde|Cidade):\s.*$/u, "") : linha))
    .join("\n");
}

/** Top of the month's ranking for the Mentor: position and revenue only. The other vendors did
 *  not agree to have their name sent to an AI because someone else asked about the ranking. */
export function top3SemNomes(linhas: unknown): { posicao: number; faturamento_total_mes: number }[] {
  if (!Array.isArray(linhas)) return [];
  return linhas.slice(0, 3).map((l) => {
    const r = (l ?? {}) as Record<string, unknown>;
    return { posicao: Number(r.posicao_faturamento) || 0, faturamento_total_mes: Number(r.faturamento_total_mes) || 0 };
  });
}
