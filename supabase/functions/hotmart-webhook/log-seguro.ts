/* What hotmart-webhook may write to the function logs (26/11/2026, LGPD minimisation).
   The logs are read by whoever has access to the Supabase panel and are kept by Supabase, so they
   carry only technical identifiers: event type, event id, transaction, subscription code, offer
   code and our own account id. The buyer's name, e-mail, CPF, phone and address never go there.
   Nothing is lost for the financial audit: the whole event stays in the table hotmart_eventos,
   found by the transaction. Pure, no imports. */

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
const REGRAS: [RegExp, string][] = [
  [/[\p{L}\p{N}._%+-]+@[\p{L}\p{N}.-]+\.\p{L}{2,}/gu, "[EMAIL]"],
  [/\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/g, "[CNPJ]"],
  [/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, "[CPF]"],
  [/(?:\+?55\s?)?\(?\b\d{2}\)?\s?9?\s?\d{4}[-\s]?\d{4}\b/g, "[TELEFONE]"],
  [/\b\d{9,}\b/g, "[NUMERO]"],
];

/** A code from Hotmart (transaction, subscription, offer, event): letters, digits and - _ . : only. */
export function codigo(v: unknown, limite = 80): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).replace(/[^A-Za-z0-9_.:-]/g, "").slice(0, limite);
  return s || null;
}

/** Free text for a log line (a library or database error): contact data masked, account ids kept. */
export function semContato(texto: unknown, limite = 300): string {
  const s = String(texto ?? "").slice(0, limite * 2);
  const ids = s.match(UUID) ?? [];
  const mascarado = s.split(UUID).map((parte) => {
    let p = parte;
    for (const [re, tag] of REGRAS) p = p.replace(re, tag);
    return p;
  });
  return mascarado.reduce((acc, parte, i) => acc + parte + (ids[i] ?? ""), "").slice(0, limite);
}

export interface IdsDoEvento { evento?: unknown; id?: unknown; transacao?: unknown; assinatura?: unknown; oferta?: unknown }

/** The receipt line: only the identifiers needed to find the event in hotmart_eventos. */
export function linhaDoEvento(ids: IdsDoEvento): string {
  return JSON.stringify({
    evento: codigo(ids.evento),
    id: codigo(ids.id),
    transacao: codigo(ids.transacao),
    assinatura: codigo(ids.assinatura),
    oferta: codigo(ids.oferta),
  });
}
