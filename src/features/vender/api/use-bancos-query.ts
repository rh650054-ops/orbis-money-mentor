/* Plan status, connected banks and each account's role (work × personal). */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/shared/api";
import {
  carregarBancos, carregarContasVenda, carregarPro,
  type BancoLigado, type ContaVenda, type StatusPro,
} from "@/components/conectar/pluggy";
import { bancosKey } from "./keys";

export interface DadosBancos { pro: StatusPro; bancos: BancoLigado[]; contas: ContaVenda[]; cobraPix: boolean }

export function useBancosQuery(userId: string | undefined) {
  return useQuery({
    queryKey: bancosKey(userId ?? ""),
    enabled: !!userId,
    refetchOnWindowFocus: true, // back from the bank's OAuth tab: the webhook may have saved it
    queryFn: async (): Promise<DadosBancos> => {
      const [pro, bancos, contas, mp] = await Promise.all([
        carregarPro().catch((): StatusPro => ({ pro: false, origem: null, ate: null, bancos: 0, verificado: false })),
        carregarBancos().catch(() => [] as BancoLigado[]),
        carregarContasVenda().catch(() => [] as ContaVenda[]),
        Promise.resolve((supabase.rpc as unknown as (f: string) => PromiseLike<{ data: unknown }>)("mp_status")).catch(() => ({ data: null })),
      ]);
      const linhas = Array.isArray(mp.data) ? (mp.data as { conectado?: boolean }[]) : [];
      return { pro, bancos, contas, cobraPix: !!linhas[0]?.conectado };
    },
  });
}
