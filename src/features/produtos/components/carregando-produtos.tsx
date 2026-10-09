import { Skeleton } from "@/shared/ui/skeleton";

/** Skeleton da tela de Produtos (A7: skeleton, não spinner). */
export function CarregandoProdutos() {
  return (
    <div className="max-w-md mx-auto flex flex-col gap-3 pt-2">
      <Skeleton className="h-7 w-40" />
      <Skeleton className="h-11 w-full rounded-[14px]" />
      <Skeleton className="h-20 w-full rounded-[18px]" />
      {[0, 1, 2].map((i) => <Skeleton key={i} className="h-[72px] w-full rounded-[18px]" />)}
    </div>
  );
}
