/* ============================================================
   DEFCON QUE FUNCIONA SEM SINAL (Rick, 19/10/2026)

   Antes a venda só ia pra fila do celular DEPOIS que a internet dava erro. Na rua o
   problema é sinal fraco: a internet não dá erro, fica pendurada (até 20s por pedido,
   ~10 pedidos por venda). Fechou o app nesse meio-tempo = venda perdida.

   Agora:
   • toda escrita do DEFCON vai PRIMEIRO pro celular (IndexedDB) e só depois o
     "carteiro" (offline-sync) leva pro servidor, em ordem, uma de cada vez;
   • o sinal é testado de verdade (um pedido de 4s ao servidor), não pelo aviso do
     celular, que diz "online" com 1 tracinho;
   • o DEFCON em andamento guarda um RETRATO no aparelho: reabrir sem sinal mostra
     o dia de onde parou, somando o que ainda está na fila.
   ============================================================ */
import { addOfflineRecord, getUnsynced, type OfflineRecord } from "./offline-db";
import { avisar } from "./avisar";

/* ---------- sinal de verdade ---------- */

const URL_SUPABASE = (import.meta.env?.VITE_SUPABASE_URL as string | undefined) ?? "";
const CHAVE_SUPABASE = (import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) ?? "";
let ultimoTeste: { em: number; ok: boolean } | null = null;

/** Responde em até `prazoMs` se dá pra falar com o servidor. Guarda o resultado por 15s. */
export async function temSinal(prazoMs = 4000): Promise<boolean> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return false;
  if (ultimoTeste && Date.now() - ultimoTeste.em < 15_000) return ultimoTeste.ok;
  if (!URL_SUPABASE || typeof fetch === "undefined") return true; // sem como testar: confia no celular
  const ctl = new AbortController();
  const alarme = setTimeout(() => ctl.abort(), prazoMs);
  let ok = false;
  try {
    const r = await fetch(`${URL_SUPABASE}/auth/v1/health`, { headers: { apikey: CHAVE_SUPABASE }, signal: ctl.signal, cache: "no-store" });
    ok = r.ok;
  } catch { ok = false; } finally { clearTimeout(alarme); }
  ultimoTeste = { em: Date.now(), ok };
  return ok;
}
/** O carteiro conseguiu (ou não) falar com o servidor: atualiza o teste sem gastar pedido. */
export function registrarSinal(ok: boolean): void { ultimoTeste = { em: Date.now(), ok }; }

/* ---------- escritas que não são venda (bloco, sessão, contadores) ---------- */

export type TabelaFila = "challenge_sessions" | "hourly_goal_blocks";

/** Guarda uma alteração de linha pra subir depois. Várias alterações na mesma linha
 *  se juntam (a mais nova vence campo a campo), então a ordem nunca se perde. */
export async function filaAtualizar(tabela: TabelaFila, id: string, patch: Record<string, unknown>): Promise<void> {
  const chave = `patch:${tabela}:${id}`;
  try {
    const atual = (await getUnsynced("pending_defcon")).find((r) => r.id === chave);
    const anterior = (atual?.data?.patch as Record<string, unknown> | undefined) ?? {};
    await addOfflineRecord("pending_defcon", {
      id: chave, store: "pending_defcon", created_at: atual?.created_at ?? new Date().toISOString(), synced: false,
      data: { type: "patch", tabela, linha: id, patch: { ...anterior, ...patch } },
    });
  } catch (e) { avisar.erro(`fila: guardar alteração em ${tabela}`, e); }
}

/** Abordagens/vendas do bloco (challenge_blocks) — valor absoluto, a última vence. */
export async function filaContadoresBloco(p: {
  session_id: string; user_id: string; block_index: number; approaches_count: number;
  sales_count?: number; ended_at?: string; status?: string;
}): Promise<void> {
  const chave = `contadores:${p.session_id}:${p.block_index}`;
  try {
    const atual = (await getUnsynced("pending_defcon")).find((r) => r.id === chave);
    const anterior = (atual?.data?.payload as Record<string, unknown> | undefined) ?? {};
    await addOfflineRecord("pending_defcon", {
      id: chave, store: "pending_defcon", created_at: atual?.created_at ?? new Date().toISOString(), synced: false,
      data: { type: "contadores", payload: { ...anterior, ...p } },
    });
  } catch (e) { avisar.erro("fila: guardar abordagens do bloco", e); }
}

/* ---------- o que ainda está na fila (pra tela somar) ---------- */

export interface BlocoNaFila {
  id: string; achieved_amount: number; valor_dinheiro: number; valor_cartao: number;
  valor_pix: number; valor_calote: number; valor_gorjeta: number;
}
export interface FilaDoDia {
  blocos: Map<string, BlocoNaFila>;
  vendas: Record<string, unknown>[];
  totalSessao: number | null;
  contadores: Map<number, { approaches_count: number; sales_count?: number }>;
}

