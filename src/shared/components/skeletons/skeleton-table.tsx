import { Skeleton } from "@/shared/ui/skeleton";

interface SkeletonTableProps {
  rows?: number;
  cols?: number;
  className?: string;
}

export function SkeletonTable({ rows = 5, cols = 3, className }: SkeletonTableProps) {
  return (
    <div data-testid="skeleton-table" className={className}>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="grid gap-2 mb-2" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
          {Array.from({ length: cols }).map((__, c) => (
            <Skeleton key={c} className="h-8 w-full" />
          ))}
        </div>
      ))}
    </div>
  );
}
