import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface Ingredient {
  id: string;
  name: string;
  unit: string;
  stock_quantity: number;
  stock_min: number;
  cost_per_unit: number;
  alerts_enabled: boolean;
  photo_url: string | null;
  notes: string | null;
}

export interface RecipeItem {
  id: string;
  product_id: string;
  ingredient_id: string;
  quantity: number;
}

export const UNIT_OPTIONS = [
  { value: "un", label: "un (unidade)" },
  { value: "g", label: "g (grama)" },
  { value: "kg", label: "kg (quilo)" },
  { value: "ml", label: "ml (mililitro)" },
  { value: "l", label: "l (litro)" },
  { value: "pct", label: "pct (pacote)" },
];

export function useIngredients() {
  const { user } = useAuth();
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("ingredients")
      .select("*")
      .eq("user_id", user.id)
      .order("name", { ascending: true });
    setIngredients((data as Ingredient[]) ?? []);
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const lowStock = ingredients.filter(
    (i) => i.alerts_enabled && Number(i.stock_quantity) <= Number(i.stock_min)
  );

  return { ingredients, loading, reload: load, lowStock };
}
