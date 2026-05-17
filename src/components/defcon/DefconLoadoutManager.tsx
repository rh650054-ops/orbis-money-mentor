import { useState } from "react";
import { Plus, X, Package } from "lucide-react";
import { useDefconLoadout, ProductOption } from "@/hooks/useDefconLoadout";
import { Link } from "react-router-dom";

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
    <div className="rounded-2xl bg-[#0F0F0F] border border-white/10 p-4 space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-white">Mercadoria de hoje</h3>
        <p className="text-xs text-neutral-500 mt-0.5">
          O que você vai vender? Sai do estoque automaticamente.
        </p>
      </div>

      {loading ? (
        <p className="text-xs text-neutral-500">Carregando...</p>
      ) : loadout.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/10 p-4 text-center space-y-2">
          <Package className="w-5 h-5 mx-auto text-neutral-600" />
          <p className="text-xs text-neutral-500">
            Nenhum produto selecionado.
          </p>
          {products.length === 0 && (
            <Link to="/products" className="text-[11px] text-[#F4A100] underline">
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
                className="flex items-center gap-2 bg-black/40 border border-white/5 rounded-xl px-2.5 py-2"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{item.product_name}</p>
                  <p className="text-[10px] text-neutral-500">
                    {item.qty_sold}/{item.qty_initial} vendidos · {restante} restantes
                  </p>
                </div>
                <input
                  type="number"
                  inputMode="numeric"
                  value={item.qty_initial}
                  onChange={(e) => updateQty(item.id, parseInt(e.target.value) || 0)}
                  className="shrink-0 w-14 h-9 bg-black border border-white/10 rounded-lg text-center text-sm font-bold text-white focus:outline-none focus:border-[#F4A100]"
                />
                <button
                  onClick={() => updateQty(item.id, 0)}
                  className="shrink-0 w-9 h-9 rounded-lg bg-black/40 border border-white/5 flex items-center justify-center text-red-500 active:scale-95"
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
          onClick={() => setShowPicker(true)}
          className="w-full h-10 rounded-xl border border-dashed border-[#F4A100]/40 text-[#F4A100] text-xs font-semibold flex items-center justify-center gap-2 active:scale-[0.98]"
        >
          <Plus className="w-4 h-4" />
          Adicionar produto
        </button>
      )}

      {showPicker && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-end sm:items-center justify-center"
          onClick={() => setShowPicker(false)}
        >
          <div
            className="w-full sm:max-w-md bg-neutral-900 border-t sm:border border-white/10 rounded-t-3xl sm:rounded-3xl p-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] space-y-2.5 animate-in slide-in-from-bottom duration-200 max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between sticky top-0 bg-neutral-900 pb-2 -mx-1 px-1 z-10">
              <h3 className="text-base font-semibold text-white">Escolher produto</h3>
              <button
                onClick={() => setShowPicker(false)}
                className="w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center"
              >
                <X className="w-4 h-4 text-neutral-400" />
              </button>
            </div>
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
        </div>
      )}
    </div>
  );
}

function ProductPickRow({ product, onAdd }: { product: ProductOption; onAdd: (qty: number) => void }) {
  const [qty, setQty] = useState("");
  return (
    <div className="flex items-center gap-2 bg-black/40 border border-white/5 rounded-xl px-2.5 py-2">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white truncate">{product.name}</p>
        <p className="text-[10px] text-neutral-500">
          Estoque: {product.stock_quantity}
        </p>
      </div>
      <input
        type="number"
        inputMode="numeric"
        value={qty}
        onChange={(e) => setQty(e.target.value)}
        placeholder="Qtd"
        className="shrink-0 w-14 h-10 bg-black border border-white/10 rounded-lg text-center text-sm font-bold text-white focus:outline-none focus:border-[#F4A100]"
      />
      <button
        onClick={() => {
          const n = parseInt(qty) || 0;
          if (n > 0) onAdd(n);
        }}
        disabled={!qty || parseInt(qty) <= 0}
        className="shrink-0 h-10 px-3 rounded-lg bg-[#F4A100] text-black text-xs font-bold disabled:opacity-40 active:scale-95"
      >
        Levar
      </button>
    </div>
  );
}
