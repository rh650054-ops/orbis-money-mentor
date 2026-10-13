/* Aba Estoque: o que sobrou de ingrediente guardado e quantas levas ainda dá pra
   fazer de cada produto com isso. É a mesma base do "Tô no mercado". */
import { useMercadoQuery } from "../api/use-mercado-query";
import { levasPossiveis } from "../lib/receitas";

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toLocaleString("pt-BR", { maximumFractionDigits: 2 }));

export function IngredientesGuardados({ userId, onMercado }: { userId: string | undefined; onMercado: () => void }) {
  const { data } = useMercadoQuery(userId);
  const ingredientes = data?.ingredientes ?? [];
  const porId = new Map(ingredientes.map((i) => [i.id, i]));
  const levas = (data?.produtos ?? [])
    .filter((p) => p.recipe_mode === "batch" && p.batch_yield > 0)
    .map((p) => {
      const rec = (data?.receitas ?? []).filter((r) => r.product_id === p.id && r.quantity > 0);
      const n = levasPossiveis(rec.map((r) => ({ qtd: r.quantity, estoque: porId.get(r.ingredient_id)?.stock_quantity ?? 0 })));
      return { id: p.id, nome: p.name, emoji: p.emoji, n, un: n * p.batch_yield, temReceita: rec.length > 0 };
    })
    .filter((x) => x.temReceita);

  return (
    <div className="flex flex-col gap-2 mt-3">
      <span className="text-[11px] font-black tracking-[.14em] px-1" style={{ color: "#7b766e" }}>INGREDIENTES GUARDADOS</span>
      {levas.map((x) => (
        <div key={x.id} className="rounded-2xl px-3.5 py-2.5 text-[12.5px] font-extrabold"
          style={{ background: "#0f0f10", border: "1px solid #26241f", color: x.n > 0 ? "#3DD68C" : "#7b766e" }}>
          {x.emoji ?? "📦"} {x.nome}: {x.n > 0 ? `dá pra mais ${x.n} leva${x.n > 1 ? "s" : ""} (${x.un} un)` : "falta ingrediente pra próxima leva"}
        </div>
      ))}
      {ingredientes.length === 0 ? (
        <p className="text-[12.5px] px-1" style={{ color: "#7b766e" }}>
          Nenhum ingrediente ainda. Eles aparecem quando você monta a receita na ficha do produto.
        </p>
      ) : (
        <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid #26241f" }}>
          {ingredientes.map((i, k) => (
            <div key={i.id} className="flex items-center justify-between px-3.5 py-2.5 text-[13px]"
              style={{ background: "#0f0f10", borderTop: k ? "1px solid #1d1c19" : undefined }}>
              <span className="font-extrabold truncate">{i.name}</span>
              <span className="font-black tabular-nums" style={{ color: i.stock_quantity > 0 ? "#F4F1EA" : "#7b766e" }}>
                {fmt(Math.max(0, i.stock_quantity))} {i.unit}
              </span>
            </div>
          ))}
        </div>
      )}
      <button type="button" onClick={onMercado} className="rounded-2xl h-12 text-[13.5px] font-black mt-1"
        style={{ background: "#121211", border: "1px solid rgba(245,184,0,.45)", color: "#F5B800" }}>
        🛒 Tô no mercado
      </button>
    </div>
  );
}
