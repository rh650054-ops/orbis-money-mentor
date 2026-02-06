import { useState } from "react";
import { formatCurrency } from "@/lib/utils";

interface DefconDecisionProps {
  saleAmount: number;
  onAdvance: () => void;
  onEnd: () => void;
}

export function DefconDecision({ saleAmount, onAdvance, onEnd }: DefconDecisionProps) {
  const [showConfirmEnd, setShowConfirmEnd] = useState(false);

  // Cold feedback
  const feedback =
    saleAmount > 0
      ? "Bloco concluído. Continue."
      : "Tempo passou. Nada entrou.";

  if (showConfirmEnd) {
    return (
      <div className="flex flex-col items-center gap-8 w-full max-w-sm">
        <div className="text-center space-y-3">
          <div className="text-6xl">⚠️</div>
          <div className="text-xl font-bold text-white">
            Encerrar o desafio?
          </div>
          <p className="text-sm text-neutral-500 font-mono">
            Você perde a streak. Tem certeza?
          </p>
        </div>

        <div className="w-full space-y-3">
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
    <div className="flex flex-col items-center gap-10 w-full max-w-sm">
      {/* Feedback */}
      <div className="text-center space-y-4">
        <div className="text-sm font-mono text-neutral-600">
          {formatCurrency(saleAmount)} registrado
        </div>
        <p className="text-xl text-neutral-400 font-medium">
          {feedback}
        </p>
      </div>

      {/* Action buttons */}
      <div className="w-full space-y-4">
        <button
          onClick={onAdvance}
          className="w-full h-16 bg-white text-black font-black text-xl rounded-xl flex items-center justify-center gap-3 active:scale-95 transition-transform"
        >
          🔁 AVANÇAR PARA O PRÓXIMO BLOCO
        </button>

        <button
          onClick={() => setShowConfirmEnd(true)}
          className="w-full h-14 bg-transparent border-2 border-red-900 text-red-500 font-bold text-base rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-transform"
        >
          ⛔ ENCERRAR DESAFIO
        </button>
      </div>
    </div>
  );
}
