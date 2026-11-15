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
import { bancoComReferencia, type EstadoDaIdentidade, estadoPeloErro, modoDaReferencia, MODOS_DA_IDENTIDADE, type ModosDaIdentidade, reapontamentos, referenciaDeCodigo, referenciasDaLeitura } from "./pluggy-identidade.ts";
import { type Existe, identidadeDoDia, MODO_DA_MARGEM, type ModoDaMargem, parearComSumidas, type TransacaoBruta, vereditoDoPar } from "./pluggy-margem.ts";

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
export async function importarEntradas(
  // deno-lint-ignore no-explicit-any
  admin: any, apiKey: string, itemId: string, userId: string, conexaoId: string, dias = 2,
  modo: ModoDaMargem = MODO_DA_MARGEM, modos: ModosDaIdentidade = MODOS_DA_IDENTIDADE,
) {
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

  // 15/11: for a bank whose own reference survives a re-issue, the payment is recognised by it.
  // "sem_migration" = exactly the behaviour before; "indisponivel" = we could not tell whether the
  // protection exists, so this read writes nothing and stamps nothing (the next one tries again).
  const estado: EstadoDaIdentidade = bancoComReferencia(conexao?.institution_name) ? await estadoDaIdentidade(admin, !!modos.exigida) : "sem_migration";
  const daIdentidade = { reapontadas: 0, observadas: 0, divergentes: 0, adiadas: 0 };
  if (estado === "indisponivel") {
    console.error("pluggy identidade: estado indisponivel, leitura adiada", JSON.stringify({ conexao: conexaoId }));
    return { contas: contas.length, gravadas: 0, pix: 0, removidas: 0, completa: false, margem: { legitimas: 0, duplicadas: 0, aConferir: 0 }, identidade: null };
  }
  const identidade = estado === "ativa";
  const campos = identidade ? CAMPOS_COM_IDENTIDADE : CAMPOS_DA_LINHA;

  let gravadas = 0;
  let pix = 0;
  // 21/10/2026: what Pluggy returned in THIS read (every page of every account).
  const vistos = new Set<string>();
  // 03/11: day|amount of what came back, so a vanished entry is only removed when a re-issued
  // twin (same day, same amount, new id) came in its place
  const vistosPorChave = new Map<string, number>();
  const brutasDaMargem: TransacaoBruta[] = []; // the oldest day as Pluggy sent it (identity fields only are looked at)
  // 13/11: false when something Pluggy returned could not be written or checked
  let provada = true;
  let leituraCompleta = contasRes.ok && contas.length > 0;
  // 15/11: NOTHING is written while pages are still coming. A re-issue can be split between two
  // pages, and the old id of a "new" one can still be on a later page: only the whole list says
  // which ids are gone. So every page of every account is read first.
  const lidas = new Map<string, LinhaDoBanco>();
  for (const conta of contas) {
    let cursor: string | null = null;
    let terminou = false;
    // deno-lint-ignore no-explicit-any
    const creditos: any[] = [];
    for (let pagina = 0; pagina < 5; pagina++) {
      const u = urlTransacoes(String(conta.id), dataDe, cursor);
      const txRes = await fetch(u, { headers: { "X-API-KEY": apiKey }, signal: AbortSignal.timeout(25000) });
      if (!txRes.ok) { console.error("pluggy transactions", txRes.status, conta.id); break; }
      // deno-lint-ignore no-explicit-any
      const corpo: any = await txRes.json().catch(() => ({}));
      // deno-lint-ignore no-explicit-any
      const txs: any[] = corpo?.results ?? [];
      for (const t of txs) {
        if (t?.type !== "CREDIT" || !(Number(t?.amount) > 0) || !t?.id) continue;
        vistos.add(String(t.id));
        if (quandoFoi(t, atraso).dia === dataDe) brutasDaMargem.push(t);
        const k = chaveSumida(quandoFoi(t, atraso).dia, Number(t.amount));
        vistosPorChave.set(k, (vistosPorChave.get(k) ?? 0) + 1);
        creditos.push(t);
      }
      cursor = corpo?.next ? String(corpo.next) : null;
      if (!cursor) { terminou = true; break; }
    }
    if (!terminou) leituraCompleta = false;
    // a reference identifies a payment only if no other transaction of this account has it in this read
    const refs = identidade ? referenciasDaLeitura(creditos) : null;
    if (refs && refs.repetidas > 0) console.log("pluggy identidade: referencia repetida na leitura, ignorada", JSON.stringify({ conexao: conexaoId, repetidas: refs.repetidas }));
    for (const t of creditos) {
      const q = quandoFoi(t, atraso);
      const p = ehPix(t);
      const quem = pagadorDe(t);
      if (p) pix++;
      if (q.dia < dataDe) continue;
      lidas.set(String(t.id), {
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
        ...(refs ? { conta_id: String(conta.id), provedor_ref: refs.porId.get(String(t.id)) ?? null } : {}),
      });
    }
  }

  // 15/11: a re-issued id is pointed back to the entry already stored BEFORE anything else looks
  // at it — from here on it is a known id, on any day of the window
  let naoGravar = new Set<string>();
  if (identidade) {
    const r = await reapontarReemitidas(admin, { conexaoId, userId, linhas: [...lidas.values()], vistos, completa: leituraCompleta, modos });
    daIdentidade.reapontadas = r.reapontadas; daIdentidade.observadas = r.observadas;
    daIdentidade.divergentes = r.divergentes; daIdentidade.adiadas = r.adiar.size;
    naoGravar = r.naoGravar;
    if (r.adiar.size > 0 || r.retidas > 0) provada = false; // something returned was not written: no stamp
  }
  // The rule is APPLIED here only for a reference of the proven kind (providerCode). Then the
  // oldest day is also decided on evidence, so a row that has no reference yet (stored before the
  // migration) cannot be copied during the first days.
  const aplicada = identidade && modos.code === "aplicar" && [...lidas.values()].some((l) => referenciaDeCodigo(l.provedor_ref));
  const modoDaMargem: ModoDaMargem = aplicada ? "aplicar" : modo;

  const daMargem = new Map<string, LinhaDoBanco>();
  const doMeio: LinhaDoBanco[] = [];
  for (const l of lidas.values()) {
    if (naoGravar.has(l.transaction_id)) continue;
    if (l.transaction_date === dataDe) daMargem.set(l.transaction_id, l); else doMeio.push(l);
  }
  // 08/10/2026: write only what is NEW or CHANGED. Re-saving identical rows on every read was
  // ~50 rewrites per new entry, each one also a realtime event to every open app.
  for (let i = 0; i < doMeio.length; i += 100) {
    const linhas = doMeio.slice(i, i + 100);
    const { data: existentes, error: eLer } = await admin.from("auto_detected_sales").select(campos).in("transaction_id", linhas.map((l) => l.transaction_id));
    // reading failed → the old full upsert (never lose an entry). It writes by transaction_id, so
    // it cannot store a copy; but it is not a proven read (13/11)
    if (eLer) { provada = false; console.error("pluggy importar: existentes nao lidas", eLer.message); }
    const aGravar = eLer ? linhas : linhasMudadas(linhas, existentes ?? []);
    if (aGravar.length === 0) continue;
    const { error } = await admin.from("auto_detected_sales").upsert(aGravar, { onConflict: "transaction_id" });
    // 13/11: an entry that was not written must never be followed by a read stamp
    if (error) { provada = false; console.error("pluggy importar: upsert", error.message); }
    else gravadas += aGravar.length;
  }
  const margem = await gravarMargem(admin, {
    conexaoId, dataDe, horasAtraso: atraso, linhas: [...daMargem.values()], vistos,
    existe: (id) => existeNaPluggy(apiKey, id), modo: modoDaMargem, campos, referenciaProva: aplicada,
  });
  // 13/11: does this bank send anything that identifies the payment itself? Counts and change
  // detectors only — no id, amount, name or document.
  if (brutasDaMargem.length > 0 && (bancoComReferencia(conexao?.institution_name) || margem.pares > 0)) {
    console.log("pluggy identidade", JSON.stringify({ conexao: conexaoId, dia: dataDe, ...identidadeDoDia(brutasDaMargem) }));
  }
  gravadas += margem.gravadas;
  const removidas = leituraCompleta ? await tirarSumidas(admin, conexaoId, dataDe, vistos, vistosPorChave, () => { provada = false; }, aplicada) : 0;
  // 05/11 (audit #2): completa = every account read to the end → the caller stamps leitura_ok_em.
  // Where a rule is applied (13/11 oldest day, 15/11 identity): and nothing Pluggy returned was
  // left unwritten or unchecked. Everywhere else the stamp is decided exactly as before.
  const completa = modoDaMargem === "aplicar" ? leituraCompleta && provada && margem.aConferir === 0 : leituraCompleta;
  return {
    contas: contas.length, gravadas, pix, removidas, completa,
    margem: { legitimas: margem.legitimas, duplicadas: margem.duplicadas, aConferir: margem.aConferir },
    identidade: identidade ? daIdentidade : null,
  };
}

