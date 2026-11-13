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

import { linhasMudadas, type LinhaEntrada } from "./pluggy-linhas.ts";
import { type Existe, parearComSumidas, vereditoDoPar } from "./pluggy-margem.ts";

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
/** 08/11/2026: Cora sends every credit 3h EARLIER (Brazil clock stamped as UTC). Checked on 360
 *  entries of the first Cora seller: 43% landed between 0h and 5h (other banks: 0% to 6%), and
 *  shifting +3h lines them up with his Foco hours. Without the shift, the morning Pix looked like
 *  "before the Foco", was dropped from "caiu" and became calote (R$ 1.193 on 07/11). */
export function horasAtrasoDoBanco(instituicao: string | null | undefined): number {
  const nome = instituicao ?? "";
  if (/pag\s*bank|pagseguro/i.test(nome)) return 6;
  if (/^\s*cora\b/i.test(nome)) return 3;
  return 0;
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
  // 13/11: entries of the window's oldest day wait for the whole read (see pluggy-margem.ts)
  const daMargem = new Map<string, LinhaDoBanco>();
  // 13/11: false when something Pluggy returned could not be written or checked
  let provada = true;
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
      }).filter((l) => l.transaction_date >= dataDe).filter((l) => {
        if (l.transaction_date !== dataDe) return true;
        daMargem.set(l.transaction_id, l);
        return false;
      });
      if (linhas.length > 0) {
        // 08/10/2026: write only what is NEW or CHANGED. Re-saving identical rows on every
        // read was ~50 rewrites per new entry, and each rewrite also fired a realtime event
        // to every open app — the biggest load on the database.
        const ids = linhas.map((l) => l.transaction_id);
        const { data: existentes, error: eLer } = await admin.from("auto_detected_sales")
          .select("transaction_id, amount, description, transaction_date, transacted_at, is_pix, own_transfer, pagador_nome, pagador_doc")
          .in("transaction_id", ids);
        // reading failed → fall back to the old full upsert (never lose an entry). It writes by
        // transaction_id, so it cannot store a copy; but it is not a proven read (13/11)
        if (eLer) { provada = false; console.error("pluggy importar: existentes nao lidas", eLer.message); }
        const aGravar = eLer ? linhas : linhasMudadas(linhas, existentes ?? []);
        if (aGravar.length > 0) {
          const { error } = await admin.from("auto_detected_sales").upsert(aGravar, { onConflict: "transaction_id" });
          // 13/11: an entry that was not written must never be followed by a read stamp
          if (error) { provada = false; console.error("pluggy importar: upsert", error.message); }
          else gravadas += aGravar.length;
        }
      }
      cursor = corpo?.next ? String(corpo.next) : null;
      if (!cursor) { terminou = true; break; }
    }
    if (!terminou) leituraCompleta = false;
  }
  const margem = await gravarMargem(admin, {
    conexaoId, dataDe, horasAtraso: atraso, linhas: [...daMargem.values()], vistos,
    existe: (id) => existeNaPluggy(apiKey, id),
  });
  gravadas += margem.gravadas;
  const removidas = leituraCompleta ? await tirarSumidas(admin, conexaoId, dataDe, vistos, vistosPorChave, () => { provada = false; }) : 0;
  // 05/11 (audit #2): completa = every account read to the end → the caller stamps leitura_ok_em
  // 13/11: and nothing Pluggy returned was left unwritten or unchecked
  const completa = leituraCompleta && provada && margem.aConferir === 0;
  return {
    contas: contas.length, gravadas, pix, removidas, completa,
    margem: { legitimas: margem.legitimas, duplicadas: margem.duplicadas, aConferir: margem.aConferir },
  };
}

type LinhaDoBanco = LinhaEntrada & { user_id: string; bank_connection_id: string };
const CAMPOS_DA_LINHA = "transaction_id, amount, description, transaction_date, transacted_at, is_pix, own_transfer, pagador_nome, pagador_doc";
/** At most this many old ids are asked of Pluggy in one read; the rest waits for the next read. */
export const MAX_CONFERIR = 60;

/** Does this transaction id still exist on Pluggy? Only an explicit answer counts:
 *  200 with that same id = it exists; 404 = it does not; anything else = no answer. */
