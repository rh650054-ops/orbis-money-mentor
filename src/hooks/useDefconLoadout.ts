import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getBrazilDate } from "@/lib/dateUtils";

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
}

export function useDefconLoadout(userId: string | undefined, date?: string) {
  const day = date ?? getBrazilDate();
  const [loadout, setLoadout] = useState<LoadoutItem[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [loading, setLoading] = useState(true);

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
        .select("id, name, sale_price, stock_quantity")
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

  const addProduct = async (product: ProductOption, qty: number) => {
    if (!userId || qty <= 0) return;
    await supabase.from("defcon_daily_loadout").upsert(
      {
        user_id: userId,
        date: day,
        product_id: product.id,
        product_name: product.name,
        qty_initial: qty,
      },
      { onConflict: "user_id,date,product_id" }
    );
    await load();
  };

  const updateQty = async (id: string, qty: number) => {
    if (qty <= 0) {
      await supabase.from("defcon_daily_loadout").delete().eq("id", id);
    } else {
      await supabase.from("defcon_daily_loadout").update({ qty_initial: qty }).eq("id", id);
    }
    await load();
  };

  const incrementSold = async (productId: string, qty = 1) => {
    if (!userId) return;
    const item = loadout.find((l) => l.product_id === productId);
    if (!item) return;
    await supabase
      .from("defcon_daily_loadout")
      .update({ qty_sold: Number(item.qty_sold) + qty })
      .eq("id", item.id);
    // debita estoque do produto também
    const prod = products.find((p) => p.id === productId);
    if (prod) {
      const newStock = Math.max(0, Number(prod.stock_quantity) - qty);
      await supabase.from("products").update({ stock_quantity: newStock }).eq("id", productId);
    }
    await load();
  };

  return { loadout, products, loading, reload: load, addProduct, updateQty, incrementSold };
}
