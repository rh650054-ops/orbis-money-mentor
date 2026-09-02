/* ============================================================
   DEFCON 4 OFFLINE — o motor do DEFCON sem servidor.

   Espelha a FORMA do useDefconChallenge (mesmos nomes que a tela
   DefconRunning espera), mas tudo mora no celular: localStorage
   (instantâneo) + fila do IndexedDB (sync). Blocos de 1 hora contam
   a partir de INICIAR, pelo relógio do aparelho. Quando o sinal
   volta, `offline-sync` sobe o dia como bloco "OFFLINE" absoluto →
   daily_sales → ranking (idempotente).

   Pedido do Rick (01/09): "o modo offline não é o placar, é a tela
   do DEFCON 4". Então a tela é a MESMA; só o motor é este.
   ============================================================ */
import { useCallback, useEffect, useMemo, useState } from "react";
import type { DefconBlock } from "@/hooks/useDefconChallenge";
import {
  carregarDiaOffline, novoDiaOffline, salvarDiaOffline, totaisDoDia, metaDiaLembrada, hojeBR,
  type DiaOffline, type MetodoVenda,
} from "@/shared/lib/offline-day";

const BLOCO_S = 60 * 60;   // 1 hora
const MAX_BLOCOS = 10;

export type FaseOffline = "idle" | "running" | "lunch_pause" | "finished";

