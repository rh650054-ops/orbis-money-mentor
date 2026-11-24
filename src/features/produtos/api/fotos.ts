/* Photos in the product-photos bucket (24/11/2026). The bucket only lets each seller write in his own
   folder ({user_id}/...), so a seller can never change another one's photos. A photo replaced or removed
   is deleted from the bucket only when NO product and NO flavour still points to it (no orphan files,
   and never a photo still in use). Nothing here touches stock, sales or money. */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/api";
import { produtosKeys } from "./use-produtos-query";

const BUCKET = "product-photos";
const MARCA = `/storage/v1/object/public/${BUCKET}/`;

/** The bucket path of one of OUR public URLs inside this user's folder; null for anything else. */
export function caminhoDaFoto(url: string | null | undefined, userId: string): string | null {
  if (!url) return null;
  const i = url.indexOf(MARCA);
  if (i < 0) return null;
  const caminho = decodeURIComponent(url.slice(i + MARCA.length).split("?")[0] ?? "");
  return caminho.startsWith(`${userId}/`) && !caminho.includes("..") ? caminho : null;
}

type Contagem = PromiseLike<{ count: number | null; error: unknown }>;
type Tabela = { select: (c: string, o: { count: "exact"; head: true }) => { eq: (c: string, v: string) => Contagem } };
const tabela = (t: string) => (supabase as unknown as { from: (t: string) => Tabela }).from(t);

/** Deletes old photos that nothing uses any more. Best effort: a failure here never breaks the save. */
export async function apagarFotosOrfas(urls: (string | null | undefined)[], userId: string | undefined): Promise<void> {
  if (!userId) return;
  for (const url of new Set(urls.filter(Boolean) as string[])) {
    const caminho = caminhoDaFoto(url, userId);
    if (!caminho) continue;
    try {
      const [a, b] = await Promise.all([tabela("products").select("id", { count: "exact", head: true }).eq("photo_url", url),
        tabela("product_variants").select("id", { count: "exact", head: true }).eq("photo_url", url)]);
      if (a.error || b.error || (a.count ?? 1) > 0 || (b.count ?? 1) > 0) continue;
      await supabase.storage.from(BUCKET).remove([caminho]);
    } catch { /* keep the file: never block the seller for a cleanup */ }
  }
}

/** Whether the database already has product_variants.photo_url (migration 20261124120000). Until then the
 *  flavour photo button stays hidden instead of failing on save. */
export function useFotoSaborDisponivel() {
  return useQuery({
    queryKey: produtosKeys.detail("foto-sabor-disponivel"),
    staleTime: 10 * 60_000,
    queryFn: async () => {
      type T = { select: (c: string) => { limit: (n: number) => PromiseLike<{ error: unknown }> } };
      const r = await (supabase as unknown as { from: (t: string) => T }).from("product_variants").select("photo_url").limit(1);
      return !r.error;
    },
  });
}

/** The product's photo, straight from the product card (24/11): saved right away, old file cleaned. */
export function useFotoProdutoMutation(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { produtoId: string; foto: string | null; anterior: string | null }) => {
      const { error } = await supabase.from("products").update({ photo_url: v.foto }).eq("id", v.produtoId);
      if (error) throw error;
      await apagarFotosOrfas([v.anterior], userId);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: produtosKeys.all }),
  });
}

/** A flavour's own photo: set (url) or removed (null), right away, then the old file is cleaned. */
export function useFotoSaborMutation(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { saborId: string; foto: string | null; anterior: string | null }) => {
      type Upd = { update: (r: Record<string, unknown>) => { eq: (c: string, v: string) => PromiseLike<{ error: unknown }> } };
      const { error } = await (supabase as unknown as { from: (t: string) => Upd }).from("product_variants").update({ photo_url: v.foto }).eq("id", v.saborId);
      if (error) throw error;
      await apagarFotosOrfas([v.anterior], userId);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: produtosKeys.all }),
  });
}
