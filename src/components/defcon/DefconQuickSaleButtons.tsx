import { formatCurrency } from "@/lib/utils";

interface DefconQuickSaleButtonsProps {
  saleHistory: number[];
  onQuickSale: (amount: number) => void;
}

export function DefconQuickSaleButtons({ saleHistory, onQuickSale }: DefconQuickSaleButtonsProps) {
  if (saleHistory.length < 2) return null;

  // Count frequency of each value
  const freq = new Map<number, number>();
  for (const v of saleHistory) {
    freq.set(v, (freq.get(v) || 0) + 1);
  }

  // Get unique values sorted by frequency (most common first), then by recency
  const unique = Array.from(freq.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([val]) => val)
    .slice(0, 6); // max 6 buttons

  if (unique.length === 0) return null;

  return (
    <div className="w-full max-w-md px-1">
      <div className="text-[9px] font-mono text-[#A1A1A1]/60 text-center mb-1.5 tracking-[0.25em] uppercase">
        Venda rápida
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        {unique.map((amount) => (
          <button
            key={amount}
            onClick={() => onQuickSale(amount)}
            className="h-10 px-3.5 min-w-[70px] bg-[#1A1A1A] border border-[#F5B400]/25 rounded-xl text-white font-bold text-[13px] active:scale-90 active:bg-[#22C55E] active:border-[#22C55E] transition-all"
          >
            + {formatCurrency(amount).replace('R$\u00a0', 'R$')}
          </button>
        ))}
      </div>
    </div>
  );
}
