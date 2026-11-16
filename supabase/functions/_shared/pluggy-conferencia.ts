// Vant — READ-ONLY check of stored bank entries against Pluggy (16/11/2026, owner's decision 3).
// Pure: everything it touches comes through `Portas`, and no port can write. Used by
// pluggy-conferir and by vitest.
//
// Why: copies of Mercado Pago payments were stored while Pluggy re-issued their ids. Before any of
// them is taken out, each pair (the entry that would go, the entry that stays) needs evidence of
// its own. This produces that evidence and classifies the pair. It decides nothing and removes
// nothing; a 404 alone never makes a pair approvable.
//
// The report carries Pluggy transaction ids, days and amounts (needed to act on a pair). It never
// carries names, documents, descriptions, credentials or a provider reference in full — a
// reference appears only as its kind and a change detector (resumoDeIds).
import { ehPix, horasAtrasoDoBanco, pagadorDe, quandoFoi } from "./pluggy-entradas.ts";
import { type Existe, impressao, resumoDeIds } from "./pluggy-margem.ts";

export interface Guardada {
  transaction_id: string; amount: number; description: string | null; transaction_date: string; transacted_at: string | null;
  is_pix: boolean; pagador_nome?: string | null; pagador_doc?: string | null;
  status: string | null; daily_sale_id: string | null; created_at: string;
  conta_id?: string | null; provedor_ref?: string | null;
}
export interface DoExtrato {
  id: string; conta: string; ref: { tipo: "providerCode" | "providerId"; valor: string } | null;
  amount: number; description: string | null; transaction_date: string; transacted_at: string | null;
  is_pix: boolean; pagador_nome: string | null; pagador_doc: string | null;
}
export type NaPluggy = "listada" | Existe;
export type Classe = "comprovada_por_id" | "comprovada_por_contagem" | "ambigua";
export interface Condicoes {
  conta_identificada: boolean;   // 1. connection and account of both entries known and equal
  atributos_iguais: boolean;     // 2. every stored attribute equal (day, amount, description, Pix, instant, payer)
  copia_tardia: boolean;         // 3. one of the two was created on/after day+3 (Brasília): the copy
  sai_nao_existe: boolean;       // 4a. Pluggy does not have the id that would go
  fica_existe: boolean;          // 4b. Pluggy has the id that stays
  contagem_confere: boolean;     // 5. whole statement, and it lists fewer payments like this than are stored
  nao_usada: boolean;            // 6. the entry that would go was not used (status, linked sale, review decision)
}
export interface ParConferido {
  conexao: string; conta: string | null; dia: string; valor: number;
  sai: { transaction_id: string; criada_em: string; na_pluggy: NaPluggy };
  fica: { transaction_id: string; criada_em: string; na_pluggy: NaPluggy; referencia: { tipo: string; resumo: string } | null };
  contagem: { guardadas: number; no_extrato: number };
  condicoes: Condicoes; classe: Classe; motivos: string[];
}
/** One movement of the account (credit or debit) with the balance the provider reports after it. */
export interface Movimento { dia: string; valor: number; saldo: number | null }
export type EstadoDoSaldo = "ok" | "quebrada" | "indisponivel";

/** Is the statement whole? "The request ended well" does not say so: Pluggy has returned lists that
 *  end normally and lack payments. When the provider reports the balance after each movement, the
 *  movements must chain: each one starts from a balance another one ended on. A missing movement
 *  leaves a gap, whatever the order (Mercado Pago sends no time of day, so order is unknown).
 *  `quebras` = gaps; the one movement nothing precedes (the start of the window) is not a gap.
 *  Fewer than 90% of the movements with a balance: "indisponivel" — completeness NOT proven. */
