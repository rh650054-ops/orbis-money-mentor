/**
 * VENDA QUE NÃO SE PERDE (12/10/2026)
 * Antes, sem internet (ou com a rede caindo no meio), só o TOTAL do bloco ia pra fila:
 * o dinheiro aparecia, mas a venda em si (produto, quantidade, forma) sumia — e sem a
 * linha em defcon_sales o estoque não baixava.
 *
 * Agora cada venda nasce no aparelho com um id próprio (uuid) e a hora em que foi feita.
 * Esse id vai junto pro banco, então mandar a mesma venda 2x não duplica nada:
 *   • online: insert com o id; se já existia (23505), está tudo certo;
 *   • fila:   upsert ignorando duplicado (ON CONFLICT DO NOTHING) — o gatilho de
 *             estoque só roda quando a linha entra de verdade, então baixa uma vez só.
 * O total da sessão (usado no X1) também vai pra fila, como valor absoluto.
 */
import { supabase } from "@/integrations/supabase/client";
import { addOfflineRecord, getUnsynced, removeOfflineRecord, type OfflineRecord } from "./offline-db";

export interface LinhaVenda {
  id: string;
  user_id: string;
  session_id: string;
  block_index: number;
  amount: number;
  method: "dinheiro" | "pix" | "cartao" | "gorjeta";
  late: boolean;
  created_at: string;
  product_id?: string;
  qty?: number;
}

function novoId(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  // aparelho antigo sem randomUUID: uuid v4 com getRandomValues
  const b = new Uint8Array(16);
  c.getRandomValues(b);
  b[6] = (b[6]! & 0x0f) | 0x40;
  b[8] = (b[8]! & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export function novaLinhaVenda(v: Omit<LinhaVenda, "id" | "created_at">): LinhaVenda {
  return { ...v, id: novoId(), created_at: new Date().toISOString() };
}

const chaveSessao = (sessionId: string) => `sessao:${sessionId}`;

/** Grava a venda no banco. Já existir com esse id = já subiu = ok. */
export async function gravarLinhaVenda(linha: LinhaVenda): Promise<void> {
  const { error } = await supabase.from("defcon_sales").insert(linha);
  if (error && (error as { code?: string }).code !== "23505") throw error;
}

/** Guarda a venda + o total da sessão no aparelho pra subir quando a rede voltar. */
export async function guardarVendaOffline(linha: LinhaVenda, totalSessao: number): Promise<void> {
  const agora = new Date().toISOString();
  await addOfflineRecord("pending_venda", {
    id: linha.id, store: "pending_venda", data: { tipo: "venda", linha }, created_at: agora, synced: false,
  });
  await addOfflineRecord("pending_venda", {
    id: chaveSessao(linha.session_id), store: "pending_venda",
    data: { tipo: "total_sessao", session_id: linha.session_id, total_sold: totalSessao },
    created_at: agora, synced: false,
  });
}

/** Só o total da sessão (ex.: ao excluir uma venda), valor absoluto. */
export async function guardarTotalSessaoOffline(sessionId: string, totalSessao: number): Promise<void> {
  try {
    await addOfflineRecord("pending_venda", {
      id: chaveSessao(sessionId), store: "pending_venda",
      data: { tipo: "total_sessao", session_id: sessionId, total_sold: totalSessao },
      created_at: new Date().toISOString(), synced: false,
    });
  } catch { /* sem IndexedDB: a tela já mostra o valor certo; a próxima venda corrige */ }
}

/** Excluir uma venda: se ela ainda estava na fila, só sai dela (nunca chega no servidor);
 *  senão entra na fila um pedido de apagar, que o carteiro leva em ordem. */
export async function apagarVendaOffline(vendaId: string): Promise<void> {
  try {
    const pendentes = await getUnsynced("pending_venda");
    if (pendentes.some((r) => r.id === vendaId)) { await removeOfflineRecord("pending_venda", vendaId); return; }
    await addOfflineRecord("pending_venda", {
      id: `apagar:${vendaId}`, store: "pending_venda",
      data: { tipo: "apagar", venda_id: vendaId }, created_at: new Date().toISOString(), synced: false,
    });
  } catch (e) { console.error("[venda-offline] não consegui guardar a exclusão:", e); }
}

/** O total da sessão subiu online: o valor guardado na fila ficou velho, descarta. */
export async function esquecerTotalSessaoOffline(sessionId: string): Promise<void> {
  try { await removeOfflineRecord("pending_venda", chaveSessao(sessionId)); } catch { /* sem IndexedDB: nada guardado */ }
}

/** Sobe um item da fila. true = pode tirar da fila. */
export async function subirVendaPendente(record: OfflineRecord): Promise<boolean> {
  const d = record.data;
  if (d.tipo === "venda") {
    const { error } = await supabase
      .from("defcon_sales")
      .upsert(d.linha as LinhaVenda, { onConflict: "id", ignoreDuplicates: true });
    if (!error) return true;
    // a sessão foi apagada nesse meio-tempo: a venda não tem onde entrar
    if ((error as { code?: string }).code === "23503") {
      console.error("[OfflineSync] venda sem sessão, descartada:", record.id);
      return true;
    }
    return false;
  }
  if (d.tipo === "apagar") {
    const { error } = await supabase.from("defcon_sales").delete().eq("id", String(d.venda_id));
    return !error;
  }
  if (d.tipo === "total_sessao") {
    const { error } = await supabase
      .from("challenge_sessions")
      .update({ total_sold: Number(d.total_sold) })
      .eq("id", String(d.session_id));
    return !error;
  }
  return true; // registro desconhecido: descarta
}
