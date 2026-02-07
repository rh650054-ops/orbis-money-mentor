import { useState } from "react";
import { formatCurrency } from "@/lib/utils";

interface DefconEndScreenProps {
  phase: "finished" | "abandoned";
  totalSold: number;
  dailyGoal: number;
  totalBlocks: number;
  onSaveBreakdown: (dinheiro: number, cartao: number, pix: number) => Promise<void>;
  onExit: () => void;
}

export function DefconEndScreen({
  phase,
  totalSold,
  dailyGoal,
  totalBlocks,
  onSaveBreakdown,
  onExit,
}: DefconEndScreenProps) {
  const [showBreakdown, setShowBreakdown] = useState(true);
  const [dinheiro, setDinheiro] = useState("");
  const [cartao, setCartao] = useState("");
  const [pix, setPix] = useState("");
  const [saving, setSaving] = useState(false);

  const dinheiroNum = parseFloat(dinheiro) || 0;
  const cartaoNum = parseFloat(cartao) || 0;
  const pixNum = parseFloat(pix) || 0;
  const totalInformado = dinheiroNum + cartaoNum + pixNum;
  const calote = Math.max(0, totalSold - totalInformado);

  const percentage = dailyGoal > 0 ? (totalSold / dailyGoal) * 100 : 0;
  const goalReached = totalSold >= dailyGoal;

  const handleSaveBreakdown = async () => {
    setSaving(true);
    await onSaveBreakdown(dinheiroNum, cartaoNum, pixNum);
    setSaving(false);
    setShowBreakdown(false);
  };

  // Payment breakdown form
  if (showBreakdown && totalSold > 0) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center px-6 select-none">
        <div className="text-center mb-8">
          <div className="text-xs font-mono text-neutral-600 tracking-[0.3em] uppercase mb-3">
            {phase === "abandoned" ? "Desafio encerrado" : "Desafio concluído"}
          </div>
          <div className="text-3xl font-black text-white mb-2">
            {formatCurrency(totalSold)}
          </div>
          <p className="text-sm font-mono text-neutral-500">
            Informe como recebeu esse valor
          </p>
        </div>

        <div className="w-full max-w-sm space-y-4 mb-6">
          {/* Dinheiro */}
          <div className="bg-neutral-900 rounded-xl p-4">
            <label className="text-xs font-mono text-green-500 tracking-widest uppercase mb-2 block">
              💵 Dinheiro
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg text-neutral-600 font-bold">R$</span>
              <input
                type="number"
                inputMode="decimal"
                value={dinheiro}
                onChange={(e) => setDinheiro(e.target.value)}
                placeholder="0"
                className="w-full h-14 bg-black border border-neutral-700 rounded-lg text-right text-2xl font-black text-white pr-4 pl-12 focus:outline-none focus:border-green-500 transition-colors placeholder:text-neutral-700"
              />
            </div>
          </div>

          {/* Cartão */}
          <div className="bg-neutral-900 rounded-xl p-4">
            <label className="text-xs font-mono text-blue-500 tracking-widest uppercase mb-2 block">
              💳 Cartão
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg text-neutral-600 font-bold">R$</span>
              <input
                type="number"
                inputMode="decimal"
                value={cartao}
                onChange={(e) => setCartao(e.target.value)}
                placeholder="0"
                className="w-full h-14 bg-black border border-neutral-700 rounded-lg text-right text-2xl font-black text-white pr-4 pl-12 focus:outline-none focus:border-blue-500 transition-colors placeholder:text-neutral-700"
              />
            </div>
          </div>

          {/* Pix */}
          <div className="bg-neutral-900 rounded-xl p-4">
            <label className="text-xs font-mono text-purple-500 tracking-widest uppercase mb-2 block">
              📱 Pix
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg text-neutral-600 font-bold">R$</span>
              <input
                type="number"
                inputMode="decimal"
                value={pix}
                onChange={(e) => setPix(e.target.value)}
                placeholder="0"
                className="w-full h-14 bg-black border border-neutral-700 rounded-lg text-right text-2xl font-black text-white pr-4 pl-12 focus:outline-none focus:border-purple-500 transition-colors placeholder:text-neutral-700"
              />
            </div>
          </div>

          {/* Calote auto-calculated */}
          <div className="bg-neutral-900 border border-red-900/30 rounded-xl p-4">
            <div className="flex justify-between items-center">
              <span className="text-xs font-mono text-red-500 tracking-widest uppercase">
                ⚠️ Calote
              </span>
              <span className={`text-2xl font-black ${calote > 0 ? "text-red-500" : "text-neutral-600"}`}>
                {formatCurrency(calote)}
              </span>
            </div>
            <p className="text-xs text-neutral-700 font-mono mt-1">
              Calculado automaticamente
            </p>
          </div>

          {/* Validation hint */}
          {totalInformado > totalSold && (
            <p className="text-xs text-red-500 font-mono text-center">
              Total informado ({formatCurrency(totalInformado)}) excede o vendido ({formatCurrency(totalSold)})
            </p>
          )}
        </div>

        <button
          onClick={handleSaveBreakdown}
          disabled={saving || totalInformado > totalSold}
          className="w-full max-w-sm h-14 bg-white text-black font-black text-lg rounded-xl active:scale-95 transition-transform disabled:opacity-30"
        >
          {saving ? "SALVANDO..." : "SALVAR E FINALIZAR"}
        </button>
      </div>
    );
  }

  // Summary screen after breakdown
  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center px-6 select-none">
      {/* Status */}
      <div className="text-center mb-10">
        <div className="text-xs font-mono text-neutral-600 tracking-[0.3em] uppercase mb-4">
          {phase === "abandoned" ? "Desafio encerrado" : "Desafio concluído"}
        </div>

        {phase === "abandoned" ? (
          <div className="text-6xl mb-4">⛔</div>
        ) : goalReached ? (
          <div className="text-6xl mb-4">🏆</div>
        ) : (
          <div className="text-6xl mb-4">📊</div>
        )}
      </div>

      {/* Stats */}
      <div className="w-full max-w-sm space-y-6 mb-10">
        <div className="bg-neutral-900 rounded-xl p-6 space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-sm font-mono text-neutral-500">Total vendido</span>
            <span className="text-2xl font-black text-white">
              {formatCurrency(totalSold)}
            </span>
          </div>

          <div className="h-px bg-neutral-800" />

          <div className="flex justify-between items-center">
            <span className="text-sm font-mono text-neutral-500">Meta</span>
            <span className="text-lg font-bold text-neutral-400">
              {formatCurrency(dailyGoal)}
            </span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-sm font-mono text-neutral-500">Progresso</span>
            <span className={`text-lg font-bold ${
              goalReached ? "text-green-500" : "text-red-500"
            }`}>
              {percentage.toFixed(0)}%
            </span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-sm font-mono text-neutral-500">Blocos completados</span>
            <span className="text-lg font-bold text-white">{totalBlocks}</span>
          </div>
        </div>

        {/* Cold message */}
        <p className="text-center text-sm text-neutral-600 font-mono">
          {phase === "abandoned"
            ? "Você encerrou antes do tempo. Streak perdida."
            : goalReached
            ? "Missão cumprida. Sem mais o que dizer."
            : "Números não mentem. Amanhã tem mais."
          }
        </p>
      </div>

      {/* Exit */}
      <button
        onClick={onExit}
        className="w-full max-w-sm h-14 bg-neutral-900 border border-neutral-800 text-white font-bold text-lg rounded-xl active:scale-95 transition-transform"
      >
        SAIR
      </button>
    </div>
  );
}
