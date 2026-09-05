import { useEffect, useMemo, useRef, useState } from "react";
import { getBrazilDate } from "@/shared/lib/date-utils";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useDefconChallenge } from "@/hooks/useDefconChallenge";
import { useDistanceTracker } from "@/hooks/useDistanceTracker";
import { useDefconOnboarding } from "@/hooks/useDefconOnboarding";
import { useDefconQuickNotification } from "@/hooks/useDefconQuickNotification";
import { useDefconPresence } from "@/hooks/useDefconPresence";
import { useX1DefconAlert } from "@/hooks/useX1DefconAlert";
import DefconTour, { TreinoConcluido } from "@/components/defcon/DefconTour";
import FirstTimeCard from "@/components/FirstTimeCard";
import { DefconStartScreen } from "@/components/defcon/DefconStartScreen";
import { DefconRunning } from "@/components/defcon/DefconRunning";
import { DefconBreak } from "@/components/defcon/DefconBreak";
import { DefconFechamento } from "@/components/defcon/DefconFechamento";
import { DefconCargaDoDia } from "@/components/defcon/DefconCargaDoDia";
import ExtratoDailyModal from "@/components/competitions/ExtratoDailyModal";
import { DefconLunchPause } from "@/components/defcon/DefconLunchPause";
import { DefconBlockReport } from "@/components/defcon/DefconBlockReport";

