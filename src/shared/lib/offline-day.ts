/* ============================================================
   DIA OFFLINE — o estado do "Placar Offline" no celular.

   O vendedor está sem sinal (metrô, feira, galpão). Ele ativa o
   modo offline e registra o dia aqui: vendas (com método), abordagens
   e calote. TUDO fica no aparelho (localStorage = rápido; IndexedDB =
   fila de sincronização que o app já tem). Quando a internet volta,
   `offline-sync` pega o registro e joga no MESMO funil do DEFCON:
   plano do dia → bloco "OFFLINE" → daily_sales → ranking.

   Idempotente: o bloco OFFLINE recebe valores ABSOLUTOS (não soma),
   então sincronizar 2x nunca duplica dinheiro.
   ============================================================ */
import { addOfflineRecord } from "@/shared/lib/offline-db";

export type MetodoVenda = "dinheiro" | "pix" | "cartao" | "gorjeta";

export interface VendaOffline {
  id: string;
  amount: number;
  method: MetodoVenda;
  at: string; // ISO
  block_index?: number; // bloco de 1h do DEFCON offline em que a venda caiu
}

export interface DiaOffline {
  user_id: string;
  date: string;           // YYYY-MM-DD (dia do Brasil)
  daily_goal: number;
  sales: VendaOffline[];
  approaches: number;
  calote: number;         // R$ que ficou de fiado/calote
  started_at: string;
  ended_at: string | null;
  synced_at: string | null;
  // --- DEFCON 4 offline (a mesma tela do DEFCON, sem servidor) ---
  defcon_started_at?: string | null;  // quando tocou em INICIAR (blocos de 1h contam daqui)
  approaches_log?: string[];          // ISO de cada abordagem (pra contar por bloco)
  occurrences?: { at: string; text: string }[];
  paused_until?: string | null;       // pausa/almoço em andamento
}

const chave = (userId: string, date: string) => `orbis_dia_offline_${userId}_${date}`;
const chaveMetaDia = (userId: string) => `orbis_meta_dia_${userId}`;

/** Data de hoje no fuso do Brasil (sem depender de rede). */
export function hojeBR(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }); // YYYY-MM-DD
}

/** O dashboard/Foco gravam a meta do dia aqui sempre que estão online,
 *  pra o modo offline saber qual é a meta mesmo sem servidor. */
export function lembrarMetaDia(userId: string, meta: number): void {
  try { if (meta > 0) localStorage.setItem(chaveMetaDia(userId), String(meta)); } catch { /* nada */ }
}
export function metaDiaLembrada(userId: string): number {
  try { return Number(localStorage.getItem(chaveMetaDia(userId))) || 0; } catch { return 0; }
}

export function carregarDiaOffline(userId: string, date = hojeBR()): DiaOffline | null {
  try {
    const raw = localStorage.getItem(chave(userId, date));
    return raw ? (JSON.parse(raw) as DiaOffline) : null;
  } catch { return null; }
}

export function novoDiaOffline(userId: string, dailyGoal: number, date = hojeBR()): DiaOffline {
  const dia: DiaOffline = {
    user_id: userId, date, daily_goal: dailyGoal,
    sales: [], approaches: 0, calote: 0,
    started_at: new Date().toISOString(), ended_at: null, synced_at: null,
  };
  void salvarDiaOffline(dia);
  return dia;
}

/** Grava no localStorage (instantâneo) E na fila do IndexedDB (pra sync). */
export async function salvarDiaOffline(dia: DiaOffline): Promise<void> {
  try { localStorage.setItem(chave(dia.user_id, dia.date), JSON.stringify(dia)); } catch { /* nada */ }
  try {
    await addOfflineRecord("pending_defcon", {
      id: `offline_day_${dia.user_id}_${dia.date}`,
      store: "pending_defcon",
      data: { type: "offline_day", ...dia },
      created_at: dia.started_at,
      synced: false,
    });
  } catch { /* IndexedDB indisponível: o localStorage segura e o sync tenta por ele */ }
}

export function totaisDoDia(dia: DiaOffline) {
  const r2 = (n: number) => Math.round(n * 100) / 100;
  const soma = (m: MetodoVenda) => r2(dia.sales.filter((s) => s.method === m).reduce((a, s) => a + s.amount, 0));
  const dinheiro = soma("dinheiro"), pix = soma("pix"), cartao = soma("cartao"), gorjeta = soma("gorjeta");
  const total = r2(dinheiro + pix + cartao + gorjeta); // gorjeta conta no faturamento (igual ao DEFCON)
  return { dinheiro, pix, cartao, gorjeta, total, vendas: dia.sales.filter((s) => s.method !== "gorjeta").length };
}

/** Todos os dias offline ainda não sincronizados (pra tela "pendente" e pro sync). */
export function diasOfflinePendentes(userId: string): DiaOffline[] {
  const out: DiaOffline[] = [];
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith(`orbis_dia_offline_${userId}_`))
      .forEach((k) => {
        try {
          const d = JSON.parse(localStorage.getItem(k) || "null") as DiaOffline | null;
          if (d && !d.synced_at && (d.sales.length > 0 || d.approaches > 0 || d.calote > 0)) out.push(d);
        } catch { /* nada */ }
      });
  } catch { /* nada */ }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

export function marcarDiaSincronizado(userId: string, date: string): void {
  const d = carregarDiaOffline(userId, date);
  if (!d) return;
  d.synced_at = new Date().toISOString();
  try { localStorage.setItem(chave(userId, date), JSON.stringify(d)); } catch { /* nada */ }
}
