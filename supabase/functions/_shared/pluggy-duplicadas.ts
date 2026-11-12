// 04/11/2026: the Mercado Pago login loop (store app) made people connect the SAME account
// 3–5 times. Every copy is read and billed separately, and with more than one connection the
// "only one bank = it's the work account" rule stops applying, so their sales stopped counting.
// pluggy-hora removed the copies: same vendor, same bank, same holder, same accounts; the oldest
// connection stayed. (Until 12/11 — see below.)
//
// 12/11/2026 (Rick, A4): "Não exclua automaticamente conexões sem identificação inequívoca da
// mesma conta bancária. Se essa identificação ainda não estiver disponível, mantenha ambas e
// registre apenas o diagnóstico técnico."
// Same bank + same holder (even the same CPF) + same account names is NOT that identification:
// one person can hold two checking accounts at the same institution. The unequivocal one would be
// the account's own number, which the app does not store (privacy, 02/10) and whose real fields
// per bank are not validated yet. So, until it exists, THIS ROUTINE REMOVES NOTHING: it only
// reports what looks like a copy. No connection is deleted on its own anywhere any more.
// deno-lint-ignore-file no-explicit-any

export type Conexao = {
  id: string; user_id: string; institution_name: string | null; dono_nome: string | null; created_at: string;
  dono_doc?: string | null; status?: string | null;
};

const soDigitos = (v: unknown) => String(v ?? "").replace(/\D/g, "");

/** Who holds the account, as far as we know: the document when present, else the name. "" = unknown. */
export function titularDe(c: Pick<Conexao, "dono_doc" | "dono_nome">): string {
  const doc = soDigitos(c.dono_doc);
  if (doc.length >= 11) return `doc:${doc}`;
  const nome = String(c.dono_nome ?? "").trim().toLowerCase();
  return nome ? `nome:${nome}` : "";
}

/** Pure: groups of connections that LOOK like copies of one account — same seller, same bank,
 *  same identified holder, same account names. A diagnosis, never a proof: nothing is removed
 *  because of it. Connections younger than `minIdadeMin` are left out (still connecting). */
export function possiveisCopias(
  conexoes: Conexao[], contasPorConexao: Map<string, string[]>, agora = Date.now(), minIdadeMin = 10,
): Conexao[][] {
  const grupos = new Map<string, Conexao[]>();
  for (const c of conexoes) {
    const contas = (contasPorConexao.get(c.id) ?? []).filter(Boolean).sort();
    if (contas.length === 0) continue; // nothing to compare yet
    if (agora - Date.parse(c.created_at) < minIdadeMin * 60_000) continue;
    const titular = titularDe(c);
    if (!titular) continue; // nobody identified as the holder: not even a suspicion
    const k = [c.user_id, (c.institution_name ?? "").toLowerCase(), titular, contas.join(",")].join("|");
    grupos.set(k, [...(grupos.get(k) ?? []), c]);
  }
  return [...grupos.values()].filter((g) => g.length > 1)
    .map((g) => [...g].sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at)));
}

/** Pure: the technical diagnosis that goes to the log. Counts only, no identifiers. */
export function diagnosticoDeCopias(grupos: Conexao[][]) {
  const conexoes = grupos.flat();
  return {
    grupos: grupos.length,
    conexoes: conexoes.length,
    por_documento: grupos.filter((g) => titularDe(g[0] ?? { dono_doc: null, dono_nome: null }).startsWith("doc:")).length,
    saudaveis: conexoes.filter((c) => String(c.status ?? "").toUpperCase() === "UPDATED").length,
  };
}

/** Looks for what seems to be a copy and REPORTS it. Removes nothing and calls nothing on Pluggy;
 *  the result (connections removed) is always 0. The `chave` argument is kept for the caller. */
export async function limparRepetidas(admin: any, _chave?: () => Promise<string | null>): Promise<number> {
  const { data: cons } = await admin.from("bank_connections")
    .select("id, user_id, institution_name, dono_nome, dono_doc, status, created_at").neq("status", "deleted");
  const conexoes: Conexao[] = cons ?? [];
  if (conexoes.length < 2) return 0;
  const { data: saldos } = await admin.from("bank_saldos").select("bank_connection_id, nome")
    .in("bank_connection_id", conexoes.map((c) => c.id));
  const contas = new Map<string, string[]>();
  for (const s of (saldos ?? []) as { bank_connection_id: string; nome: string | null }[]) {
    contas.set(s.bank_connection_id, [...(contas.get(s.bank_connection_id) ?? []), String(s.nome ?? "")]);
  }
  const grupos = possiveisCopias(conexoes, contas);
  if (grupos.length > 0) {
    console.log("pluggy duplicadas: possiveis copias mantidas, sem identificacao inequivoca da conta",
      JSON.stringify(diagnosticoDeCopias(grupos)));
  }
  return 0; // nothing is removed
}
