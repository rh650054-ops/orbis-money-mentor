import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { avisar } from "@/shared/lib/avisar";
import { getBrazilDate } from "@/shared/lib/date-utils";

export interface LoadoutItem {
  id: string;
  product_id: string;
  product_name: string;
  qty_initial: number;
  qty_sold: number;
}

export interface ProductOption {
  id: string;
  name: string;
  sale_price: number;
  stock_quantity: number;
  cost: number;
  /** false = "não controlo estoque desse produto": a carga não é limitada. */
  controla_estoque?: boolean | null;
}

/** Carga pedida passou do estoque: a tela pergunta antes de salvar. */
export interface AvisoEstoque {
  productId: string;
  nome: string;
  /** quanto pode levar agora (estoque + o que já vendeu da carga de hoje) */
  podeLevar: number;
  quer: number;
  /** estoque que fica se ele confirmar que tem mais */
  precisa: number;
  salvar: (qty: number) => Promise<void>;
}

export function useDefconLoadout(userId: string | undefined, date?: string) {
  const day = date ?? getBrazilDate();
  const [loadout, setLoadout] = useState<LoadoutItem[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [aviso, setAviso] = useState<AvisoEstoque | null>(null);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    const [{ data: load }, { data: prods }] = await Promise.all([
      supabase
        .from("defcon_daily_loadout")
        .select("id, product_id, product_name, qty_initial, qty_sold")
        .eq("user_id", userId)
        .eq("date", day)
        .order("created_at", { ascending: true }),
      supabase
        .from("products")
        .select("id, name, sale_price, stock_quantity, cost, controla_estoque")
        .eq("user_id", userId)
        .eq("is_active", true)
        .order("name"),
    ]);
    setLoadout((load as LoadoutItem[]) ?? []);
    setProducts((prods as ProductOption[]) ?? []);
    setLoading(false);
  }, [userId, day]);

  useEffect(() => {
    load();
  }, [load]);

  const salvarCarga = async (product: ProductOption, qty: number) => {
    if (!userId || qty <= 0) return;
    const { error } = await supabase.from("defcon_daily_loadout").upsert(
      {
        user_id: userId,
        date: day,
        product_id: product.id,
        product_name: product.name,
        qty_initial: qty,
      },
      { onConflict: "user_id,date,product_id" }
    );
    if (error) avisar.usuario("Não consegui adicionar o produto na carga. Tenta de novo.", error, "useDefconLoadout: adicionar produto");
    await load();
  };

  /** A carga não passa do estoque (Rick, 07/10): se passar, a tela pergunta. */
  const cabeNoEstoque = (product: ProductOption, qty: number, salvar: (q: number) => Promise<void>): boolean => {
    if (product.controla_estoque === false) return true;
    const jaVendido = Number(loadout.find((l) => l.product_id === product.id)?.qty_sold || 0);
    const podeLevar = Math.max(0, Number(product.stock_quantity || 0)) + jaVendido;
    if (qty <= podeLevar) return true;
    setAviso({ productId: product.id, nome: product.name, podeLevar, quer: qty, precisa: qty - jaVendido, salvar });
    return false;
  };

  const addProduct = async (product: ProductOption, qty: number) => {
    if (!userId || qty <= 0) return;
    const salvar = (q: number) => salvarCarga(product, q);
    if (!cabeNoEstoque(product, qty, salvar)) return;
    await salvar(qty);
  };

  const updateQty = async (id: string, qty: number) => {
    const salvar = async (q: number) => {
      const { error } = q <= 0
        ? await supabase.from("defcon_daily_loadout").delete().eq("id", id)
        : await supabase.from("defcon_daily_loadout").update({ qty_initial: q }).eq("id", id);
      if (error) avisar.usuario("Não consegui salvar a quantidade da carga. Tenta de novo.", error, "useDefconLoadout: alterar quantidade");
      await load();
    };
    const item = loadout.find((l) => l.id === id);
    const product = item ? products.find((p) => p.id === item.product_id) : undefined;
    // só pergunta quando AUMENTA a carga (baixar nunca abre o aviso)
    if (item && qty > Number(item.qty_initial) && product && !cabeNoEstoque(product, qty, salvar)) return;
    await salvar(qty);
  };

  /** Chegou mais do que o estoque dizia: acerta o estoque e leva. */
  const confirmarAviso = async () => {
    const a = aviso;
    if (!a) return;
    setAviso(null);
    const { error } = await supabase.from("products").update({ stock_quantity: a.precisa }).eq("id", a.productId);
    if (error) { avisar.usuario("Não consegui atualizar o estoque. Tenta de novo.", error, "useDefconLoadout: acertar estoque"); return; }
    await a.salvar(a.quer);
  };
  /** Leva só o que tem no estoque. */
  const levarSoOQueTem = async () => {
    const a = aviso;
    if (!a) return;
    setAviso(null);
    if (a.podeLevar > 0) await a.salvar(a.podeLevar);
  };

  return {
    loadout, products, loading, reload: load, addProduct, updateQty,
    aviso, confirmarAviso, levarSoOQueTem, fecharAviso: () => setAviso(null),
  };
}
