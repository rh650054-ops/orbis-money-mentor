// 04/11/2026: the Mercado Pago login loop (store app) made people connect the SAME account
// 3–5 times. Every copy is read and billed separately, and with more than one connection the
// "only one bank = it's the work account" rule stops applying, so their sales stopped counting.
// pluggy-hora now removes the copies: same vendor, same bank, same holder, same accounts.
// The oldest connection stays.
//
// 12/11/2026 (Rick, A4): "contas distintas da mesma instituição não são automaticamente
// duplicadas." This is now the ONLY place that removes a connection on its own, and it needs proof:
//   - the holder must be identified on both sides and be the same: the document (CPF/CNPJ) when
//     there is one, otherwise the name. No holder = no proof. A CPF and a CNPJ at the same bank
//     are two accounts;
//   - the accounts must be the same (as before);
//   - the connection that stays (the oldest: it holds the history and the account's purpose) must
//     be healthy. If it is not, nothing is removed — a working connection is never the one to go.
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

/** Pure part: ids to remove. Connections younger than `minIdadeMin` are left alone (still connecting). */
export function copiasRepetidas(
  conexoes: Conexao[], contasPorConexao: Map<string, string[]>, agora = Date.now(), minIdadeMin = 10,
): string[] {
  const grupos = new Map<string, Conexao[]>();
  for (const c of conexoes) {
    const contas = (contasPorConexao.get(c.id) ?? []).filter(Boolean).sort();
    if (contas.length === 0) continue; // nothing to compare yet
    if (agora - Date.parse(c.created_at) < minIdadeMin * 60_000) continue;
    const titular = titularDe(c);
    if (!titular) continue; // A4: nobody identified as the holder — the bank's name proves nothing
    const k = [c.user_id, (c.institution_name ?? "").toLowerCase(), titular, contas.join(",")].join("|");
    grupos.set(k, [...(grupos.get(k) ?? []), c]);
  }
  const fora: string[] = [];
  for (const g of grupos.values()) {
    if (g.length < 2) continue;
    g.sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));
    const fica = g[0];
    if (String(fica?.status ?? "").toUpperCase() !== "UPDATED") continue; // A4: only when the one that stays works
    fora.push(...g.slice(1).map((c) => c.id));
  }
  return fora;
}

/** Finds the copies, deletes the Pluggy item and marks the connection deleted. */
export async function limparRepetidas(admin: any, chave: () => Promise<string | null>): Promise<number> {
  const { data: cons } = await admin.from("bank_connections")
    .select("id, item_id, user_id, institution_name, dono_nome, dono_doc, status, created_at").neq("status", "deleted");
  const conexoes: (Conexao & { item_id: string | null })[] = cons ?? [];
  if (conexoes.length < 2) return 0;
  const { data: saldos } = await admin.from("bank_saldos").select("bank_connection_id, nome")
    .in("bank_connection_id", conexoes.map((c) => c.id));
  const contas = new Map<string, string[]>();
  for (const s of (saldos ?? []) as { bank_connection_id: string; nome: string | null }[]) {
    contas.set(s.bank_connection_id, [...(contas.get(s.bank_connection_id) ?? []), String(s.nome ?? "")]);
  }
  const fora = copiasRepetidas(conexoes, contas);
  if (fora.length === 0) return 0;
  const apiKey = await chave();
  if (!apiKey) return 0;
  let n = 0;
  for (const id of fora) {
    const c = conexoes.find((x) => x.id === id);
    if (!c) continue;
    if (c.item_id) {
      const r = await fetch(`https://api.pluggy.ai/items/${encodeURIComponent(c.item_id)}`, {
        method: "DELETE", headers: { "X-API-KEY": apiKey }, signal: AbortSignal.timeout(15000),
      }).catch(() => null);
      if (!r || (!r.ok && r.status !== 404)) continue; // try again next run
    }
    const { error } = await admin.from("bank_connections")
      .update({ status: "deleted", updated_at: new Date().toISOString() }).eq("id", id);
    if (!error) n++;
  }
  return n;
}
