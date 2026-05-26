import { Skeleton } from "@/shared/ui/skeleton";

interface SkeletonCardProps {
  className?: string;
}

export function SkeletonCard({ className }: SkeletonCardProps) {
  return (
    <div
      data-testid="skeleton-card"
      className={["rounded-2xl border border-border bg-card p-4 space-y-3", className].filter(Boolean).join(" ")}
    >
      <Skeleton className="h-5 w-1/3" />
      <Skeleton className="h-4 w-2/3" />
      <Skeleton className="h-4 w-1/2" />
    </div>
  );
}
