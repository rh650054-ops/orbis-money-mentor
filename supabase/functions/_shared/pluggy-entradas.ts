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

/** 04/11 (Rick): the bank verifies the whole month — the first read goes back to day 1 (at least 7 days). */
export function diasDoPrimeiroImporte(agora: Date = new Date()): number {
  return Math.max(7, Number(diaBRT(agora).slice(8, 10)));
}

const soDigitos = (v: unknown) => String(v ?? "").replace(/\D/g, "");

/** A data da Pluggy às vezes vem só com o dia (meia-noite UTC cravada). Nesse
 *  caso não dá pra saber a hora: fica o dia como veio, sem converter fuso. */
// deno-lint-ignore no-explicit-any
export function quandoFoi(t: any, horasAtraso = 0, agora = Date.now()): { dia: string; instante: string | null } {
  const bruto = String(t?.date ?? "");
  if (!bruto) return { dia: diaBRT(new Date()), instante: null };
  let d = new Date(bruto);
  if (Number.isNaN(d.getTime())) return { dia: bruto.slice(0, 10), instante: null };
  const soDia = /T00:00:00(\.0+)?(Z|\+00:00)$/.test(bruto) || bruto.length <= 10;
  if (soDia) return { dia: bruto.slice(0, 10), instante: null };
  if (horasAtraso > 0) {
    const certo = new Date(d.getTime() + horasAtraso * 3_600_000);
    // if the bank already sends the right time, the shifted one lands in the future: keep it as it came
    if (certo.getTime() <= agora + 10 * 60_000) d = certo;
  }
  return { dia: diaBRT(d), instante: d.toISOString() };
}

/** 02/11/2026: PagBank (via Pluggy) sends every credit 6h EARLIER than it happened. Checked on
 *  ~650 entries: the fastest read came 6h00 after the stored time (other banks: seconds), and a
 *  Pix the bank statement lists at 00:41 of day 2 arrived as 18:41 of day 1. A morning Pix then
 *  looked like 5 a.m. and was pushed to the previous day. */
