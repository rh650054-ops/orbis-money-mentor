/* Histórico editável dos custos rápidos (mercadoria/transporte/almoço). Esses custos são
   somados nas colunas do daily_sales; aqui o usuário vê por dia, edita o valor ou zera,
   e lança num dia escolhido. Movido do DefconHub no redesign do Foco (18/10/2026). */
import { useEffect, useState } from "react";
import { Bus, Check, ChevronDown, History, Loader2, Package, Pencil, Plus, Trash2, Utensils, X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { getBrazilDate } from "@/shared/lib/date-utils";
import { formatCurrency } from "@/shared/lib/utils";
import { MoneyInput } from "@/shared/ui/money-input";
import { useToast } from "@/shared/hooks/use-toast";

interface CustoRow { id: string; date: string; cost: number | null; transport_cost: number | null; food_cost: number | null }
type Col = "cost" | "transport_cost" | "food_cost";
const CATS: { col: Col; label: string; Icon: typeof Package }[] = [
  { col: "cost", label: "Mercadoria", Icon: Package },
  { col: "transport_cost", label: "Transporte", Icon: Bus },
  { col: "food_cost", label: "Almoço", Icon: Utensils },
];
const prettyDate = (iso: string) => { const [, m, d] = (iso || "").split("-"); return d && m ? `${d}/${m}` : iso; };
const valorDe = (r: CustoRow, col: Col) => Number(r[col]) || 0;

export function CustoRapidoHistorico({ onChanged }: { onChanged?: () => void }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [show, setShow] = useState(false);
  const [rows, setRows] = useState<CustoRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<{ id: string; col: Col } | null>(null);
  const [editVal, setEditVal] = useState("");
  const [busy, setBusy] = useState(false);
  const [addCol, setAddCol] = useState<Col>("transport_cost");
  const [addVal, setAddVal] = useState("");
  const [addDate, setAddDate] = useState(getBrazilDate());
  const [adding, setAdding] = useState(false);

  const fetchHistory = async () => {
    if (!user) return;
    setLoading(true);
    const yearStart = `${getBrazilDate().slice(0, 4)}-01-01`;
    const { data } = await supabase.from("daily_sales").select("id, date, cost, transport_cost, food_cost")
      .eq("user_id", user.id).gte("date", yearStart).or("cost.gt.0,transport_cost.gt.0,food_cost.gt.0")
      .order("date", { ascending: false }).limit(120);
    setRows((data as CustoRow[]) || []);
    setLoading(false);
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- fetchHistory lê user/show; recriar a cada render faria loop
  useEffect(() => { if (show) void fetchHistory(); }, [show, user]);

  const saveEdit = async () => {
    if (!editing) return;
    const v = Math.round((parseFloat(editVal.replace(",", ".")) || 0) * 100) / 100;
    if (v < 0) { toast({ title: "Valor inválido", variant: "destructive" }); return; }
    setBusy(true);
    const { error } = await supabase.from("daily_sales").update({ [editing.col]: v }).eq("id", editing.id);
    setBusy(false);
    if (error) { toast({ title: "Erro ao salvar", variant: "destructive" }); return; }
    setEditing(null);
    toast({ title: "Custo atualizado", description: formatCurrency(v) });
    void fetchHistory(); onChanged?.();
  };

  const zerar = async (id: string, col: Col, label: string) => {
    if (typeof window !== "undefined" && !window.confirm(`Zerar ${label} desse dia?`)) return;
    setBusy(true);
    const { error } = await supabase.from("daily_sales").update({ [col]: 0 }).eq("id", id);
    setBusy(false);
    if (error) { toast({ title: "Erro ao zerar", variant: "destructive" }); return; }
    toast({ title: `${label} zerado` });
    void fetchHistory(); onChanged?.();
  };

  const addOnDate = async () => {
    if (!user) return;
    const v = Math.round((parseFloat(addVal.replace(",", ".")) || 0) * 100) / 100;
    if (v <= 0 || !addDate) { toast({ title: "Valor inválido", variant: "destructive" }); return; }
    setAdding(true);
    const { data: existentes } = await supabase.from("daily_sales").select("id, cost, transport_cost, food_cost")
      .eq("user_id", user.id).eq("date", addDate).order("created_at", { ascending: true }).limit(1);
    const atual = existentes?.[0];
    const { error } = atual
      ? await supabase.from("daily_sales").update({ [addCol]: (Number(atual[addCol]) || 0) + v }).eq("id", atual.id)
      : await supabase.from("daily_sales").insert({ user_id: user.id, date: addDate, [addCol]: v });
    setAdding(false);
    if (error) { toast({ title: "Erro ao lançar", variant: "destructive" }); return; }
    const label = CATS.find((c) => c.col === addCol)?.label ?? "Custo";
    toast({ title: `${label} lançado`, description: `${formatCurrency(v)} em ${prettyDate(addDate)}` });
    setAddVal(""); void fetchHistory(); onChanged?.();
  };

  return (
    <div>
      <button type="button" onClick={() => setShow((v) => !v)} aria-expanded={show} className="w-full h-9 flex items-center justify-between text-xs text-muted-foreground hover:text-foreground transition-colors">
        <span className="flex items-center gap-1.5"><History className="w-3.5 h-3.5" /> Histórico de custos</span>
        <ChevronDown className={`w-4 h-4 transition-transform ${show ? "rotate-180" : ""}`} />
      </button>
      {show && (
        <div className="mt-1">
          <div className="mb-3 rounded-lg bg-background border border-border/50 p-2.5 space-y-2">
            <p className="text-[11px] font-semibold text-muted-foreground">Lançar em outro dia</p>
            <div className="grid grid-cols-3 gap-1">
              {CATS.filter((c) => c.col !== "cost").map(({ col, label, Icon }) => (
                <button key={col} type="button" onClick={() => setAddCol(col)} className={`flex items-center justify-center gap-1 h-8 rounded-lg border text-[11px] font-medium transition ${addCol === col ? "border-primary bg-primary/10 text-foreground" : "border-border/60 bg-card text-muted-foreground"}`}>
                  <Icon className="w-3 h-3" />{label}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <input type="date" value={addDate} max={getBrazilDate()} onChange={(e) => setAddDate(e.target.value)} aria-label="Dia do custo" className="h-9 flex-1 min-w-0 bg-card border border-border rounded-lg px-2 text-xs text-foreground" />
              <MoneyInput value={parseFloat(addVal) || 0} onChange={(n) => setAddVal(n ? String(n) : "")} placeholder="R$ 0,00" className="h-9 w-24 text-sm" />
              <button type="button" onClick={addOnDate} disabled={adding || !addVal || parseFloat(addVal) <= 0} aria-label="Lançar" className="shrink-0 h-9 w-9 rounded-lg bg-primary text-primary-foreground font-bold text-xs flex items-center justify-center disabled:opacity-40 active:scale-95">
                {adding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
          {loading ? (
            <div className="flex justify-center py-4"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>
          ) : rows.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">Nenhum custo lançado ainda.</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {rows.map((r) => (
                <div key={r.id} className="rounded-lg bg-background border border-border/50 px-3 py-2">
                  <p className="text-[11px] font-semibold text-muted-foreground mb-1">{prettyDate(r.date)}</p>
                  <div className="space-y-1">
                    {CATS.map(({ col, label, Icon }) => {
                      const val = valorDe(r, col);
                      const isEditing = editing?.id === r.id && editing.col === col;
                      if (val <= 0 && !isEditing) return null;
                      return (
                        <div key={col} className="flex items-center gap-2">
                          <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground flex-1 min-w-0 truncate">{label}</span>
                          {isEditing ? (
                            <>
                              <MoneyInput value={parseFloat(editVal) || 0} onChange={(n) => setEditVal(n ? String(n) : "")} className="h-8 w-24 text-sm" />
                              <button type="button" onClick={saveEdit} disabled={busy} className="p-1 text-success" aria-label="Salvar">{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}</button>
                              <button type="button" onClick={() => setEditing(null)} className="p-1 text-muted-foreground" aria-label="Cancelar"><X className="w-4 h-4" /></button>
                            </>
                          ) : (
                            <>
                              <span className="text-sm font-bold text-destructive tabular-nums">{formatCurrency(val)}</span>
                              <button type="button" onClick={() => { setEditing({ id: r.id, col }); setEditVal(String(Math.round(val * 100) / 100)); }} className="p-1 text-muted-foreground hover:text-foreground" aria-label="Editar"><Pencil className="w-3.5 h-3.5" /></button>
                              <button type="button" onClick={() => zerar(r.id, col, label)} className="p-1 text-muted-foreground hover:text-destructive" aria-label="Zerar"><Trash2 className="w-3.5 h-3.5" /></button>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
