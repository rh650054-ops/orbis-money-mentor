/* ============================================================
   DEFCON pelo LIVRO-RAZÃO (ADR 0001, Fase 2 — cliente novo)

   Em uma sessão marcada pelo servidor (challenge_sessions.totais_servidor), o app NÃO grava
   mais totais absolutos (bloco, sessão, contadores). Cada toque vira UM lançamento com id
   próprio (venda, Pix depois, gorjeta, abordagem, apagar venda), que vai:
     1. primeiro pro celular (IndexedDB, como hoje: sinal fraco não perde nada);
     2. depois pro servidor pelo carteiro, em ordem, via defcon_lancar — que soma no servidor,
        trava a sessão e nunca aplica o mesmo id duas vezes.
   A TELA continua exatamente igual: o estado otimista é o mesmo de antes; o que muda é só o
   que vai pro banco. Sessões não marcadas seguem o caminho antigo, sem nenhuma diferença.
   ============================================================ */
import { supabase } from "@/integrations/supabase/client";
import { addOfflineRecord, getUnsynced, removeOfflineRecord, type OfflineRecord } from "./offline-db";
import { avisar } from "./avisar";

export type TipoLancamento = "venda" | "venda_tardia" | "gorjeta" | "abordagem" | "apagar_venda";
export type Metodo = "dinheiro" | "pix" | "cartao" | "gorjeta";

export interface Lancamento {
  id: string;                 // id da venda (ou da abordagem): a chave de idempotência no servidor
  tipo: TipoLancamento;
  sessao: string;
  plano: string | null;       // pra somar na tela por cima dos blocos do plano (ainda não subiu)
  bloco: number;
  valor?: number;
  metodo?: Metodo;
  tardia?: boolean;           // apagar: a venda apagada era Pix depois (não contava venda/abordagem)
  produto?: string | null;
  qtd?: number | null;
  criadoEm: string;           // quando aconteceu no celular (a venda offline guarda a sua hora)
}

/* ---------- quais sessões são do livro ---------- */
const CHAVE = "defcon_livro_sessoes";
function lerMarcadas(): string[] {
  try { const v = JSON.parse(localStorage.getItem(CHAVE) ?? "[]"); return Array.isArray(v) ? v.map(String) : []; } catch { return []; }
}
/** O servidor diz se a sessão é dele (coluna totais_servidor). Guardado no aparelho pra reabrir sem sinal. */
export function marcarSessaoLivro(sessao: string, marcada: boolean): void {
  const atual = lerMarcadas().filter((s) => s !== sessao);
  if (marcada) atual.push(sessao);
  try { localStorage.setItem(CHAVE, JSON.stringify(atual.slice(-30))); } catch { /* sem armazenamento: vale a coluna na próxima carga */ }
}
export function usaLivro(sessao: string | null | undefined): boolean {
  return !!sessao && lerMarcadas().includes(sessao);
}

/* ---------- fila ---------- */
const chave = (l: Pick<Lancamento, "tipo" | "id">) => `livro:${l.tipo}:${l.id}`;
const ehLivro = (r: OfflineRecord) => (r.data as { tipo?: string } | undefined)?.tipo === "lancar";

export async function guardarLancamento(l: Lancamento): Promise<void> {
  await addOfflineRecord("pending_venda", {
    id: chave(l), store: "pending_venda", data: { tipo: "lancar", lancamento: l }, created_at: l.criadoEm, synced: false,
  });
}

/** Apagar uma venda. Se ela ainda está na fila, sai dela; e o "apagar" vai pro servidor SEMPRE,
    mesmo assim: a venda pode estar sendo enviada neste exato momento (o carteiro já a pegou), ou
    um envio atrasado na rede pode chegar depois. O servidor encerra o id no "apagar" (lápide), e
    qualquer chegada dessa venda depois disso é recusada: uma venda apagada nunca sobrevive. */
export async function apagarVendaDoLivro(l: Omit<Lancamento, "tipo"> & { tipoVenda: "venda" | "venda_tardia" | "gorjeta" }): Promise<void> {
  const pendente = (await getUnsynced("pending_venda")).find((r) => r.id === chave({ tipo: l.tipoVenda, id: l.id }));
  if (pendente) await removeOfflineRecord("pending_venda", pendente.id);
  const { tipoVenda: _t, ...resto } = l;
  await guardarLancamento({ ...resto, tipo: "apagar_venda" });
}

/** Lançamentos ainda no celular desta sessão (ou deste plano). */
export async function lancamentosPendentes(f: { sessao?: string | null; plano?: string | null }): Promise<Lancamento[]> {
  try {
    return (await getUnsynced("pending_venda")).filter(ehLivro).map((r) => (r.data as { lancamento: Lancamento }).lancamento)
      .filter((l) => (f.sessao && l.sessao === f.sessao) || (f.plano && l.plano === f.plano))
      .sort((a, b) => a.criadoEm.localeCompare(b.criadoEm));
  } catch { return []; }
}

