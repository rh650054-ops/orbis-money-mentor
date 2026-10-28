/* Month summary of the Raio-X (extrato_resumo), plus the previous month for "vs mês anterior". */
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { supabase } from "@/shared/api";
import { resumoSchema, type ResumoRX } from "../types";
import { raioxKeys } from "./keys";

type Rpc = (f: string, a?: object) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
const rpc = (f: string, a?: object) => (supabase.rpc as unknown as Rpc)(f, a);

export async function lerResumo(mes: string): Promise<ResumoRX | null> {
  const { data, error } = await rpc("extrato_resumo", { p_mes: mes });
  if (error) throw new Error(error.message);
  const r = resumoSchema.safeParse(data);
  return r.success ? r.data : null;
}

export function useResumoQuery(mes: string, ativo: boolean) {
  return useQuery({
    queryKey: raioxKeys.list({ q: "resumo", mes }),
    queryFn: () => lerResumo(mes),
    enabled: ativo,
    placeholderData: keepPreviousData,
  });
}

export function useMesesQuery(ativo: boolean) {
  return useQuery({
    queryKey: raioxKeys.list({ q: "meses" }),
    enabled: ativo,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await rpc("extrato_meses");
      if (error) throw new Error(error.message);
      return ((data ?? []) as { mes: string }[]).map((m) => String(m.mes).slice(0, 10)).sort();
    },
  });
}