type LinhaDoBanco = LinhaEntrada & { user_id: string; bank_connection_id: string };
const CAMPOS_DA_LINHA = "transaction_id, amount, description, transaction_date, transacted_at, is_pix, own_transfer, pagador_nome, pagador_doc";
const CAMPOS_COM_IDENTIDADE = `${CAMPOS_DA_LINHA}, conta_id, provedor_ref`;

/** Can the identity columns of 20261115190000_entradas_identidade_do_provedor.sql be used?
 *  A missing column and a failed query are different answers (estadoPeloErro). */
// deno-lint-ignore no-explicit-any
async function estadoDaIdentidade(admin: any, exigida: boolean): Promise<EstadoDaIdentidade> {
  try {
    const { error } = await admin.from("auto_detected_sales").select("conta_id, provedor_ref, ids_anteriores").limit(1);
    if (error) console.error("pluggy identidade: colunas nao lidas", JSON.stringify({ code: error.code ?? null, exigida }));
    return estadoPeloErro(error, exigida);
  } catch { return "indisponivel"; }
}

/** Entries whose Pluggy id is not stored but whose provider reference is.
 *  - same account, day and amount: the same payment, re-issued. Reference of the proven kind
 *    ("aplicar"): the stored row takes the new id and keeps the old one in ids_anteriores; the row
 *    itself (when it was first seen, what the seller did with it) stays. Other kind ("observar"):
 *    only counted, and written as before.
 *  - another day or amount: recorded in banco_entradas_divergencias and NOT written as an entry —
 *    it is not assumed to be a new payment, and the stored row is not overwritten.
 *  Nothing is pointed back on a list that did not come whole (`completa` false).
 *  `naoGravar` = ids that must not be written in this read; `adiar` (a part of it) = the ones that
 *  could not be checked, pointed back or recorded; `retidas` = divergences recorded and kept out of
 *  the entries. Either way something Pluggy returned was not written, so the read gets no stamp
 *  (13/11: the day is never taken as reconciled over an entry that is not there). */