const r2 = (n: number) => Math.round(n * 100) / 100;
const novoId = () => `off_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

export function useDefconOffline(userId: string | null) {
  const [dia, setDia] = useState<DiaOffline | null>(null);
  const [agora, setAgora] = useState(() => Date.now());

  // carrega (ou cria) o dia de hoje
  useEffect(() => {
    if (!userId) return;
    const existente = carregarDiaOffline(userId, hojeBR());
    if (existente) { setDia(existente); return; }
    setDia(novoDiaOffline(userId, metaDiaLembrada(userId) || 200));
  }, [userId]);

  // relógio de 1s (só enquanto roda ou pausa)
  const rodando = Boolean(dia?.defcon_started_at && !dia?.ended_at);
  useEffect(() => {
    if (!rodando) return;
    const id = window.setInterval(() => setAgora(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [rodando]);

  const gravar = useCallback((next: DiaOffline) => { setDia(next); void salvarDiaOffline(next); }, []);
  const mudar = useCallback((fn: (d: DiaOffline) => DiaOffline) => {
    setDia((d) => { if (!d) return d; const next = fn(d); void salvarDiaOffline(next); return next; });
  }, []);

  // ---- blocos pelo relógio ----
  const inicioMs = dia?.defcon_started_at ? new Date(dia.defcon_started_at).getTime() : 0;
  const decorrido = inicioMs ? Math.max(0, Math.floor((agora - inicioMs) / 1000)) : 0;
  const currentBlockIndex = Math.min(MAX_BLOCOS - 1, Math.floor(decorrido / BLOCO_S));
  const blockStartedAt = inicioMs ? new Date(inicioMs + currentBlockIndex * BLOCO_S * 1000) : null;
  const blockEndTime = blockStartedAt ? new Date(blockStartedAt.getTime() + BLOCO_S * 1000) : null;
  const remainingSeconds = inicioMs ? Math.max(0, BLOCO_S - (decorrido - currentBlockIndex * BLOCO_S)) : BLOCO_S;

  const pausaAte = dia?.paused_until ? new Date(dia.paused_until).getTime() : 0;
  const emPausa = pausaAte > agora;
  const lunchPauseRemaining = emPausa ? Math.ceil((pausaAte - agora) / 1000) : 0;

  const phase: FaseOffline = !dia?.defcon_started_at ? "idle" : dia.ended_at ? "finished" : emPausa ? "lunch_pause" : "running";

  // ---- totais ----
  const t = useMemo(() => (dia ? totaisDoDia(dia) : { dinheiro: 0, pix: 0, cartao: 0, gorjeta: 0, total: 0, vendas: 0 }), [dia]);
  const vendasBloco = useMemo(() => (dia?.sales ?? []).filter((s) => (s.block_index ?? 0) === currentBlockIndex), [dia, currentBlockIndex]);
  const somaBloco = (m: MetodoVenda) => r2(vendasBloco.filter((s) => s.method === m).reduce((a, s) => a + s.amount, 0));
  const abordagensBloco = useMemo(() => {
    if (!blockStartedAt || !blockEndTime) return 0;
    const a = blockStartedAt.getTime(), b = blockEndTime.getTime();
    return (dia?.approaches_log ?? []).filter((iso) => { const ms = new Date(iso).getTime(); return ms >= a && ms < b; }).length;
  }, [dia, blockStartedAt, blockEndTime]);

  const currentBlock: DefconBlock = {
    id: `offline-${currentBlockIndex}`,
    hour_index: currentBlockIndex,
    hour_label: blockStartedAt ? `${String(blockStartedAt.getHours()).padStart(2, "0")}h` : "OFFLINE",
    target_amount: dia ? r2(dia.daily_goal / MAX_BLOCOS) : 0,
    achieved_amount: r2(somaBloco("dinheiro") + somaBloco("pix") + somaBloco("cartao") + somaBloco("gorjeta")),
    is_completed: false,
    valor_dinheiro: somaBloco("dinheiro"), valor_cartao: somaBloco("cartao"), valor_pix: somaBloco("pix"),
    valor_calote: 0, valor_gorjeta: somaBloco("gorjeta"),
  };

  // lista no formato que a folha "ver blocos" da tela espera
  const sessionSales = useMemo(() => (dia?.sales ?? []).map((s) => ({
    id: s.id, amount: s.amount, method: s.method, created_at: s.at, block_index: s.block_index ?? 0, late: false,
  })), [dia]);

  // ---- ações ----
  const startChallenge = async () => {
    if (!dia) return;
    if (dia.ended_at) { gravar({ ...dia, ended_at: null, defcon_started_at: dia.defcon_started_at ?? new Date().toISOString() }); return; }
    gravar({ ...dia, defcon_started_at: new Date().toISOString(), paused_until: null });
  };

  /* Venda também conta ABORDAGEM — quem comprou foi abordado.
     É a mesma regra do DEFCON com internet (useDefconChallenge.addSale).
     Sem isso a conversão passava de 100% no offline: 12 vendas / 2 abordagens
     tocadas à mão davam 600%. Com a correção, abordagens = toques manuais +
     vendas, então 10 abordagens com 6 vendas = 60%, como o Rick descreveu.
     Gorjeta NÃO conta abordagem nem venda (é um extra, não um atendimento). */
  const addSale = async (amount: number, method: MetodoVenda = "dinheiro") => {
    if (!(amount > 0)) return;
    const agoraISO = new Date().toISOString();
    const ehGorjeta = method === "gorjeta";
    mudar((d) => ({
      ...d,
      sales: [...d.sales, { id: novoId(), amount: r2(amount), method, at: agoraISO, block_index: currentBlockIndex }],
      approaches: ehGorjeta ? (d.approaches || 0) : (d.approaches || 0) + 1,
      approaches_log: ehGorjeta ? (d.approaches_log ?? []) : [...(d.approaches_log ?? []), agoraISO],
    }));
  };
  const addTip = async (amount: number) => addSale(amount, "gorjeta");
  const addApproach = () => {
    mudar((d) => ({ ...d, approaches: (d.approaches || 0) + 1, approaches_log: [...(d.approaches_log ?? []), new Date().toISOString()] }));
  };
  const addOccurrence = async (text: string) => {
    if (!text.trim()) return;
    mudar((d) => ({ ...d, occurrences: [...(d.occurrences ?? []), { at: new Date().toISOString(), text: text.trim() }] }));
  };
  const deleteSale = async (sale: { id: string }) => {
    mudar((d) => ({ ...d, sales: d.sales.filter((s) => s.id !== sale.id) }));
  };
  const startLunchPause = async (minutes: number) => {
    const m = Math.max(1, Math.min(120, Math.round(minutes || 30)));
    mudar((d) => ({ ...d, paused_until: new Date(Date.now() + m * 60_000).toISOString() }));
  };
  const skipLunchPause = () => { mudar((d) => ({ ...d, paused_until: null })); setAgora(Date.now()); };
  const endChallenge = async () => {
    mudar((d) => ({ ...d, ended_at: new Date().toISOString(), paused_until: null }));
    // Mesma regra do online: fechou com venda → a Home acende a chama uma vez.
    try {
      if (userId && t.total > 0) localStorage.setItem(`orbis_chama_acender_${userId}`, String(Date.now()));
    } catch { /* sem storage: sem animação */ }
  };
  const reabrir = () => { mudar((d) => ({ ...d, ended_at: null })); setAgora(Date.now()); };

  const workedMinutes = inicioMs ? Math.round(((dia?.ended_at ? new Date(dia.ended_at).getTime() : agora) - inicioMs) / 60_000) : 0;

  return {
    dia, phase, loading: !dia, hasPlan: true,
    dailyGoal: dia?.daily_goal ?? 0,
    totalSold: t.total,
    totais: t,
    blocks: Array.from({ length: MAX_BLOCOS }, (_, i) => i),
    currentBlock, currentBlockIndex, totalBlocks: MAX_BLOCOS,
    remainingSeconds, blockStartedAt, blockEndTime,
    lunchPauseUsed: false, lunchPauseRemaining,
    blockApproaches: abordagensBloco,
    totalApproaches: dia?.approaches ?? 0,
    totalSalesCount: t.vendas,
    blockSalesCount: vendasBloco.filter((s) => s.method !== "gorjeta").length,
    sessionSales, workedMinutes,
    ocorrencias: dia?.occurrences ?? [],
    startChallenge, addSale, addTip, addApproach, addOccurrence, deleteSale,
    startLunchPause, skipLunchPause, endChallenge, reabrir,
    setDailyGoal: (meta: number) => { if (meta > 0) mudar((d) => ({ ...d, daily_goal: meta })); },
  };
}
