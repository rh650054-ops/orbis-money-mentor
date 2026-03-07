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
    <div className="w-full max-w-md px-2">
      <div className="text-xs font-mono text-neutral-600 text-center mb-2 tracking-widest uppercase">
        Venda rápida
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        {unique.map((amount) => (
          <button
            key={amount}
            onClick={() => onQuickSale(amount)}
            className="h-12 px-5 bg-neutral-900 border border-neutral-700 rounded-xl text-white font-bold text-base active:scale-90 active:bg-green-600 transition-all"
          >
            {formatCurrency(amount)}
          </button>
        ))}
      </div>
    </div>
  );
}
