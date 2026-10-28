/* Every movement of the month (search, filters, category detail). Internal
   transfers come from a separate call because extrato_lista keeps them apart. */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/shared/api";
import { lancamentoSchema, type LancamentoRX } from "../types";
import { raioxKeys } from "./keys";

type Rpc = (f: string, a?: object) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
const lista = async (mes: string, categoria: string | null): Promise<LancamentoRX[]> => {
  const { data, error } = await (supabase.rpc as unknown as Rpc)("extrato_lista", { p_mes: mes, p_categoria: categoria, p_tipo: null });
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown[]).flatMap((l) => {
    const r = lancamentoSchema.safeParse(l);
    return r.success ? [{ ...r.data, hora: r.data.hora ? r.data.hora.slice(0, 5) : null }] : [];
  });
};

export function useLancamentosQuery(mes: string, ativo: boolean) {
  return useQuery({
    queryKey: raioxKeys.list({ q: "lancamentos", mes }),
    enabled: ativo,
    queryFn: async () => {
      const [normais, entre] = await Promise.all([lista(mes, null), lista(mes, "__entre_contas")]);
      return [...normais, ...entre];
    },
  });
}
