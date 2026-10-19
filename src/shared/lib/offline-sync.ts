/**
 * Background sync: when connection is restored, push pending offline data to the cloud.
 */
import { supabase } from "@/integrations/supabase/client";
import { avisar } from "@/shared/lib/avisar";
import { getUnsynced, markSynced, clearSynced, type OfflineRecord } from "./offline-db";
import { syncBlocksToDailySales } from "@/utils/syncDailySales";
import { subirVendaPendente } from "./venda-offline";
import { diasOfflinePendentes, marcarDiaSincronizado, type DiaOffline } from "./offline-day";
import { contarPendentes, registrarSinal, temSinal } from "./fila-defcon";
import { guardarNoAparelho, lerLogsDoAparelho, limparLogsDoAparelho } from "./avisar";

let syncing = false;
let deNovo = false;

/** Avisa a tela (DEFCON, tarja) quanto falta subir e quando algo subiu. */
async function avisarTela(enviou: number): Promise<void> {
  if (typeof window === "undefined") return;
  const pendentes = await contarPendentes();
  window.dispatchEvent(new CustomEvent("orbis:fila", { detail: { pendentes, enviou } }));
}

/** O CARTEIRO: leva o que está no celular pro servidor, em ordem, uma coisa de cada vez.
 *  Se chamarem de novo enquanto ele trabalha, ele dá mais uma volta no fim (nada fica
 *  pra trás). Total do dia e ranking são recalculados UMA vez, quando a fila esvazia. */
export async function syncAllPendingData(): Promise<void> {
  if (syncing) { deNovo = true; return; }
  syncing = true;
  let enviouTotal = 0;
  const diasTocados = new Set<string>();

  try {
    do {
      deNovo = false;
      const salesSynced =
        (await syncStore('pending_sales', (r) => syncSaleRecord(r, diasTocados))) +
        (await syncStore('pending_venda', subirVendaPendente));
      const outros =
        (await syncStore('pending_checklist', syncChecklistRecord)) +
        (await syncStore('pending_defcon', syncDefconRecord)) +
        (await syncStore('pending_approaches', syncApproachRecord));
      enviouTotal += salesSynced + outros;

      // PLACAR OFFLINE (localStorage é a fonte; o IndexedDB é só espelho). Se o
      // IndexedDB falhou no celular, este passo garante que o dia sobe mesmo assim.
      await syncDiasOfflineLocais();

      await clearSynced('pending_sales');
      await clearSynced('pending_venda');
      await clearSynced('pending_checklist');
      await clearSynced('pending_defcon');
      await clearSynced('pending_approaches');
    } while (deNovo);

    // Depois de subir as vendas (que gravam em hourly_goal_blocks), recalcula o total
    // do dia (daily_sales) + ranking a partir dos blocos — do DIA de cada bloco.
    if (diasTocados.size > 0) {
      const { data } = await supabase.auth.getUser();
      if (data.user) for (const dia of diasTocados) await syncBlocksToDailySales(data.user.id, dia || undefined);
    }
  } catch (err) {
    console.error('[OfflineSync] Error during sync:', err);
  } finally {
    syncing = false;
    void avisarTela(enviouTotal);
    void registrarFilaEEnviarLogs();
  }
}

/** Fase 4: se a fila está velha, anota; e manda os erros guardados no aparelho. */
async function registrarFilaEEnviarLogs(): Promise<void> {
  try {
    const pendentes = await contarPendentes();
    if (pendentes > 0) {
      const maisVelha = await idadeDaFilaMin();
      if (maisVelha >= 30) guardarNoAparelho({ quando: new Date().toISOString(), nivel: "fila", ctx: "fila parada", pendentes, fila_mais_velha_min: maisVelha });
    }
    const logs = lerLogsDoAparelho();
    if (logs.length === 0 || !(await temSinal())) return;
    const app = typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 200) : null;
    const { error } = await (supabase as unknown as { from: (t: string) => { insert: (r: unknown[]) => Promise<{ error: unknown }> } })
      .from("client_logs").insert(logs.map((l) => ({ ...l, app })));
    if (!error) limparLogsDoAparelho(logs.length);
  } catch { /* sem tabela ou sem sinal: os logs ficam no aparelho e vão na próxima */ }
}