export async function reapontarReemitidas(
  // deno-lint-ignore no-explicit-any
  admin: any, p: { conexaoId: string; userId: string; linhas: LinhaDoBanco[]; vistos: Set<string>; completa: boolean; modos: ModosDaIdentidade },
) {
  const fim = { reapontadas: 0, observadas: 0, divergentes: 0, retidas: 0, adiar: new Set<string>(), naoGravar: new Set<string>() };
  const comRef = p.linhas.filter((l) => l.provedor_ref && l.conta_id);
  if (comRef.length === 0) return fim;
  const guardadasPorId = new Set<string>();
  // deno-lint-ignore no-explicit-any
  const guardadas: any[] = [];
  for (let i = 0; i < comRef.length; i += 100) {
    const lote = comRef.slice(i, i + 100);
    const a = await admin.from("auto_detected_sales").select("transaction_id").in("transaction_id", lote.map((l) => l.transaction_id));
    const b = a.error ? a : await admin.from("auto_detected_sales")
      .select("transaction_id, conta_id, provedor_ref, transaction_date, amount, ids_anteriores")
      .eq("bank_connection_id", p.conexaoId).in("provedor_ref", lote.map((l) => String(l.provedor_ref)));
    if (a.error || b.error) { // not knowing what is stored, none of these is written now
      console.error("pluggy identidade: guardadas nao lidas", (a.error ?? b.error)?.message);
      for (const l of lote) fim.adiar.add(l.transaction_id);
      continue;
    }
    for (const e of a.data ?? []) guardadasPorId.add(String(e.transaction_id));
    guardadas.push(...(b.data ?? []));
  }
  const novas = comRef.filter((l) => !guardadasPorId.has(l.transaction_id) && !fim.adiar.has(l.transaction_id));
  const { reapontar, divergentes } = reapontamentos(novas, guardadas, p.vistos);
  const linhaDe = (id: string) => p.linhas.find((x) => x.transaction_id === id);

  for (const r of reapontar) {
    const l = linhaDe(r.para);
    if (modoDaReferencia(l?.provedor_ref, p.modos) === "observar") {
      if (l) l.provedor_ref = null; // written as before, WITHOUT the reference (the unique index would refuse it)
      fim.observadas++;
      continue;
    }
    if (!p.completa) { fim.adiar.add(r.para); continue; } // a list still to be completed decides nothing
    const { data, error } = await admin.from("auto_detected_sales").update({ transaction_id: r.para, ids_anteriores: r.anteriores })
      .eq("transaction_id", r.de).eq("bank_connection_id", p.conexaoId).select("transaction_id");
    // no row changed = another import moved that row meanwhile: not ours to write now
    if (error || (data ?? []).length === 0) { fim.adiar.add(r.para); if (error) console.error("pluggy identidade: reapontar", error.message); }
    else fim.reapontadas++;
  }
  for (const d of divergentes) {
    fim.divergentes++;
    if (modoDaReferencia(d.novo.provedor_ref, p.modos) === "observar") continue; // written as before
    const { error } = await admin.from("banco_entradas_divergencias").upsert([{
      user_id: p.userId, bank_connection_id: p.conexaoId, conta_id: d.novo.conta_id, provedor_ref: d.novo.provedor_ref,
      transaction_id_guardado: d.guardado.transaction_id, transaction_id_novo: d.novo.transaction_id,
      data_guardada: String(d.guardado.transaction_date).slice(0, 10), valor_guardado: Number(d.guardado.amount),
      data_nova: d.novo.transaction_date, valor_novo: Number(d.novo.amount),
    }], { onConflict: "bank_connection_id,conta_id,provedor_ref,data_nova,valor_novo", ignoreDuplicates: true });
    if (error) { fim.adiar.add(d.novo.transaction_id); console.error("pluggy identidade: divergencia nao registrada", error.message); }
    else { fim.naoGravar.add(d.novo.transaction_id); fim.retidas++; }
  }
  for (const id of fim.adiar) fim.naoGravar.add(id);
  if (fim.reapontadas + fim.observadas + fim.divergentes + fim.adiar.size > 0) {
    // counts only: no id, reference, amount, name or document
    console.log("pluggy identidade: reemissao", JSON.stringify({
      conexao: p.conexaoId, lista_completa: p.completa, reconhecidas: fim.reapontadas, so_observadas: fim.observadas,
      divergentes: fim.divergentes, adiadas: fim.adiar.size,
    }));
  }
  return fim;
}

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

