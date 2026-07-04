import { useState, useEffect } from "react";
import { Wallet, X, Loader2, Trash2, ChevronDown, Pencil } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { MoneyInput } from "@/shared/ui/money-input";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/shared/ui/dialog";
import { ScrollArea } from "@/shared/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/shared/hooks/use-toast";
import { formatCurrency, cn } from "@/shared/lib/utils";
import { getBrazilDate } from "@/shared/lib/date-utils";

const QUICK_CATEGORIES = [
  { key: "almoco", label: "Almoço", icon: "🍽️", category: "Alimentação" },
  { key: "transporte", label: "Transporte", icon: "🚗", category: "Transporte" },
  { key: "lanche", label: "Lanche", icon: "☕", category: "Alimentação" },
  { key: "mercadoria", label: "Mercadoria", icon: "📦", category: "Mercadoria" },
  { key: "combustivel", label: "Combustível", icon: "⛽", category: "Transporte" },
  { key: "outro", label: "Outro", icon: "➕", category: "Outros" },
];

interface DayExpense {
  id: string;
  name: string;
  amount: number;
  icon: string | null;
  category: string;
}

interface HistoryExpense extends DayExpense {
  date: string;
  notes: string | null;
}

// YYYY-MM-DD -> DD/MM
const prettyDate = (iso: string) => {
  const parts = (iso || "").split("-");
  return parts.length === 3 ? `${parts[2]}/${parts[1]}` : iso;
};

interface QuickExpenseButtonProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideFab?: boolean;
  initialCategoryKey?: string;
}

