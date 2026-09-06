import { useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { getBrazilDate, formatBrazilDate, getBrazilDateDaysAgo, getBrazilTime } from "@/shared/lib/date-utils";
import { formatCurrency } from "@/shared/lib/utils";
import { MoneyInput } from "@/shared/ui/money-input";
import { Zap, FileDown, Pencil, Plus, Banknote, CreditCard, Smartphone, TrendingDown, Coins, Sparkles, History, Loader2, Trash2, ChevronDown, ChevronRight, Package, Bus, Utensils, Play, FileText, ArrowRight, ShoppingCart, Clock } from "lucide-react";
import { getTier } from "@/components/ranking/tier";
import { useToast } from "@/shared/hooks/use-toast";
import { generateDefconDayPDF } from "@/utils/generateDefconDayPDF";
import { syncBlocksToDailySales } from "@/utils/syncDailySales";
import { Check, X, Calendar, MapPin } from "lucide-react";
import { DefconLoadoutManager } from "@/components/defcon/DefconLoadoutManager";
import { DefconCompraMercadoria } from "@/components/defcon/DefconCompraMercadoria";
import { DefconAjustarDiaModal } from "@/components/defcon/DefconAjustarDiaModal";
import { CompetitionStatementUpload } from "@/components/defcon/CompetitionStatementUpload";
import { WeeklyChallengeIcon } from "@/components/competitions/WeeklyChallenge";
import { EditPlanningModal } from "@/components/EditPlanningModal";
import { BRAND_COLORS, readThemeColor } from "@/shared/lib/theme-colors";

// "Pix que caiu depois" — pagamento que entrou tarde, lançado num dia anterior
// (padrão: ontem). Atualiza o daily_sales daquele dia (total_profit + pix_sales)
// e guarda cada lançamento em late_pix_entries (pro histórico + desfazer).
interface LatePixEntry {
  id: string;
  amount: number;
  sale_date: string;
  created_at: string;
}

function LatePixSection() {
  const { user } = useAuth();
  const { toast } = useToast();
  const yesterday = formatBrazilDate(new Date(Date.now() - 86400000));
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(yesterday);
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState<LatePixEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const prettyDate = (iso: string) => {
    const [, m, d] = iso.split("-");
    return d && m ? `${d}/${m}` : iso;
  };
  const prettyWhen = (iso: string) => {
    const dt = new Date(iso);
    if (isNaN(dt.getTime())) return "";
    return dt.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  };

  const fetchHistory = async () => {
    if (!user) return;
    setLoadingHistory(true);
    const { data } = await supabase
      .from("late_pix_entries")
      .select("id, amount, sale_date, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(60);
    setHistory((data as LatePixEntry[]) || []);
    setLoadingHistory(false);
  };

  useEffect(() => {
    fetchHistory();
  }, [user]);

  const handleSubmit = async () => {
    if (!user) return;
    const value = parseFloat(amount) || 0;
    if (value <= 0 || !date) return;
    setSaving(true);
    try {
      // Pode existir mais de uma linha de daily_sales no mesmo dia (a constraint
      // UNIQUE(user_id,date) foi removida) — aí .maybeSingle() quebrava ("multiple
      // rows"). Pega a mais antiga e soma nela (sem criar linha nova/duplicada).
      const { data: rows, error: selErr } = await supabase
        .from("daily_sales")
        .select("id, total_profit, pix_sales, total_debt")
        .eq("user_id", user.id)
        .eq("date", date)
        .order("created_at", { ascending: true })
        .limit(1);
      if (selErr) throw selErr;
      const existing = rows && rows.length > 0 ? rows[0] : null;

      if (existing) {
        const { error: updErr } = await supabase
          .from("daily_sales")
          .update({
            total_profit: (Number(existing.total_profit) || 0) + value,
            pix_sales: (Number(existing.pix_sales) || 0) + value,
            // Pix tardio = o dinheiro que FALTAVA cair e caiu: abate do "faltou cair"
            // (total_debt). Assim "caiu" sobe, "faltou" desce e "era pra cair" fica igual.
            total_debt: Math.max(0, (Number((existing as any).total_debt) || 0) - value),
          })
          .eq("id", existing.id);
        if (updErr) throw updErr;
      } else {
        const { error: insErr } = await supabase
          .from("daily_sales")
          .insert({ user_id: user.id, date, total_profit: value, pix_sales: value });
        if (insErr) throw insErr;
      }

      // Registra o lançamento individual (pro histórico). Se a tabela ainda não
      // existir, mantém o lançamento no total e avisa que o histórico está off.
      const { error: histErr } = await supabase
        .from("late_pix_entries")
        .insert({ user_id: user.id, amount: value, sale_date: date });
      if (histErr) {
        toast({ title: "Pix lançado", description: `Lançado em ${prettyDate(date)} (histórico ainda indisponível)` });
      } else {
        toast({ title: "Pix lançado", description: `Pix de ${formatCurrency(value)} lançado em ${prettyDate(date)}` });
      }
      setAmount("");
      fetchHistory();
    } catch (e) {
      toast({ title: "Erro ao lançar o Pix", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  // Apaga um lançamento e DESCONTA o valor de volta do daily_sales daquele dia.
  const handleDelete = async (entry: LatePixEntry) => {
    if (!user) return;
    if (
      typeof window !== "undefined" &&
      !window.confirm(
        `Apagar o Pix de ${formatCurrency(Number(entry.amount))} do dia ${prettyDate(entry.sale_date)}? O valor será descontado daquele dia.`,
      )
    )
      return;
    setDeletingId(entry.id);
    try {
      const { data: dsRows } = await supabase
        .from("daily_sales")
        .select("id, total_profit, pix_sales, total_debt")
        .eq("user_id", user.id)
        .eq("date", entry.sale_date)
        .order("created_at", { ascending: true })
        .limit(1);
      const ds = dsRows && dsRows.length > 0 ? dsRows[0] : null;
      if (ds) {
        await supabase
          .from("daily_sales")
          .update({
            total_profit: Math.max(0, (Number(ds.total_profit) || 0) - Number(entry.amount)),
            pix_sales: Math.max(0, (Number(ds.pix_sales) || 0) - Number(entry.amount)),
            // Desfazer: o valor volta a "faltar cair".
            total_debt: (Number((ds as any).total_debt) || 0) + Number(entry.amount),
          })
          .eq("id", ds.id);
      }
      const { error: delErr } = await supabase.from("late_pix_entries").delete().eq("id", entry.id);
      if (delErr) throw delErr;
      setHistory((prev) => prev.filter((e) => e.id !== entry.id));
      toast({
        title: "Lançamento removido",
        description: `${formatCurrency(Number(entry.amount))} descontado de ${prettyDate(entry.sale_date)}`,
      });
    } catch (e) {
      toast({ title: "Erro ao remover", variant: "destructive" });
    } finally {
      setDeletingId(null);
    }
  };

  // O que já foi lançado PRO DIA selecionado (pra não lançar de novo sem querer).
  const entriesForDate = history.filter((e) => e.sale_date === date);
  const totalForDate = entriesForDate.reduce((s, e) => s + Number(e.amount || 0), 0);

  return (
    <div className="rounded-2xl bg-card border border-border p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Smartphone className="w-4 h-4" style={{ color: BRAND_COLORS.PIX }} />
          <h3 className="text-sm font-semibold text-foreground">Pix que caiu depois</h3>
        </div>
        <button
          onClick={() => setShowHistory((v) => !v)}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors shrink-0"
        >
          <History className="w-3.5 h-3.5" />
          Histórico{history.length > 0 ? ` (${history.length})` : ""}
        </button>
      </div>
      <p className="text-xs text-muted-foreground -mt-1">
        Pagamento que entrou atrasado. Lança no dia em que a venda aconteceu.
      </p>
      <div className="space-y-2">
        <div className="flex gap-2">
          <div className="relative flex-1 min-w-0">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-medium z-10">R$</span>
            <MoneyInput
              value={parseFloat(amount) || 0}
              onChange={(n) => setAmount(n ? String(n) : "")}
              placeholder="Quanto caiu"
              className="h-11 pl-9 rounded-xl text-sm"
            />
          </div>
          <input
            type="date"
            value={date}
            max={yesterday}
            onChange={(e) => setDate(e.target.value)}
            aria-label="De que dia?"
            className="shrink-0 h-11 bg-background border border-border rounded-xl px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          />
        </div>
        {/* Aviso do dia escolhido: já lançou algum Pix nesse dia? (evita lançar 2x) */}
        {date &&
          (entriesForDate.length > 0 ? (
            <button
              type="button"
              onClick={() => setShowHistory(true)}
              className="w-full text-left text-xs rounded-lg px-3 py-2 bg-primary/10 border border-primary/30 text-primary flex items-center gap-1.5"
            >
              <History className="w-3.5 h-3.5 shrink-0" />
              <span>
                Dia {prettyDate(date)}: você já lançou {formatCurrency(totalForDate)} ({entriesForDate.length}{" "}
                {entriesForDate.length === 1 ? "Pix" : "Pix"}). Toque pra ver.
              </span>
            </button>
          ) : (
            <p className="text-[11px] text-muted-foreground px-1">
              Dia {prettyDate(date)}: nenhum Pix tardio lançado ainda.
            </p>
          ))}
        <button
          onClick={handleSubmit}
          disabled={saving || !amount || parseFloat(amount) <= 0 || !date}
          style={{ backgroundColor: BRAND_COLORS.PIX }}
          className="w-full h-11 rounded-xl text-white font-bold text-sm flex items-center justify-center gap-1.5 disabled:opacity-40 active:scale-[0.98] transition-transform"
        >
          <Plus className="w-4 h-4" strokeWidth={3} />
          {saving ? "Lançando..." : "Lançar Pix"}
        </button>
      </div>

      {showHistory && (
        <div className="pt-3 border-t border-border/60 space-y-1.5">
          {loadingHistory ? (
            <div className="flex justify-center py-4">
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            </div>
          ) : history.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-3">
              Nenhum Pix tardio lançado ainda.
            </p>
          ) : (
            history.map((e) => (
              <div
                key={e.id}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg bg-background border ${
                  e.sale_date === date ? "border-primary/50 ring-1 ring-primary/30" : "border-border/40"
                }`}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground">
                    {formatCurrency(Number(e.amount))}
                    <span className="text-xs text-muted-foreground font-normal"> · dia {prettyDate(e.sale_date)}</span>
                    {e.sale_date === date && (
                      <span className="text-[10px] text-primary font-semibold"> · deste dia</span>
                    )}
                  </p>
                  <p className="text-[11px] text-muted-foreground">lançado em {prettyWhen(e.created_at)}</p>
                </div>
                <button
                  onClick={() => handleDelete(e)}
                  disabled={deletingId === e.id}
                  className="p-1.5 rounded-md text-muted-foreground hover:text-destructive transition-colors disabled:opacity-40"
                  aria-label="Remover lançamento"
                  title="Remover (desconta o valor de volta do dia)"
                >
                  {deletingId === e.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
                </button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// Histórico editável dos custos rápidos (mercadoria/transporte/almoço). Esses custos são
// somados nas colunas do daily_sales; aqui o usuário vê por dia, edita o valor ou zera.
interface CustoRow {
  id: string;
  date: string;
  cost: number | null;
  transport_cost: number | null;
  food_cost: number | null;
}
const CUSTO_CATS = [
  { col: "cost", label: "Mercadoria", emoji: "📦" },
  { col: "transport_cost", label: "Transporte", emoji: "🚌" },
  { col: "food_cost", label: "Almoço", emoji: "🍽️" },
] as const;

function CustoRapidoHistory({ onChanged }: { onChanged?: () => void }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [show, setShow] = useState(false);
  const [rows, setRows] = useState<CustoRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<{ id: string; col: string } | null>(null);
  const [editVal, setEditVal] = useState("");
  const [busy, setBusy] = useState(false);
  // Lançar custo num dia escolhido (não só hoje)
  const [addCol, setAddCol] = useState<string>("cost");
  const [addVal, setAddVal] = useState("");
  const [addDate, setAddDate] = useState(getBrazilDate());
  const [adding, setAdding] = useState(false);

  const prettyDate = (iso: string) => {
    const [, m, d] = (iso || "").split("-");
    return d && m ? `${d}/${m}` : iso;
  };

  const fetchHistory = async () => {
    if (!user) return;
    setLoading(true);
    const yearStart = `${getBrazilDate().slice(0, 4)}-01-01`;
    const { data } = await supabase
      .from("daily_sales")
      .select("id, date, cost, transport_cost, food_cost")
      .eq("user_id", user.id)
      .gte("date", yearStart)
      .or("cost.gt.0,transport_cost.gt.0,food_cost.gt.0")
      .order("date", { ascending: false })
      .limit(120);
    setRows((data as CustoRow[]) || []);
    setLoading(false);
  };

  useEffect(() => { if (show) fetchHistory(); /* eslint-disable-next-line */ }, [show, user]);

  const startEdit = (id: string, col: string, val: number) => {
    setEditing({ id, col });
    setEditVal(String(Math.round((val || 0) * 100) / 100));
  };

  const saveEdit = async () => {
    if (!editing) return;
    const v = Math.round((parseFloat(editVal.replace(",", ".")) || 0) * 100) / 100;
    if (v < 0) { toast({ title: "Valor inválido", variant: "destructive" }); return; }
    setBusy(true);
    const { error } = await supabase.from("daily_sales").update({ [editing.col]: v } as never).eq("id", editing.id);
    setBusy(false);
    if (error) { toast({ title: "Erro ao salvar", variant: "destructive" }); return; }
    setEditing(null);
    toast({ title: "Custo atualizado", description: formatCurrency(v) });
    fetchHistory();
    onChanged?.();
  };

  const zerar = async (id: string, col: string, label: string) => {
    if (typeof window !== "undefined" && !window.confirm(`Zerar ${label} desse dia?`)) return;
    setBusy(true);
    const { error } = await supabase.from("daily_sales").update({ [col]: 0 } as never).eq("id", id);
    setBusy(false);
    if (error) { toast({ title: "Erro ao zerar", variant: "destructive" }); return; }
    toast({ title: `${label} zerado` });
    fetchHistory();
    onChanged?.();
  };

  // Lança um custo numa DATA escolhida — soma na coluna certa do daily_sales daquele dia.
  const addOnDate = async () => {
    if (!user) return;
    const v = Math.round((parseFloat(addVal.replace(",", ".")) || 0) * 100) / 100;
    if (v <= 0 || !addDate) { toast({ title: "Valor inválido", variant: "destructive" }); return; }
    setAdding(true);
    const { data: rows } = await supabase
      .from("daily_sales")
      .select("id, cost, transport_cost, food_cost")
      .eq("user_id", user.id)
      .eq("date", addDate)
      .order("created_at", { ascending: true })
      .limit(1);
    let error;
    if (rows && rows.length > 0) {
      const prev = Number((rows[0] as unknown as Record<string, number>)[addCol]) || 0;
      ({ error } = await supabase.from("daily_sales").update({ [addCol]: prev + v } as never).eq("id", (rows[0] as { id: string }).id));
    } else {
      ({ error } = await supabase.from("daily_sales").insert({ user_id: user.id, date: addDate, [addCol]: v } as never));
    }
    setAdding(false);
    if (error) { toast({ title: "Erro ao lançar", variant: "destructive" }); return; }
    const label = CUSTO_CATS.find((c) => c.col === addCol)?.label ?? "Custo";
    toast({ title: `${label} lançado`, description: `${formatCurrency(v)} em ${prettyDate(addDate)}` });
    setAddVal("");
    fetchHistory();
    onChanged?.();
  };

  return (
    <div className="pt-1">
      <button
        onClick={() => setShow((v) => !v)}
        className="w-full flex items-center justify-between text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <span className="flex items-center gap-1.5"><History className="w-3.5 h-3.5" /> Histórico de custos</span>
        <ChevronDown className={`w-4 h-4 transition-transform ${show ? "rotate-180" : ""}`} />
      </button>
      {show && (
        <div className="mt-2">
          {/* Lançar custo numa data escolhida */}
          <div className="mb-3 rounded-lg bg-background border border-border/50 p-2.5 space-y-2">
            <p className="text-[11px] font-semibold text-muted-foreground">Lançar em outro dia</p>
            <div className="grid grid-cols-3 gap-1">
              {CUSTO_CATS.map((c) => (
                <button
                  key={c.col}
                  type="button"
                  onClick={() => setAddCol(c.col)}
                  className={`flex items-center justify-center gap-1 h-8 rounded-lg border text-[11px] font-medium transition ${
                    addCol === c.col ? "border-primary bg-primary/10 text-foreground" : "border-border/60 bg-card text-muted-foreground"
                  }`}
                >
                  <span>{c.emoji}</span>{c.label}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="date"
                value={addDate}
                max={getBrazilDate()}
                onChange={(e) => setAddDate(e.target.value)}
                className="h-9 flex-1 min-w-0 bg-card border border-border rounded-lg px-2 text-xs text-foreground"
              />
              <MoneyInput
                value={parseFloat(addVal) || 0}
                onChange={(n) => setAddVal(n ? String(n) : "")}
                placeholder="R$ 0,00"
                className="h-9 w-24 text-sm"
              />
              <button
                onClick={addOnDate}
                disabled={adding || !addVal || parseFloat(addVal) <= 0}
                className="shrink-0 h-9 px-3 rounded-lg bg-primary text-primary-foreground font-bold text-xs flex items-center gap-1 disabled:opacity-40 active:scale-95"
              >
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
                    {CUSTO_CATS.map((c) => {
                      const val = Number((r as unknown as Record<string, number>)[c.col]) || 0;
                      if (val <= 0 && !(editing && editing.id === r.id && editing.col === c.col)) return null;
                      const isEditing = editing && editing.id === r.id && editing.col === c.col;
                      return (
                        <div key={c.col} className="flex items-center gap-2">
                          <span className="text-sm">{c.emoji}</span>
                          <span className="text-xs text-muted-foreground flex-1 min-w-0 truncate">{c.label}</span>
                          {isEditing ? (
                            <>
                              <MoneyInput
                                value={parseFloat(editVal) || 0}
                                onChange={(n) => setEditVal(n ? String(n) : "")}
                                className="h-8 w-24 text-sm"
                              />
                              <button onClick={saveEdit} disabled={busy} className="p-1 text-success" aria-label="Salvar">
                                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                              </button>
                              <button onClick={() => setEditing(null)} className="p-1 text-muted-foreground" aria-label="Cancelar">
                                <X className="w-4 h-4" />
                              </button>
                            </>
                          ) : (
                            <>
                              <span className="text-sm font-bold text-destructive tabular-nums">{formatCurrency(val)}</span>
                              <button onClick={() => startEdit(r.id, c.col, val)} className="p-1 text-muted-foreground hover:text-foreground" aria-label="Editar">
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => zerar(r.id, c.col, c.label)} className="p-1 text-muted-foreground hover:text-destructive" aria-label="Zerar">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
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

/* ---- peças da Foco v2 (FORA do componente: dentro, remontavam a cada tecla
   e o input do custo rápido perdia o foco) ---- */
function Trio({ itens }: { itens: [string, ReactNode][] }) {
  return (
    <div className="flex mt-4 pt-3.5 border-t" style={{ borderColor: "rgba(255,255,255,.09)" }}>
      {itens.map(([k, v], i) => (
        <div key={k} className={`flex-1 min-w-0 ${i ? "border-l pl-3" : ""}`} style={i ? { borderColor: "rgba(255,255,255,.09)" } : undefined}>
          <p className="text-[9.5px] font-bold uppercase tracking-[.08em]" style={{ color: "var(--orbis-fg-3)" }}>{k}</p>
          <p className="orbis-num text-[15px] font-bold mt-1 whitespace-nowrap truncate">{v}</p>
        </div>
      ))}
    </div>
  );
}
function Linha({ k, icone, titulo, sub, aberto, onToggle, onClick, children }: {
  k: string; icone: ReactNode; titulo: string; sub?: string; aberto: string | null; onToggle: (k: string) => void; onClick?: () => void; children?: ReactNode;
}) {
  const expandido = aberto === k;
  return (
    <div className="border-t first:border-t-0" style={{ borderColor: "var(--orbis-line)" }}>
      <button type="button" onClick={onClick ?? (() => onToggle(k))} className="w-full flex items-center gap-3 h-14 text-left">
        <span className="w-8 h-8 rounded-[10px] flex items-center justify-center shrink-0" style={{ background: "rgba(255,255,255,.06)", color: "var(--orbis-fg-2)" }}>{icone}</span>
        <span className="flex-1 min-w-0">
          <span className="block text-[14px] font-semibold truncate">{titulo}</span>
          {sub && <span className="block text-[11.5px] font-semibold truncate" style={{ color: "var(--orbis-fg-3)" }}>{sub}</span>}
        </span>
        {children ? <ChevronDown className="w-4 h-4 shrink-0 transition-transform" style={{ color: "#5f5a50", transform: expandido ? "rotate(180deg)" : undefined }} /> : <ChevronRight className="w-4 h-4 shrink-0" style={{ color: "#5f5a50" }} />}
      </button>
      {children && expandido && <div className="pb-4">{children}</div>}
    </div>
  );
}

interface DayTotals {
  cash: number; card: number; pix: number; debt: number; profit: number; cost: number; tips: number;
  transport: number; food: number;
}

export default function DefconHub() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { toast } = useToast();
  const [dailyGoal, setDailyGoal] = useState(0);
  const [planId, setPlanId] = useState<string | null>(null);
  const [workHours, setWorkHours] = useState(8);
  const [totals, setTotals] = useState<DayTotals>({ cash: 0, card: 0, pix: 0, debt: 0, profit: 0, cost: 0, tips: 0, transport: 0, food: 0 });
  const [hasSession, setHasSession] = useState(false);
  // Sessão de ONTEM ainda aberta (virou meia-noite com o DEFCON rodando).
  const [overnightOpen, setOvernightOpen] = useState(false);
  // Deslocamento REAL (GPS) somado das sessões: semana (últimos 7 dias) e total geral.
  const [gps, setGps] = useState({ kmSemana: 0, minSemana: 0, kmTotal: 0, diasSemana: 0 });
  const [exporting, setExporting] = useState(false);
  const [pdfDate, setPdfDate] = useState(getBrazilDate()); // dia do PDF (padrão: hoje)
  const [quickCost, setQuickCost] = useState("");
  const [quickCostCat, setQuickCostCat] = useState<"mercadoria" | "transporte" | "alimentacao">("mercadoria");
  const [showEdit, setShowEdit] = useState(false);
  const [ajustarDiaOpen, setAjustarDiaOpen] = useState(false);
  // Edição manual de "Como você recebeu" (dinheiro/cartão/pix) — p/ corrigir e lançar pagamentos tardios (ex.: Pix do outro dia)
  const [editingPay, setEditingPay] = useState(false);
  const [payCash, setPayCash] = useState("");
  const [payCard, setPayCard] = useState("");
  const [payPix, setPayPix] = useState("");
  const [savingPay, setSavingPay] = useState(false);
  const today = getBrazilDate();
  /* ---- Foco v2 (Rick, 05/09): um card que muda com o momento do dia ---- */
  const [sessao, setSessao] = useState<{ id: string; status: string; current_block_index: number; total_blocks: number; started_at: string | null; ended_at: string | null; worked_minutes: number | null } | null>(null);
  const [blocoFimEm, setBlocoFimEm] = useState<number | null>(null); // ms: quando fecha a hora atual
  const [contadores, setContadores] = useState({ vendas: 0, abord: 0 });
  const [ontem, setOntem] = useState({ vendido: 0, meta: 0 });
  const [semana, setSemana] = useState(0);
  const [rank, setRank] = useState<{ pos: number | null; dias: number; acimaValor: number | null }>({ pos: null, dias: 0, acimaValor: null });
  const [horaInicio, setHoraInicio] = useState<number | null>(null);
  const [nome, setNome] = useState("");
  const [carga, setCarga] = useState<{ nome: string; levou: number; vendeu: number; preco: number; custo: number }[]>([]);
  const [aberto, setAberto] = useState<string | null>(null); // linha do "Mais" expandida
  const [, setTick] = useState(0);
  useEffect(() => { const id = setInterval(() => setTick((t) => t + 1), 30000); return () => clearInterval(id); }, []);

  useEffect(() => {
    if (!loading && !user) navigate("/auth");
  }, [user, loading, navigate]);

  const loadAll = async () => {
    if (!user) return;
    const weekStart = getBrazilDateDaysAgo(6); // últimos 7 dias (hoje incluso)
    const [{ data: plan }, { data: sales }, { data: session }, { data: gpsRows }, { data: overnightSession }] = await Promise.all([
      supabase
        .from("daily_goal_plans")
        .select("id, daily_goal, work_hours")
        .eq("user_id", user.id)
        .eq("date", today)
        .maybeSingle(),
      supabase
        .from("daily_sales")
        .select("cash_sales, card_sales, pix_sales, total_debt, total_profit, cost, tip_sales, transport_cost, food_cost")
        .eq("user_id", user.id)
        .eq("date", today)
        .maybeSingle(),
      supabase
        .from("challenge_sessions")
        .select("id, status, current_block_index, total_blocks, started_at, ended_at, worked_minutes")
        .eq("user_id", user.id)
        .eq("date", today)
        .order("created_at", { ascending: false })
        .limit(1),
      supabase
        .from("challenge_sessions")
        .select("date, distance_meters, worked_minutes")
        .eq("user_id", user.id),
      supabase
        .from("challenge_sessions")
        .select("id")
        .eq("user_id", user.id)
        .eq("status", "active")
        .is("ended_at", null)
        .eq("date", getBrazilDateDaysAgo(1))
        .maybeSingle(),
    ]);

    // Deslocamento GPS: soma metros/minutos das sessões. Semana = últimos 7 dias.
    {
      const rows = (gpsRows || []) as Array<{ date: string; distance_meters?: number | null; worked_minutes?: number | null }>;
      let distSemana = 0, minSemana = 0, distTotal = 0, diasSemana = 0;
      for (const r of rows) {
        const d = Number(r.distance_meters) || 0;
        distTotal += d;
        if (r.date >= weekStart) {
          distSemana += d;
          minSemana += Number(r.worked_minutes) || 0;
          if (d > 0) diasSemana += 1;
        }
      }
      setGps({ kmSemana: distSemana / 1000, minSemana, kmTotal: distTotal / 1000, diasSemana });
    }

    if (!plan) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("base_daily_goal, goal_hours")
        .eq("user_id", user.id)
        .maybeSingle();
      const dg = profile?.base_daily_goal || 200;
      const wh = profile?.goal_hours || 8;
      const { data: newPlan } = await supabase
        .from("daily_goal_plans")
        .insert({
          user_id: user.id, date: today,
          daily_goal: dg, work_hours: wh, mood: "normal", hourly_goal: dg / wh,
        })
        .select()
        .single();
      if (newPlan) {
        const blocks = Array.from({ length: wh }, (_, i) => ({
          plan_id: newPlan.id, user_id: user.id, hour_index: i,
          hour_label: `H${i + 1}`, target_amount: dg / wh,
          valor_dinheiro: 0, valor_cartao: 0, valor_pix: 0, valor_calote: 0,
          timer_status: "idle",
        }));
        await supabase.from("hourly_goal_blocks").insert(blocks);
        setDailyGoal(dg);
        setPlanId(newPlan.id);
        setWorkHours(wh);
      }
    } else {
      setDailyGoal(Number(plan.daily_goal));
      setPlanId(plan.id);
      setWorkHours(Number(plan.work_hours) || 8);
    }

    setTotals({
      cash: Number((sales as any)?.cash_sales || 0),
      card: Number((sales as any)?.card_sales || 0),
      pix: Number((sales as any)?.pix_sales || 0),
      debt: Number((sales as any)?.total_debt || 0),
      profit: Number((sales as any)?.total_profit || 0),
      cost: Number((sales as any)?.cost || 0),
      tips: Number((sales as any)?.tip_sales || 0),
      transport: Number((sales as any)?.transport_cost || 0),
      food: Number((sales as any)?.food_cost || 0),
    });
    const sessaoHoje = ((session as any[]) || [])[0] ?? null;
    setHasSession(!!sessaoHoje);
    setSessao(sessaoHoje);
    // Só oferece "continuar o de ontem" na MADRUGADA (até 6h). De manhã em diante a
    // sessão velha é fechada sozinha ao abrir o DEFCON — dia novo começa limpo.
    const horaBR = parseInt(getBrazilTime().slice(0, 2), 10) || 0;
    setOvernightOpen(!!overnightSession && horaBR < 6);

    /* ---- Foco v2: bloco atual, contadores, ontem, semana, ranking, hora, carga ---- */
    const ontemData = getBrazilDateDaysAgo(1);
    const mes = today.slice(0, 7);
    const [bl, ds7, planOntem, lb, plano, perfil, ld, prods] = await Promise.all([
      sessaoHoje ? supabase.from("challenge_blocks").select("block_index, started_at, ended_at, status, approaches_count, sales_count").eq("session_id", sessaoHoje.id).order("block_index", { ascending: true }) : Promise.resolve({ data: [] as any[] }),
      supabase.from("daily_sales").select("date, cash_sales, card_sales, pix_sales").eq("user_id", user.id).gte("date", weekStart).lte("date", today),
      supabase.from("daily_goal_plans").select("daily_goal").eq("user_id", user.id).eq("date", ontemData).maybeSingle(),
      supabase.from("leaderboard_stats").select("posicao_faturamento, faturamento_total_mes, dias_trabalhados_mes").eq("user_id", user.id).eq("mes_referencia", mes).maybeSingle(),
      supabase.from("onboarding_planos").select("hora_inicio").eq("user_id", user.id).maybeSingle(),
      supabase.from("profiles").select("nickname").eq("user_id", user.id).maybeSingle(),
      supabase.from("defcon_daily_loadout").select("product_id, product_name, qty_initial, qty_sold").eq("user_id", user.id).eq("date", today),
      supabase.from("products").select("id, sale_price, cost").eq("user_id", user.id).eq("is_active", true),
    ]);
    {
      const blocos = ((bl.data as any[]) || []);
      const vendas = blocos.reduce((t, b) => t + (Number(b.sales_count) || 0), 0);
      const abord = blocos.reduce((t, b) => t + (Number(b.approaches_count) || 0), 0);
      setContadores({ vendas, abord });
      const rodando = blocos.find((b) => b.status === "running" || (b.started_at && !b.ended_at));
      setBlocoFimEm(rodando?.started_at ? new Date(rodando.started_at).getTime() + 60 * 60000 : null);
    }
    {
      let sem = 0, ont = 0;
      for (const r of ((ds7.data as any[]) || [])) {
        const v = (Number(r.cash_sales) || 0) + (Number(r.card_sales) || 0) + (Number(r.pix_sales) || 0);
        sem += v;
        if (r.date === ontemData) ont += v;
      }
      setSemana(sem);
      setOntem({ vendido: ont, meta: Number((planOntem.data as any)?.daily_goal) || 0 });
    }
    {
      const eu = lb.data as any;
      const pos = eu ? Number(eu.posicao_faturamento) || null : null;
      let acimaValor: number | null = null;
      if (pos && pos > 1) {
        const { data: ac } = await supabase.from("leaderboard_stats").select("faturamento_total_mes").eq("mes_referencia", mes).eq("posicao_faturamento", pos - 1).limit(1).maybeSingle();
        acimaValor = ac ? Math.max(0, (Number((ac as any).faturamento_total_mes) || 0) - (Number(eu.faturamento_total_mes) || 0)) : null;
      }
      setRank({ pos, dias: eu ? Number(eu.dias_trabalhados_mes) || 0 : 0, acimaValor });
    }
    const hi = (plano.data as any)?.hora_inicio;
    setHoraInicio(hi == null ? null : Number(hi));
    setNome(String((perfil.data as any)?.nickname || "").trim());
    {
      const ps = ((prods.data as any[]) || []);
      setCarga(((ld.data as any[]) || []).map((l) => {
        const p = ps.find((x) => x.id === l.product_id);
        return { nome: String(l.product_name || "produto"), levou: Number(l.qty_initial) || 0, vendeu: Number(l.qty_sold) || 0, preco: Number(p?.sale_price) || 0, custo: Number(p?.cost) || 0 };
      }));
    }
  };

  useEffect(() => {
    if (user) loadAll();
  }, [user, today]);

  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel("hub-daily-sales")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "daily_sales", filter: `user_id=eq.${user.id}` },
        () => loadAll()
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user]);

  const totalVendido = totals.cash + totals.card + totals.pix;
  const progresso = dailyGoal > 0 ? Math.min(100, (totalVendido / dailyGoal) * 100) : 0;
  const goalReached = totalVendido >= dailyGoal && dailyGoal > 0;
  const falta = Math.max(0, dailyGoal - totalVendido);

  // GPS da semana: pace (min/km) e velocidade real (km/h) a partir de km + minutos trabalhados.
  const gpsPaceMin = gps.kmSemana > 0 ? gps.minSemana / gps.kmSemana : null;
  const gpsVelocidade = gps.minSemana > 0 ? gps.kmSemana / (gps.minSemana / 60) : 0;
  const gpsPaceLabel = gpsPaceMin != null
    ? (() => { const s = Math.round(gpsPaceMin * 60); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; })()
    : null;

  const handlePDF = async () => {
    if (!user) return;
    setExporting(true);
    try {
      await generateDefconDayPDF(user.id, pdfDate);
      const label = pdfDate === getBrazilDate() ? "de hoje" : `de ${pdfDate.split("-").reverse().slice(0, 2).join("/")}`;
      toast({ title: "PDF gerado", description: `Relatório ${label} baixado com sucesso.` });
    } catch (e) {
      toast({ title: "Erro ao gerar PDF", variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  const handleAddCost = async () => {
    if (!user) return;
    const amount = parseFloat(quickCost);
    if (!amount || amount <= 0) return;
    // Cada categoria vai pra coluna certa do daily_sales — e TODAS entram no relatório
    // e ABATEM do líquido: mercadoria -> "Custo de mercadoria"; transporte/almoço ->
    // "Transporte e alimentação". (Antes ia pra personal_expenses e sumia do relatório.)
    const col = quickCostCat === "transporte" ? "transport_cost"
      : quickCostCat === "alimentacao" ? "food_cost"
      : "cost";
    const { data: rows } = await supabase
      .from("daily_sales")
      .select("id, cost, transport_cost, food_cost")
      .eq("user_id", user.id)
      .eq("date", today)
      .order("created_at", { ascending: true })
      .limit(1);
    if (rows && rows.length > 0) {
      const prev = Number((rows[0] as any)[col]) || 0;
      await supabase
        .from("daily_sales")
        .update({ [col]: prev + amount } as any)
        .eq("id", (rows[0] as any).id);
    } else {
      await supabase
        .from("daily_sales")
        .insert({ user_id: user.id, date: today, [col]: amount } as any);
    }
    setQuickCost("");
    const catLabel = quickCostCat === "transporte" ? "Transporte" : quickCostCat === "alimentacao" ? "Almoço" : "Mercadoria";
    toast({ title: `${catLabel} registrado`, description: formatCurrency(amount) });
    loadAll();
  };

  // Arredonda pra 2 casas ao popular os campos — senão o float vaza (ex.: 74,99000000000001).
  const em2Casas = (v: number) => {
    const n = Math.round((Number(v) || 0) * 100) / 100;
    return n ? String(n) : "";
  };

  const openPayEditor = () => {
    setPayCash(em2Casas(totals.cash));
    setPayCard(em2Casas(totals.card));
    setPayPix(em2Casas(totals.pix));
    setEditingPay(true);
  };

  // Salva a edição manual: redistribui os valores informados pelos blocos da hora
  // (proporcional ao que cada bloco vendeu) e ressincroniza o daily_sales.
  // O que faltar pro total vira "não recebido" (calote) — cobre o caso do Pix que cai depois.
  const savePayEdit = async () => {
    if (!user || !planId) return;
    setSavingPay(true);
    try {
      // Aceita vírgula e arredonda: o valor digitado é a VERDADE (ex.: 12 tem que virar 12).
      const num = (s: string) => Math.round((parseFloat(String(s).replace(",", ".")) || 0) * 100) / 100;
      const d = num(payCash);
      const c = num(payCard);
      const p = num(payPix);

      const { data: blocks } = await supabase
        .from("hourly_goal_blocks")
        .select("id, valor_dinheiro, valor_cartao, valor_pix, valor_calote")
        .eq("plan_id", planId);

      const totalFromBlocks = (blocks || []).reduce(
        (s, b) => s + (b.valor_dinheiro || 0) + (b.valor_cartao || 0) + (b.valor_pix || 0) + (b.valor_calote || 0),
        0
      );

      if (totalFromBlocks > 0) {
        // Só os blocos com movimento recebem fatia.
        const ativos = (blocks || []).filter(
          (b) => (b.valor_dinheiro || 0) + (b.valor_cartao || 0) + (b.valor_pix || 0) + (b.valor_calote || 0) > 0
        );
        // Arredondar cada fatia perde centavos (12 virava 11,98). Então acumulamos o que
        // já foi distribuído e o ÚLTIMO bloco leva exatamente o resto — a soma bate certo.
        let accD = 0, accC = 0, accP = 0;
        for (let i = 0; i < ativos.length; i++) {
          const b = ativos[i];
          const blockTotal = (b.valor_dinheiro || 0) + (b.valor_cartao || 0) + (b.valor_pix || 0) + (b.valor_calote || 0);
          const ratio = blockTotal / totalFromBlocks;
          const ultimo = i === ativos.length - 1;
          const bd = ultimo ? Math.round((d - accD) * 100) / 100 : Math.round(d * ratio * 100) / 100;
          const bc = ultimo ? Math.round((c - accC) * 100) / 100 : Math.round(c * ratio * 100) / 100;
          const bp = ultimo ? Math.round((p - accP) * 100) / 100 : Math.round(p * ratio * 100) / 100;
          accD += bd; accC += bc; accP += bp;
          const bcal = Math.max(0, Math.round((blockTotal - (bd + bc + bp)) * 100) / 100);
          const achieved = Math.round((bd + bc + bp + bcal) * 100) / 100;
          await supabase
            .from("hourly_goal_blocks")
            .update({ valor_dinheiro: bd, valor_cartao: bc, valor_pix: bp, valor_calote: bcal, achieved_amount: achieved })
            .eq("id", b.id);
        }
      }

      await syncBlocksToDailySales(user.id);
      setEditingPay(false);
      toast({ title: "Recebimentos atualizados", description: "Dinheiro, cartão e Pix corrigidos." });
      loadAll();
    } catch {
      toast({ title: "Erro ao salvar", variant: "destructive" });
    } finally {
      setSavingPay(false);
    }
  };

  /* ---- Foco v2: derivados ---- */
  const estado: "antes" | "rodando" | "encerrado" = sessao?.status === "active" ? "rodando" : sessao ? "encerrado" : "antes";
  const agora = Date.now();
  const minRestantes = blocoFimEm ? Math.max(0, Math.round((blocoFimEm - agora) / 60000)) : null;
  const blocoN = (Number(sessao?.current_block_index) || 0) + 1;
  const blocosTot = Number(sessao?.total_blocks) || 0;
  const conv = contadores.abord > 0 ? Math.min(100, Math.round((contadores.vendas / contadores.abord) * 100)) : 0;
  const pctOntem = ontem.meta > 0 ? Math.round((ontem.vendido / ontem.meta) * 100) : 0;
  const liga = rank.pos ? getTier(rank.pos) : null;
  const ligaLabel = liga ? liga.label.charAt(0) + liga.label.slice(1).toLowerCase() : "";
  const naRua = (() => { const m = Number(sessao?.worked_minutes) || 0; return `${Math.floor(m / 60)}h${String(m % 60).padStart(2, "0")}`; })();
  const projecao = estado === "rodando" && sessao?.started_at ? (() => { const h = Math.max(0.25, (agora - new Date(sessao.started_at).getTime()) / 3600000); return (totalVendido / h) * Math.max(h, blocosTot || workHours); })() : 0;
  const cargaTot = carga.reduce((t, c) => t + c.levou, 0);
  const cargaVend = carga.reduce((t, c) => t + c.vendeu, 0);
  const cargaEntra = carga.reduce((t, c) => t + c.levou * c.preco, 0);
  const cargaCusto = carga.reduce((t, c) => t + c.levou * c.custo, 0);
  const sobras = carga.map((c) => ({ ...c, sobrou: Math.max(0, c.levou - c.vendeu) }));
  const acabou = sobras.filter((c) => c.levou > 0 && c.sobrou === 0);
  const brl0 = (n: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(Math.round(n));
  const dataLabel = new Date(`${today}T12:00:00`).toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "short" }).replace(/\./g, "").replace("-feira", "");
  const toggle = (k: string) => setAberto((v) => (v === k ? null : k));
  const heroTom = estado === "rodando"
    ? { borda: "rgba(61,214,140,.35)", fundo: "radial-gradient(120% 80% at 80% -10%, rgba(61,214,140,.18), transparent 60%), linear-gradient(170deg,#0a140e 0%,#0b0b0b 70%)", tag: "#3DD68C" }
    : estado === "encerrado"
    ? { borda: "rgba(245,184,0,.35)", fundo: "radial-gradient(120% 80% at 80% -10%, rgba(245,184,0,.18), transparent 60%), linear-gradient(170deg,#1a1408 0%,#0b0b0b 70%)", tag: "#F5B800" }
    : { borda: "rgba(242,70,90,.35)", fundo: "radial-gradient(120% 80% at 80% -10%, rgba(242,70,90,.22), transparent 60%), linear-gradient(170deg,#170a0c 0%,#0b0b0b 70%)", tag: "#F2465A" };
  if (loading || !user) return null;

  return (
    <div className="pb-8 max-w-md mx-auto px-1 orbis-stagger">
      {/* ===== CABEÇALHO ===== */}
      <p className="orbis-mini pt-1">Foco · {dataLabel}</p>
      <h1 className="font-display text-[24px] font-extrabold tracking-tight mt-1.5 leading-tight">
        {estado === "rodando" ? "Tá rodando." : estado === "encerrado" ? "Dia fechado." : `Bora pro corre${nome ? `, ${nome.split(" ")[0]}` : ""}.`}
      </h1>
      <p className="text-[12.5px] mt-1.5" style={{ color: "var(--orbis-fg-2)" }}>
        {estado === "rodando" && <>Bloco {blocoN}{blocosTot ? ` de ${blocosTot}` : ""}{minRestantes != null ? <> · <b className="text-foreground">{minRestantes} min</b> pra fechar essa hora</> : null}</>}
        {estado === "encerrado" && <>{naRua} na rua · {contadores.vendas} {contadores.vendas === 1 ? "venda" : "vendas"}{rank.dias ? <> · <b className="text-foreground">{rank.dias} {rank.dias === 1 ? "dia" : "dias"}</b> vendendo este mês</> : null}</>}
        {estado === "antes" && <>{horaInicio != null ? <>Você começa às <b className="text-foreground">{String(horaInicio).padStart(2, "0")}h</b></> : "Seu dia começa quando você apertar"}{rank.dias ? <> · {rank.dias} {rank.dias === 1 ? "dia" : "dias"} vendendo este mês</> : null}</>}
      </p>

      {/* ===== CARD PRINCIPAL — muda de cor com o momento ===== */}
      <div className="relative overflow-hidden rounded-[26px] border mt-[18px] px-5 pt-5 pb-[18px]" style={{ borderColor: heroTom.borda, background: heroTom.fundo }}>
        <span className="inline-flex items-center gap-1.5 text-[10.5px] font-extrabold tracking-[.2em] uppercase" style={{ color: heroTom.tag }}>
          {estado === "rodando" ? <span className="inline-block w-2 h-2 rounded-full" style={{ background: "#3DD68C", boxShadow: "0 0 0 4px rgba(61,214,140,.18)" }} /> : estado === "encerrado" ? <Check className="w-3 h-3" strokeWidth={3} /> : <Zap className="w-3 h-3" fill="currentColor" strokeWidth={0} />}
          DEFCON 4 · {estado === "rodando" ? "ao vivo" : estado === "encerrado" ? "encerrado" : "Modo desafio"}
        </span>
        {estado === "antes" && (
          <button onClick={() => setShowEdit(true)} aria-label="Editar meta" className="absolute right-[18px] top-[18px] w-[34px] h-[34px] rounded-[11px] flex items-center justify-center" style={{ border: "1px solid rgba(255,255,255,.10)", background: "rgba(255,255,255,.05)", color: "var(--orbis-fg-2)" }}><Pencil className="w-3.5 h-3.5" /></button>
        )}
        <p className="orbis-mini mt-3.5">{estado === "rodando" ? "Vendido até agora" : estado === "encerrado" ? "Vendido hoje" : "Meta do dia"}</p>
        <p className="orbis-num text-[40px] font-extrabold leading-none mt-1.5 tracking-[-1px]" style={estado !== "antes" ? { color: "var(--orbis-ok)" } : undefined}>
          {brl0(estado === "antes" ? dailyGoal : totalVendido)}
        </p>
        <p className="text-[12.5px] mt-2" style={{ color: "var(--orbis-fg-2)" }}>
          {estado === "antes" && <><b className="text-foreground">{workHours} blocos</b> de 1h · ritmo de <b className="text-foreground">{brl0(dailyGoal / Math.max(1, workHours))}</b> por hora</>}
          {estado === "rodando" && <>Meta <b className="text-foreground">{brl0(dailyGoal)}</b>{projecao > 0 ? <> · nesse ritmo você fecha em <b className="text-foreground">{brl0(projecao)}</b></> : null}</>}
          {estado === "encerrado" && <><b className="text-foreground">{dailyGoal > 0 ? Math.round((totalVendido / dailyGoal) * 100) : 0}%</b> da meta{totals.profit > 0 ? <> · sobrou <b style={{ color: "var(--orbis-ok)" }}>{brl0(totals.profit)}</b> pra você</> : null}</>}
        </p>
        <div className="h-1.5 rounded-full mt-3.5 overflow-hidden" style={{ background: "rgba(255,255,255,.08)" }}>
          <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${progresso}%`, background: goalReached || estado === "rodando" ? "linear-gradient(90deg,#3DD68C,#46E09A)" : "linear-gradient(90deg,#F5B800,#FFC63A)" }} />
        </div>
        <div className="flex justify-between text-[11px] font-semibold mt-1.5" style={{ color: "var(--orbis-fg-3)" }}>
          {estado === "encerrado"
            ? <><span>{goalReached ? `Meta ${brl0(dailyGoal)} batida` : `Meta ${brl0(dailyGoal)}`}</span><span>{goalReached ? `${brl0(totalVendido - dailyGoal)} acima` : `faltou ${brl0(falta)}`}</span></>
            : <><span>{estado === "rodando" ? `${Math.round(progresso)}% da meta` : <>Vendido hoje <b className="text-foreground">{brl0(totalVendido)}</b></>}</span><span>{goalReached ? "meta batida" : `falta ${brl0(falta)}`}</span></>}
        </div>

        {estado === "rodando" ? (
          <button onClick={() => navigate("/defcon")} data-tour="defcon-banner" className="w-full h-[56px] rounded-[17px] mt-4 font-extrabold text-[16px] flex items-center justify-center gap-2 active:scale-[.98] transition" style={{ background: "linear-gradient(180deg,#46E09A,#3DD68C)", color: "#06170e", boxShadow: "0 12px 28px -12px rgba(61,214,140,.8)" }}>
            <Play className="w-[18px] h-[18px]" fill="#06170e" strokeWidth={0} /> VOLTAR PRO DEFCON
          </button>
        ) : estado === "encerrado" ? (
          <>
            <button onClick={() => navigate("/defcon")} data-tour="defcon-banner" className="orbis-cta w-full mt-4"><FileText className="w-4 h-4" strokeWidth={2.4} /> VER O RELATÓRIO DE HOJE</button>
            <button onClick={handlePDF} disabled={exporting} className="w-full h-[50px] rounded-[16px] mt-2.5 text-[14px] font-bold inline-flex items-center justify-center gap-2" style={{ border: "1px solid rgba(245,184,0,.45)", color: "var(--orbis-gold)" }}>
              {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <><FileDown className="w-4 h-4" /> Baixar PDF de hoje</>}
            </button>
          </>
        ) : (
          <button onClick={() => navigate("/defcon")} data-tour="defcon-banner" className="w-full h-[56px] rounded-[17px] mt-4 font-extrabold text-[16px] tracking-wide flex items-center justify-center gap-2 active:scale-[.98] transition" style={{ background: "linear-gradient(180deg,#F2465A,#E5354A)", color: "#FFF", boxShadow: "0 12px 28px -10px rgba(229,53,74,.9)" }}>
            <Zap className="w-[18px] h-[18px]" fill="#fff" strokeWidth={0} /> {overnightOpen ? "CONTINUAR O DEFCON DE ONTEM" : "INICIAR DEFCON 4"}
          </button>
        )}
        {overnightOpen && estado === "antes" && (
          <p className="mt-2.5 text-[11.5px] leading-relaxed text-center rounded-[12px] px-3 py-2" style={{ border: "1px solid rgba(245,184,0,.35)", background: "rgba(245,184,0,.08)", color: "var(--orbis-fg-2)" }}>
            Seu DEFCON de <b className="text-foreground">ontem</b> ainda está aberto — o que você vender continua contando pra ontem até você encerrar.
          </p>
        )}

        {estado === "rodando" ? (
          <Trio itens={[["Vendas", contadores.vendas], ["Abord.", contadores.abord], ["Conv.", <span key="c" style={{ color: "var(--orbis-gold)" }}>{conv}%</span>]]} />
        ) : estado === "encerrado" ? (
          <Trio itens={[["Ranking", liga ? <span key="r" style={{ color: liga.color }}>#{rank.pos} · {ligaLabel}</span> : "—"], ["Semana", brl0(semana)], ["Amanhã", <span key="a" className="text-[14px]">{horaInicio != null ? `${String(horaInicio).padStart(2, "0")}h · ` : ""}{brl0(dailyGoal)}</span>]]} />
        ) : (
          <Trio itens={[["Ontem", ontem.vendido > 0 ? <>{brl0(ontem.vendido)} {pctOntem > 0 && <small className="text-[11px]" style={{ color: pctOntem >= 100 ? "var(--orbis-ok)" : "var(--orbis-fg-3)" }}>{pctOntem}%</small>}</> : "—"], ["Semana", semana > 0 ? brl0(semana) : "—"], ["Ranking", liga ? <span key="r" style={{ color: liga.color }}>#{rank.pos} · {ligaLabel}</span> : "—"]]} />
        )}
      </div>

      {/* ===== PONTE (dia encerrado): a linha do próximo passo ===== */}
      {estado === "encerrado" && rank.pos && (
        <button onClick={() => navigate("/ranking")} className="w-full mt-3.5 flex items-center gap-2.5 px-3.5 py-3 rounded-[14px] text-left text-[12.5px] leading-snug" style={{ border: "1px dashed rgba(245,184,0,.35)", color: "var(--orbis-fg-2)" }}>
          <ArrowRight className="w-4 h-4 shrink-0" style={{ color: "var(--orbis-gold)" }} strokeWidth={2.4} />
          <span>Você está em <b style={{ color: "var(--orbis-gold)" }}>#{rank.pos}</b> este mês.{rank.acimaValor != null && rank.pos > 1 ? <> Faltam {brl0(rank.acimaValor)} pra passar o #{rank.pos - 1} — </> : " "}<b style={{ color: "var(--orbis-gold)" }}>ver o ranking</b></span>
        </button>
      )}

      {/* ===== SUA MERCADORIA ===== */}
      <div className="flex items-center justify-between mt-7 px-1">
        <p className="orbis-mini">{estado === "encerrado" ? "Sua mercadoria" : "Sua mercadoria de hoje"}</p>
        {estado === "antes" && carga.length > 0 && <button onClick={() => toggle("carga")} className="text-[11px] font-bold" style={{ color: "var(--orbis-gold)" }}>{aberto === "carga" ? "fechar" : "ajustar"}</button>}
      </div>
      <div className="rounded-[20px] border mt-3 px-4 py-3.5" style={{ borderColor: "var(--orbis-line)", background: "var(--orbis-surf)" }}>
        {carga.length === 0 ? (
          <button onClick={() => navigate("/products")} className="w-full flex items-center gap-3 text-left">
            <span className="w-9 h-9 rounded-[12px] flex items-center justify-center shrink-0" style={{ background: "rgba(245,184,0,.12)", color: "var(--orbis-gold)" }}><Package className="w-[18px] h-[18px]" strokeWidth={2} /></span>
            <span className="flex-1 min-w-0"><b className="block text-[14px] font-bold">Quer que o Orbis controle seu estoque?</b><small className="block text-[12px] mt-0.5" style={{ color: "var(--orbis-fg-3)" }}>Cadastra o que você vende — desconta sozinho a cada venda.</small></span>
            <ChevronRight className="w-4 h-4 shrink-0" style={{ color: "#5f5a50" }} />
          </button>
        ) : (
          <>
            <div className="flex items-center gap-3">
              <span className="w-9 h-9 rounded-[12px] flex items-center justify-center shrink-0" style={{ background: "rgba(255,255,255,.06)", color: "var(--orbis-fg-2)" }}><Package className="w-[18px] h-[18px]" strokeWidth={2} /></span>
              <span className="flex-1 min-w-0">
                {estado === "antes" ? (
                  <><b className="block text-[14px] font-bold">{cargaTot} unidades na carga</b><small className="block text-[12px] mt-0.5" style={{ color: "var(--orbis-fg-3)" }}>{cargaEntra > 0 ? `Se vender tudo, entra ${brl0(cargaEntra)}` : "Preço por unidade ainda não cadastrado"}</small></>
                ) : estado === "rodando" ? (
                  <><b className="block text-[14px] font-bold">Saíram {cargaVend} de {cargaTot}</b><small className="block text-[12px] mt-0.5 truncate" style={{ color: "var(--orbis-fg-3)" }}>{carga.map((c) => `${c.nome} ${c.vendeu} de ${c.levou}`).join(" · ")}</small></>
                ) : (
                  <><b className="block text-[14px] font-bold">{sobras.some((c) => c.sobrou > 0) ? `Sobrou ${sobras.filter((c) => c.sobrou > 0).map((c) => `${c.sobrou} ${c.nome.toLowerCase()}`).join(" · ")}` : "Zerou tudo"}{acabou.length ? ` · ${acabou.map((c) => c.nome.toLowerCase()).join(", ")} acabou` : ""}</b><small className="block text-[12px] mt-0.5" style={{ color: "var(--orbis-fg-3)" }}>{acabou.length ? "Precisa comprar mercadoria pra amanhã." : `${cargaVend} unidades vendidas hoje.`}</small></>
                )}
              </span>
              {estado === "antes" && cargaEntra - cargaCusto > 0 && <span className="text-right shrink-0"><b className="orbis-num block text-[15px] font-extrabold" style={{ color: "var(--orbis-ok)" }}>{brl0(cargaEntra - cargaCusto)}</b><small className="block text-[10.5px] font-semibold" style={{ color: "var(--orbis-fg-3)" }}>sobra pra você</small></span>}
              {estado === "rodando" && <span className="text-right shrink-0"><b className="orbis-num block text-[15px] font-extrabold">{Math.max(0, cargaTot - cargaVend)}</b><small className="block text-[10.5px] font-semibold" style={{ color: "var(--orbis-fg-3)" }}>restam</small></span>}
            </div>
            {estado === "antes" && aberto !== "carga" && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {carga.map((c) => <span key={c.nome} className="rounded-full px-2.5 py-1.5 text-[12px] font-bold" style={{ border: "1px solid rgba(255,255,255,.10)", background: "rgba(0,0,0,.35)" }}>{c.nome} <b style={{ color: "var(--orbis-gold)" }}>{c.levou}</b></span>)}
                <button onClick={() => navigate("/products")} className="rounded-full px-2.5 py-1.5 text-[12px] font-bold" style={{ border: "1px dashed rgba(245,184,0,.4)", color: "var(--orbis-gold)" }}>+ produto</button>
              </div>
            )}
            {estado === "rodando" && cargaTot > 0 && (
              <div className="h-1.5 rounded-full mt-3 overflow-hidden" style={{ background: "rgba(255,255,255,.08)" }}><div className="h-full rounded-full" style={{ width: `${Math.min(100, (cargaVend / cargaTot) * 100)}%`, background: "linear-gradient(90deg,#F5B800,#FFC63A)" }} /></div>
            )}
            {estado === "antes" && aberto === "carga" && <div className="mt-3"><DefconLoadoutManager userId={user.id} /></div>}
          </>
        )}
      </div>

      {/* DESAFIO DA SEMANA — bilhete dourado (só quando há desafio ativo) */}
      <div className="mt-3"><WeeklyChallengeIcon /></div>

      {/* ===== MAIS — o que antes era uma pilha de cards ===== */}
      <p className="orbis-mini mt-7 px-1">Mais</p>
      <div className="rounded-[20px] border mt-3 px-4" style={{ borderColor: "var(--orbis-line)", background: "var(--orbis-surf)" }}>
        <Linha aberto={aberto} onToggle={toggle} k="custo" icone={<Plus className="w-4 h-4" strokeWidth={2.4} />} titulo="Custo rápido" sub={estado === "encerrado" ? "esqueceu algum custo de hoje?" : "mercadoria, transporte, almoço"}>
          <div className="grid grid-cols-3 gap-2">
            {([["mercadoria", "Mercadoria", <Package key="m" className="w-4 h-4" />], ["transporte", "Transporte", <Bus key="t" className="w-4 h-4" />], ["alimentacao", "Almoço", <Utensils key="a" className="w-4 h-4" />]] as const).map(([id, label, ico]) => {
              const active = quickCostCat === id;
              return (
                <button key={id} type="button" onClick={() => setQuickCostCat(id)} className="flex flex-col items-center justify-center gap-1 h-14 rounded-[12px] border text-[12px] font-semibold active:scale-95"
                  style={active ? { borderColor: "rgba(245,184,0,.5)", background: "rgba(245,184,0,.08)", color: "var(--orbis-fg)" } : { borderColor: "rgba(255,255,255,.10)", color: "var(--orbis-fg-3)" }}>
                  {ico}<span>{label}</span>
                </button>
              );
            })}
          </div>
          <div className="flex gap-2 mt-2">
            <MoneyInput value={parseFloat(quickCost) || 0} onChange={(n) => setQuickCost(n ? String(n) : "")} placeholder="R$ 0,00"
              className="flex-1 min-w-0 h-11 bg-background border border-border rounded-xl px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary placeholder:text-muted-foreground" />
            <button onClick={handleAddCost} disabled={!quickCost || parseFloat(quickCost) <= 0} className="shrink-0 h-11 px-4 rounded-xl font-extrabold text-[13px] flex items-center gap-1.5 disabled:opacity-40 active:scale-95" style={{ background: "var(--orbis-gold)", color: "#1A1200" }}><Plus className="w-4 h-4" /> Adicionar</button>
          </div>
          <div className="mt-3"><CustoRapidoHistory onChanged={loadAll} /></div>
        </Linha>

        {totalVendido > 0 && (
          <Linha aberto={aberto} onToggle={toggle} k="recebeu" icone={<Banknote className="w-4 h-4" strokeWidth={2.2} />} titulo="Como você recebeu" sub={`${brl0(totals.cash)} dinheiro · ${brl0(totals.card)} cartão · ${brl0(totals.pix)} pix`}>
            {editingPay ? (
              <div className="rounded-xl border p-3 space-y-2.5" style={{ borderColor: "rgba(245,184,0,.3)" }}>
                <p className="text-xs" style={{ color: "var(--orbis-fg-3)" }}>Ajuste o que entrou em cada forma. O que faltar pro total vira <span style={{ color: "var(--orbis-custo)" }}>não recebido</span>.</p>
                <PayEditRow icon={<Banknote className="w-4 h-4 text-success" />} label="Dinheiro" value={payCash} onChange={setPayCash} />
                <PayEditRow icon={<CreditCard className="w-4 h-4" style={{ color: readThemeColor("--violet-soft") }} />} label="Cartão" value={payCard} onChange={setPayCard} />
                <PayEditRow icon={<Smartphone className="w-4 h-4" style={{ color: BRAND_COLORS.PIX }} />} label="Pix" value={payPix} onChange={setPayPix} />
                <div className="flex items-center justify-between pt-1">
                  <span className="text-xs tabular-nums" style={{ color: "var(--orbis-fg-3)" }}>Somado <span className="text-foreground font-semibold">{formatCurrency((parseFloat(payCash) || 0) + (parseFloat(payCard) || 0) + (parseFloat(payPix) || 0))}</span> / {formatCurrency(totalVendido)}</span>
                  <div className="flex gap-2">
                    <button onClick={() => setEditingPay(false)} disabled={savingPay} className="h-9 px-3 rounded-lg bg-muted text-foreground text-xs font-semibold flex items-center gap-1 active:scale-95 disabled:opacity-50"><X className="w-3.5 h-3.5" /> Cancelar</button>
                    <button onClick={savePayEdit} disabled={savingPay} className="h-9 px-3 rounded-lg text-xs font-bold flex items-center gap-1 active:scale-95 disabled:opacity-50" style={{ background: "var(--orbis-gold)", color: "#1A1200" }}><Check className="w-3.5 h-3.5" /> {savingPay ? "Salvando..." : "Salvar"}</button>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-2">
                  <PayCard icon={<Banknote className="w-4 h-4" />} label="Dinheiro" value={totals.cash} total={totalVendido} color={readThemeColor("--success")} />
                  <PayCard icon={<CreditCard className="w-4 h-4" />} label="Cartão" value={totals.card} total={totalVendido} color={readThemeColor("--violet-soft")} />
                  <PayCard icon={<Smartphone className="w-4 h-4" />} label="Pix" value={totals.pix} total={totalVendido} color={BRAND_COLORS.PIX} />
                </div>
                {totals.tips > 0 && (
                  <div className="mt-2 rounded-xl px-4 py-3 flex items-center gap-3" style={{ border: "1px solid rgba(245,184,0,.3)", background: "rgba(245,184,0,.06)" }}>
                    <Coins className="w-4 h-4 shrink-0" style={{ color: "var(--orbis-gold)" }} />
                    <span className="flex-1 text-[12px]" style={{ color: "var(--orbis-fg-2)" }}>Gorjetas · já inclusas no dinheiro</span>
                    <span className="orbis-num text-[15px] font-bold" style={{ color: "var(--orbis-gold)" }}>+{formatCurrency(totals.tips)}</span>
                  </div>
                )}
                <div className={`grid gap-2 mt-2 ${(totals.debt > 0 || (totals.cost + totals.transport + totals.food) > 0) ? "grid-cols-2" : "grid-cols-1"}`}>
                  <MiniStat label="Lucro" value={formatCurrency(totals.profit)} highlight />
                  {totals.debt > 0 && <MiniStat label="Calotes" value={formatCurrency(totals.debt)} danger />}
                  {(totals.cost + totals.transport + totals.food) > 0 && <MiniStat label="Custos" value={formatCurrency(totals.cost + totals.transport + totals.food)} />}
                </div>
                <button onClick={openPayEditor} className="mt-2 inline-flex items-center gap-1 h-8 px-3 rounded-full text-[12px] font-bold" style={{ border: "1px solid rgba(245,184,0,.4)", color: "var(--orbis-gold)" }}><Pencil className="w-3 h-3" /> Corrigir valores</button>
              </>
            )}
          </Linha>
        )}

        <Linha aberto={aberto} onToggle={toggle} k="compra" icone={<ShoppingCart className="w-4 h-4" strokeWidth={2.2} />} titulo="Compra de mercadoria" sub="entra no estoque e no custo">
          <DefconCompraMercadoria userId={user.id} onChanged={loadAll} />
        </Linha>

        <Linha aberto={aberto} onToggle={toggle} k="pixdepois" icone={<Clock className="w-4 h-4" strokeWidth={2.2} />} titulo="Pix que caiu depois" sub="lançar num dia anterior">
          <LatePixSection />
        </Linha>

        <Linha aberto={aberto} onToggle={toggle} k="ajustar" icone={<Calendar className="w-4 h-4" strokeWidth={2.2} />} titulo="Ajustar dia anterior" sub="fechou depois da meia-noite?" onClick={() => setAjustarDiaOpen(true)} />

        {gps.kmTotal > 0 && (
          <Linha aberto={aberto} onToggle={toggle} k="gps" icone={<MapPin className="w-4 h-4" strokeWidth={2.2} />} titulo="Deslocamento" sub={`${gps.kmSemana < 1 ? `${Math.round(gps.kmSemana * 1000)} m` : `${gps.kmSemana.toFixed(1)} km`} na semana${gpsVelocidade > 0 ? ` · ${gpsVelocidade.toFixed(1)} km/h` : ""}`}>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div><p className="orbis-num text-xl font-black" style={{ color: "var(--orbis-gold)" }}>{gps.kmSemana < 1 ? `${Math.round(gps.kmSemana * 1000)} m` : `${gps.kmSemana.toFixed(1)} km`}</p><p className="text-[11px]" style={{ color: "var(--orbis-fg-3)" }}>na semana</p></div>
              <div><p className="orbis-num text-xl font-black">{gpsPaceLabel ?? "—"}</p><p className="text-[11px]" style={{ color: "var(--orbis-fg-3)" }}>pace /km</p></div>
              <div><p className="orbis-num text-xl font-black">{gpsVelocidade.toFixed(1)}</p><p className="text-[11px]" style={{ color: "var(--orbis-fg-3)" }}>km/h real</p></div>
            </div>
            <p className="text-[11px] text-center mt-2" style={{ color: "var(--orbis-fg-3)" }}>Total geral: <b className="text-foreground">{gps.kmTotal.toFixed(1)} km</b>{gps.diasSemana > 0 && <> · {gps.diasSemana} {gps.diasSemana === 1 ? "dia" : "dias"} com GPS na semana</>}</p>
          </Linha>
        )}

        <Linha aberto={aberto} onToggle={toggle} k="extrato" icone={<FileText className="w-4 h-4" strokeWidth={2.2} />} titulo="Extrato da competição" sub="pra quem está em X1 ou competição">
          <CompetitionStatementUpload userId={user.id} />
        </Linha>

        <Linha aberto={aberto} onToggle={toggle} k="pdf" icone={<FileDown className="w-4 h-4" strokeWidth={2.2} />} titulo="Baixar relatório em PDF" sub="de hoje ou de qualquer dia">
          <div className="flex gap-2">
            <input type="date" value={pdfDate} max={getBrazilDate()} onChange={(e) => setPdfDate(e.target.value)} className="h-11 w-36 shrink-0 bg-background border border-border rounded-xl px-3 text-sm text-foreground" />
            <button onClick={handlePDF} disabled={exporting} className="flex-1 h-11 rounded-xl text-[13px] font-bold flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-50" style={{ border: "1px solid rgba(245,184,0,.4)", color: "var(--orbis-gold)" }}>
              <FileDown className="w-4 h-4" /> {exporting ? "Gerando..." : pdfDate === getBrazilDate() ? "Baixar PDF do dia" : "Baixar PDF do dia escolhido"}
            </button>
          </div>
        </Linha>
      </div>

      <p className="text-center text-[11.5px] mt-4" style={{ color: "var(--orbis-fg-3)" }}>Relatórios completos e filtros ficam na aba <span style={{ color: "var(--orbis-gold)" }}>Relatório</span>.</p>

      {user && (
        <EditPlanningModal userId={user.id} isOpen={showEdit} onClose={() => { setShowEdit(false); loadAll(); }} />
      )}
      {user && (
        <DefconAjustarDiaModal open={ajustarDiaOpen} onOpenChange={setAjustarDiaOpen} userId={user.id} onSaved={loadAll} />
      )}
    </div>
  );
}

function PayCard({
  icon,
  label,
  value,
  total,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  total: number;
  color: string;
}) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  const active = value > 0;
  return (
    <div
      className="relative overflow-hidden rounded-xl bg-gradient-to-br from-card to-background border p-2.5 space-y-1.5 transition-[colors,transform,opacity]"
      style={{
        borderColor: active ? `${color}55` : "rgba(255,255,255,0.06)",
        boxShadow: active ? `0 6px 18px -8px ${color}66, inset 0 1px 0 0 ${color}15` : undefined,
      }}
    >
      {/* glow corner sutil */}
      {active && (
        <div
          className="absolute -top-6 -right-6 w-14 h-14 rounded-full blur-2xl opacity-40 pointer-events-none"
          style={{ background: color }}
        />
      )}
      <div className="relative flex items-center gap-1.5 text-muted-foreground" style={active ? { color } : undefined}>
        {icon}
        <span className="text-xs font-semibold tracking-wide uppercase">{label}</span>
      </div>
      <p className="relative text-sm font-bold text-foreground tabular-nums leading-tight break-words">
        {formatCurrency(value)}
      </p>
      {/* mini barra com % do total */}
      <div className="relative h-0.5 bg-foreground/5 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-[colors,transform,opacity] duration-500"
          style={{
            width: `${pct}%`,
            background: active ? color : "transparent",
            boxShadow: active ? `0 0 8px ${color}99` : undefined,
          }}
        />
      </div>
      <p className="relative text-xs text-muted-foreground tabular-nums">{pct}% do total</p>
    </div>
  );
}

function PayEditRow({ icon, label, value, onChange }: { icon: React.ReactNode; label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="relative h-11 rounded-lg bg-background border border-border focus-within:border-primary/60 transition-colors flex items-center">
      <span className="absolute left-3">{icon}</span>
      <span className="absolute left-10 text-xs font-medium text-muted-foreground">{label}</span>
      <span className="absolute right-[68px] text-xs text-muted-foreground">R$</span>
      <input
        type="number"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="0"
        className="w-full h-full bg-transparent text-right text-sm font-bold text-foreground pr-3 pl-28 focus-visible:outline-none rounded-lg placeholder:text-muted-foreground"
      />
    </div>
  );
}

function MiniStat({ label, value, highlight, danger }: { label: string; value: string; highlight?: boolean; danger?: boolean }) {
  return (
    <div
      className={`rounded-xl border p-3 ${
        danger
          ? "bg-destructive/10 border-destructive/30"
          : highlight
          ? "bg-primary/10 border-primary/25"
          : "bg-card border-border"
      }`}
    >
      <p className={`text-xs font-medium ${danger ? "text-destructive" : highlight ? "text-primary" : "text-muted-foreground"}`}>
        {label}
      </p>
      <p className="text-base font-bold text-foreground tabular-nums mt-0.5">{value}</p>
    </div>
  );
}
