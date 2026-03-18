import { formatCurrency } from "@/lib/utils";

interface DefconBlockReportProps {
  blockIndex: number;
  approaches: number;
  sales: number;
  soldAmount: number;
  onContinue: () => void;
}

export function DefconBlockReport({
  blockIndex,
  approaches,
  sales,
  soldAmount,
  onContinue,
}: DefconBlockReportProps) {
  const conversionRate = approaches > 0 ? (sales / approaches) * 100 : 0;

  const getMessage = () => {
    if (approaches === 0) return "Nenhuma abordagem registrada neste bloco.";
    if (conversionRate < 15) return "Taxa baixa. Tente abordar com mais confiança e sorria mais.";
    if (conversionRate <= 30) return `Bom ritmo! A cada 10 abordagens você fecha ~${Math.round(conversionRate / 10)} vendas.`;
    return "Excelente conversão! Você está no modo elite hoje.";
  };

  const getEmoji = () => {
    if (approaches === 0) return "📋";
    if (conversionRate < 15) return "💪";
    if (conversionRate <= 30) return "🔥";
    return "🏆";
  };

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center px-6 select-none">
      <div className="text-center mb-8">
        <div className="text-6xl mb-4">{getEmoji()}</div>
        <div className="text-xs font-mono text-neutral-600 tracking-[0.3em] uppercase mb-2">
          Relatório do Bloco #{blockIndex + 1}
        </div>
      </div>

      <div className="w-full max-w-sm space-y-3 mb-8">
        <div className="bg-neutral-900 rounded-xl p-4 flex justify-between items-center">
          <span className="text-sm font-mono text-neutral-500">👤 Abordagens</span>
          <span className="text-2xl font-black text-white">{approaches}</span>
        </div>

        <div className="bg-neutral-900 rounded-xl p-4 flex justify-between items-center">
          <span className="text-sm font-mono text-neutral-500">🛒 Vendas</span>
          <span className="text-2xl font-black text-green-500">{sales}</span>
        </div>

        <div className="bg-neutral-900 rounded-xl p-4 flex justify-between items-center">
          <span className="text-sm font-mono text-neutral-500">💰 Valor vendido</span>
          <span className="text-xl font-black text-white">{formatCurrency(soldAmount)}</span>
        </div>

        <div className="bg-neutral-900 border border-neutral-700 rounded-xl p-4 flex justify-between items-center">
          <span className="text-sm font-mono text-neutral-500">📊 Conversão</span>
          <span className={`text-2xl font-black ${
            conversionRate >= 30 ? "text-green-500" : conversionRate >= 15 ? "text-amber-500" : "text-red-500"
          }`}>
            {conversionRate.toFixed(0)}%
          </span>
        </div>
      </div>

      <p className="text-sm text-neutral-500 font-mono text-center mb-8 max-w-sm italic">
        "{getMessage()}"
      </p>

      <button
        onClick={onContinue}
        className="w-full max-w-sm h-14 bg-neutral-900 border border-neutral-700 text-white font-bold text-lg rounded-xl active:scale-95 transition-transform"
      >
        PRÓXIMO BLOCO →
      </button>
    </div>
  );
}