async function idadeDaFilaMin(): Promise<number> {
  const todos = [
    ...(await getUnsynced('pending_sales')), ...(await getUnsynced('pending_venda')), ...(await getUnsynced('pending_defcon')),
  ];
  const maisVelho = todos.reduce((m, r) => Math.min(m, new Date(r.created_at).getTime() || Date.now()), Date.now());
  return Math.round((Date.now() - maisVelho) / 60000);
}

/** Chama o carteiro sem esperar (a tela não trava). */
export function enviarFila(): void { void syncAllPendingData(); }

type StoreName = 'pending_sales' | 'pending_venda' | 'pending_checklist' | 'pending_defcon' | 'pending_approaches';

async function syncStore(store: StoreName, handler: (record: OfflineRecord) => Promise<boolean>): Promise<number> {
  const records = (await getUnsynced(store)).sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
  let synced = 0;
  for (const record of records) {
    try {
      const ok = await handler(record);
      if (ok) registrarSinal(true);
      if (ok) { await markSynced(store, record.id, record.rev); synced++; }
    } catch (err) {
      console.error(`[OfflineSync] Failed to sync ${store} record ${record.id}:`, err);
    }
  }
  return synced;
}

async function syncSaleRecord(record: OfflineRecord, dias?: Set<string>): Promise<boolean> {
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
  if (!error) dias?.add(String(d.plan_date ?? ""));
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
  // alteração de sessão/bloco feita sem sinal (avançar bloco, pausa, encerrar)
  if (d.type === 'patch') {
    const tabela = d.tabela as "challenge_sessions" | "hourly_goal_blocks";
    const { error } = await supabase.from(tabela).update(d.patch as never).eq('id', String(d.linha));
    return !error;
  }
  // abordagens / vendas do bloco (challenge_blocks), valor absoluto
  if (d.type === 'contadores') {
    const { error } = await supabase.from('challenge_blocks').upsert(d.payload as never, { onConflict: 'session_id,block_index' });
    return !error;
  }
  if (d.type === 'offline_day') {
    return syncOfflineDay(d as unknown as DiaOffline);
  }
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

  // 4) SINAL FRACO: o celular não avisa "voltou" quando o sinal passa de ruim pra bom.
  //    Enquanto tiver coisa na fila, o carteiro tenta de novo a cada 30s.
  setInterval(() => {
    if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
    void contarPendentes().then((n) => { if (n > 0) syncIfOnline(); });
  }, 30_000);

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


/* ============================================================
   PLACAR OFFLINE → servidor. Entra no MESMO funil do DEFCON:
   plano do dia (cria se faltar) → bloco "OFFLINE" com valores
   ABSOLUTOS (idempotente) → daily_sales → ranking.
   ============================================================ */
export async function syncOfflineDay(dia: DiaOffline): Promise<boolean> {
  try {
    const userId = dia.user_id;
    const date = dia.date;
    if (!userId || !date) return true; // registro inválido: descarta

    const r2 = (n: number) => Math.round(n * 100) / 100;
    const soma = (m: string) => r2(dia.sales.filter((s) => s.method === m).reduce((a, s) => a + Number(s.amount || 0), 0));
    const dinheiro = soma("dinheiro"), pix = soma("pix"), cartao = soma("cartao"), gorjeta = soma("gorjeta");
    const calote = r2(Number(dia.calote || 0));
    const total = r2(dinheiro + pix + cartao + gorjeta); // gorjeta conta no faturamento (igual ao DEFCON)
    if (total === 0 && calote === 0 && !dia.approaches) {
      marcarDiaSincronizado(userId, date);
      return true; // dia vazio: nada a subir
    }

    // 1) plano do dia
    let { data: plan } = await supabase
      .from("daily_goal_plans").select("id").eq("user_id", userId).eq("date", date).maybeSingle();
    if (!plan) {
      const { data: profile } = await supabase
        .from("profiles").select("base_daily_goal, goal_hours").eq("user_id", userId).maybeSingle();
      const dg = Number(dia.daily_goal) || Number(profile?.base_daily_goal) || 200;
      const wh = Number(profile?.goal_hours) || 8;
      const { data: novo, error } = await supabase
        .from("daily_goal_plans")
        .insert({ user_id: userId, date, daily_goal: dg, work_hours: wh, mood: "normal", hourly_goal: dg / wh })
        .select("id").single();
      if (error || !novo) return false;
      plan = novo;
    }

    // 2) bloco OFFLINE (hour_index 99) — valores absolutos, nunca soma
    const { data: existente } = await supabase
      .from("hourly_goal_blocks").select("id").eq("plan_id", plan.id).eq("hour_label", "OFFLINE").maybeSingle();
    const valores = {
      achieved_amount: total,
      valor_dinheiro: dinheiro, valor_pix: pix, valor_cartao: cartao, valor_calote: calote, valor_gorjeta: gorjeta,
      approaches_count: Number(dia.approaches || 0),
      is_completed: true,
    };
    if (existente) {
      const { error } = await supabase.from("hourly_goal_blocks").update(valores as never).eq("id", existente.id);
      if (error) return false;
    } else {
      const { error } = await supabase.from("hourly_goal_blocks").insert({
        plan_id: plan.id, user_id: userId, hour_index: 99, hour_label: "OFFLINE",
        target_amount: 0, timer_status: "idle", ...valores,
      } as never);
      if (error) return false;
    }

    // 3) daily_sales + ranking (mesma função que o DEFCON usa)
    await syncBlocksToDailySales(userId, date);

    // 4) O dia offline vira um DEFCON DE VERDADE: sessão + blocos + vendas.
    //    Sem isso o relatório do dia vinha vazio, não tinha hora-a-hora e o dia
    //    não contava na ofensiva — o vendedor fechava o corre e "não ia" (Rick, 12/09).
    //    Re-enviar é substituir (a RPC troca as linhas dessa sessão), então pode rodar
    //    quantas vezes for: nunca duplica venda.
    try {
      await (supabase.rpc as unknown as (n: string, a: Record<string, unknown>) => Promise<{ error: unknown }>)(
        "orbis_subir_dia_offline",
        {
          p_date: date,
          p_daily_goal: Number(dia.daily_goal) || 0,
          p_started_at: dia.defcon_started_at ?? null,
          p_ended_at: dia.ended_at ?? null,
          p_approaches: Number(dia.approaches || 0),
          p_sales: (dia.sales || []).map((s) => ({
            amount: Number(s.amount || 0),
            method: s.method,
            at: s.at,
            block_index: Number(s.block_index ?? 0),
          })),
        },
      );
    } catch (e) {
      // O dinheiro já subiu no passo 3; o relatório tenta de novo no próximo gatilho.
      console.error("[OfflineSync] dia offline -> DEFCON falhou:", e);
    }

    marcarDiaSincronizado(userId, date);
    return true;
  } catch (err) {
    console.error("[OfflineSync] offline_day falhou:", err);
    return false;
  }
}

async function syncDiasOfflineLocais(): Promise<void> {
  try {
    const { data } = await supabase.auth.getUser();
    const userId = data.user?.id;
    if (!userId) return;
    for (const dia of diasOfflinePendentes(userId)) {
      await syncOfflineDay(dia);
    }
  } catch (e) { avisar.erro("offline-sync: sincronizar dias offline (tenta no próximo gatilho)", e); }
}
