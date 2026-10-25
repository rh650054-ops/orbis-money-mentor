/* META DO DIA — lê metas_dia pelo RPC meta_do_dia(), replaneja por meta_replanejar()
   e troca o modo (padrão / adaptativo) por meta_definir_modo().
   A conta é do servidor (cérebro); aqui é só leitura + invalidação. */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { lerMetaDoDia, type MetaDoDia } from "@/shared/lib/meta-viavel";

type Rpc = { rpc: (f: string, a?: object) => Promise<{ data: unknown; error: { message: string } | null }> };
const rpc = supabase as unknown as Rpc;

export const metaKeys = { dia: (userId: string | undefined, dia: string) => ["meta-do-dia", userId ?? "", dia] as const };

export async function carregarMetaDoDia(dia?: string): Promise<MetaDoDia | null> {
  const { data, error } = await rpc.rpc("meta_do_dia", dia ? { p_dia: dia } : {});
  if (error) return null;
  return lerMetaDoDia(data);
}

export type TipoReplanejar = "maximo" | "realista" | "manter";

export function useMetaDoDia(userId: string | undefined, dia: string) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: metaKeys.dia(userId, dia),
    queryFn: () => carregarMetaDoDia(dia),
    enabled: !!userId,
    staleTime: 60_000,
  });
  const replanejar = useMutation({
    mutationFn: async (tipo: TipoReplanejar) => {
      const { data, error } = await rpc.rpc("meta_replanejar", { p_tipo: tipo });
      if (error) throw new Error(error.message);
      return lerMetaDoDia(data);
    },
    onSuccess: (m) => {
      qc.setQueryData(metaKeys.dia(userId, dia), m);
      void qc.invalidateQueries({ queryKey: ["meta-do-dia"] });
    },
  });
  // 25/10: liga/desliga a meta adaptativa (Mínimo · Meta · Turbo pelo ritmo)
  const definirModo = useMutation({
    mutationFn: async (adaptativa: boolean) => {
      const { data, error } = await rpc.rpc("meta_definir_modo", { p_adaptativa: adaptativa });
      if (error) throw new Error(error.message);
      return lerMetaDoDia(data);
    },
    onSuccess: (m) => {
      qc.setQueryData(metaKeys.dia(userId, dia), m);
      void qc.invalidateQueries({ queryKey: ["meta-do-dia"] });
    },
  });
  return { meta: q.data ?? null, carregando: q.isLoading, replanejar, definirModo };
}
