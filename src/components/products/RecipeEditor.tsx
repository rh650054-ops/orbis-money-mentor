import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { useIngredients } from "@/hooks/useIngredients";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

interface Props {
  productId: string | null; // null se ainda não salvou produto
  recipeMode: "none" | "per_unit" | "batch";
  batchYield: number;
  onChangeMode: (m: "none" | "per_unit" | "batch") => void;
  onChangeBatchYield: (n: number) => void;
}

interface RecipeRow {
  id?: string;
  ingredient_id: string;
  quantity: string;
}

export default function RecipeEditor({ productId, recipeMode, batchYield, onChangeMode, onChangeBatchYield }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { ingredients } = useIngredients();
  const [items, setItems] = useState<RecipeRow[]>([]);

  useEffect(() => {
    if (!productId) { setItems([]); return; }
    supabase
      .from("product_recipes")
      .select("id, ingredient_id, quantity")
      .eq("product_id", productId)
      .then(({ data }) => {
        if (data) setItems(data.map((r) => ({ id: r.id, ingredient_id: r.ingredient_id, quantity: String(r.quantity) })));
      });
  }, [productId]);

  const addRow = () => setItems([...items, { ingredient_id: "", quantity: "" }]);
  const removeRow = async (idx: number) => {
    const row = items[idx];
    if (row.id) await supabase.from("product_recipes").delete().eq("id", row.id);
    setItems(items.filter((_, i) => i !== idx));
  };
  const updateRow = (idx: number, patch: Partial<RecipeRow>) => {
    setItems(items.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  };

  const persistAll = async () => {
    if (!user || !productId) return;
    for (const r of items) {
      if (!r.ingredient_id || !r.quantity) continue;
      const payload = {
        user_id: user.id,
        product_id: productId,
        ingredient_id: r.ingredient_id,
        quantity: parseFloat(r.quantity) || 0,
      };
      if (r.id) {
        await supabase.from("product_recipes").update({ quantity: payload.quantity }).eq("id", r.id);
      } else {
        await supabase.from("product_recipes").upsert(payload, { onConflict: "product_id,ingredient_id" });
      }
    }
    toast({ title: "Receita salva" });
  };

  // Exposed via window for parent quick-save (simpler than ref forwarding)
  useEffect(() => {
    (window as any).__saveCurrentRecipe = persistAll;
    return () => { delete (window as any).__saveCurrentRecipe; };
  });

  return (
    <div className="space-y-3 border-t pt-3">
      <div>
        <Label>Modo de estoque por receita</Label>
        <Select value={recipeMode} onValueChange={(v) => onChangeMode(v as any)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Sem receita (estoque manual)</SelectItem>
            <SelectItem value="per_unit">Por unidade vendida (baixa direta)</SelectItem>
            <SelectItem value="batch">Por lote (rendimento)</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground mt-1">
          {recipeMode === "per_unit" && "A cada venda, baixa do estoque os ingredientes na quantidade abaixo."}
          {recipeMode === "batch" && "Você produz um lote (ex: faz 50 brigadeiros de uma vez) e o app baixa os ingredientes do lote inteiro."}
          {recipeMode === "none" && "Apenas o estoque do produto é controlado, sem ingredientes."}
        </p>
      </div>

      {recipeMode === "batch" && (
        <div>
          <Label>Rendimento do lote (unidades)</Label>
          <Input
            type="number"
            inputMode="numeric"
            value={batchYield || ""}
            onChange={(e) => onChangeBatchYield(parseInt(e.target.value) || 0)}
            placeholder="Ex: 50"
          />
        </div>
      )}

      {recipeMode !== "none" && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Ingredientes da receita</Label>
            <Button type="button" size="sm" variant="outline" onClick={addRow} disabled={!productId}>
              <Plus className="w-3.5 h-3.5 mr-1" /> Adicionar
            </Button>
          </div>
          {!productId && (
            <p className="text-xs text-muted-foreground">Salve o produto primeiro para adicionar ingredientes.</p>
          )}
          {ingredients.length === 0 && productId && (
            <p className="text-xs text-muted-foreground">
              Nenhuma mercadoria cadastrada. Cadastre na aba "Mercadoria".
            </p>
          )}
          {items.map((r, idx) => {
            const ing = ingredients.find((i) => i.id === r.ingredient_id);
            return (
              <div key={idx} className="flex gap-2 items-end">
                <div className="flex-1">
                  <Select value={r.ingredient_id} onValueChange={(v) => updateRow(idx, { ingredient_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Mercadoria" /></SelectTrigger>
                    <SelectContent>
                      {ingredients.map((i) => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-28">
                  <Input
                    type="number"
                    inputMode="decimal"
                    value={r.quantity}
                    onChange={(e) => updateRow(idx, { quantity: e.target.value })}
                    placeholder={ing ? `qtd ${ing.unit}` : "qtd"}
                  />
                </div>
                <Button type="button" variant="ghost" size="icon" onClick={() => removeRow(idx)}>
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            );
          })}
          {productId && items.length > 0 && (
            <Button type="button" size="sm" variant="secondary" onClick={persistAll} className="w-full">
              Salvar receita
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
