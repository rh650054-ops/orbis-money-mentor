import { Skeleton } from "@/shared/ui/skeleton";

interface SkeletonListProps {
  rows?: number;
  className?: string;
}

export function SkeletonList({ rows = 5, className }: SkeletonListProps) {
  return (
    <div data-testid="skeleton-list" className={className}>
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-full mb-2" />
      ))}
    </div>
  );
}
