import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "@/shared/api";
import { produtosKeys } from "./use-produtos-query";

const num = z.coerce.number().catch(0);
const saidaSchema = z.object({
  id: z.string(), comerciante: z.string().nullable().catch(null), descricao: z.string().nullable().catch(null),
  valor: num, data: z.string(), hora: z.string().nullable().catch(null), banco: z.string().nullable().catch(null),
  pluggy_tx_id: z.string().nullable().catch(null),
});
export type SaidaBanco = z.infer<typeof saidaSchema>;
export interface BancoDaCompra { temBanco: boolean; candidatos: SaidaBanco[] }

// bank_connections e mercado_compras ainda não estão nos tipos gerados do Supabase
type Resp = PromiseLike<{ data: unknown; error: Error | null }>;
interface Consulta extends Resp {
  eq: (c: string, v: unknown) => Consulta; gte: (c: string, v: unknown) => Consulta; lte: (c: string, v: unknown) => Consulta; limit: (n: number) => Consulta;
}
interface Tabela {
  select: (cols: string) => Consulta;
  update: (v: Record<string, unknown>) => { eq: (c: string, v: unknown) => Resp };
}
const tabela = (nome: "bank_connections" | "extrato_lancamentos" | "mercado_compras") =>
  (supabase as unknown as { from: (t: string) => Tabela }).from(nome);

const diaMais = (iso: string, d: number) => { const x = new Date(`${iso}T12:00:00Z`); x.setUTCDate(x.getUTCDate() + d); return x.toISOString().slice(0, 10); };

/** Procura a compra do mercado no extrato (Open Finance): saída de valor parecido,
 *  do dia anterior até 2 dias depois, a mais próxima do total primeiro. */
export function useBancoDaCompra(compra: { id: string; total: number; dia: string } | null) {
  return useQuery({
    queryKey: [...produtosKeys.all, "banco-da-compra", compra?.id],
    enabled: !!compra && compra.total > 0,
    queryFn: async (): Promise<BancoDaCompra> => {
      const c = compra!;
      const con = await tabela("bank_connections").select("id").limit(1);
      if (con.error) throw con.error;
      if (!Array.isArray(con.data) || con.data.length === 0) return { temBanco: false, candidatos: [] };
      const folga = Math.round(Math.max(2, c.total * 0.03) * 100) / 100;
      const { data, error } = await tabela("extrato_lancamentos")
        .select("id, comerciante, descricao, valor, data, hora, banco, pluggy_tx_id")
        .eq("tipo", "saida").gte("data", diaMais(c.dia, -1)).lte("data", diaMais(c.dia, 2))
        .gte("valor", c.total - folga).lte("valor", c.total + folga).limit(10);
      if (error) throw error;
      const candidatos = z.array(saidaSchema).parse(data ?? [])
        .sort((a, b) => Math.abs(a.valor - c.total) - Math.abs(b.valor - c.total)).slice(0, 3);
      return { temBanco: true, candidatos };
    },
  });
}

/** "É essa": liga a compra à saída do banco (mercado_compras já tem as colunas). */
export function useConfirmarBancoMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ compraId, saida }: { compraId: string; saida: SaidaBanco }) => {
      const { error } = await tabela("mercado_compras").update({
        banco_transacao_id: saida.pluggy_tx_id ?? saida.id, total_banco: saida.valor, conferida_em: new Date().toISOString(),
      }).eq("id", compraId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [...produtosKeys.all, "banco-da-compra"] }),
  });
}