export function cadeiaDeSaldo(movs: Movimento[]): { estado: EstadoDoSaldo; total: number; com_saldo: number; quebras: number; quebrasPorDia: Map<string, number> } {
  const com = movs.filter((m) => typeof m.saldo === "number" && Number.isFinite(m.saldo) && m.valor !== 0);
  const fim = { estado: "indisponivel" as EstadoDoSaldo, total: movs.length, com_saldo: com.length, quebras: 0, quebrasPorDia: new Map<string, number>() };
  if (movs.length === 0 || com.length < movs.length * 0.9) return fim;
  const c = (n: number) => Math.round(n * 100);
  const chegadas = new Map<number, number>(); // balance after a movement → how many movements ended there
  for (const m of com) chegadas.set(c(m.saldo as number), (chegadas.get(c(m.saldo as number)) ?? 0) + 1);
  const soltas: Movimento[] = []; // movements that start from a balance no other one ended on
  for (const m of [...com].sort((a, b) => a.dia.localeCompare(b.dia))) {
    const antes = c((m.saldo as number) - m.valor);
    const n = chegadas.get(antes) ?? 0;
    if (n > 0) chegadas.set(antes, n - 1); else soltas.push(m);
  }
  soltas.shift(); // the earliest one is where the window starts
  for (const m of soltas) fim.quebrasPorDia.set(m.dia, (fim.quebrasPorDia.get(m.dia) ?? 0) + 1);
  fim.quebras = soltas.length;
  fim.estado = soltas.length === 0 ? "ok" : "quebrada";
  return fim;
}

export interface ResumoDoDia {
  dia: string; guardadas: number; no_extrato: number; extrato_completo: boolean;
  valor_guardado: number; valor_no_extrato: number;
  extrato_ids: string;            // change detector of the ids Pluggy listed for the day (compare two runs)
  guardadas_listadas: number; guardadas_inexistentes: number; guardadas_sem_resposta: number;
  saldo: EstadoDoSaldo; quebras_de_saldo: number; // gaps in the balance chain on this day or the next
  comprovadas_por_id: number; comprovadas_por_contagem: number; ambiguas: number;
  valor_por_id: number; valor_por_contagem: number; valor_ambiguo: number;
  sem_extrato: number;   // stored entries like which the statement lists none: nothing to compare with
  faltando: number;      // payments the statement lists and are NOT stored
}

/** One Pluggy credit as the importer would store it (same derivation, so both sides compare equal). */
// deno-lint-ignore no-explicit-any
export function linhaDoExtrato(t: any, conta: string, horasAtraso: number): DoExtrato {
  const q = quandoFoi(t, horasAtraso);
  const quem = pagadorDe(t);
  const texto = (v: unknown) => (typeof v === "string" && v.trim() !== "") || typeof v === "number" ? String(v).trim() : null;
  const code = texto(t?.providerCode); const id = texto(t?.providerId);
  return {
    id: String(t.id), conta, ref: code ? { tipo: "providerCode", valor: code } : id ? { tipo: "providerId", valor: id } : null,
    amount: Number(t.amount), description: t?.description ?? null, transaction_date: q.dia, transacted_at: q.instante,
    is_pix: ehPix(t), pagador_nome: quem.nome, pagador_doc: quem.doc,
  };
}