export default function QuickExpenseButton({
  open: controlledOpen,
  onOpenChange,
  hideFab = false,
  initialCategoryKey,
}: QuickExpenseButtonProps = {}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const isOpen = isControlled ? controlledOpen : internalOpen;
  const setIsOpen = (o: boolean) => {
    if (!isControlled) setInternalOpen(o);
    onOpenChange?.(o);
  };
  const [selected, setSelected] = useState<typeof QUICK_CATEGORIES[number] | null>(null);
  const [amount, setAmount] = useState("");
  const [customName, setCustomName] = useState("");
  const [saving, setSaving] = useState(false);
  const [todayExpenses, setTodayExpenses] = useState<DayExpense[]>([]);
  const [loading, setLoading] = useState(false);
  // Histórico do ano — editar/remover custos antigos mal lançados
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<HistoryExpense[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Data de Brasília (não UTC) — senão um custo lançado de noite "vaza" pro dia seguinte.
  const today = getBrazilDate();

  const fetchTodayExpenses = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("personal_expenses")
      .select("id, name, amount, icon, category")
      .eq("user_id", user.id)
      .eq("date", today)
      .order("created_at", { ascending: false });
    setTodayExpenses((data as DayExpense[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    if (isOpen) {
      fetchTodayExpenses();
      if (initialCategoryKey) {
        const pre = QUICK_CATEGORIES.find((c) => c.key === initialCategoryKey);
        if (pre) setSelected(pre);
      }
    }
  }, [isOpen, user, initialCategoryKey]);

  const totalToday = todayExpenses.reduce((s, e) => s + Number(e.amount || 0), 0);

  const reset = () => {
    setSelected(null);
    setAmount("");
    setCustomName("");
  };

  const handleSave = async () => {
    if (!user || !selected) return;
    const value = parseFloat(amount.replace(",", "."));
    if (!value || value <= 0) {
      toast({ title: "Valor inválido", variant: "destructive" });
      return;
    }
    const name = selected.key === "outro"
      ? (customName.trim() || "Outro custo")
      : selected.label;

    setSaving(true);
    const { error } = await supabase.from("personal_expenses").insert({
      user_id: user.id,
      name: name.slice(0, 80),
      category: selected.category,
      icon: selected.icon,
      amount: value,
      type: "variable",
      date: today,
    });
    setSaving(false);

    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: `${selected.icon} ${name}`, description: `${formatCurrency(value)} registrado` });
    reset();
    fetchTodayExpenses();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("personal_expenses").delete().eq("id", id);
    if (!error) {
      setTodayExpenses((prev) => prev.filter((e) => e.id !== id));
      setHistory((prev) => prev.filter((e) => e.id !== id));
    }
  };

  // Últimos custos do ano (todos os dias) — pra corrigir lançamentos antigos.
  const fetchHistory = async () => {
    if (!user) return;
    setLoadingHistory(true);
    const yearStart = `${today.slice(0, 4)}-01-01`;
    const { data } = await supabase
      .from("personal_expenses")
      .select("id, name, amount, icon, category, date, notes")
      .eq("user_id", user.id)
      .gte("date", yearStart)
      .order("date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(200);
    setHistory((data as HistoryExpense[]) || []);
    setLoadingHistory(false);
  };

  const toggleHistory = () => {
    const next = !showHistory;
    setShowHistory(next);
    if (next) fetchHistory();
  };

  const startEdit = (e: HistoryExpense) => {
    setEditingId(e.id);
    setEditName(e.name);
    setEditAmount(String(e.amount));
    setEditNotes(e.notes || "");
  };

  const saveEdit = async (e: HistoryExpense) => {
    const value = parseFloat(editAmount.replace(",", "."));
    if (!value || value <= 0) {
      toast({ title: "Valor inválido", variant: "destructive" });
      return;
    }
    setSavingEdit(true);
    const { error } = await supabase
      .from("personal_expenses")
      .update({
        name: (editName.trim() || e.name).slice(0, 80),
        amount: value,
        notes: editNotes.trim() || null,
      })
      .eq("id", e.id);
    setSavingEdit(false);
    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
      return;
    }
    setEditingId(null);
    toast({ title: "Custo atualizado", description: formatCurrency(value) });
    fetchHistory();
    fetchTodayExpenses();
  };

  const deleteFromHistory = async (id: string) => {
    if (!window.confirm("Remover este custo? O relatório será recalculado.")) return;
    setDeletingId(id);
    const { error } = await supabase.from("personal_expenses").delete().eq("id", id);
    setDeletingId(null);
    if (error) {
      toast({ title: "Erro ao remover", description: error.message, variant: "destructive" });
      return;
    }
    setHistory((prev) => prev.filter((e) => e.id !== id));
    setTodayExpenses((prev) => prev.filter((e) => e.id !== id));
    toast({ title: "Custo removido" });
  };

  return (
    <>
      {/* Floating Button - posicionado acima do botão de chat */}
      {!hideFab && (
        <Button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-44 right-4 md:bottom-28 md:right-8 h-12 w-12 rounded-full shadow-lg bg-card border-2 border-primary/40 hover:border-primary text-primary hover:bg-primary/10 transition-[colors,transform,opacity] z-40"
          size="icon"
          aria-label="Registrar custo do dia"
        >
          <Wallet className="h-5 w-5" />
        </Button>
      )}

      <Dialog open={isOpen} onOpenChange={(o) => { setIsOpen(o); if (!o) reset(); }}>
        <DialogContent className="max-w-md p-0 gap-0 bg-card border-border/60">
          <DialogTitle className="sr-only">Custos de hoje</DialogTitle>
          <DialogDescription className="sr-only">
            Registre seus gastos do dia para contabilizar no relatório.
          </DialogDescription>
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-border/60">
            <div>
              <h2 className="text-lg font-bold">Custos de hoje</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Total: <span className="text-primary font-bold">{formatCurrency(totalToday)}</span>
              </p>
            </div>
          </div>

          <div className="p-5 space-y-5">
            {!selected ? (
              <>
                {/* Quick categories grid */}
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-3">
                    Registrar gasto
                  </p>
                  <div className="grid grid-cols-3 gap-2.5">
                    {QUICK_CATEGORIES.map((cat) => (
                      <button
                        key={cat.key}
                        onClick={() => setSelected(cat)}
                        className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl border border-border/60 bg-background hover:border-primary hover:bg-primary/5 transition-[colors,transform,opacity]"
                      >
                        <span className="text-2xl">{cat.icon}</span>
                        <span className="text-xs font-medium">{cat.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Today's expenses list */}
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-2">
                    Lançamentos de hoje
                  </p>
                  {loading ? (
                    <div className="flex justify-center py-6">
                      <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : todayExpenses.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-6">
                      Nenhum custo registrado hoje.
                    </p>
                  ) : (
                    <ScrollArea className="max-h-48">
                      <div className="space-y-1.5">
                        {todayExpenses.map((e) => (
                          <div
                            key={e.id}
                            className="flex items-center gap-3 px-3 py-2 rounded-lg bg-background border border-border/40"
                          >
                            <span className="text-lg">{e.icon || "💰"}</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{e.name}</p>
                              <p className="text-xs text-muted-foreground">{e.category}</p>
                            </div>
                            <span className="text-sm font-bold text-primary">
                              {formatCurrency(Number(e.amount))}
                            </span>
                            <button
                              onClick={() => handleDelete(e.id)}
                              className="p-1 rounded text-muted-foreground hover:text-destructive transition-colors"
                              aria-label="Remover"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                </div>

                {/* Histórico do ano — corrigir/remover custos antigos */}
                <div>
                  <button
                    onClick={toggleHistory}
                    className="w-full flex items-center justify-between text-xs uppercase tracking-wider text-muted-foreground font-semibold py-1 hover:text-foreground transition-colors"
                  >
                    <span>Histórico do ano</span>
                    <ChevronDown className={cn("w-4 h-4 transition-transform", showHistory && "rotate-180")} />
                  </button>
                  {showHistory && (
                    loadingHistory ? (
                      <div className="flex justify-center py-6">
                        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                      </div>
                    ) : history.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-6">
                        Nenhum custo no histórico.
                      </p>
                    ) : (
                      <ScrollArea className="max-h-64 mt-1">
                        <div className="space-y-1.5">
                          {history.map((e) => (
                            <div
                              key={e.id}
                              className="px-3 py-2 rounded-lg bg-background border border-border/40"
                            >
                              {editingId === e.id ? (
                                <div className="space-y-2">
                                  <Input
                                    value={editName}
                                    onChange={(ev) => setEditName(ev.target.value.slice(0, 80))}
                                    placeholder="Descrição"
                                    className="h-9 text-sm"
                                  />
                                  <MoneyInput
                                    value={parseFloat(editAmount) || 0}
                                    onChange={(n) => setEditAmount(n ? String(n) : "")}
                                    className="h-10 text-base font-bold"
                                  />
                                  <Input
                                    value={editNotes}
                                    onChange={(ev) => setEditNotes(ev.target.value.slice(0, 200))}
                                    placeholder="Anotação (opcional)"
                                    className="h-9 text-sm"
                                  />
                                  <div className="flex gap-2">
                                    <Button
                                      onClick={() => saveEdit(e)}
                                      disabled={savingEdit}
                                      className="flex-1 h-9 text-sm"
                                    >
                                      {savingEdit ? <Loader2 className="w-4 h-4 animate-spin" /> : "Salvar"}
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      onClick={() => setEditingId(null)}
                                      className="h-9 text-sm"
                                    >
                                      Cancelar
                                    </Button>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex items-center gap-3">
                                  <span className="text-lg">{e.icon || "💰"}</span>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate">{e.name}</p>
                                    <p className="text-[11px] text-muted-foreground truncate">
                                      {prettyDate(e.date)} · {e.category}
                                      {e.notes ? ` · ${e.notes}` : ""}
                                    </p>
                                  </div>
                                  <span className="text-sm font-bold text-primary">
                                    {formatCurrency(Number(e.amount))}
                                  </span>
                                  <button
                                    onClick={() => startEdit(e)}
                                    className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors"
                                    aria-label="Editar"
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    onClick={() => deleteFromHistory(e.id)}
                                    disabled={deletingId === e.id}
                                    className="p-1 rounded text-muted-foreground hover:text-destructive transition-colors"
                                    aria-label="Remover"
                                  >
                                    {deletingId === e.id ? (
                                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                      <Trash2 className="h-3.5 w-3.5" />
                                    )}
                                  </button>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    )
                  )}
                </div>
              </>
            ) : (
              /* Input value step */
              <div className="space-y-4">
                <button
                  onClick={reset}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  ← voltar
                </button>
                <div className="flex items-center gap-3 p-4 rounded-xl bg-primary/10 border border-primary/30">
                  <span className="text-3xl">{selected.icon}</span>
                  <div>
                    <p className="text-sm font-semibold">{selected.label}</p>
                    <p className="text-xs text-muted-foreground">{selected.category}</p>
                  </div>
                </div>

                {selected.key === "outro" && (
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1.5">Descrição</label>
                    <Input
                      value={customName}
                      onChange={(e) => setCustomName(e.target.value.slice(0, 80))}
                      placeholder="Ex: estacionamento"
                      maxLength={80}
                    />
                  </div>
                )}

                <div>
                  <label className="text-xs text-muted-foreground block mb-1.5">Valor (R$)</label>
                  <MoneyInput
                    value={parseFloat(amount) || 0}
                    onChange={(n) => setAmount(n ? String(n) : "")}
                    autoFocus
                    className="text-2xl font-bold h-14"
                  />
                </div>

                <Button
                  onClick={handleSave}
                  disabled={saving || !amount}
                  className={cn(
                    "w-full h-12 text-base font-bold bg-gradient-to-r from-primary to-[hsl(45_100%_38%)]",
                    "hover:opacity-90 text-primary-foreground"
                  )}
                >
                  {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : "Registrar"}
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
