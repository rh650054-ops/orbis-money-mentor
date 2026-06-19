import { formatCurrency } from "@/shared/lib/utils";

interface DefconQuickSaleButtonsProps {
  saleHistory: number[];
  onQuickSale: (amount: number) => void;
  forcedValues?: number[];
}

export function DefconQuickSaleButtons({ saleHistory, onQuickSale, forcedValues }: DefconQuickSaleButtonsProps) {
  const useForced = !!(forcedValues && forcedValues.length > 0);
  if (!useForced && saleHistory.length < 2) return null;

  // Count frequency of each value
  const freq = new Map<number, number>();
  for (const v of saleHistory) {
    freq.set(v, (freq.get(v) || 0) + 1);
  }

  // Get unique values sorted by frequency (most common first), then by recency
  const unique = useForced
    ? forcedValues!
    : Array.from(freq.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([val]) => val)
        .slice(0, 6); // max 6 buttons

  if (unique.length === 0) return null;

  return (
    <div className="w-full max-w-md px-1">
      <div className="text-xs font-mono text-muted-foreground/60 text-center mb-1.5 tracking-[0.25em] uppercase">
        Venda rápida
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        {unique.map((amount) => (
          <button
            key={amount}
            onClick={() => onQuickSale(amount)}
            className="h-11 px-3.5 min-w-[70px] bg-card border border-primary/25 rounded-xl text-foreground font-bold text-sm active:scale-90 active:bg-success active:border-success transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            + {formatCurrency(amount).replace('R$\u00a0', 'R$')}
          </button>
        ))}
      </div>
    </div>
  );
}
