// VANT — strips personal data from free text before it goes to a third-party AI (26/11/2026,
// App Store 5.1.1(i) / 5.1.2(i), LGPD minimisation). Pure, no imports: used by analisar-bug and
// tested by the app's vitest suite. A bug report is written by a person and may carry a CPF, an
// e-mail, a phone, a Pix key, a card or account number, an address or a token pasted from a
// screen. Each match becomes a neutral tag ([CPF], [EMAIL]…) so the AI still understands the bug.
// Names in free text cannot be detected reliably: that is why the caller also drops the reporter
// field and only an admin, by hand, starts an analysis.

const REGRAS: [RegExp, string][] = [
  [/[\p{L}\p{N}._%+-]+@[\p{L}\p{N}.-]+\.\p{L}{2,}/gu, "[EMAIL]"],
  [/\bhttps?:\/\/\S+/gi, "[LINK]"],
  [/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g, "[TOKEN]"],
  [/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, "[ID]"],
  [/\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/g, "[CNPJ]"],
  [/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, "[CPF]"],
  [/\b(?:\d[ -]?){13,19}\b/g, "[NUMERO]"],
  [/(?:\+?55\s?)?\(?\b\d{2}\)?\s?9?\d{4}[-\s]?\d{4}\b/g, "[TELEFONE]"],
  [/\b\d{5}-?\d{3}\b/g, "[CEP]"],
  [/\b(?:ag[eê]ncia|ag\.?|conta|c\/c|cc)\s*:?\s*\d[\d.-]{2,}\b/gi, "[CONTA]"],
  [/\b(?:rua|r\.|avenida|av\.|travessa|alameda|estrada|rodovia)\s+[^\n,;]{2,60}(?:,\s*n?º?\s*\d+)?/gi, "[ENDERECO]"],
  [/\b(?:senha|password|token|chave pix|pix)\s*[:=]\s*\S+/gi, "[SEGREDO]"],
];

export function semDadosPessoais(texto: unknown, limite = 2000): string {
  let s = String(texto ?? "").slice(0, limite * 2);
  for (const [re, tag] of REGRAS) s = s.replace(re, tag);
  return s.slice(0, limite);
}