export async function existeNaPluggy(apiKey: string, id: string): Promise<Existe> {
  try {
    const r = await fetch(`https://api.pluggy.ai/transactions/${encodeURIComponent(id)}`, {
      headers: { "X-API-KEY": apiKey }, signal: AbortSignal.timeout(10000),
    });
    if (r.status === 404) return "nao_existe";
    if (!r.ok) return "sem_resposta";
    // deno-lint-ignore no-explicit-any
    const corpo: any = await r.json().catch(() => null);
    return String(corpo?.id ?? "") === id ? "existe" : "sem_resposta";
  } catch { return "sem_resposta"; }
}

export interface ResultadoDaMargem { gravadas: number; legitimas: number; duplicadas: number; aConferir: number }

/** Writes the entries of the window's OLDEST day (rules and reasons in pluggy-margem.ts).
 *  Nothing is removed. A returned id that is not stored yet is written unless a stored entry with
 *  the very same attributes is missing from this read AND Pluggy confirms that old id is gone.
 *  Whatever cannot be decided, read or written counts in `aConferir`: the caller must not stamp
 *  the read, and the next read tries again. */
// deno-lint-ignore no-explicit-any
type Banco = any;
export async function gravarMargem(admin: Banco, p: {
  conexaoId: string; dataDe: string; horasAtraso: number; linhas: LinhaDoBanco[]; vistos: Set<string>;
  existe: (id: string) => Promise<Existe>;
}): Promise<ResultadoDaMargem> {
  const fim: ResultadoDaMargem = { gravadas: 0, legitimas: 0, duplicadas: 0, aConferir: 0 };
  const { linhas } = p;
  if (linhas.length === 0) return fim;

  // what is stored: the returned ids (wherever they are) and this connection's entries of that day
  const porId: Partial<LinhaEntrada>[] = [];
  let leu = true;
  for (let i = 0; i < linhas.length && leu; i += 100) {
    const { data, error } = await admin.from("auto_detected_sales").select(CAMPOS_DA_LINHA)
      .in("transaction_id", linhas.slice(i, i + 100).map((l) => l.transaction_id));
    if (error) leu = false; else porId.push(...((data ?? []) as Partial<LinhaEntrada>[]));
  }
  const doDia = leu
    ? await admin.from("auto_detected_sales").select(CAMPOS_DA_LINHA).eq("bank_connection_id", p.conexaoId).eq("transaction_date", p.dataDe)
    : { data: null, error: { message: "nao lido" } };
  if (!leu || doDia.error) {
    // Not knowing what is stored, writing could store a copy and skipping could lose a payment:
    // nothing of this day is written now, and the read is not proven. The next read tries again.
    console.error("pluggy margem: guardadas nao lidas, dia fica a conferir", JSON.stringify({ conexao: p.conexaoId, dia: p.dataDe, entradas: linhas.length }));
    fim.aConferir = linhas.length;
    return fim;
  }

  const ja = new Set(porId.map((e) => String(e.transaction_id)));
  const novas = linhas.filter((l) => !ja.has(l.transaction_id));
  const guardadas = ((doDia.data ?? []) as LinhaEntrada[]).map((g) => ({
    ...g, transaction_id: String(g.transaction_id), amount: Number(g.amount), transaction_date: String(g.transaction_date).slice(0, 10), is_pix: !!g.is_pix,
  }));
  const { legitimas, pares } = parearComSumidas(novas, guardadas, p.vistos, p.dataDe, p.horasAtraso);

  const escrever = new Set(legitimas);
  for (let i = 0; i < pares.length; i += 6) {
    const lote = pares.slice(i, i + 6);
    const respostas: Existe[] = i < MAX_CONFERIR
      ? await Promise.all(lote.map((par) => p.existe(par.antiga).catch((): Existe => "sem_resposta")))
      : lote.map((): Existe => "sem_resposta");
    lote.forEach((par, n) => {
      const v = vereditoDoPar(respostas[n] ?? "sem_resposta");
      if (v === "legitima") escrever.add(par.nova);
      else if (v === "duplicada") fim.duplicadas++;
      else fim.aConferir++;
    });
  }
  fim.legitimas = escrever.size;

  const aGravar = [...linhasMudadas(linhas.filter((l) => ja.has(l.transaction_id)), porId), ...novas.filter((l) => escrever.has(l.transaction_id))];
  for (let i = 0; i < aGravar.length; i += 100) {
    const lote = aGravar.slice(i, i + 100);
    const { error } = await admin.from("auto_detected_sales").upsert(lote, { onConflict: "transaction_id" });
    if (error) { fim.aConferir += lote.length; console.error("pluggy importar: upsert (margem)", error.message); }
    else fim.gravadas += lote.length;
  }
  if (fim.duplicadas > 0 || fim.aConferir > 0) {
    // counts only: no amount, name or document
    console.log("pluggy margem", JSON.stringify({ conexao: p.conexaoId, dia: p.dataDe, legitimas: fim.legitimas, duplicadas: fim.duplicadas, a_conferir: fim.aConferir }));
  }
  return fim;
}

