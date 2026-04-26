import { useState, useEffect } from "react";
import { Wallet, X, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, cn } from "@/lib/utils";

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

export default function QuickExpenseButton() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [selected, setSelected] = useState<typeof QUICK_CATEGORIES[number] | null>(null);
  const [amount, setAmount] = useState("");
  const [customName, setCustomName] = useState("");
  const [saving, setSaving] = useState(false);
  const [todayExpenses, setTodayExpenses] = useState<DayExpense[]>([]);
  const [loading, setLoading] = useState(false);

  const today = new Date().toISOString().split("T")[0];

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
    if (isOpen) fetchTodayExpenses();
  }, [isOpen, user]);

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
    }
  };

  return (
    <>
      {/* Floating Button - posicionado acima do botão de chat */}
      <Button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-44 right-4 md:bottom-28 md:right-8 h-12 w-12 rounded-full shadow-lg bg-card border-2 border-primary/40 hover:border-primary text-primary hover:bg-primary/10 transition-all z-40"
        size="icon"
        aria-label="Registrar custo do dia"
      >
        <Wallet className="h-5 w-5" />
      </Button>

      <Dialog open={isOpen} onOpenChange={(o) => { setIsOpen(o); if (!o) reset(); }}>
        <DialogContent className="max-w-md p-0 gap-0 bg-card border-border/60">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-border/60">
            <div>
              <h2 className="text-lg font-bold">Custos de hoje</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Total: <span className="text-primary font-bold">{formatCurrency(totalToday)}</span>
              </p>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="p-5 space-y-5">
            {!selected ? (
              <>
                {/* Quick categories grid */}
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-3">
                    Registrar gasto
                  </p>
                  <div className="grid grid-cols-3 gap-2.5">
                    {QUICK_CATEGORIES.map((cat) => (
                      <button
                        key={cat.key}
                        onClick={() => setSelected(cat)}
                        className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl border border-border/60 bg-background hover:border-primary hover:bg-primary/5 transition-all"
                      >
                        <span className="text-2xl">{cat.icon}</span>
                        <span className="text-xs font-medium">{cat.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Today's expenses list */}
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">
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
                              <p className="text-[10px] text-muted-foreground">{e.category}</p>
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
                    <p className="text-[11px] text-muted-foreground">{selected.category}</p>
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
                  <Input
                    type="text"
                    inputMode="decimal"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, ""))}
                    placeholder="0,00"
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
