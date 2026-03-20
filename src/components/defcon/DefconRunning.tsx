import { useState } from "react";
import { formatCurrency } from "@/lib/utils";
import { Plus, X, UtensilsCrossed, UserRound, FileText } from "lucide-react";
import { DefconBlock } from "@/hooks/useDefconChallenge";
import { DefconQuickSaleButtons } from "./DefconQuickSaleButtons";
import { DefconOccurrenceModal } from "./DefconOccurrenceModal";
import { DefconSmartNotification } from "./DefconSmartNotification";

interface DefconRunningProps {
  userId: string;
  dailyGoal: number;
  totalSold: number;
  currentBlock: DefconBlock | null;
  currentBlockIndex: number;
  totalBlocks: number;
  remainingSeconds: number;
  blockStartedAt: Date | null;
  blockEndTime: Date | null;
  lunchPauseUsed: boolean;
  blockApproaches: number;
  totalApproaches: number;
  totalSalesCount: number;
  blockSalesCount: number;
  onAddSale: (amount: number) => void;
  onAddApproach: () => void;
  onAddOccurrence: (description: string) => void;
  onEnd: () => void;
  onLunchPause: (minutes: number) => void;
}

export function DefconRunning({
  userId,
  dailyGoal,
  totalSold,
  currentBlock,
  currentBlockIndex,
  totalBlocks,
  remainingSeconds,
  blockStartedAt,
  blockEndTime,
  lunchPauseUsed,
  blockApproaches,
  totalApproaches,
  totalSalesCount,
  blockSalesCount,
  onAddSale,
  onAddApproach,
  onAddOccurrence,
  onEnd,
  onLunchPause,
}: DefconRunningProps) {
  const [showAddSale, setShowAddSale] = useState(false);
  const [saleValue, setSaleValue] = useState("");
  const [showConfirmEnd, setShowConfirmEnd] = useState(false);
  const [showLunchPicker, setShowLunchPicker] = useState(false);
  const [customLunchMinutes, setCustomLunchMinutes] = useState("");
  const [showOccurrence, setShowOccurrence] = useState(false);
  const [saleHistory, setSaleHistory] = useState<number[]>([]);

  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  const progress = ((60 * 60 - remainingSeconds) / (60 * 60)) * 100;
  const isUrgent = remainingSeconds < 300; // last 5 minutes

  const remaining = Math.max(0, dailyGoal - totalSold);

  const formatTime = (date: Date | null) => {
    if (!date) return "--:--";
    return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
  };

  const registerSale = (amount: number) => {
    onAddSale(amount);
    setSaleHistory((prev) => [...prev, amount]);
  };

  const handleAddSale = () => {
    const amount = parseFloat(saleValue) || 0;
    if (amount > 0) {
      registerSale(amount);
      setSaleValue("");
      setShowAddSale(false);
    }
  };

  const blockSold = currentBlock
    ? (currentBlock.valor_dinheiro + currentBlock.valor_cartao + currentBlock.valor_pix + currentBlock.valor_calote)
    : 0;

  // Confirm end screen
  if (showConfirmEnd) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center px-6 select-none">
        <div className="text-center space-y-3 mb-8">
          <div className="text-6xl">⚠️</div>
          <div className="text-xl font-bold text-white">Encerrar o desafio?</div>
          <p className="text-sm text-neutral-500 font-mono">
            Você perde a streak. Tem certeza?
          </p>
        </div>
        <div className="w-full max-w-sm space-y-3">
          <button
            onClick={onEnd}
            className="w-full h-14 bg-red-600 text-white font-black text-lg rounded-xl active:scale-95 transition-transform"
          >
            SIM, ENCERRAR
          </button>
          <button
            onClick={() => setShowConfirmEnd(false)}
            className="w-full h-14 bg-neutral-900 border border-neutral-700 text-neutral-400 font-bold text-lg rounded-xl active:scale-95 transition-transform"
          >
            VOLTAR
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black flex flex-col select-none">
      {/* Smart approach notifications */}
      <DefconSmartNotification
        userId={userId}
        totalApproaches={totalApproaches}
        totalSalesCount={totalSalesCount}
        blockApproaches={blockApproaches}
        blockSalesCount={blockSalesCount}
        phase="running"
        currentBlockIndex={currentBlockIndex}
      />
      {/* Mission header */}
      <div className="pt-12 pb-4 px-6 text-center">
        <div className="text-xs font-mono text-red-500/60 tracking-[0.3em] uppercase mb-2">
          🎯 Missão
        </div>
        <div className="text-2xl md:text-3xl font-black text-white tracking-tight">
          Vender {formatCurrency(dailyGoal)}
        </div>
        {totalSold > 0 && (
          <div className="mt-2 text-sm font-mono text-neutral-500">
            Faltam {formatCurrency(remaining)}
          </div>
        )}
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 gap-8">
        {/* Block info */}
        <div className="text-center">
          <div className="text-xs font-mono text-neutral-600 tracking-[0.3em] uppercase mb-1">
            Bloco #{currentBlockIndex + 1}
          </div>
          <div className="text-sm font-mono text-neutral-500">
            {formatTime(blockStartedAt)} → {formatTime(blockEndTime)}
          </div>
        </div>

        {/* Timer */}
        <div
          className={`text-8xl md:text-9xl font-black font-mono tabular-nums tracking-tighter ${
            isUrgent ? "text-red-500 animate-pulse" : "text-white"
          }`}
        >
          {String(minutes).padStart(2, "0")}
          <span className={isUrgent ? "text-red-500/50" : "text-white/30"}>:</span>
          {String(seconds).padStart(2, "0")}
        </div>

        {/* Progress bar */}
        <div className="w-full max-w-md h-1 bg-neutral-900 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-1000 ease-linear rounded-full ${
              isUrgent ? "bg-red-500" : "bg-white/20"
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Approaches counter */}
        <div className="text-center">
          <div className="text-sm font-mono text-neutral-600 mb-1">Abordagens neste bloco</div>
          <div className="text-2xl font-black text-blue-400">{blockApproaches}</div>
        </div>

        {/* Block sales total */}
        <div className="text-center">
          <div className="text-sm font-mono text-neutral-600 mb-1">Vendido neste bloco</div>
          <div className="text-3xl font-black text-white">
            {formatCurrency(blockSold)}
          </div>
        </div>

        {/* Quick sale buttons */}
        <DefconQuickSaleButtons
          saleHistory={saleHistory}
          onQuickSale={registerSale}
        />

        {/* Action buttons row */}
        <div className="flex items-center gap-6">
          {/* Approach button */}
          <button
            onClick={onAddApproach}
            className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center active:scale-90 transition-transform shadow-lg shadow-blue-600/30"
          >
            <UserRound className="w-8 h-8 text-white" strokeWidth={2.5} />
          </button>

          {/* Add sale button */}
          <button
            onClick={() => setShowAddSale(true)}
            className="w-20 h-20 bg-green-600 rounded-full flex items-center justify-center active:scale-90 transition-transform shadow-lg shadow-green-600/30"
          >
            <Plus className="w-10 h-10 text-white" strokeWidth={3} />
          </button>
        </div>

        {/* Mantra */}
        <p className="text-sm text-neutral-700 font-mono italic">
          "Venda agora. Pense depois."
        </p>
      </div>

      {/* Footer */}
      <div className="pb-6 px-6 flex justify-between items-center">
        <span className="text-xs font-mono text-neutral-600 tracking-widest uppercase">
          Bloco {currentBlockIndex + 1}/{totalBlocks} • {formatCurrency(totalSold)} total
        </span>
        <div className="flex items-center gap-4">
          <button
            onClick={() => setShowOccurrence(true)}
            className="text-xs font-mono text-neutral-600 active:text-neutral-300 transition-colors flex items-center gap-1"
          >
            <FileText className="w-3 h-3" />
            OCORRÊNCIA
          </button>
          {!lunchPauseUsed && (
            <button
              onClick={() => setShowLunchPicker(true)}
              className="text-xs font-mono text-amber-700 active:text-amber-400 transition-colors flex items-center gap-1"
            >
              <UtensilsCrossed className="w-3 h-3" />
              ALMOÇO
            </button>
          )}
          <button
            onClick={() => setShowConfirmEnd(true)}
            className="text-xs font-mono text-red-900 active:text-red-500 transition-colors"
          >
            ENCERRAR
          </button>
        </div>
      </div>

      {/* Add sale modal */}
      {showAddSale && (
        <div className="fixed inset-0 bg-black/90 flex items-end justify-center z-50">
          <div className="w-full max-w-md bg-neutral-900 rounded-t-3xl p-6 pb-10 space-y-6 animate-in slide-in-from-bottom duration-200">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold text-white">Registrar venda</h3>
              <button onClick={() => { setShowAddSale(false); setSaleValue(""); }}>
                <X className="w-6 h-6 text-neutral-500" />
              </button>
            </div>

            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl text-neutral-600 font-bold">
                R$
              </span>
              <input
                type="number"
                inputMode="decimal"
                value={saleValue}
                onChange={(e) => setSaleValue(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddSale()}
                placeholder="0"
                autoFocus
                className="w-full h-20 bg-black border-2 border-neutral-700 rounded-xl text-center text-4xl font-black text-white pl-16 pr-4 focus:outline-none focus:border-green-500 transition-colors placeholder:text-neutral-700"
              />
            </div>

            <button
              onClick={handleAddSale}
              disabled={!saleValue || parseFloat(saleValue) <= 0}
              className="w-full h-16 bg-green-600 text-white font-black text-xl rounded-xl disabled:opacity-30 active:scale-95 transition-transform"
            >
              + REGISTRAR
            </button>
          </div>
        </div>
      )}

      {/* Lunch pause duration picker */}
      {showLunchPicker && (
        <div className="fixed inset-0 bg-black/90 flex items-end justify-center z-50">
          <div className="w-full max-w-md bg-neutral-900 rounded-t-3xl p-6 pb-10 space-y-6 animate-in slide-in-from-bottom duration-200">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold text-white">🍽️ Pausa para almoço</h3>
              <button onClick={() => { setShowLunchPicker(false); setCustomLunchMinutes(""); }}>
                <X className="w-6 h-6 text-neutral-500" />
              </button>
            </div>
            <p className="text-sm text-neutral-500 font-mono">
              Escolha o tempo de pausa. Você só pode usar 1 vez por dia.
            </p>
            <div className="grid grid-cols-4 gap-2">
              {[15, 30, 45, 60].map((min) => (
                <button
                  key={min}
                  onClick={() => setCustomLunchMinutes(String(min))}
                  className={`h-12 rounded-xl font-bold text-sm active:scale-95 transition-all border ${
                    customLunchMinutes === String(min)
                      ? "bg-amber-600 border-amber-500 text-white"
                      : "bg-neutral-800 border-neutral-700 text-neutral-300"
                  }`}
                >
                  {min} min
                </button>
              ))}
            </div>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-neutral-600 font-mono">
                min
              </span>
              <input
                type="number"
                inputMode="numeric"
                value={customLunchMinutes}
                onChange={(e) => setCustomLunchMinutes(e.target.value)}
                placeholder="Ou digite os minutos"
                className="w-full h-14 bg-black border-2 border-neutral-700 rounded-xl text-center text-2xl font-black text-white pl-12 pr-4 focus:outline-none focus:border-amber-500 transition-colors placeholder:text-neutral-700 placeholder:text-sm"
              />
            </div>
            <button
              onClick={() => {
                const mins = parseInt(customLunchMinutes) || 0;
                if (mins > 0 && mins <= 180) {
                  setShowLunchPicker(false);
                  setCustomLunchMinutes("");
                  onLunchPause(mins);
                }
              }}
              disabled={!customLunchMinutes || parseInt(customLunchMinutes) <= 0 || parseInt(customLunchMinutes) > 180}
              className="w-full h-14 bg-amber-600 text-white font-black text-lg rounded-xl disabled:opacity-30 active:scale-95 transition-transform"
            >
              INICIAR PAUSA
            </button>
          </div>
        </div>
      )}

      {/* Occurrence modal */}
      {showOccurrence && (
        <DefconOccurrenceModal
          onSave={(desc) => {
            onAddOccurrence(desc);
            setShowOccurrence(false);
          }}
          onClose={() => setShowOccurrence(false)}
        />
      )}
    </div>
  );
}