export function horasAtrasoDoBanco(instituicao: string | null | undefined): number {
  return /pag\s*bank|pagseguro/i.test(instituicao ?? "") ? 6 : 0;
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
  const { data: conexao } = await admin.from("bank_connections").select("institution_name").eq("id", conexaoId).maybeSingle();
  const atraso = horasAtrasoDoBanco(conexao?.institution_name);
  const cpf = soDigitos(perfil?.cpf);
  try { await gravarDono(admin, contas, conexaoId); } catch (e) { console.error("pluggy dono", (e as Error)?.message); }

  // um dia a mais pra trás: o filtro da Pluggy é em UTC e o nosso dia é em Brasília
  const dataDe = diaBRT(new Date(Date.now() - (dias + 1) * 86_400_000));

  let gravadas = 0;
  let pix = 0;
  // 21/10/2026: what Pluggy returned in THIS read. Mercado Pago re-issues its Pix with new
  // ids (the old ones vanish from Pluggy), and we kept both: the same Pix counted twice.
  const vistos = new Set<string>();
  // 03/11: day|amount of what came back, so a vanished entry is only removed when a re-issued
  // twin (same day, same amount, new id) came in its place
  const vistosPorChave = new Map<string, number>();
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
      for (const t of txs) {
        if (t?.type !== "CREDIT" || !(Number(t?.amount) > 0) || !t?.id) continue;
        vistos.add(String(t.id));
        const k = chaveSumida(quandoFoi(t, atraso).dia, Number(t.amount));
        vistosPorChave.set(k, (vistosPorChave.get(k) ?? 0) + 1);
      }
      // deno-lint-ignore no-explicit-any
      const linhas = txs.filter((t: any) => t?.type === "CREDIT" && Number(t?.amount) > 0).map((t: any) => {
        const q = quandoFoi(t, atraso);
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
  const removidas = leituraCompleta ? await tirarSumidas(admin, conexaoId, dataDe, vistos, vistosPorChave) : 0;
  // 05/11 (audit #2): completa = every account read to the end → the caller stamps leitura_ok_em
  return { contas: contas.length, gravadas, pix, removidas, completa: leituraCompleta };
}

/** Entries of this connection, inside the window just read in full, that Pluggy no longer
 *  returns (re-issued with a new id, or deleted by the bank). Only after a COMPLETE read,
 *  never the window's first day (Pluggy filters in UTC), and never if Pluggy returned nothing. */
// deno-lint-ignore no-explicit-any
export async function tirarSumidas(
  admin: any, conexaoId: string, dataDe: string, vistos: Set<string>, vistosPorChave: Map<string, number>,
): Promise<number> {
  if (vistos.size === 0) return 0;
  const { data, error } = await admin.from("auto_detected_sales")
    .select("transaction_id, transaction_date, amount").eq("bank_connection_id", conexaoId).gt("transaction_date", dataDe).eq("status", "pending");
  if (error || !data) return 0;
  const guardados = (data as { transaction_id: string; transaction_date: string; amount: number | string }[])
    .map((r) => ({ id: r.transaction_id, chave: chaveSumida(r.transaction_date, Number(r.amount)) }));
  const sumidas = idsSumidos(guardados, vistos, vistosPorChave);
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

export const chaveSumida = (dia: string, valor: number) => `${dia}|${valor.toFixed(2)}`;

/** Pure part: stored entries that did not come back AND were replaced by a re-issued twin.
 *  03/11/2026: Mercado Pago sometimes returns only part of the list; removing every entry that
 *  did not come back wiped whole days (a seller's 01/11 went from R$ 295 to zero). Now an entry
 *  is removed only while there is a new id with the same day and amount to take its place. */
export function idsSumidos(guardados: { id: string; chave: string }[], vistos: Set<string>, vistosPorChave: Map<string, number>): string[] {
  const livres = new Map(vistosPorChave);
  for (const g of guardados) if (vistos.has(g.id)) livres.set(g.chave, (livres.get(g.chave) ?? 0) - 1);
  const out: string[] = [];
  for (const g of guardados) {
    if (vistos.has(g.id)) continue;
    const n = livres.get(g.chave) ?? 0;
    if (n > 0) { out.push(g.id); livres.set(g.chave, n - 1); }
  }
  return out;
}

/** transactions/deleted webhook: Pluggy tells which ids are gone.
    04/11 (audit OF1): before, every listed id was deleted on the spot, for every bank — real sales
    vanished. Now an id only goes when a re-issued twin (same day, same amount, another id, stored
    after it) is already there; the rest stays. Run it AFTER the re-import, so the twins are in. */
// deno-lint-ignore no-explicit-any
export async function apagarTransacoes(admin: any, conexaoId: string, ids: unknown): Promise<number> {
  const lista = Array.isArray(ids) ? ids.map(String).filter(Boolean).slice(0, 500) : [];
  if (lista.length === 0) return 0;
  const { data: alvos, error: e1 } = await admin.from("auto_detected_sales")
    .select("transaction_id, amount, transaction_date, created_at")
    .eq("bank_connection_id", conexaoId).in("transaction_id", lista);
  if (e1) { console.error("pluggy apagar (ler):", e1.message); return 0; }
  // deno-lint-ignore no-explicit-any
  const rows = (alvos ?? []) as any[];
  if (rows.length === 0) return 0;
  const dias = [...new Set(rows.map((r) => String(r.transaction_date)))];
  const desde = rows.map((r) => String(r.created_at)).sort()[0] ?? "";
  const { data: outros, error: e2 } = await admin.from("auto_detected_sales")
    .select("transaction_id, amount, transaction_date, created_at")
    .eq("bank_connection_id", conexaoId).in("transaction_date", dias).gt("created_at", desde);
  if (e2) { console.error("pluggy apagar (gemeas):", e2.message); return 0; }
  const fora = new Set(lista);
  const gemeas = new Map<string, number>();
  // deno-lint-ignore no-explicit-any
  for (const o of (outros ?? []) as any[]) {
    if (fora.has(String(o.transaction_id))) continue;
    const k = chaveSumida(String(o.transaction_date), Number(o.amount));
    gemeas.set(k, (gemeas.get(k) ?? 0) + 1);
  }
  const apagar = idsSumidos(
    rows.map((r) => ({ id: String(r.transaction_id), chave: chaveSumida(String(r.transaction_date), Number(r.amount)) })),
    new Set(), gemeas,
  );
  if (apagar.length === 0) return 0;
  const { data, error } = await admin.from("auto_detected_sales").delete()
    .eq("bank_connection_id", conexaoId).in("transaction_id", apagar).select("id");
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