export default function DefconChallenge() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const treino = params.get("treino") === "1";
  const primeiroDia = params.get("primeiro") === "1"; // veio direto do onboarding
  const { user, loading: authLoading } = useAuth();
  const realDefcon = useDefconChallenge(treino ? undefined : user?.id);
  const onbDefcon = useDefconOnboarding(user?.id);
  const defcon: any = treino ? onbDefcon : realDefcon;
  // Treino guiado: quando o tour termina (ou o usuário ENCERRA no treino), mostra o
  // card "treino concluído", marca o passo do checklist e volta pro início.
  const [treinoConcluido, setTreinoConcluido] = useState(false);
  const concluirTreino = () => {
    try { if (user?.id) localStorage.setItem(`orbis_defcon_tour_ok_${user.id}`, "1"); } catch { /* nada */ }
    navigate("/");
  };

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [user, authLoading, navigate]);

  // Tick de 30s: faz a comparação "sessão é de ontem?" re-rodar e o modal da virada
  // aparecer NA HORA em que passa da meia-noite (não só num reload).
  const [, setMidnightTick] = useState(0);
  // Etapa 1 da Onda 2: "Encerrar" pede confirmação antes de fechar o dia
  const [confirmarFim, setConfirmarFim] = useState(false);
  // Etapa 2: entre o Modo Desafio e o DEFCON entra a carga do dia (não no treino)
  const [cargaAberta, setCargaAberta] = useState(false);
  const [comecando, setComecando] = useState(false);
  // Primeiro DEFCON da vida + nenhum produto cadastrado → pula a carga do dia.
  // Decisão (05/09): no acesso demonstrativo o cadastro de produto NÃO é exigido —
  // a primeira venda tem que vir em minutos. A carga aparece a partir do 2º dia
  // (com o convite pra cadastrar) ou assim que ele tiver um produto.
  const [pulaCarga, setPulaCarga] = useState<boolean | null>(null);
  useEffect(() => {
    if (!user?.id || treino) { setPulaCarga(false); return; }
    let vivo = true;
    (async () => {
      const [{ count: sessoes }, { count: produtos }] = await Promise.all([
        supabase.from("challenge_sessions").select("id", { count: "exact", head: true }).eq("user_id", user.id),
        supabase.from("products").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("is_active", true),
      ]);
      if (vivo) setPulaCarga((sessoes ?? 0) === 0 && (produtos ?? 0) === 0);
    })().catch(() => { if (vivo) setPulaCarga(false); });
    return () => { vivo = false; };
  }, [user?.id, treino]);
  useEffect(() => {
    const id = setInterval(() => setMidnightTick((t) => t + 1), 30000);
    return () => clearInterval(id);
  }, []);

  // GPS: mede a distância REAL andada só enquanto o bloco está rodando (pausa no intervalo/almoço).
  const { distanceMeters } = useDistanceTracker(!treino && defcon.phase === "running");
  const distLatest = useRef(0);
  distLatest.current = distanceMeters;
  // Ao vivo usa o tracker; num reload de sessão encerrada usa o valor salvo no banco.
  const distToShow = distanceMeters > 0 ? distanceMeters : (defcon.sessionDistance || 0);
  // Ao terminar/encerrar, grava a distância na sessão (pro relatório e histórico).
  useEffect(() => {
    if (treino) return;
    if ((defcon.phase === "finished" || defcon.phase === "abandoned") && defcon.sessionId) {
      supabase.from("challenge_sessions").update({ distance_meters: Math.round(distLatest.current) } as never).eq("id", defcon.sessionId);
    }
  }, [defcon.phase, defcon.sessionId, treino]);

  // Valor da "venda rápida" = valor mais frequente do dia (mesmo critério dos
  // botões de venda rápida na tela). 0 = ainda sem nenhuma venda registrada.
  const quickSaleAmount = useMemo(() => {
    const sales = (defcon.sessionSales || []) as Array<{ amount?: number }>;
    const freq = new Map<number, number>();
    for (const s of sales) {
      const a = Number(s?.amount) || 0;
      if (a > 0) freq.set(a, (freq.get(a) || 0) + 1);
    }
    let best = 0;
    let bestN = 0;
    freq.forEach((n, val) => {
      if (n > bestN) {
        bestN = n;
        best = val;
      }
    });
    return best;
  }, [defcon.sessionSales]);

  // Registra uma venda E dispara a notificação "Venda realizada" com o valor EXATO
  // (no momento da venda, sem depender de recarregar a lista — senão pegava o valor
  // da venda anterior). Vale pra venda no app e pra venda rápida pela notificação.
  const handleAddSale = (amount: number, method: "dinheiro" | "pix" | "cartao" = "dinheiro") => {
    defcon.addSale(amount, method);
    if (
      !treino &&
      amount > 0 &&
      defcon.phase === "running" &&
      typeof navigator !== "undefined" &&
      "serviceWorker" in navigator
    ) {
      navigator.serviceWorker.ready
        .then((reg) => reg.active?.postMessage({ type: "orbis-venda-realizada", data: { amount } }))
        .catch(() => {});
    }
  };

  // Notificação na tela bloqueada (Android: botões; iPhone: 2 notificações de toque).
  // Fica visível durante toda a sessão (running + intervalos) e some ao terminar —
  // assim não re-emite a cada bloco (o que duplicaria no iPhone).
  const defconAtivo =
    !treino && ["running", "break", "block_report", "lunch_pause"].includes(defcon.phase);

  // Marca o usuário como "online" no ranking enquanto ele estiver no DEFCON.
  useDefconPresence(user?.id, defconAtivo);

  // Alerta de X1: notificação quando o oponente passa você + estado ao vivo pro
  // widget DENTRO da tela (faixa de placar + banner de virada com vibração).
  const x1Live = useX1DefconAlert(user?.id, defconAtivo);

  useDefconQuickNotification(defconAtivo, {
    totalSales: defcon.totalSalesCount ?? 0,
    totalApproaches: defcon.totalApproaches ?? 0,
    quickValue: quickSaleAmount,
    onVenda: () => {
      if (quickSaleAmount > 0) handleAddSale(quickSaleAmount, "pix");
    },
    onAbordagem: () => defcon.addApproach(),
  });

  if (authLoading || defcon.loading || !user) {
    return (
      <div className="min-h-[100dvh] bg-black pt-safe pb-safe flex items-center justify-center">
        <div className="text-2xl font-mono text-destructive animate-pulse">
          CARREGANDO DEFCON 4...
        </div>
      </div>
    );
  }

  if (!defcon.hasPlan) {
    return (
      <div className="min-h-[100dvh] bg-black pt-safe pb-safe flex flex-col items-center justify-center px-6">
        <div className="text-6xl mb-6">⚠️</div>
        <h1 className="text-2xl font-bold text-white mb-3">Sem plano hoje</h1>
        <p className="text-sm text-neutral-500 font-mono text-center mb-8">
          Vá até o Ritmo para criar seu plano do dia antes de iniciar o DEFCON 4.
        </p>
        <button
          onClick={() => navigate("/daily-goals")}
          className="h-14 px-8 bg-neutral-900 border border-neutral-700 text-white font-bold rounded-xl active:scale-95 transition-transform"
        >
          IR PARA O RITMO
        </button>
      </div>
    );
  }

  const handleExit = () => navigate("/daily-goals");

  // Inicia o DEFCON. Pede a permissão de notificação AQUI, dentro do toque — porque
  // o iPhone só mostra o prompt se ele for disparado por um gesto do usuário. Sem
  // isso, quem está no iOS nunca era perguntado e a notificação de venda/abordagem
  // (e a de "venda realizada") não aparecia. Espera a resposta antes de começar,
  // assim a sessão já arranca com a permissão resolvida.
  const handleStart = async () => {
    try {
      if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") {
        await Notification.requestPermission();
      }
    } catch {
      /* ignora — em aparelho sem suporte, segue sem notificação */
    }
    defcon.startChallenge();
  };

  const screen = (() => {
  switch (defcon.phase) {
    case "idle":
      if (cargaAberta && !treino) {
        return (
          <DefconCargaDoDia
            userId={user.id}
            dailyGoal={defcon.dailyGoal}
            starting={comecando}
            onComecar={async () => { setComecando(true); try { await handleStart(); } finally { setComecando(false); setCargaAberta(false); } }}
          />
        );
      }
      return (
        <DefconStartScreen
          dailyGoal={defcon.dailyGoal}
          totalBlocks={defcon.blocks.length}
          onStart={treino || pulaCarga || (pulaCarga === null && primeiroDia) ? handleStart : () => setCargaAberta(true)}
          onExit={handleExit}
          onboardingMode={treino}
          primeiroDia={primeiroDia && !treino}
        />
      );

    case "running":
      return (
        <DefconRunning
          userId={user.id}
          dailyGoal={defcon.dailyGoal}
          totalSold={defcon.totalSold}
          currentBlock={defcon.currentBlock}
          currentBlockIndex={defcon.currentBlockIndex}
          totalBlocks={defcon.blocks.length}
          remainingSeconds={defcon.remainingSeconds}
          blockStartedAt={defcon.blockStartedAt}
          blockEndTime={defcon.blockEndTime}
          lunchPauseUsed={defcon.lunchPauseUsed}
          blockApproaches={defcon.blockApproaches}
          totalApproaches={defcon.totalApproaches}
          totalSalesCount={defcon.totalSalesCount}
          blockSalesCount={defcon.blockSalesCount}
          onAddSale={handleAddSale}
          onAddTip={defcon.addTip}
          onAddApproach={defcon.addApproach}
          onAddOccurrence={defcon.addOccurrence}
          onEnd={treino ? defcon.endChallenge : () => setConfirmarFim(true)}
          onLunchPause={defcon.startLunchPause}
          sessionSales={defcon.sessionSales}
          onDeleteSale={defcon.deleteSale}
          onboardingMode={treino}
          quickSaleValue={defcon.quickSaleValue}
          x1Live={treino ? undefined : x1Live}
        />
      );

    case "block_report":
      return defcon.blockReportData ? (
        <DefconBlockReport
          blockIndex={defcon.blockReportData.blockIndex}
          approaches={defcon.blockReportData.approaches}
          sales={defcon.blockReportData.sales}
          soldAmount={defcon.blockReportData.soldAmount}
          distanceMeters={distToShow}
          totalSalesCount={defcon.totalSalesCount}
          onContinue={defcon.dismissBlockReport}
        />
      ) : null;

    case "break":
      return (
        <DefconBreak
          breakRemaining={defcon.breakRemaining}
          currentBlockIndex={defcon.currentBlockIndex}
          blockSold={defcon.currentBlock?.achieved_amount || 0}
          onSkip={defcon.skipBreak}
        />
      );

    case "lunch_pause":
      return (
        <DefconLunchPause
          lunchPauseRemaining={defcon.lunchPauseRemaining}
          totalSold={defcon.totalSold}
          onSkip={defcon.skipLunchPause}
        />
      );

    case "finished":
    case "abandoned":
      if (treino) return null; // no treino, o card "treino concluído" cobre a tela
      return (
        <>
          {/* Etapa 1 da Onda 2 (Rick, 05/09): fechamento em 3 passos + relatório +
              "o que mexeu". A DefconEndScreen antiga continua no repositório
              (rollback = trocar o import). distanceMeters ficou de fora: o GPS agora é
              opcional e o relatório já esconde a linha quando é zero. */}
          <DefconFechamento
            phase={defcon.phase}
            totalSold={defcon.totalSold}
            dailyGoal={defcon.dailyGoal}
            workedMinutes={defcon.workedMinutes ?? (defcon.currentBlockIndex * 60 + Math.min(60, Math.max(0, Math.round((60 * 60 - defcon.remainingSeconds) / 60))))}
            totalApproaches={defcon.totalApproaches}
            totalSalesCount={defcon.totalSalesCount}
            userId={user.id}
            onSaveBreakdown={defcon.savePaymentBreakdown}
            onExit={handleExit}
            onExtend={treino ? undefined : defcon.extendChallenge}
            onRestart={treino ? undefined : defcon.restartChallenge}
          />
          {/* Popup do extrato do dia — ao terminar OU sair do DEFCON (não no treino). */}
          {["finished", "abandoned"].includes(defcon.phase) && !treino && <ExtratoDailyModal userId={user.id} />}
        </>
      );

    default:
      return null;
  }
  })();

  // VIRADA DE MEIA-NOITE: sessão ainda aberta de ONTEM (madrugada). Primeiro PERGUNTA
  // ("continuar vendendo ou encerrar?"); depois da escolha, fica só a faixa lembrando.
  const overnight =
    !treino &&
    defcon.sessionDate &&
    defcon.sessionDate < getBrazilDate() &&
    ["running", "break", "block_report", "lunch_pause"].includes(defcon.phase);
  const overnightLabel = defcon.sessionDate
    ? new Date(defcon.sessionDate + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })
    : "";
  const askKey = user && defcon.sessionDate ? `orbis_midnight_ask_${user.id}_${defcon.sessionDate}` : null;
  const jaPerguntou = askKey ? localStorage.getItem(askKey) === "1" : true;
  const mostrarPergunta = Boolean(overnight && !jaPerguntou);
  const marcarPerguntado = () => { try { if (askKey) localStorage.setItem(askKey, "1"); } catch { /* ignore */ } setMidnightTick((t) => t + 1); };

  return (
    <>
      {/* Encerrar o dia — confirmação (tela 7 do fluxo aprovado) */}
      {confirmarFim && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center px-4 pb-8" style={{ background: "rgba(0,0,0,.86)" }} role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-[24px] border p-6" style={{ background: "var(--orbis-surface)", borderColor: "rgba(255,255,255,.12)" }}>
            <p className="font-display text-[19px] font-extrabold text-center">Encerrar o desafio?</p>
            <p className="text-[13px] text-center mt-2 leading-relaxed" style={{ color: "var(--orbis-fg-2)" }}>
              Você fecha o dia e vê seu relatório completo. Dá pra reabrir depois.
            </p>
            <button onClick={() => { setConfirmarFim(false); void defcon.endChallenge(); }}
              className="w-full h-[52px] rounded-[16px] mt-5 font-extrabold text-[15px] active:scale-[.98] transition"
              style={{ background: "#E5737F", color: "#1A0A0C" }}>SIM, ENCERRAR</button>
            <button onClick={() => setConfirmarFim(false)} className="w-full h-11 mt-2 text-[13.5px] font-semibold" style={{ color: "var(--orbis-fg-3)" }}>Voltar</button>
          </div>
        </div>
      )}

      {/* Pergunta da virada: continuar no mesmo desafio ou encerrar de vez? */}
      {mostrarPergunta && (
        <div className="fixed inset-0 z-[70] bg-black/85 flex items-center justify-center px-6">
          <div className="w-full max-w-sm rounded-2xl bg-neutral-900 border border-amber-500/40 p-5 space-y-4">
            <div className="text-center">
              <div className="text-4xl mb-2">🕛</div>
              <p className="text-lg font-black text-white">Passou da meia-noite!</p>
              <p className="text-sm text-neutral-300 mt-2 leading-relaxed">
                Você ainda está no DEFCON do dia <b className="text-amber-400">{overnightLabel}</b>.
                Quer <b>continuar vendendo</b> nele (pode seguir mais blocos — tudo conta pro dia {overnightLabel})
                ou <b>encerrar agora</b>?
              </p>
            </div>
            <button
              onClick={marcarPerguntado}
              className="w-full py-3 rounded-xl bg-amber-500 text-black font-black text-sm active:scale-[0.98] transition"
            >
              CONTINUAR VENDENDO — conta pro dia {overnightLabel}
            </button>
            <button
              onClick={() => { marcarPerguntado(); defcon.endChallenge(); }}
              className="w-full py-3 rounded-xl border border-neutral-700 text-neutral-300 font-bold text-sm active:scale-[0.98] transition"
            >
              Encerrar agora — fecha o dia {overnightLabel} de vez
            </button>
            <p className="text-[11px] text-neutral-500 text-center leading-relaxed">
              Depois de encerrar é definitivo: o próximo DEFCON já começa no novo dia, do zero.
            </p>
          </div>
        </div>
      )}
      {/* Faixa-lembrete enquanto a sessão de ontem segue aberta */}
      {overnight && jaPerguntou && (
        <div className="fixed top-0 inset-x-0 z-[60] bg-amber-500/95 text-black text-[12px] font-semibold px-4 py-2 text-center" style={{ paddingTop: "max(env(safe-area-inset-top), 8px)" }}>
          🕛 Este DEFCON é de {overnightLabel} — tudo conta pra esse dia até você ENCERRAR.
        </div>
      )}
      {screen}
      {treino && user && !treinoConcluido && !["finished", "abandoned"].includes(defcon.phase) && (
        <DefconTour
          phase={defcon.phase}
          totalApproaches={defcon.totalApproaches ?? 0}
          totalSalesCount={defcon.totalSalesCount ?? 0}
          onConcluir={() => setTreinoConcluido(true)}
        />
      )}
      {treino && user && (treinoConcluido || ["finished", "abandoned"].includes(defcon.phase)) && (
        <TreinoConcluido onVoltar={concluirTreino} />
      )}
      {/* Card de 1ª vez do DEFCON (rota fora do layout, então renderiza aqui):
          venda em 2 toques, offline continua registrando, encerrar o dia. */}
      {!treino && user && <FirstTimeCard tela="defcon" userId={user.id} />}
    </>
  );
}
