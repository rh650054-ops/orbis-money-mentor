import { Skeleton } from "@/shared/ui/skeleton";

interface SkeletonStatProps {
  className?: string;
}

export function SkeletonStat({ className }: SkeletonStatProps) {
  return (
    <div
      data-testid="skeleton-stat"
      className={["rounded-2xl border border-border bg-card p-4 space-y-2", className].filter(Boolean).join(" ")}
    >
      <Skeleton className="h-3 w-1/2" />
      <Skeleton className="h-8 w-3/4" />
    </div>
  );
}
