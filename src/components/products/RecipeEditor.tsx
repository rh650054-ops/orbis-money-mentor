import { Plus, Trash2, Check } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/shared/ui/select";
import { useIngredients } from "@/hooks/useIngredients";

export type RecipeMode = "none" | "per_unit" | "batch";

export interface RecipeItem {
  id?: string;
  ingredient_id: string;
  quantity: string;
}

interface Props {
  recipeMode: RecipeMode;
  batchYield: number;
  items: RecipeItem[];
  onChangeMode: (m: RecipeMode) => void;
  onChangeBatchYield: (n: number) => void;
  onChangeItems: (items: RecipeItem[]) => void;
}

// Opções em linguagem do dia a dia, com exemplo — no lugar do jargão ("baixa direta", "rendimento").
const MODES: { value: RecipeMode; emoji: string; title: string; example: string }[] = [
  {
    value: "none",
    emoji: "📦",
    title: "Sem ingredientes",
    example: "Controlo só a quantidade do produto pronto. Ex.: revenda de bala, refri, água.",
  },
  {
    value: "per_unit",
    emoji: "🥤",
    title: "Tira ingredientes a cada venda",
    example: "Cada venda baixa os ingredientes do estoque. Ex.: 1 suco = 1 laranja + 1 copo.",
  },
  {
    value: "batch",
    emoji: "🍫",
    title: "Faço em lotes",
    example: "Produzo um monte de uma vez e o app baixa os ingredientes do lote. Ex.: 50 brigadeiros.",
  },
];

export default function RecipeEditor({
  recipeMode,
  batchYield,
  items,
  onChangeMode,
  onChangeBatchYield,
  onChangeItems,
}: Props) {
  const { ingredients } = useIngredients();

  const addRow = () => onChangeItems([...items, { ingredient_id: "", quantity: "" }]);
  const removeRow = (idx: number) => onChangeItems(items.filter((_, i) => i !== idx));
  const updateRow = (idx: number, patch: Partial<RecipeItem>) =>
    onChangeItems(items.map((r, i) => (i === idx ? { ...r, ...patch } : r)));

  return (
    <div className="space-y-3">
      {/* Seletor de modo — 3 cards com exemplo */}
      <div className="space-y-2">
        {MODES.map((m) => {
          const active = recipeMode === m.value;
          return (
            <button
              key={m.value}
              type="button"
              onClick={() => onChangeMode(m.value)}
              className={`w-full text-left flex gap-3 p-3 rounded-xl border transition active:scale-[0.99] ${
                active
                  ? "border-primary bg-primary/10"
                  : "border-border/60 bg-muted/30 hover:bg-muted/60"
              }`}
            >
              <span className="text-xl shrink-0 leading-none mt-0.5">{m.emoji}</span>
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-semibold text-foreground">{m.title}</span>
                <span className="block text-xs text-muted-foreground mt-0.5 leading-snug">{m.example}</span>
              </span>
              {active && <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />}
            </button>
          );
        })}
      </div>

      {recipeMode === "batch" && (
        <div>
          <Label>Quantas unidades saem de um lote?</Label>
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
            <Label>Ingredientes que ele usa</Label>
            <Button type="button" size="sm" variant="outline" onClick={addRow}>
              <Plus className="w-3.5 h-3.5 mr-1" /> Adicionar
            </Button>
          </div>
          {ingredients.length === 0 && (
            <p className="text-xs text-muted-foreground">
              Você ainda não cadastrou ingredientes. Cadastre na aba "Mercadoria" e eles aparecem aqui.
            </p>
          )}
          {items.map((r, idx) => {
            const ing = ingredients.find((i) => i.id === r.ingredient_id);
            return (
              <div key={idx} className="flex gap-2 items-end">
                <div className="flex-1">
                  <Select value={r.ingredient_id} onValueChange={(v) => updateRow(idx, { ingredient_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Ingrediente" /></SelectTrigger>
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
          {recipeMode !== "none" && items.length === 0 && ingredients.length > 0 && (
            <p className="text-xs text-muted-foreground">Toque em "Adicionar" pra incluir um ingrediente.</p>
          )}
        </div>
      )}
    </div>
  );
}
