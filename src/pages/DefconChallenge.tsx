import { useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useDefconChallenge } from "@/hooks/useDefconChallenge";
import { useDefconOnboarding } from "@/hooks/useDefconOnboarding";
import { useDefconQuickNotification } from "@/hooks/useDefconQuickNotification";
import { useDefconPresence } from "@/hooks/useDefconPresence";
import MissionOrchestrator from "@/components/onboarding/mission/MissionOrchestrator";
import ScreenCoach from "@/components/onboarding/ScreenCoach";
import { DefconStartScreen } from "@/components/defcon/DefconStartScreen";
import { DefconRunning } from "@/components/defcon/DefconRunning";
import { DefconBreak } from "@/components/defcon/DefconBreak";
import { DefconEndScreen } from "@/components/defcon/DefconEndScreen";
import { DefconLunchPause } from "@/components/defcon/DefconLunchPause";
import { DefconBlockReport } from "@/components/defcon/DefconBlockReport";
import { DefconDayReport } from "@/components/defcon/DefconDayReport";

export default function DefconChallenge() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const treino = params.get("treino") === "1";
  const { user, loading: authLoading } = useAuth();
  const realDefcon = useDefconChallenge(treino ? undefined : user?.id);
  const onbDefcon = useDefconOnboarding(user?.id);
  const defcon: any = treino ? onbDefcon : realDefcon;

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [user, authLoading, navigate]);

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

  const screen = (() => {
  switch (defcon.phase) {
    case "idle":
      return (
        <DefconStartScreen
          dailyGoal={defcon.dailyGoal}
          totalBlocks={defcon.blocks.length}
          onStart={defcon.startChallenge}
          onExit={handleExit}
          onboardingMode={treino}
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
          onEnd={defcon.endChallenge}
          onLunchPause={defcon.startLunchPause}
          sessionSales={defcon.sessionSales}
          onDeleteSale={defcon.deleteSale}
          onboardingMode={treino}
          quickSaleValue={defcon.quickSaleValue}
        />
      );

    case "block_report":
      return defcon.blockReportData ? (
        <DefconBlockReport
          blockIndex={defcon.blockReportData.blockIndex}
          approaches={defcon.blockReportData.approaches}
          sales={defcon.blockReportData.sales}
          soldAmount={defcon.blockReportData.soldAmount}
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
      return (
        <DefconEndScreen
          phase={defcon.phase}
          totalSold={defcon.totalSold}
          dailyGoal={defcon.dailyGoal}
          totalBlocks={defcon.currentBlockIndex + 1}
          workedMinutes={defcon.currentBlockIndex * 60 + Math.min(60, Math.max(0, Math.round((60 * 60 - defcon.remainingSeconds) / 60)))}
          totalApproaches={defcon.totalApproaches}
          totalSalesCount={defcon.totalSalesCount}
          userId={user.id}
          onSaveBreakdown={defcon.savePaymentBreakdown}
          onExit={handleExit}
          onExtend={treino ? undefined : defcon.extendChallenge}
          onRestart={treino ? undefined : defcon.restartChallenge}
        />
      );

    default:
      return null;
  }
  })();

  return (
    <>
      {screen}
      {treino && user && (
        <MissionOrchestrator userId={user.id} nickname={null} onCompleted={() => {}} />
      )}
      {/* Coach por tela no DEFCON real (rota fica fora do layout, então renderiza aqui).
          Explica as funções: iniciar, venda rápida, cobrança no WhatsApp e abordagem. */}
      {!treino && user && <ScreenCoach userId={user.id} />}
    </>
  );
}