const curto = (v: string | null | undefined) => (v ? String(v).slice(0, 8) : null);
const diaBRT = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date(iso));
const maisDias = (dia: string, n: number) => new Date(Date.parse(`${dia}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

/** One connection-day. `existe`: what Pluggy answered, one by one, about stored ids it did not list. */
export function conferirDia(p: {
  conexao: string; dia: string; guardadas: Guardada[]; extrato: DoExtrato[]; extratoCompleto: boolean;
  contas: string[]; existe: Map<string, Existe>; comRevisao: Set<string> | null;
  /** the balance chain of the window, and whether the count may be trusted without it */
  saldo?: { estado: EstadoDoSaldo; quebras: number }; exigirSaldo?: boolean;
}): { pares: ParConferido[]; resumo: ResumoDoDia } {
  const doDia = p.extrato.filter((e) => e.transaction_date === p.dia);
  const listadas = new Map(p.extrato.map((e) => [e.id, e]));
  const guardadas = p.guardadas.filter((g) => String(g.transaction_date).slice(0, 10) === p.dia);
  const grupos = new Map<string, { g: Guardada[]; e: DoExtrato[] }>();
  const grupo = (k: string) => { let x = grupos.get(k); if (!x) { x = { g: [], e: [] }; grupos.set(k, x); } return x; };
  for (const g of guardadas) grupo(impressao({ ...g, amount: Number(g.amount), is_pix: !!g.is_pix })).g.push(g);
  for (const e of doDia) grupo(impressao({ ...e, transaction_id: e.id })).e.push(e);

  const naPluggy = (g: Guardada): NaPluggy => listadas.has(g.transaction_id) ? "listada" : (p.existe.get(g.transaction_id) ?? "sem_resposta");
  const viva = (g: Guardada) => { const s = naPluggy(g); return s === "listada" || s === "existe"; };
  // a review decision counts as use; if the decisions could not be read, every entry counts as used
  const usada = (g: Guardada) => (g.status ?? "pending") !== "pending" || g.daily_sale_id != null || p.comRevisao === null || p.comRevisao.has(g.transaction_id);
  const contaDe = (g: Guardada) => listadas.get(g.transaction_id)?.conta ?? g.conta_id ?? (p.contas.length === 1 ? p.contas[0] ?? null : null);

  const saldo = p.saldo ?? { estado: "indisponivel" as EstadoDoSaldo, quebras: 0 };
  // the count is evidence only from a statement proven whole: every page read AND the balance chain
  // without a gap around this day (or, by explicit choice, without that second proof)
  const extratoProvado = p.extratoCompleto && (p.exigirSaldo === false || (saldo.estado !== "indisponivel" && saldo.quebras === 0));
  const soma = (xs: { amount: number }[]) => Math.round(xs.reduce((t, x) => t + Number(x.amount), 0) * 100) / 100;
  const pares: ParConferido[] = [];
  const r: ResumoDoDia = {
    dia: p.dia, guardadas: guardadas.length, no_extrato: doDia.length, extrato_completo: p.extratoCompleto,
    valor_guardado: soma(guardadas), valor_no_extrato: soma(doDia), extrato_ids: resumoDeIds(doDia.map((e) => e.id)),
    guardadas_listadas: guardadas.filter((g) => naPluggy(g) === "listada").length,
    guardadas_inexistentes: guardadas.filter((g) => naPluggy(g) === "nao_existe").length,
    guardadas_sem_resposta: guardadas.filter((g) => naPluggy(g) === "sem_resposta").length,
    saldo: saldo.estado === "indisponivel" ? "indisponivel" : saldo.quebras === 0 ? "ok" : "quebrada", quebras_de_saldo: saldo.quebras,
    comprovadas_por_id: 0, comprovadas_por_contagem: 0, ambiguas: 0, valor_por_id: 0, valor_por_contagem: 0, valor_ambiguo: 0, sem_extrato: 0, faltando: 0,
  };
  for (const { g, e } of grupos.values()) {
    if (e.length > g.length) r.faltando += e.length - g.length;
    if (g.length <= e.length) continue;
    if (e.length === 0) { r.sem_extrato += g.length; continue; }
    // who stays: what Pluggy still has, then what was used, then the oldest; the rest would go
    const ordem = [...g].sort((a, b) => Number(viva(b)) - Number(viva(a)) || Number(usada(b)) - Number(usada(a)) || a.created_at.localeCompare(b.created_at));
    const ficam = ordem.slice(0, e.length);
    ordem.slice(e.length).forEach((sai, i) => {
      const fica = ficam[i % ficam.length] as Guardada;
      const conta = contaDe(fica);
      const ref = listadas.get(fica.transaction_id)?.ref ?? null;
      const c: Condicoes = {
        conta_identificada: conta != null && contaDe(sai) === conta,
        atributos_iguais: impressao({ ...sai, amount: Number(sai.amount), is_pix: !!sai.is_pix }) === impressao({ ...fica, amount: Number(fica.amount), is_pix: !!fica.is_pix }),
        copia_tardia: [sai, fica].some((x) => diaBRT(x.created_at) >= maisDias(p.dia, 3)),
        sai_nao_existe: naPluggy(sai) === "nao_existe",
        fica_existe: viva(fica),
        contagem_confere: extratoProvado,
        nao_usada: !usada(sai),
      };
      const motivos = (Object.keys(c) as (keyof Condicoes)[]).filter((k) => !c[k] && k !== "fica_existe");
      // without the id that stays: only the count speaks, and only when Pluggy is SURE that id is gone too
      const soContagem = !c.fica_existe && naPluggy(fica) === "nao_existe";
      if (!c.fica_existe && !soContagem) motivos.push("fica_existe");
      const classe: Classe = motivos.length > 0 ? "ambigua" : c.fica_existe ? "comprovada_por_id" : "comprovada_por_contagem";
      const valor = Number(sai.amount);
      if (classe === "comprovada_por_id") { r.comprovadas_por_id++; r.valor_por_id += valor; }
      else if (classe === "comprovada_por_contagem") { r.comprovadas_por_contagem++; r.valor_por_contagem += valor; }
      else { r.ambiguas++; r.valor_ambiguo += valor; }
      pares.push({
        conexao: p.conexao.slice(0, 8), conta: curto(conta), dia: p.dia, valor,
        sai: { transaction_id: sai.transaction_id, criada_em: sai.created_at, na_pluggy: naPluggy(sai) },
        fica: { transaction_id: fica.transaction_id, criada_em: fica.created_at, na_pluggy: naPluggy(fica), referencia: ref ? { tipo: ref.tipo, resumo: resumoDeIds([ref.valor]) } : null },
        contagem: { guardadas: g.length, no_extrato: e.length },
        condicoes: c, classe, motivos,
      });
    });
  }
  for (const k of ["valor_por_id", "valor_por_contagem", "valor_ambiguo"] as const) r[k] = Math.round(r[k] * 100) / 100;
  return { pares, resumo: r };
}

/** Everything the check may do. There is no way to write through it. */
export interface Portas {
  conexao(id: string): Promise<{ id: string; item_id: string; institution_name: string | null } | null>;
  contas(itemId: string): Promise<string[] | null>;                                       // BANK accounts; null = could not be read
  /** credits of the window as entries, plus EVERY movement (credits and debits) with its balance */
  extrato(conta: string, de: string, ate: string, horasAtraso: number): Promise<{ txs: DoExtrato[]; completo: boolean; movimentos?: Movimento[] }>;
  guardadas(conexaoId: string, de: string, ate: string): Promise<Guardada[] | null>;
  comRevisao(ids: string[]): Promise<Set<string> | null>;                                 // ids that have a review decision
  existe(id: string): Promise<Existe>;
}
export const MAX_DIAS = 7;
export const MAX_PERGUNTAS = 400; // ids asked of Pluggy one by one in a call; the rest stays "sem_resposta"

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DIA = /^\d{4}-\d{2}-\d{2}$/;

export async function conferirConexao(portas: Portas, pedido: { conexao?: unknown; de?: unknown; ate?: unknown; exigir_saldo?: unknown }) {
  const conexaoId = String(pedido.conexao ?? ""); const de = String(pedido.de ?? ""); const ate = String(pedido.ate ?? "");
  if (!UUID.test(conexaoId) || !DIA.test(de) || !DIA.test(ate) || de > ate || maisDias(de, MAX_DIAS - 1) < ate) {
    return { erro: "pedido_invalido" as const, detalhe: `conexao (uuid), de e ate (AAAA-MM-DD), no maximo ${MAX_DIAS} dias` };
  }
  const con = await portas.conexao(conexaoId);
  if (!con) return { erro: "conexao_nao_encontrada" as const };
  const contas = await portas.contas(con.item_id);
  const guardadas = await portas.guardadas(conexaoId, de, ate);
  if (!contas || !guardadas) return { erro: "leitura_falhou" as const, detalhe: !contas ? "contas na Pluggy" : "entradas guardadas" };

  const atraso = horasAtrasoDoBanco(con.institution_name);
  const extrato: DoExtrato[] = [];
  let completo = contas.length > 0;
  // the balance chain, account by account; any account without it leaves the whole check without it
  const saldoGeral = { estado: "ok" as EstadoDoSaldo, total: 0, com_saldo: 0, quebras: 0 };
  const quebrasPorDia = new Map<string, number>();
  for (const conta of contas) { // a day before and after: Pluggy filters in UTC, the days here are Brasília's
    const e = await portas.extrato(conta, maisDias(de, -1), maisDias(ate, 1), atraso);
    extrato.push(...e.txs);
    if (!e.completo) completo = false;
    const cadeia = cadeiaDeSaldo(e.movimentos ?? []);
    saldoGeral.total += cadeia.total; saldoGeral.com_saldo += cadeia.com_saldo; saldoGeral.quebras += cadeia.quebras;
    if (cadeia.estado === "indisponivel") saldoGeral.estado = "indisponivel";
    else if (cadeia.estado === "quebrada" && saldoGeral.estado === "ok") saldoGeral.estado = "quebrada";
    for (const [d, n] of cadeia.quebrasPorDia) quebrasPorDia.set(d, (quebrasPorDia.get(d) ?? 0) + n);
  }
  if (contas.length === 0) saldoGeral.estado = "indisponivel";
  const exigirSaldo = pedido.exigir_saldo !== false;
  const listadas = new Set(extrato.map((e) => e.id));
  const aPerguntar = guardadas.filter((g) => !listadas.has(g.transaction_id)).map((g) => g.transaction_id);
  const existe = new Map<string, Existe>();
  for (let i = 0; i < Math.min(aPerguntar.length, MAX_PERGUNTAS); i += 6) {
    const lote = aPerguntar.slice(i, Math.min(i + 6, MAX_PERGUNTAS));
    const respostas = await Promise.all(lote.map((id) => portas.existe(id).catch((): Existe => "sem_resposta")));
    lote.forEach((id, n) => existe.set(id, respostas[n] ?? "sem_resposta"));
  }
  const comRevisao = await portas.comRevisao(guardadas.map((g) => g.transaction_id));

  const dias: ResumoDoDia[] = [];
  const pares: ParConferido[] = [];
  for (let dia = de; dia <= ate; dia = maisDias(dia, 1)) {
    // a gap on the next day may be a movement missing at the end of this one
    const quebras = (quebrasPorDia.get(dia) ?? 0) + (quebrasPorDia.get(maisDias(dia, 1)) ?? 0);
    const d = conferirDia({ conexao: conexaoId, dia, guardadas, extrato, extratoCompleto: completo, contas, existe, comRevisao, saldo: { estado: saldoGeral.estado, quebras }, exigirSaldo });
    dias.push(d.resumo); pares.push(...d.pares);
  }
  return {
    conexao: conexaoId.slice(0, 8), banco: con.institution_name, contas: contas.length, de, ate,
    extrato_completo: completo, saldo: saldoGeral, exigiu_saldo: exigirSaldo, perguntadas_por_id: existe.size, limite_de_perguntas_atingido: aPerguntar.length > MAX_PERGUNTAS,
    revisoes_lidas: comRevisao !== null, gerado_em: new Date().toISOString(), dias, pares,
  };
}
