import { useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "@/shared/api";
import { saboresParaSalvar, type SaborRascunho } from "../lib/sabores";
import { funcaoFaltando } from "./use-concluir-compra-mutation";
import { produtosKeys } from "./use-produtos-query";
import { salvarSabores } from "./use-sabores";

type Rpc = (fn: string, args?: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }>;
type Tabela = { select: (c: string) => { eq: (c: string, v: string) => PromiseLike<{ data: unknown[] | null; error: unknown }> } };

/** 23/11: the ready units of each flavour typed in the registration (absolute values: a retry is harmless). */
async function estoqueInicial(produtoId: string, sabores: SaborRascunho[]) {
  const comEstoque = sabores.filter((s) => s.nome.trim() && (s.estoque ?? 0) > 0);
  if (comEstoque.length === 0) return;
  const v = await (supabase as unknown as { from: (t: string) => Tabela }).from("product_variants").select("id, name").eq("product_id", produtoId);
  if (v.error) throw v.error;
  const porNome = new Map(z.array(z.object({ id: z.string(), name: z.string() })).parse(v.data ?? []).map((x) => [x.name.trim().toLowerCase(), x.id]));
  const lista = comEstoque.flatMap((s) => { const id = porNome.get(s.nome.trim().toLowerCase()); return id ? [{ id, unidades: s.estoque ?? 0 }] : []; });
  const { error } = await (supabase as unknown as { rpc: Rpc }).rpc("produto_estoque_inicial", { p_produto: produtoId, p_sem_sabor: 0, p_sabores: lista });
  // a database before 23/11 has no such function: the product total (already saved) stays, flavours at 0
  if (error && !funcaoFaltando(error)) throw error;
}

/** Flavours typed in the registration of a NEW product (22/11, Etapa 2). Same RPC as the product
 *  sheet; nothing is sent when no flavour has a name, so existing flavours are never touched. */
export function useSalvarSaboresMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ produtoId, sabores }: { produtoId: string; sabores: SaborRascunho[] }) => {
      const lista = saboresParaSalvar(sabores);
      if (lista.length > 0) await salvarSabores(produtoId, lista);
      await estoqueInicial(produtoId, sabores);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: produtosKeys.all }),
  });
}
