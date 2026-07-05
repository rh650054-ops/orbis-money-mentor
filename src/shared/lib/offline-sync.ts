/**
 * Background sync: when connection is restored, push pending offline data to the cloud.
 */
import { supabase } from "@/integrations/supabase/client";
import { getUnsynced, markSynced, clearSynced, type OfflineRecord } from "./offline-db";
import { syncBlocksToDailySales } from "@/utils/syncDailySales";

let syncing = false;

export async function syncAllPendingData(): Promise<void> {
  if (syncing) return;
  syncing = true;

  try {
    const salesSynced = await syncStore('pending_sales', syncSaleRecord);
    await syncStore('pending_checklist', syncChecklistRecord);
    await syncStore('pending_defcon', syncDefconRecord);
    await syncStore('pending_approaches', syncApproachRecord);

    // Clean up synced records
    await clearSynced('pending_sales');
    await clearSynced('pending_checklist');
    await clearSynced('pending_defcon');
    await clearSynced('pending_approaches');

    // Depois de subir as vendas offline (que gravam em hourly_goal_blocks), recalcula
    // o total do dia (daily_sales) + ranking a partir dos blocos — senao o Dashboard e
    // o ranking so atualizariam no proximo carregamento do app.
    if (salesSynced > 0) {
      const { data } = await supabase.auth.getUser();
      if (data.user) await syncBlocksToDailySales(data.user.id);
    }
  } catch (err) {
    console.error('[OfflineSync] Error during sync:', err);
  } finally {
    syncing = false;
  }
}

type StoreName = 'pending_sales' | 'pending_checklist' | 'pending_defcon' | 'pending_approaches';

async function syncStore(store: StoreName, handler: (record: OfflineRecord) => Promise<boolean>): Promise<number> {
  const records = await getUnsynced(store);
  let synced = 0;
  for (const record of records) {
    try {
      const ok = await handler(record);
      if (ok) { await markSynced(store, record.id); synced++; }
    } catch (err) {
      console.error(`[OfflineSync] Failed to sync ${store} record ${record.id}:`, err);
    }
  }
  return synced;
}

async function syncSaleRecord(record: OfflineRecord): Promise<boolean> {
  const d = record.data;
  const { error } = await supabase.from('hourly_goal_blocks').upsert({
    id: d.block_id as string,
    user_id: d.user_id as string,
    plan_id: d.plan_id as string,
    hour_index: d.hour_index as number,
    hour_label: d.hour_label as string,
    target_amount: d.target_amount as number,
    achieved_amount: d.achieved_amount as number,
    valor_dinheiro: d.valor_dinheiro as number,
    valor_cartao: d.valor_cartao as number,
    valor_pix: d.valor_pix as number,
    valor_calote: d.valor_calote as number,
    valor_gorjeta: (d.valor_gorjeta as number) ?? 0,
  }, { onConflict: 'id' });
  return !error;
}

async function syncChecklistRecord(record: OfflineRecord): Promise<boolean> {
  const d = record.data;
  const { error } = await supabase.from('daily_checklist').upsert({
    id: d.id as string,
    user_id: d.user_id as string,
    activity_name: d.activity_name as string,
    completed: d.completed as boolean,
    date: d.date as string,
    status: d.status as string,
    completed_at: d.completed_at as string | null,
  }, { onConflict: 'id' });
  return !error;
}

async function syncDefconRecord(record: OfflineRecord): Promise<boolean> {
  const d = record.data;
  if (d.type === 'block_update') {
    const { error } = await supabase.from('challenge_blocks').upsert({
      id: d.id as string,
      user_id: d.user_id as string,
      session_id: d.session_id as string,
      block_index: d.block_index as number,
      sold_amount: d.sold_amount as number,
      approaches_count: d.approaches_count as number,
      status: d.status as string,
    }, { onConflict: 'id' });
    return !error;
  }
  return true;
}

async function syncApproachRecord(record: OfflineRecord): Promise<boolean> {
  const d = record.data;
  const { error } = await supabase.from('hourly_goal_blocks').update({
    approaches_count: d.approaches_count as number,
  }).eq('id', d.block_id as string);
  return !error;
}

// Setup listeners
export function setupOfflineSyncListeners(): void {
  // Roda a sync se houver rede. Usado pelos gatilhos abaixo; não faz nada offline.
  const syncIfOnline = () => {
    if (typeof navigator === "undefined" || navigator.onLine === false) return;
    syncAllPendingData();
  };

  // 1) Conexão VOLTOU (offline -> online) durante a sessão.
  window.addEventListener('online', () => {
    console.log('[OfflineSync] Connection restored, syncing...');
    syncAllPendingData();
  });

  // 2) ABERTURA DO APP: o caso do vendedor de rua — registra venda sem sinal,
  //    fecha o app, e quando reabre JÁ está online (nenhum evento 'online'
  //    dispara). Sem isto, a venda ficava presa no aparelho até a próxima queda
  //    de sinal. Faz a varredura logo no boot.
  syncIfOnline();

  // 3) APP VOLTOU AO PRIMEIRO PLANO (trocou de app e voltou / destravou a tela).
  //    Pega o mesmo cenário sem depender de recarregar a página (é PWA).
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') syncIfOnline();
  });
  window.addEventListener('focus', syncIfOnline);

  // Try Background Sync if available
  if ('serviceWorker' in navigator && 'SyncManager' in window) {
    navigator.serviceWorker.ready.then(reg => {
      // Register for background sync
      (reg as any).sync?.register('orbis-sync').catch(() => {
        // Background sync not supported, fallback to online event
      });
    });
  }
}
