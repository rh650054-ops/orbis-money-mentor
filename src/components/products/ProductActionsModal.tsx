import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useIngredients } from "@/hooks/useIngredients";

interface Product {
  id: string;
  name: string;
  sale_price: number;
  stock_quantity: number;
  recipe_mode?: "none" | "per_unit" | "batch";
  batch_yield?: number;
  open_price?: boolean;
}

interface Props {
  product: Product | null;
  onClose: () => void;
  onChanged: () => void;
}

interface RecipeItem { ingredient_id: string; quantity: number; }

export default function ProductActionsModal({ product, onClose, onChanged }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { ingredients, reload: reloadIngredients } = useIngredients();
  const [recipe, setRecipe] = useState<RecipeItem[]>([]);
  const [saleQty, setSaleQty] = useState("1");
  const [saleAmount, setSaleAmount] = useState("");
  const [batches, setBatches] = useState("1");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!product) return;
    supabase
      .from("product_recipes")
      .select("ingredient_id, quantity")
      .eq("product_id", product.id)
      .then(({ data }) => setRecipe((data as RecipeItem[]) ?? []));
    setSaleQty("1");
    setSaleAmount(product.open_price ? "" : String(product.sale_price));
    setBatches("1");
  }, [product]);

  if (!product) return null;
  const mode = product.recipe_mode ?? "none";

  const ingredientName = (id: string) => ingredients.find((i) => i.id === id)?.name ?? "?";
  const ingredientUnit = (id: string) => ingredients.find((i) => i.id === id)?.unit ?? "";

  const registerSale = async () => {
    if (!user) return;
    const qty = parseFloat(saleQty) || 1;
    const amount = parseFloat(saleAmount) || 0;
    setBusy(true);

    // 1. Log da venda
    await supabase.from("product_sales_log").insert({
      user_id: user.id, product_id: product.id, quantity: qty, total_amount: amount,
    });

    if (mode === "per_unit") {
      // baixa direta dos ingredientes
      for (const r of recipe) {
        const ing = ingredients.find((i) => i.id === r.ingredient_id);
        if (!ing) continue;
        const newQty = Math.max(0, Number(ing.stock_quantity) - Number(r.quantity) * qty);
        await supabase.from("ingredients").update({ stock_quantity: newQty }).eq("id", ing.id);
      }
    }

    // sempre baixa do estoque do produto se houver
    if (product.stock_quantity > 0) {
      const newStock = Math.max(0, product.stock_quantity - qty);
      await supabase.from("products").update({ stock_quantity: newStock }).eq("id", product.id);
    }

    toast({ title: "Venda registrada", description: `${qty}× ${product.name}` });
    setBusy(false);
    reloadIngredients();
    onChanged();
    onClose();
  };

  const produceBatch = async () => {
    if (!user) return;
    const lots = parseFloat(batches) || 1;
    const yieldPer = product.batch_yield || 0;
    if (yieldPer <= 0) {
      toast({ title: "Defina o rendimento do lote no produto", variant: "destructive" });
      return;
    }
    setBusy(true);

    // baixa ingredientes do lote
    for (const r of recipe) {
      const ing = ingredients.find((i) => i.id === r.ingredient_id);
      if (!ing) continue;
      const newQty = Math.max(0, Number(ing.stock_quantity) - Number(r.quantity) * lots);
      await supabase.from("ingredients").update({ stock_quantity: newQty }).eq("id", ing.id);
    }

    const unitsAdded = lots * yieldPer;
    await supabase.from("products").update({
      stock_quantity: Number(product.stock_quantity) + unitsAdded,
    }).eq("id", product.id);

    await supabase.from("production_batches").insert({
      user_id: user.id, product_id: product.id, batches_count: lots, units_produced: unitsAdded,
    });

    toast({ title: "Produção registrada", description: `+${unitsAdded} ${product.name} no estoque` });
    setBusy(false);
    reloadIngredients();
    onChanged();
    onClose();
  };

  return (
    <Dialog open={!!product} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{product.name}</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="sale">
          <TabsList className="grid grid-cols-2">
            <TabsTrigger value="sale">Registrar venda</TabsTrigger>
            <TabsTrigger value="produce" disabled={mode !== "batch"}>Produzir lote</TabsTrigger>
          </TabsList>

          <TabsContent value="sale" className="space-y-3 mt-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Quantidade</Label>
                <Input type="number" inputMode="numeric" value={saleQty} onChange={(e) => setSaleQty(e.target.value)} />
              </div>
              <div>
                <Label>Valor total (R$)</Label>
                <Input type="number" inputMode="decimal" value={saleAmount} onChange={(e) => setSaleAmount(e.target.value)} />
              </div>
            </div>
            {mode === "per_unit" && recipe.length > 0 && (
              <div className="text-xs text-muted-foreground bg-muted/30 rounded-lg p-2 space-y-0.5">
                <p className="font-medium text-foreground">Vai baixar do estoque:</p>
                {recipe.map((r) => (
                  <p key={r.ingredient_id}>
                    • {(Number(r.quantity) * (parseFloat(saleQty) || 1)).toLocaleString("pt-BR")} {ingredientUnit(r.ingredient_id)} de {ingredientName(r.ingredient_id)}
                  </p>
                ))}
              </div>
            )}
            <Button onClick={registerSale} disabled={busy} className="w-full">
              Confirmar venda
            </Button>
          </TabsContent>

          <TabsContent value="produce" className="space-y-3 mt-3">
            <div>
              <Label>Quantidade de lotes</Label>
              <Input type="number" inputMode="numeric" value={batches} onChange={(e) => setBatches(e.target.value)} />
              <p className="text-[11px] text-muted-foreground mt-1">
                Cada lote rende <span className="font-semibold">{product.batch_yield ?? 0}</span> unidades.
                Total: <span className="font-semibold">{(parseFloat(batches) || 0) * (product.batch_yield ?? 0)}</span> unidades.
              </p>
            </div>
            {recipe.length > 0 && (
              <div className="text-xs text-muted-foreground bg-muted/30 rounded-lg p-2 space-y-0.5">
                <p className="font-medium text-foreground">Vai consumir:</p>
                {recipe.map((r) => (
                  <p key={r.ingredient_id}>
                    • {(Number(r.quantity) * (parseFloat(batches) || 1)).toLocaleString("pt-BR")} {ingredientUnit(r.ingredient_id)} de {ingredientName(r.ingredient_id)}
                  </p>
                ))}
              </div>
            )}
            <Button onClick={produceBatch} disabled={busy} className="w-full">
              Registrar produção
            </Button>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