/** `legitimas`, `duplicadas`, `aConferir` are the verdicts; in "observar" they are what WOULD be
 *  decided, while everything was written as before. `pares` = suspects asked of Pluggy or waiting. */
export interface ResultadoDaMargem { gravadas: number; legitimas: number; duplicadas: number; aConferir: number; pares: number }

/** Writes the entries of the window's OLDEST day (rules and reasons in pluggy-margem.ts).
 *  Nothing is removed. A returned id that is not stored yet is written unless a stored entry with
 *  the very same attributes is missing from this read AND Pluggy confirms that old id is gone.
 *  Whatever cannot be decided, read or written counts in `aConferir`: the caller must not stamp
 *  the read, and the next read tries again. */
// deno-lint-ignore no-explicit-any
type Banco = any;
export async function gravarMargem(admin: Banco, p: {
  conexaoId: string; dataDe: string; horasAtraso: number; linhas: LinhaDoBanco[]; vistos: Set<string>;
  existe: (id: string) => Promise<Existe>; modo?: ModoDaMargem; campos?: string;
  /** 15/11: two entries that BOTH carry a proven reference and were not matched by it are two
   *  payments, however alike. Such a pair is never a suspect: the new one is written. */
  referenciaProva?: boolean;
}): Promise<ResultadoDaMargem> {
  const campos = p.campos ?? CAMPOS_DA_LINHA;
  const fim: ResultadoDaMargem = { gravadas: 0, legitimas: 0, duplicadas: 0, aConferir: 0, pares: 0 };
  const { linhas } = p;
  if (linhas.length === 0) return fim;
  const observar = (p.modo ?? MODO_DA_MARGEM) === "observar";
  const gravar = async (aGravar: LinhaDoBanco[]) => {
    for (let i = 0; i < aGravar.length; i += 100) {
      const lote = aGravar.slice(i, i + 100);
      const { error } = await admin.from("auto_detected_sales").upsert(lote, { onConflict: "transaction_id" });
      if (error) { if (!observar) fim.aConferir += lote.length; console.error("pluggy importar: upsert (margem)", error.message); }
      else fim.gravadas += lote.length;
    }
  };

  // what is stored: the returned ids (wherever they are) and this connection's entries of that day
  const porId: Partial<LinhaEntrada>[] = [];
  let leu = true;
  for (let i = 0; i < linhas.length && leu; i += 100) {
    const { data, error } = await admin.from("auto_detected_sales").select(campos)
      .in("transaction_id", linhas.slice(i, i + 100).map((l) => l.transaction_id));
    if (error) leu = false; else porId.push(...((data ?? []) as Partial<LinhaEntrada>[]));
  }
  // "observar": first write exactly what was written before this change (new or changed rows;
  // everything when the lookup failed). The verdicts below are then only counted.
  if (observar) await gravar(leu ? linhasMudadas(linhas, porId) : linhas);
  const doDia = leu
    ? await admin.from("auto_detected_sales").select(campos).eq("bank_connection_id", p.conexaoId).eq("transaction_date", p.dataDe)
    : { data: null, error: { message: "nao lido" } };
  if (!leu || doDia.error) {
    // Not knowing what is stored, writing could store a copy and skipping could lose a payment:
    // nothing of this day is written now, and the read is not proven. The next read tries again.
    console.error("pluggy margem: guardadas nao lidas, dia fica a conferir", JSON.stringify({ conexao: p.conexaoId, dia: p.dataDe, entradas: linhas.length }));
    if (!observar) fim.aConferir = linhas.length;
    return fim;
  }

  const ja = new Set(porId.map((e) => String(e.transaction_id)));
  const novas = linhas.filter((l) => !ja.has(l.transaction_id));
  const guardadas = ((doDia.data ?? []) as LinhaEntrada[]).map((g) => ({
    ...g, transaction_id: String(g.transaction_id), amount: Number(g.amount), transaction_date: String(g.transaction_date).slice(0, 10), is_pix: !!g.is_pix,
  }));
  let { legitimas, pares } = parearComSumidas(novas, guardadas, p.vistos, p.dataDe, p.horasAtraso);
  if (p.referenciaProva) {
    // new entries WITH a proven reference are compared only with stored ones that have none
    const tem = (e: { provedor_ref?: string | null }) => referenciaDeCodigo(e.provedor_ref);
    const a = parearComSumidas(novas.filter(tem), guardadas.filter((g) => !tem(g)), p.vistos, p.dataDe, p.horasAtraso);
    const usadas = new Set(a.pares.map((par) => par.antiga));
    const b = parearComSumidas(novas.filter((n) => !tem(n)), guardadas.filter((g) => !usadas.has(g.transaction_id)), p.vistos, p.dataDe, p.horasAtraso);
    legitimas = [...a.legitimas, ...b.legitimas]; pares = [...a.pares, ...b.pares];
  }

  fim.pares = pares.length;
  let existem = 0;
  const escrever = new Set(legitimas);
  for (let i = 0; i < pares.length; i += 6) {
    const lote = pares.slice(i, i + 6);
    const respostas: Existe[] = i < MAX_CONFERIR
      ? await Promise.all(lote.map((par) => p.existe(par.antiga).catch((): Existe => "sem_resposta")))
      : lote.map((): Existe => "sem_resposta");
    lote.forEach((par, n) => {
      const v = vereditoDoPar(respostas[n] ?? "sem_resposta");
      if (v === "legitima") { escrever.add(par.nova); existem++; }
      else if (v === "duplicada") fim.duplicadas++;
      else fim.aConferir++;
    });
  }
  fim.legitimas = escrever.size;

  if (!observar) {
    await gravar([...linhasMudadas(linhas.filter((l) => ja.has(l.transaction_id)), porId), ...novas.filter((l) => escrever.has(l.transaction_id))]);
  }
  if (pares.length > 0 || fim.aConferir > 0) {
    // counts only: no id, amount, name or document. `antigas_*` = what Pluggy answered about the old ids
    console.log("pluggy margem", JSON.stringify({
      conexao: p.conexaoId, dia: p.dataDe, modo: observar ? "observar" : "aplicar", novas: novas.length, suspeitas: pares.length,
      antigas_nao_existem: fim.duplicadas, antigas_existem: existem, sem_resposta: fim.aConferir,
      legitimas: fim.legitimas, duplicadas: fim.duplicadas, a_conferir: fim.aConferir,
    }));
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
  // 15/11: with the identity applied, an entry that HAS a provider reference is never removed for
  // being absent from a list: a re-issue is pointed back by reapontarReemitidas, so an absence is
  // a partial list (or a deletion Pluggy must tell us about), not a twin to drop.
  poupaComReferencia = false,
): Promise<number> {
  if (vistos.size === 0) return 0;
  const { data, error } = await admin.from("auto_detected_sales")
    .select(poupaComReferencia ? "transaction_id, transaction_date, amount, provedor_ref" : "transaction_id, transaction_date, amount")
    .eq("bank_connection_id", conexaoId).gt("transaction_date", dataDe).eq("status", "pending");
  if (error || !data) { falhou?.(); return 0; }
  const linhas = data as { transaction_id: string; transaction_date: string; amount: number | string; provedor_ref?: string | null }[];
  const guardados = linhas.map((r) => ({ id: r.transaction_id, chave: chaveSumida(r.transaction_date, Number(r.amount)) }));
  const comReferencia = new Set(linhas.filter((r) => poupaComReferencia && referenciaDeCodigo(r.provedor_ref)).map((r) => r.transaction_id));
  const todas = idsSubstituidos(guardados, vistos, vistosPorChave);
  const sumidas = todas.filter((id) => !comReferencia.has(id));
  if (todas.length > sumidas.length) console.log("pluggy sumidas: com referencia, mantidas", conexaoId, todas.length - sumidas.length);
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