/** Entries of this connection, inside the window just read in full, that Pluggy no longer
 *  returns (re-issued with a new id, or deleted by the bank). Only after a COMPLETE read,
 *  never the window's first day (Pluggy filters in UTC), and never if Pluggy returned nothing. */
// deno-lint-ignore no-explicit-any
export async function tirarSumidas(
  admin: any, conexaoId: string, dataDe: string, vistos: Set<string>, vistosPorChave: Map<string, number>,
  falhou?: () => void, // 13/11: a cleaning that could not be done is not a proven read
): Promise<number> {
  if (vistos.size === 0) return 0;
  const { data, error } = await admin.from("auto_detected_sales")
    .select("transaction_id, transaction_date, amount").eq("bank_connection_id", conexaoId).gt("transaction_date", dataDe).eq("status", "pending");
  if (error || !data) { falhou?.(); return 0; }
  const guardados = (data as { transaction_id: string; transaction_date: string; amount: number | string }[])
    .map((r) => ({ id: r.transaction_id, chave: chaveSumida(r.transaction_date, Number(r.amount)) }));
  const sumidas = idsSubstituidos(guardados, vistos, vistosPorChave);
  let n = 0;
  for (let i = 0; i < sumidas.length; i += 100) {
    const lote = sumidas.slice(i, i + 100);
    const { error: eDel } = await admin.from("auto_detected_sales").delete().eq("bank_connection_id", conexaoId).in("transaction_id", lote);
    if (eDel) { falhou?.(); console.error("pluggy sumidas:", eDel.message); break; }
    n += lote.length;
  }
  if (n > 0) console.log("pluggy sumidas removidas", conexaoId, n);
  return n;
}

export const chaveSumida = (dia: string, valor: number) => `${dia}|${valor.toFixed(2)}`;

/** Pure part of tirarSumidas: after a COMPLETE read, stored entries Pluggy no longer returns,
 *  for every day+amount Pluggy DID return (re-issued with a new id).
 *
 *  09/11/2026 (Rick: "o banco está lendo errado"): Mercado Pago gives every transaction a new id
 *  on every read. The old twin of each entry was never removed, because idsSumidos counted the new
 *  twin — already upserted by the time it runs — as "one of this day+amount came back", so it saw
 *  nothing to replace. One Pix of R$ 35,34 was stored 7 times, one per read; a seller's Sunday of
 *  R$ 435 showed R$ 2.283. Rule now: for each day+amount Pluggy returned, keep what it returned and
 *  drop the stored ids it did not (only as many as the returned ones already cover).
 *  A day+amount Pluggy did not return at all is still kept (03/11: partial lists must not wipe days). */
export function idsSubstituidos(guardados: { id: string; chave: string }[], vistos: Set<string>, vistosPorChave: Map<string, number>): string[] {
  // stored entries Pluggy returned in this read, per day+amount
  const cobertas = new Map<string, number>();
  for (const g of guardados) if (vistos.has(g.id)) cobertas.set(g.chave, (cobertas.get(g.chave) ?? 0) + 1);
  // returned entries not stored yet (an upsert that failed): that many old ids may stay in their place
  const folga = new Map<string, number>();
  for (const [k, n] of vistosPorChave) folga.set(k, Math.max(n - (cobertas.get(k) ?? 0), 0));
  const out: string[] = [];
  for (const g of guardados) {
    if (vistos.has(g.id)) continue;
    if (!vistosPorChave.has(g.chave)) continue; // nothing of this day+amount came back: keep
    const sobra = folga.get(g.chave) ?? 0;
    if (sobra > 0) { folga.set(g.chave, sobra - 1); continue; }
    out.push(g.id);
  }
  return out;
}

/** Pure part of apagarTransacoes: ids Pluggy declared gone, removed only while a newer twin
 *  (same day, same amount, stored after them) exists to take their place.
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
