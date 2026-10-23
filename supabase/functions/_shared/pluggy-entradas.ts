// Vant — importador ÚNICO das entradas do banco (Pluggy → auto_detected_sales).
// Usado pelo pluggy-sync ("puxa agora" do relatório) e pelo pluggy-hora (cron).
//
// O que ele grava além do básico (02/10/2026, Pix travado):
//   • is_pix        → a Pluggy diz que é Pix (paymentData.paymentMethod ou
//                     operationType) ou a descrição fala em Pix
//   • transacted_at → data+hora real do crédito. O dia do ranking é o dia em
//                     Brasília: um Pix às 21h de quinta é de quinta, não de sexta.
//   • own_transfer  → quem pagou tem o MESMO CPF do vendedor: transferência entre
//                     contas dele mesmo não é venda e não vai pro ranking.
// O CPF de quem pagou é comparado aqui e jogado fora: não é gravado (LGPD).
//
// Upsert por transaction_id SEM mexer em `status`: se o vendedor marcou um
// crédito como "ignorado", a próxima leitura não desfaz a escolha dele.

import { linhasMudadas } from "./pluggy-linhas.ts";

const BRT = "America/Sao_Paulo";

export async function pluggyKey(): Promise<string | null> {
  // Same object as the `Deno` global; typed via globalThis so the src test typecheck (no Deno lib) compiles too.
  const env = (globalThis as unknown as { Deno: { env: { get(k: string): string | undefined } } }).Deno.env;
  const clientId = env.get("PLUGGY_CLIENT_ID");
  const clientSecret = env.get("PLUGGY_CLIENT_SECRET");
  if (!clientId || !clientSecret) return null;
  const r = await fetch("https://api.pluggy.ai/auth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ clientId, clientSecret }),
    signal: AbortSignal.timeout(20000),
  });
  if (!r.ok) return null;
  const { apiKey } = await r.json();
  return apiKey as string;
}

/** URL de uma página do GET /v2/transactions. A Pluggy devolve em `next` o pedaço que vai
 *  colado no fim do endpoint (ex.: "?after=...&accountId=..."), não só o cursor: mandar
 *  `after=<next>` voltava 400 "Invalid cursor" e a 2ª página nunca vinha (05/10). */
