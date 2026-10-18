import { SkeletonCard } from "@/shared/components/skeletons";
import { Skeleton } from "@/shared/ui/skeleton";

/** The page's shape while the server sums the period (no spinner, A7). */
export function RelatorioSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Carregando relatório">
      <div className="rounded-2xl border border-[rgba(245,184,0,.2)] p-4 space-y-3">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-3 w-48" />
        <div className="space-y-2 pt-2">
          <Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" />
        </div>
      </div>
      <SkeletonCard />
      <SkeletonCard />
      <SkeletonCard />
    </div>
  );
}
