/* Reads my flame (and one month of the calendar) from constancia_minha(). The rule lives on the server. */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createQueryKeys, supabase } from "@/shared/api";
import { constanciaSchema, type Constancia } from "../types";

export const constanciaKeys = createQueryKeys("constancia");

type Rpc = (fn: string, args?: Record<string, unknown>) => PromiseLike<{ data: unknown; error: Error | null }>;
const rpc: Rpc = (fn, args) => (supabase as unknown as { rpc: Rpc }).rpc(fn, args);

/** `mes` = any date of the month wanted in the calendar ("YYYY-MM-01"); default = this month. */
export function useConstanciaQuery(userId: string | undefined, mes?: string) {
  return useQuery({
    queryKey: constanciaKeys.detail(`${userId ?? ""}:${mes ?? "atual"}`),
    enabled: !!userId,
    staleTime: 60_000,
    queryFn: async (): Promise<Constancia | null> => {
      const { data, error } = await rpc("constancia_minha", mes ? { p_mes: mes } : {});
      if (error) throw error;
      return data ? constanciaSchema.parse(data) : null;
    },
  });
}

/** After the Foco starts or ends, the flame may have changed: refresh every month view. */
export function useAtualizarConstancia() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: constanciaKeys.all });
}
