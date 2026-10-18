/* Últimas compras (3 itens, "ver mais" abre 10). Excluir em dois toques: o banco
   reverte estoque, custo médio e o custo do dia (trigger de compras_mercadoria). */
import { useCallback, useEffect, useState } from "react";
import { Package, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/shared/hooks/use-toast";
import { formatCurrency } from "@/shared/lib/utils";
import { PRESS } from "./foco-tipos";

interface CompraRow {
  id: string; item_tipo: string; ingredient_id: string | null; product_id: string | null;
  quantidade: number; total_pago: number; custo_unitario: number; data: string;
}
type Sb = { from: (t: string) => { select: (c: string) => { eq: (k: string, v: string) => { order: (c: string, o: { ascending: boolean }) => { limit: (n: number) => Promise<{ data: CompraRow[] | null }> } } }; delete: () => { eq: (k: string, v: string) => Promise<{ error: unknown }> } } };
const sb = supabase as unknown as Sb;

export function UltimasCompras({ userId, versao, onChanged }: { userId: string; versao: number; onChanged?: () => void }) {
  const { toast } = useToast();
  const [compras, setCompras] = useState<CompraRow[]>([]);
  const [nomes, setNomes] = useState<Record<string, string>>({});
  const [limite, setLimite] = useState(3);
  const [excluindoId, setExcluindoId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [{ data: cps }, { data: prods }, { data: ings }] = await Promise.all([
      sb.from("compras_mercadoria").select("id, item_tipo, ingredient_id, product_id, quantidade, total_pago, custo_unitario, data").eq("user_id", userId).order("created_at", { ascending: false }).limit(limite),
      supabase.from("products").select("id, name").eq("user_id", userId),
      supabase.from("ingredients").select("id, name").eq("user_id", userId),
    ]);
    const n: Record<string, string> = {};
    for (const p of prods ?? []) n[p.id] = p.name;
    for (const i of ings ?? []) n[i.id] = i.name;
    setNomes(n);
    setCompras(cps ?? []);
  }, [userId, limite]);
  useEffect(() => { void load(); }, [load, versao]);

  const excluir = async (id: string) => {
    if (excluindoId !== id) { setExcluindoId(id); setTimeout(() => setExcluindoId((c) => (c === id ? null : c)), 3500); return; }
    setExcluindoId(null);
    const { error } = await sb.from("compras_mercadoria").delete().eq("id", id);
    if (error) { toast({ title: "Erro ao excluir a compra", variant: "destructive" }); return; }
    toast({ title: "Compra excluída", description: "Estoque, custo e relatório revertidos" });
    await load(); onChanged?.();
  };

  if (compras.length === 0) return null;
  const nome = (c: CompraRow) => nomes[(c.item_tipo === "ingrediente" ? c.ingredient_id : c.product_id) ?? ""] ?? (c.item_tipo === "ingrediente" ? "insumo" : "produto");

  return (
    <section className="mt-6 px-0.5" aria-label="Últimas compras">
      <div className="flex items-center justify-between">
        <p className="orbis-mini">Últimas compras</p>
        {limite === 3 && compras.length === 3 && <button type="button" onClick={() => setLimite(10)} className="text-[11.5px] font-bold" style={{ color: "var(--orbis-gold)" }}>ver mais ›</button>}
      </div>
      <div className="rounded-[20px] border mt-2.5 px-4" style={{ borderColor: "var(--orbis-line)", background: "var(--orbis-surf)" }}>
        {compras.map((c, i) => (
          <div key={c.id} className="flex items-center gap-2.5 py-2.5" style={i ? { borderTop: "1px solid var(--orbis-line)" } : undefined}>
            <span className="w-[34px] h-[34px] rounded-[10px] flex items-center justify-center shrink-0" style={{ background: "#1b1a17", color: "var(--orbis-fg-3)" }}><Package className="w-[15px] h-[15px]" strokeWidth={2} /></span>
            <span className="flex-1 min-w-0">
              <b className="block text-[13.5px] font-bold truncate">{nome(c)}</b>
              <small className="block text-[11.5px] orbis-num" style={{ color: "var(--orbis-fg-3)" }}>{Number(c.quantidade)} × {formatCurrency(Number(c.custo_unitario))} · {c.data.split("-").reverse().slice(0, 2).join("/")}</small>
            </span>
            <span className="orbis-num text-[14px] font-extrabold whitespace-nowrap">{formatCurrency(Number(c.total_pago))}</span>
            <button type="button" onClick={() => excluir(c.id)} aria-label={excluindoId === c.id ? "Toque de novo para confirmar a exclusão" : "Excluir compra"}
              className={`w-9 h-9 rounded-[9px] flex items-center justify-center shrink-0 ${PRESS}`}
              style={excluindoId === c.id ? { background: "var(--orbis-custo)", color: "#1a0608" } : { border: "1px solid var(--orbis-line)", color: "var(--orbis-fg-3)" }}>
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
        {excluindoId && <p className="text-[11px] pb-2.5 font-medium" style={{ color: "var(--orbis-custo)" }}>Toque de novo na lixeira para confirmar — estoque e relatório serão revertidos.</p>}
      </div>
    </section>
  );
}
