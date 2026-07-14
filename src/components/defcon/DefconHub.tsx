import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { getBrazilDate, formatBrazilDate } from "@/shared/lib/date-utils";
import { formatCurrency } from "@/shared/lib/utils";
import { MoneyInput } from "@/shared/ui/money-input";
import { Zap, FileDown, Pencil, Plus, Banknote, CreditCard, Smartphone, TrendingDown, Coins, Sparkles, History, Loader2, Trash2, ChevronDown } from "lucide-react";
import { useToast } from "@/shared/hooks/use-toast";
import { generateDefconDayPDF } from "@/utils/generateDefconDayPDF";
import { syncBlocksToDailySales } from "@/utils/syncDailySales";
import { Check, X } from "lucide-react";
import { DefconLoadoutManager } from "@/components/defcon/DefconLoadoutManager";
import { CompetitionStatementUpload } from "@/components/defcon/CompetitionStatementUpload";
import { WeeklyChallengeIcon } from "@/components/competitions/WeeklyChallenge";
import HourlyBreakdown from "@/components/history/HourlyBreakdown";
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
  const [totals, setTotals] = useState<DayTotals>({ cash: 0, card: 0, pix: 0, debt: 0, profit: 0, cost: 0, tips: 0, transport: 0, food: 0 });
  const [hasSession, setHasSession] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [pdfDate, setPdfDate] = useState(getBrazilDate()); // dia do PDF (padrão: hoje)
  const [quickCost, setQuickCost] = useState("");
  const [quickCostCat, setQuickCostCat] = useState<"mercadoria" | "transporte" | "alimentacao">("mercadoria");
  const [showEdit, setShowEdit] = useState(false);
  // Edição manual de "Como você recebeu" (dinheiro/cartão/pix) — p/ corrigir e lançar pagamentos tardios (ex.: Pix do outro dia)
  const [editingPay, setEditingPay] = useState(false);
  const [payCash, setPayCash] = useState("");
  const [payCard, setPayCard] = useState("");
  const [payPix, setPayPix] = useState("");
  const [savingPay, setSavingPay] = useState(false);
  const today = getBrazilDate();

  useEffect(() => {
    if (!loading && !user) navigate("/auth");
  }, [user, loading, navigate]);

  const loadAll = async () => {
    if (!user) return;
    const [{ data: plan }, { data: sales }, { data: session }] = await Promise.all([
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
        .select("status")
        .eq("user_id", user.id)
        .eq("date", today)
        .maybeSingle(),
    ]);

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
      }
    } else {
      setDailyGoal(Number(plan.daily_goal));
      setPlanId(plan.id);
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
    setHasSession(!!session);
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

  if (loading || !user) return null;

  return (
    <div className="space-y-4 pb-8 max-w-2xl mx-auto px-1">
      {/* HEADER discreto */}
      <div className="pt-1 pb-1">
        <p className="text-xs text-destructive/80 tracking-[0.25em] uppercase">⚡ Modo desafio</p>
        <h1 className="text-2xl font-bold text-foreground tracking-tight mt-0.5">DEFCON 4</h1>
      </div>

      {/* BLOCO UNIFICADO — Meta + Botão */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-card via-card to-background border border-border p-5 space-y-5 shadow-[0_8px_30px_-12px_hsl(var(--primary)/0.25)]">
        {/* glow sutil */}
        <div className="absolute -top-20 -right-20 w-56 h-56 bg-primary/10 blur-3xl rounded-full pointer-events-none" />

        <div className="relative flex items-start justify-between">
          <div>
            <p className="text-xs text-muted-foreground tracking-wider uppercase mb-1">Meta do dia</p>
            <p className="text-3xl font-bold text-foreground tracking-tight tabular-nums">
              {formatCurrency(dailyGoal)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {goalReached ? (
                <span className="text-success">🎉 Meta batida!</span>
              ) : (
                <>Vendido <span className="text-foreground font-medium">{formatCurrency(totalVendido)}</span> · falta <span className="text-primary">{formatCurrency(falta)}</span></>
              )}
            </p>
          </div>
          <button
            onClick={() => setShowEdit(true)}
            className="w-8 h-8 rounded-lg bg-foreground/5 hover:bg-foreground/10 border border-border flex items-center justify-center text-muted-foreground active:scale-95 transition"
            aria-label="Editar meta"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Progress fino */}
        <div className="relative h-1.5 bg-foreground/5 rounded-full overflow-hidden">
          <div
            className={`h-full transition-[colors,transform,opacity] duration-700 rounded-full ${
              goalReached
                ? "bg-gradient-to-r from-success to-success/80 shadow-[0_0_12px_hsl(var(--success)/0.6)]"
                : "bg-gradient-to-r from-primary to-primary shadow-[0_0_12px_hsl(var(--primary)/0.5)]"
            }`}
            style={{ width: `${progresso}%` }}
          />
        </div>

        {/* CTA — botão grande mas refinado */}
        <button
          onClick={() => navigate("/defcon")}
          data-tour="defcon-banner"
          className="relative w-full h-14 rounded-xl bg-gradient-to-r from-destructive to-destructive/85 text-destructive-foreground font-bold text-base tracking-wide flex items-center justify-center gap-2.5 active:scale-[0.98] transition-transform shadow-[0_8px_24px_-6px_hsl(var(--destructive)/0.55)] overflow-hidden group"
        >
          <span className="absolute inset-0 bg-foreground/10 opacity-0 group-active:opacity-100 transition" />
          <Zap className="w-5 h-5 fill-white" />
          {hasSession ? "Continuar DEFCON 4" : "Iniciar DEFCON 4"}
        </button>

        {/* Extrato do dia (só pra quem está em competição/X1) — bem separado do botão. */}
        <div className="mt-6">
          <CompetitionStatementUpload userId={user.id} />
        </div>
      </div>

      {/* DESAFIO DA SEMANA — ícone dourado que reabre o bilhete (semana toda) */}
      <WeeklyChallengeIcon />

      {/* LOADOUT */}
      <DefconLoadoutManager userId={user.id} />

      {/* RESUMO POR PAGAMENTO — visual rico */}
      {totalVendido > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-foreground">Como você recebeu</h3>
              {!editingPay && (
                <button
                  onClick={openPayEditor}
                  className="w-6 h-6 rounded-md bg-foreground/5 hover:bg-foreground/10 border border-border flex items-center justify-center text-muted-foreground active:scale-95 transition"
                  aria-label="Editar recebimentos"
                >
                  <Pencil className="w-3 h-3" />
                </button>
              )}
            </div>
            <span className="text-xs text-muted-foreground tabular-nums">
              Total <span className="text-primary font-bold">{formatCurrency(totalVendido)}</span>
            </span>
          </div>

          {editingPay ? (
            <div className="rounded-xl bg-card border border-primary/30 p-3 space-y-2.5">
              <p className="text-xs text-muted-foreground">
                Ajuste o que entrou em cada forma. O que faltar pro total vira <span className="text-destructive">não recebido</span>.
              </p>
              <PayEditRow icon={<Banknote className="w-4 h-4 text-success" />} label="Dinheiro" value={payCash} onChange={setPayCash} />
              <PayEditRow icon={<CreditCard className="w-4 h-4" style={{ color: readThemeColor("--violet-soft") }} />} label="Cartão" value={payCard} onChange={setPayCard} />
              <PayEditRow icon={<Smartphone className="w-4 h-4" style={{ color: BRAND_COLORS.PIX }} />} label="Pix" value={payPix} onChange={setPayPix} />
              <div className="flex items-center justify-between pt-1">
                <span className="text-xs text-muted-foreground tabular-nums">
                  Somado <span className="text-foreground font-semibold">{formatCurrency((parseFloat(payCash) || 0) + (parseFloat(payCard) || 0) + (parseFloat(payPix) || 0))}</span> / {formatCurrency(totalVendido)}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setEditingPay(false)}
                    disabled={savingPay}
                    className="h-9 px-3 rounded-lg bg-muted text-foreground text-xs font-semibold flex items-center gap-1 active:scale-95 disabled:opacity-50"
                  >
                    <X className="w-3.5 h-3.5" /> Cancelar
                  </button>
                  <button
                    onClick={savePayEdit}
                    disabled={savingPay}
                    className="h-9 px-3 rounded-lg bg-primary text-primary-foreground text-xs font-bold flex items-center gap-1 active:scale-95 disabled:opacity-50"
                  >
                    <Check className="w-3.5 h-3.5" /> {savingPay ? "Salvando..." : "Salvar"}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              <PayCard icon={<Banknote className="w-4 h-4" />} label="Dinheiro" value={totals.cash} total={totalVendido} color={readThemeColor("--success")} />
              <PayCard icon={<CreditCard className="w-4 h-4" />} label="Cartão" value={totals.card} total={totalVendido} color={readThemeColor("--violet-soft")} />
              <PayCard icon={<Smartphone className="w-4 h-4" />} label="Pix" value={totals.pix} total={totalVendido} color={BRAND_COLORS.PIX} />
            </div>
          )}

          {/* Gorjeta — destaque dourado quando > 0 */}
          {totals.tips > 0 && (
            <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-primary/15 via-primary/8 to-transparent border border-primary/30 px-4 py-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-primary/20 flex items-center justify-center shrink-0">
                <Coins className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-xs uppercase tracking-wider text-primary font-semibold">Gorjetas</p>
                  <Sparkles className="w-3 h-3 text-primary" />
                </div>
                <p className="text-xs text-muted-foreground">Já incluso no dinheiro recebido</p>
              </div>
              <p className="text-lg font-bold text-primary tabular-nums">+{formatCurrency(totals.tips)}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <MiniStat label="Lucro" value={formatCurrency(totals.profit)} highlight />
            {totals.debt > 0 && <MiniStat label="Calotes" value={formatCurrency(totals.debt)} danger />}
            {(totals.cost + totals.transport + totals.food) > 0 && <MiniStat label="Custos" value={formatCurrency(totals.cost + totals.transport + totals.food)} />}
          </div>
        </div>
      )}

      {/* VENDAS POR HORA */}
      {planId && totalVendido > 0 && (
        <div className="rounded-2xl bg-card border border-border p-4">
          <HourlyBreakdown userId={user.id} date={today} />
        </div>
      )}

      {/* CUSTO RÁPIDO — responsivo */}
      <div className="rounded-2xl bg-card border border-border p-4 space-y-3">
        <div className="flex items-center gap-2">
          <TrendingDown className="w-4 h-4 text-destructive" />
          <h3 className="text-sm font-semibold text-foreground">Custo rápido</h3>
        </div>
        <p className="text-xs text-muted-foreground -mt-1">
          Escolha o tipo, digite o valor. Entra no relatório e abate do líquido.
        </p>
        <div className="space-y-2">
          <div className="grid grid-cols-3 gap-2">
            {([
              { id: "mercadoria", label: "Mercadoria", emoji: "📦" },
              { id: "transporte", label: "Transporte", emoji: "🚌" },
              { id: "alimentacao", label: "Almoço", emoji: "🍽️" },
            ] as const).map((c) => {
              const active = quickCostCat === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setQuickCostCat(c.id)}
                  className={`flex flex-col items-center justify-center gap-0.5 h-14 rounded-xl border text-xs font-medium transition active:scale-95 ${
                    active
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border/60 bg-background text-muted-foreground hover:bg-muted/40"
                  }`}
                >
                  <span className="text-base leading-none">{c.emoji}</span>
                  <span>{c.label}</span>
                </button>
              );
            })}
          </div>
          <div className="flex gap-2">
            <MoneyInput
              value={parseFloat(quickCost) || 0}
              onChange={(n) => setQuickCost(n ? String(n) : "")}
              placeholder="R$ 0,00"
              className="flex-1 min-w-0 h-11 bg-background border border-border rounded-xl px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary placeholder:text-muted-foreground"
            />
            <button
              onClick={handleAddCost}
              disabled={!quickCost || parseFloat(quickCost) <= 0}
              className="shrink-0 h-11 px-4 rounded-xl bg-primary text-primary-foreground font-bold text-sm flex items-center gap-1.5 disabled:opacity-40 active:scale-95"
            >
              <Plus className="w-4 h-4" />
              Adicionar
            </button>
          </div>
        </div>
        <CustoRapidoHistory onChanged={loadAll} />
      </div>

      {/* Pix que caiu depois — lançar num dia anterior */}
      <LatePixSection />

      {/* PDF do dia — escolha qual dia baixar */}
      <div className="flex gap-2">
        <input
          type="date"
          value={pdfDate}
          max={getBrazilDate()}
          onChange={(e) => setPdfDate(e.target.value)}
          className="h-12 w-36 shrink-0 bg-card border border-border rounded-xl px-3 text-sm text-foreground"
        />
        <button
          onClick={handlePDF}
          disabled={exporting}
          className="flex-1 h-12 rounded-xl bg-card border border-primary/30 hover:border-primary/60 text-primary text-sm font-semibold flex items-center justify-center gap-2 active:scale-[0.98] transition disabled:opacity-50"
        >
          <FileDown className="w-4 h-4" />
          {exporting ? "Gerando..." : pdfDate === getBrazilDate() ? "Baixar PDF do dia" : "Baixar PDF do dia escolhido"}
        </button>
      </div>

      <p className="text-center text-xs text-muted-foreground">
        Os relatórios completos e filtros do DEFCON 4 estão na aba <span className="text-primary">Relatório</span>.
      </p>

      {user && (
        <EditPlanningModal
          userId={user.id}
          isOpen={showEdit}
          onClose={() => { setShowEdit(false); loadAll(); }}
        />
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
      <p className="relative text-base font-bold text-foreground tabular-nums truncate leading-tight">
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
