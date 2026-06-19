import { useState } from "react";
import { Plus, X, Package } from "lucide-react";
import { useDefconLoadout, ProductOption } from "@/hooks/useDefconLoadout";
import { Link } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/shared/ui/dialog";

interface Props {
  userId: string;
}

export function DefconLoadoutManager({ userId }: Props) {
  const { loadout, products, loading, addProduct, updateQty } = useDefconLoadout(userId);
  const [showPicker, setShowPicker] = useState(false);

  const availableProducts = products.filter(
    (p) => !loadout.some((l) => l.product_id === p.id)
  );

  return (
    <div className="rounded-2xl bg-card border border-border p-4 space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-foreground">Mercadoria de hoje</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          O que você vai vender? Sai do estoque automaticamente.
        </p>
      </div>

      {loading ? (
        <p className="text-xs text-muted-foreground">Carregando...</p>
      ) : loadout.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-4 text-center space-y-2">
          <Package className="w-5 h-5 mx-auto text-muted-foreground" />
          <p className="text-xs text-muted-foreground">
            Nenhum produto selecionado.
          </p>
          {products.length === 0 && (
            <Link to="/products" className="text-xs text-primary underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded">
              Cadastre seus produtos primeiro
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {loadout.map((item) => {
            const restante = Math.max(0, Number(item.qty_initial) - Number(item.qty_sold));
            return (
              <div
                key={item.id}
                className="flex items-center gap-2 bg-background border border-border rounded-xl px-2.5 py-2"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{item.product_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.qty_sold}/{item.qty_initial} vendidos · {restante} restantes
                  </p>
                </div>
                <input
                  type="number"
                  inputMode="numeric"
                  value={item.qty_initial}
                  onChange={(e) => updateQty(item.id, parseInt(e.target.value) || 0)}
                  className="shrink-0 w-14 h-11 bg-background border border-border rounded-lg text-center text-sm font-bold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  aria-label="Quantidade inicial"
                />
                <button
                  onClick={() => updateQty(item.id, 0)}
                  className="shrink-0 w-11 h-11 rounded-lg bg-background border border-border flex items-center justify-center text-destructive active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  aria-label="Remover"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {availableProducts.length > 0 && (
        <button
          data-tour="loadout-add"
          onClick={() => setShowPicker(true)}
          className="w-full h-11 rounded-xl border border-dashed border-primary/40 text-primary text-xs font-semibold flex items-center justify-center gap-2 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <Plus className="w-4 h-4" />
          Adicionar produto
        </button>
      )}

      <Dialog open={showPicker} onOpenChange={setShowPicker}>
        <DialogContent className="bg-card border-border max-w-md max-h-[85vh] overflow-y-auto rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-foreground">Escolher produto</DialogTitle>
          </DialogHeader>
          <div className="space-y-2.5">
            {availableProducts.map((p) => (
              <ProductPickRow
                key={p.id}
                product={p}
                onAdd={async (qty) => {
                  await addProduct(p, qty);
                  setShowPicker(false);
                }}
              />
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ProductPickRow({ product, onAdd }: { product: ProductOption; onAdd: (qty: number) => void }) {
  const [qty, setQty] = useState("");
  return (
    <div className="flex items-center gap-2 bg-background border border-border rounded-xl px-2.5 py-2">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{product.name}</p>
        <p className="text-xs text-muted-foreground">
          Estoque: {product.stock_quantity}
        </p>
      </div>
      <input
        type="number"
        inputMode="numeric"
        value={qty}
        onChange={(e) => setQty(e.target.value)}
        placeholder="Qtd"
        className="shrink-0 w-14 h-11 bg-background border border-border rounded-lg text-center text-sm font-bold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        aria-label="Quantidade"
      />
      <button
        onClick={() => {
          const n = parseInt(qty) || 0;
          if (n > 0) onAdd(n);
        }}
        disabled={!qty || parseInt(qty) <= 0}
        className="shrink-0 h-11 px-3 rounded-lg bg-primary text-primary-foreground text-xs font-bold disabled:opacity-40 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        Levar
      </button>
    </div>
  );
}