/** Lê a fila do celular e separa o que é desta sessão/plano. */
export async function lerFilaDoDia(planId: string | null, sessionId: string | null): Promise<FilaDoDia> {
  const fila: FilaDoDia = { blocos: new Map(), vendas: [], totalSessao: null, contadores: new Map() };
  try {
    const [blocos, vendas, defcon] = await Promise.all([
      getUnsynced("pending_sales"), getUnsynced("pending_venda"), getUnsynced("pending_defcon"),
    ]);
    for (const r of blocos) {
      const d = r.data as Record<string, unknown>;
      if (planId && d.plan_id === planId) fila.blocos.set(String(d.block_id), d as unknown as BlocoNaFila & { id: string });
    }
    for (const r of vendas) {
      const d = r.data as Record<string, unknown>;
      const linha = d.linha as Record<string, unknown> | undefined;
      if (d.tipo === "venda" && linha && linha.session_id === sessionId) fila.vendas.push(linha);
      if (d.tipo === "total_sessao" && d.session_id === sessionId) fila.totalSessao = Number(d.total_sold) || 0;
    }
    for (const r of defcon) {
      const d = r.data as Record<string, unknown>;
      const p = d.payload as Record<string, unknown> | undefined;
      if (d.type === "contadores" && p && p.session_id === sessionId) {
        fila.contadores.set(Number(p.block_index), { approaches_count: Number(p.approaches_count) || 0, sales_count: p.sales_count == null ? undefined : Number(p.sales_count) });
      }
    }
  } catch (e) { avisar.erro("fila: ler o que falta subir", e); }
  return fila;
}

/** Blocos do servidor + a versão mais nova que está na fila (a da fila é sempre mais nova). */
export function aplicarFilaNosBlocos<T extends { id: string }>(blocos: T[], fila: Map<string, BlocoNaFila>): T[] {
  return blocos.map((b) => {
    const f = fila.get(b.id);
    if (!f) return b;
    return {
      ...b,
      achieved_amount: Number(f.achieved_amount) || 0, valor_dinheiro: Number(f.valor_dinheiro) || 0,
      valor_cartao: Number(f.valor_cartao) || 0, valor_pix: Number(f.valor_pix) || 0,
      valor_calote: Number(f.valor_calote) || 0, valor_gorjeta: Number(f.valor_gorjeta) || 0,
    };
  });
}

/** Lista de vendas do servidor + as que ainda não subiram (sem repetir), em ordem de hora. */
export function juntarVendas<T extends { id?: unknown; created_at?: unknown }>(servidor: T[], fila: Record<string, unknown>[]): T[] {
  const ids = new Set(servidor.map((s) => String(s.id)));
  const novas = fila.filter((v) => !ids.has(String(v.id))) as unknown as T[];
  return [...servidor, ...novas].sort((a, b) => String(a.created_at ?? "").localeCompare(String(b.created_at ?? "")));
}

/** Quantos itens ainda esperam sinal (pra tarja da tela). */
export async function contarPendentes(): Promise<number> {
  try {
    const [a, b, c, d] = await Promise.all([
      getUnsynced("pending_sales"), getUnsynced("pending_venda"), getUnsynced("pending_defcon"), getUnsynced("pending_approaches"),
    ]);
    const vendas = b.filter((r: OfflineRecord) => (r.data as { tipo?: string }).tipo === "venda").length;
    // vendas são o que o vendedor entende; o resto (bloco, total, contadores) só conta se não houver venda
    return vendas > 0 ? vendas : a.length + c.length + d.length + b.length;
  } catch { return 0; }
}

/* ---------- retrato do DEFCON em andamento ---------- */

export interface RetratoDefcon {
  salvo_em: string;
  data: string;               // dia da sessão (pode ser ontem, na madrugada)
  planId: string;
  dailyGoal: number;
  sessionId: string | null;
  sessionStartedAt: string | null;
  fase: string;
  blocos: { id: string; hour_index: number; hour_label: string; target_amount: number; achieved_amount: number; is_completed: boolean;
    valor_dinheiro: number; valor_cartao: number; valor_pix: number; valor_calote: number; valor_gorjeta: number }[];
  blocoAtual: number;
  blocoIniciouEm: string | null;
  pausaIniciouEm: string | null;
  pausaDuracao: number;
  blocoRestanteNaPausa: number;
  abordagensBloco: number;
  vendasBloco: number;
  abordagensTotal: number;
  vendasTotal: number;
}

const chaveRetrato = (uid: string) => `orbis_defcon_retrato_${uid}`;

export function salvarRetrato(uid: string, r: RetratoDefcon): void {
  try { localStorage.setItem(chaveRetrato(uid), JSON.stringify(r)); } catch (e) { avisar.silencioso("fila: guardar retrato do DEFCON", e); }
}
export function lerRetrato(uid: string): RetratoDefcon | null {
  try {
    const raw = localStorage.getItem(chaveRetrato(uid));
    return raw ? (JSON.parse(raw) as RetratoDefcon) : null;
  } catch { return null; }
}
/** Retrato serve se for de hoje — ou de ontem com o DEFCON ainda rodando na madrugada. */
export function retratoValido(r: RetratoDefcon | null, hoje: string, ontem: string, madrugada: boolean): r is RetratoDefcon {
  if (!r) return false;
  if (r.data === hoje) return true;
  return madrugada && r.data === ontem && ["running", "break", "block_report", "lunch_pause"].includes(r.fase);
}
/** Tem DEFCON rodando guardado no aparelho? (o aviso de "sem internet" manda pra ele) */
export function temDefconRodando(uid: string | null | undefined): boolean {
  if (!uid) return false;
  const r = lerRetrato(uid);
  return !!r && ["running", "break", "block_report", "lunch_pause"].includes(r.fase);
}