/* ---------- o carteiro ---------- */
// Recusas definitivas: tentar de novo nunca vai dar certo (sessão apagada, dado impossível).
// NUNCA somem em silêncio: ficam guardadas no aparelho e o vendedor é avisado (registrarRecusa).
const DEFINITIVAS = ["sessao_invalida", "sessao_nao_servidor", "valor_invalido", "bloco_invalido", "tipo_invalido", "id_obrigatorio", "origem_invalida", "23503"];

export interface Recusado { lancamento: Lancamento; motivo: string; quando: string; visto: boolean }
const CHAVE_RECUSADOS = "defcon_livro_recusados";
export function lancamentosRecusados(): Recusado[] {
  try { const v = JSON.parse(localStorage.getItem(CHAVE_RECUSADOS) ?? "[]"); return Array.isArray(v) ? (v as Recusado[]) : []; } catch { return []; }
}
function gravarRecusados(v: Recusado[]): void {
  try { localStorage.setItem(CHAVE_RECUSADOS, JSON.stringify(v.slice(-100))); } catch { /* sem espaço: o aviso já foi dado */ }
}
const reais = (v?: number) => (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
function fraseDaRecusa(l: Lancamento): string | null {
  if (l.tipo === "venda" || l.tipo === "venda_tardia") return `Uma venda de ${reais(l.valor)} não foi aceita pelo servidor e NÃO está no seu dia. Registre de novo.`;
  if (l.tipo === "gorjeta") return `Uma gorjeta de ${reais(l.valor)} não foi aceita pelo servidor e NÃO está no seu dia. Registre de novo.`;
  if (l.tipo === "abordagem") return "Uma abordagem não foi aceita pelo servidor e não está no seu dia.";
  return null; // apagar algo que já não existe: nada a refazer
}
function registrarRecusa(l: Lancamento, motivo: string): void {
  const frase = fraseDaRecusa(l);
  gravarRecusados([...lancamentosRecusados(), { lancamento: l, motivo, quando: new Date().toISOString(), visto: !frase }]);
  if (frase) avisar.usuario(frase, motivo, "DEFCON: lançamento recusado");
}
/** Ao abrir o DEFCON: o que foi recusado e o vendedor ainda não viu é avisado de novo (o carteiro
    pode ter rodado com o app em segundo plano, quando o aviso passou sem ninguém ver). */
export function avisarRecusadosNaoVistos(): void {
  const todos = lancamentosRecusados();
  const novos = todos.filter((r) => !r.visto);
  if (!novos.length) return;
  avisar.usuario(novos.length === 1 ? (fraseDaRecusa(novos[0]!.lancamento) ?? "Um registro não foi aceito pelo servidor.")
    : `${novos.length} registros do DEFCON não foram aceitos pelo servidor e NÃO estão no seu dia. Registre de novo.`, "recusados", "DEFCON: recusados");
  gravarRecusados(todos.map((r) => ({ ...r, visto: true })));
}

/** Sobe um lançamento. true = pode sair da fila (aplicado, já aplicado antes, ou impossível). */
export async function subirLancamento(l: Lancamento): Promise<boolean> {
  const rpc = supabase.rpc as unknown as (n: string, a: Record<string, unknown>) => Promise<{ error: { message?: string; code?: string } | null }>;
  const { error } = await rpc.call(supabase, "defcon_lancar", {
    p_id: l.id, p_tipo: l.tipo, p_sessao: l.sessao, p_bloco: l.bloco,
    p_valor: l.valor ?? null, p_metodo: l.metodo ?? null, p_produto: l.produto ?? null, p_qtd: l.qtd ?? null,
    p_split: null, p_origem: "app", p_criado_em: l.criadoEm,
  });
  if (!error) return true;
  const txt = `${error.message ?? ""} ${error.code ?? ""}`;
  if (DEFINITIVAS.some((d) => txt.includes(d))) { registrarRecusa(l, error.message ?? txt.trim()); return true; }
  return false; // sem sinal / servidor fora: fica na fila e sobe depois, com o MESMO id
}

/* ---------- o que ainda não subiu, somado na tela ---------- */
export interface BlocoValores {
  achieved_amount: number; valor_dinheiro: number; valor_cartao: number; valor_pix: number; valor_calote: number; valor_gorjeta: number;
}
const r2 = (n: number) => Math.round(n * 100) / 100;

/** Efeito de um lançamento no dinheiro do bloco (sinal + ou −). Igual ao que o servidor deriva. */
function efeito(l: Lancamento): Partial<BlocoValores> {
  const v = Number(l.valor) || 0;
  const s = l.tipo === "apagar_venda" ? -1 : 1;
  if (l.tipo === "abordagem") return {};
  const m = l.tipo === "gorjeta" ? "gorjeta" : l.tipo === "venda_tardia" ? "pix" : l.metodo ?? "dinheiro";
  if (m === "gorjeta") return { valor_dinheiro: s * v, valor_gorjeta: s * v };
  if (m === "pix") return { valor_pix: s * v };
  if (m === "cartao") return { valor_cartao: s * v };
  return { valor_dinheiro: s * v };
}

/** Blocos do plano (na ordem do DEFCON) + o que ainda está na fila do livro. */
export function aplicarLivroNosBlocos<T extends BlocoValores>(blocos: T[], fila: Lancamento[]): T[] {
  if (!fila.length) return blocos;
  return blocos.map((b, idx) => {
    const meus = fila.filter((l) => l.bloco === idx);
    if (!meus.length) return b;
    const n = { ...b };
    for (const l of meus) {
      const e = efeito(l);
      n.valor_dinheiro = r2(Math.max(0, n.valor_dinheiro + (e.valor_dinheiro ?? 0)));
      n.valor_cartao = r2(Math.max(0, n.valor_cartao + (e.valor_cartao ?? 0)));
      n.valor_pix = r2(Math.max(0, n.valor_pix + (e.valor_pix ?? 0)));
      n.valor_gorjeta = r2(Math.max(0, (n.valor_gorjeta || 0) + (e.valor_gorjeta ?? 0)));
    }
    n.achieved_amount = r2(n.valor_dinheiro + n.valor_cartao + n.valor_pix + n.valor_calote);
    return n;
  });
}

/** Vendas e abordagens por bloco que ainda não subiram (venda conta 1 venda + 1 abordagem;
    Pix depois e gorjeta não contam; apagar desconta o que a venda contava). */
export function contadoresDoLivro(fila: Lancamento[]): Map<number, { vendas: number; abordagens: number }> {
  const m = new Map<number, { vendas: number; abordagens: number }>();
  for (const l of fila) {
    const c = m.get(l.bloco) ?? { vendas: 0, abordagens: 0 };
    if (l.tipo === "venda") { c.vendas += 1; c.abordagens += 1; }
    else if (l.tipo === "abordagem") c.abordagens += 1;
    else if (l.tipo === "apagar_venda" && !l.tardia && l.metodo !== "gorjeta") { c.vendas -= 1; c.abordagens -= 1; }
    m.set(l.bloco, c);
  }
  return m;
}

/** As vendas da fila no formato de linha (pra lista de vendas da tela). */
export function vendasDoLivro(fila: Lancamento[], usuario: string): Record<string, unknown>[] {
  const apagadas = new Set(fila.filter((l) => l.tipo === "apagar_venda").map((l) => l.id));
  return fila.filter((l) => (l.tipo === "venda" || l.tipo === "venda_tardia" || l.tipo === "gorjeta") && !apagadas.has(l.id)).map((l) => ({
    id: l.id, user_id: usuario, session_id: l.sessao, block_index: l.bloco, amount: l.valor,
    method: l.tipo === "gorjeta" ? "gorjeta" : l.tipo === "venda_tardia" ? "pix" : l.metodo, late: l.tipo === "venda_tardia",
    created_at: l.criadoEm, ...(l.produto ? { product_id: l.produto, qty: l.qtd ?? 1 } : {}),
  }));
}

/** "Como recebeu" / divisão por forma de pagamento: pelo servidor, bloco a bloco, com id próprio.
    Retorna false quando a sessão desse bloco não é do livro (aí vale o caminho antigo). */
export async function redistribuirBloco(blocoId: string, split: { dinheiro: number; cartao: number; pix: number; calote: number }): Promise<boolean> {
  const rpc = supabase.rpc as unknown as (n: string, a: Record<string, unknown>) => Promise<{ data: unknown; error: { message?: string } | null }>;
  const { data, error } = await rpc.call(supabase, "defcon_redistribuir_bloco", {
    p_id: globalThis.crypto.randomUUID(), p_bloco_id: blocoId, p_split: split,
  });
  if (error) {
    // the ledger migration is not in this database yet: nothing is a ledger session, today's path
    if (/defcon_redistribuir_bloco|PGRST202|Could not find the function/i.test(`${error.message ?? ""} ${(error as { code?: string }).code ?? ""}`)) return false;
    throw new Error(error.message?.includes("redistribuicao_muda_total") ? "valores_mudaram" : (error.message ?? "erro"));
  }
  return !!(data as { livro?: boolean } | null)?.livro;
}
