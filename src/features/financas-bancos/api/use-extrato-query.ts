/* The month's imported movements (extrato_lista, the Raio-X's reader), for one bank's statement.
   Read from the database only: no call to the bank or to Open Finance. */
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "@/shared/api";
import type { Movimento } from "../lib/extrato";
import { financasBancosKeys } from "./use-painel-query";

const num = z.union([z.number(), z.string()]).transform(Number).pipe(z.number().finite());
const linha = z.object({
  id: z.string(), data: z.string(), hora: z.string().nullable().catch(null), descricao: z.string().catch(""),
  comerciante: z.string().nullable().catch(null), valor: num, tipo: z.enum(["entrada", "saida"]),
  banco: z.string().nullable().catch(null), movimento: z.string().catch("normal"),
});

type Rpc = (f: string, a?: object) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
async function lista(mes: string, categoria: string | null): Promise<Movimento[]> {
  const { data, error } = await (supabase.rpc as unknown as Rpc)("extrato_lista", { p_mes: mes, p_categoria: categoria, p_tipo: null });
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown[]).flatMap((l) => {
    const r = linha.safeParse(l);
    return r.success ? [{ ...r.data, hora: r.data.hora ? r.data.hora.slice(0, 5) : null }] : [];
  });
}

export function useExtratoQuery(userId: string | undefined, mes: string, ativo: boolean) {
  return useQuery({
    queryKey: [...financasBancosKeys.all, "extrato", userId ?? "", mes] as const,
    enabled: !!userId && ativo,
    queryFn: async () => {
      // transfers between the person's own accounts come apart in extrato_lista: both are movements of the account
      const [normais, entre] = await Promise.all([lista(mes, null), lista(mes, "__entre_contas")]);
      return [...normais, ...entre].sort((a, b) => (b.data + (b.hora ?? "")).localeCompare(a.data + (a.hora ?? "")));
    },
  });
}