export function urlTransacoes(accountId: string, dataDe: string, next: string | null): string {
  const base = "https://api.pluggy.ai/v2/transactions";
  if (next) {
    if (/^https?:\/\//.test(next)) return next;
    if (next.startsWith("?") || next.startsWith("/")) return base + next;
    return `${base}?accountId=${encodeURIComponent(accountId)}&dateFrom=${dataDe}&after=${encodeURIComponent(next)}`;
  }
  return `${base}?accountId=${encodeURIComponent(accountId)}&dateFrom=${dataDe}`;
}

/** Dia em Brasília (YYYY-MM-DD) de um instante. */
export function diaBRT(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: BRT, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

const soDigitos = (v: unknown) => String(v ?? "").replace(/\D/g, "");

/** A data da Pluggy às vezes vem só com o dia (meia-noite UTC cravada). Nesse
 *  caso não dá pra saber a hora: fica o dia como veio, sem converter fuso. */
// deno-lint-ignore no-explicit-any
export function quandoFoi(t: any): { dia: string; instante: string | null } {
  const bruto = String(t?.date ?? "");
  if (!bruto) return { dia: diaBRT(new Date()), instante: null };
  const d = new Date(bruto);
  if (Number.isNaN(d.getTime())) return { dia: bruto.slice(0, 10), instante: null };
  const soDia = /T00:00:00(\.0+)?(Z|\+00:00)$/.test(bruto) || bruto.length <= 10;
  return soDia ? { dia: bruto.slice(0, 10), instante: null } : { dia: diaBRT(d), instante: d.toISOString() };
}

// deno-lint-ignore no-explicit-any
export function ehPix(t: any): boolean {
  const metodo = String(t?.paymentData?.paymentMethod ?? "").toUpperCase();
  const op = String(t?.operationType ?? "").toUpperCase();
  if (metodo === "PIX" || op === "PIX") return true;
  return /\bpix\b/i.test(String(t?.description ?? "")) || /\bpix\b/i.test(String(t?.descriptionRaw ?? ""));
}

/** Nome e documento de quem pagou (Pix traz em paymentData.payer). */
// deno-lint-ignore no-explicit-any
export function pagadorDe(t: any): { nome: string | null; doc: string | null } {
  const p = t?.paymentData?.payer;
  const doc = p?.documentNumber;
  const valor = soDigitos(typeof doc === "object" && doc ? doc.value : doc);
  const nome = String(p?.name ?? "").trim().slice(0, 120);
  return { nome: nome || null, doc: valor.length >= 11 ? valor : null };
}

/** Dono da conta (owner / taxNumber da Pluggy) → bank_connections.dono_nome / dono_doc.
 *  É o que barra Pix da própria conta no ranking (Rick, 11/10/2026). Falha não derruba a leitura. */
// deno-lint-ignore no-explicit-any
export async function gravarDono(admin: any, contas: any[], conexaoId: string) {
  // deno-lint-ignore no-explicit-any
  const c = contas.find((x: any) => x?.owner || x?.taxNumber);
  if (!c) return;
  const nome = String(c?.owner ?? "").trim().slice(0, 120) || null;
  const doc = soDigitos(c?.taxNumber);
  const { error } = await admin.from("bank_connections")
    .update({ dono_nome: nome, dono_doc: doc.length >= 11 ? doc : null })
    .eq("id", conexaoId);
  if (error) console.error("pluggy dono:", error.message);
}

// deno-lint-ignore no-explicit-any
export function mesmoDono(t: any, cpfDoVendedor: string): boolean {
  if (cpfDoVendedor.length !== 11) return false;
  const doc = t?.paymentData?.payer?.documentNumber;
  const valor = soDigitos(typeof doc === "object" && doc ? doc.value : doc);
  return valor.length === 11 && valor === cpfDoVendedor;
}

/** Puxa as ENTRADAS (CREDIT) das contas BANK do item, de `dias` dias atrás até hoje. */
// deno-lint-ignore no-explicit-any
export async function importarEntradas(admin: any, apiKey: string, itemId: string, userId: string, conexaoId: string, dias = 2) {
  const contasRes = await fetch(`https://api.pluggy.ai/accounts?itemId=${encodeURIComponent(itemId)}`, {
    headers: { "X-API-KEY": apiKey }, signal: AbortSignal.timeout(25000),
  });
  // deno-lint-ignore no-explicit-any
  const contas: any[] = ((await contasRes.json().catch(() => ({})))?.results ?? [])
    .filter((c: { type?: string }) => String(c?.type ?? "").toUpperCase() === "BANK");

  const { data: perfil } = await admin.from("profiles").select("cpf").eq("user_id", userId).maybeSingle();
  const cpf = soDigitos(perfil?.cpf);
  try { await gravarDono(admin, contas, conexaoId); } catch (e) { console.error("pluggy dono", (e as Error)?.message); }

  // um dia a mais pra trás: o filtro da Pluggy é em UTC e o nosso dia é em Brasília
  const dataDe = diaBRT(new Date(Date.now() - (dias + 1) * 86_400_000));

  let gravadas = 0;
  let pix = 0;
  // 21/10/2026: what Pluggy returned in THIS read. Mercado Pago re-issues its Pix with new
  // ids (the old ones vanish from Pluggy), and we kept both: the same Pix counted twice.
  const vistos = new Set<string>();
  let leituraCompleta = contasRes.ok && contas.length > 0;
  for (const conta of contas) {
    let cursor: string | null = null;
    let terminou = false;
    for (let pagina = 0; pagina < 5; pagina++) {
      const u = urlTransacoes(String(conta.id), dataDe, cursor);
      const txRes = await fetch(u, { headers: { "X-API-KEY": apiKey }, signal: AbortSignal.timeout(25000) });
      if (!txRes.ok) { console.error("pluggy transactions", txRes.status, conta.id); break; }
      // deno-lint-ignore no-explicit-any
      const corpo: any = await txRes.json().catch(() => ({}));
      // deno-lint-ignore no-explicit-any
      const txs: any[] = corpo?.results ?? [];
      // deno-lint-ignore no-explicit-any
      for (const t of txs) if (t?.type === "CREDIT" && Number(t?.amount) > 0 && t?.id) vistos.add(String(t.id));
      // deno-lint-ignore no-explicit-any
      const linhas = txs.filter((t: any) => t?.type === "CREDIT" && Number(t?.amount) > 0).map((t: any) => {
        const q = quandoFoi(t);
        const p = ehPix(t);
        const quem = pagadorDe(t);
        if (p) pix++;
        return {
          user_id: userId,
          bank_connection_id: conexaoId,
          transaction_id: String(t.id),
          amount: Number(t.amount),
          description: t?.description ?? null,
          transaction_date: q.dia,
          transacted_at: q.instante,
          is_pix: p,
          own_transfer: mesmoDono(t, cpf),
          pagador_nome: quem.nome,
          pagador_doc: quem.doc,
        };
      }).filter((l) => l.transaction_date >= dataDe);
      if (linhas.length > 0) {
        // 08/10/2026: write only what is NEW or CHANGED. Re-saving identical rows on every
        // read was ~50 rewrites per new entry, and each rewrite also fired a realtime event
        // to every open app — the biggest load on the database.
        const ids = linhas.map((l) => l.transaction_id);
        const { data: existentes, error: eLer } = await admin.from("auto_detected_sales")
          .select("transaction_id, amount, description, transaction_date, transacted_at, is_pix, own_transfer, pagador_nome, pagador_doc")
          .in("transaction_id", ids);
        // reading failed → fall back to the old full upsert (never lose an entry)
        const aGravar = eLer ? linhas : linhasMudadas(linhas, existentes ?? []);
        if (aGravar.length > 0) {
          const { error } = await admin.from("auto_detected_sales").upsert(aGravar, { onConflict: "transaction_id" });
          if (error) console.error("pluggy importar: upsert", error.message);
          else gravadas += aGravar.length;
        }
      }
      cursor = corpo?.next ? String(corpo.next) : null;
      if (!cursor) { terminou = true; break; }
    }
    if (!terminou) leituraCompleta = false;
  }
  const removidas = leituraCompleta ? await tirarSumidas(admin, conexaoId, dataDe, vistos) : 0;
  return { contas: contas.length, gravadas, pix, removidas };
}

/** Entries of this connection, inside the window just read in full, that Pluggy no longer
 *  returns (re-issued with a new id, or deleted by the bank). Only after a COMPLETE read,
 *  never the window's first day (Pluggy filters in UTC), and never if Pluggy returned nothing. */
// deno-lint-ignore no-explicit-any
export async function tirarSumidas(admin: any, conexaoId: string, dataDe: string, vistos: Set<string>): Promise<number> {
  if (vistos.size === 0) return 0;
  const { data, error } = await admin.from("auto_detected_sales")
    .select("transaction_id").eq("bank_connection_id", conexaoId).gt("transaction_date", dataDe).eq("status", "pending");
  if (error || !data) return 0;
  const sumidas = idsSumidos((data as { transaction_id: string }[]).map((r) => r.transaction_id), vistos);
  let n = 0;
  for (let i = 0; i < sumidas.length; i += 100) {
    const lote = sumidas.slice(i, i + 100);
    const { error: eDel } = await admin.from("auto_detected_sales").delete().eq("bank_connection_id", conexaoId).in("transaction_id", lote);
    if (eDel) { console.error("pluggy sumidas:", eDel.message); break; }
    n += lote.length;
  }
  if (n > 0) console.log("pluggy sumidas removidas", conexaoId, n);
  return n;
}

/** Pure part: which stored ids did not come back. */
export function idsSumidos(guardados: string[], vistos: Set<string>): string[] {
  return guardados.filter((id) => !vistos.has(id));
}

/** transactions/deleted webhook: Pluggy tells which ids are gone. */
// deno-lint-ignore no-explicit-any
export async function apagarTransacoes(admin: any, conexaoId: string, ids: unknown): Promise<number> {
  const lista = Array.isArray(ids) ? ids.map(String).filter(Boolean) : [];
  if (lista.length === 0) return 0;
  const { data, error } = await admin.from("auto_detected_sales").delete()
    .eq("bank_connection_id", conexaoId).in("transaction_id", lista.slice(0, 500)).select("id");
  if (error) { console.error("pluggy apagar:", error.message); return 0; }
  return (data ?? []).length;
}

/** Pede pra Pluggy buscar dados novos no banco. A resposta chega pelo pluggy-webhook. */
export async function pedirAtualizacao(apiKey: string, itemId: string): Promise<boolean> {
  try {
    const p = await fetch(`https://api.pluggy.ai/items/${encodeURIComponent(itemId)}`, {
      method: "PATCH", headers: { "Content-Type": "application/json", "X-API-KEY": apiKey },
      body: "{}", signal: AbortSignal.timeout(15000),
    });
    if (!p.ok) console.log("pluggy patch", p.status, (await p.text()).slice(0, 120));
    return p.ok;
  } catch (e) {
    console.log("pluggy patch falhou", (e as Error)?.message);
    return false;
  }
}
