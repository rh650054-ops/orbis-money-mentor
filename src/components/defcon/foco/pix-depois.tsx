/* "Pix que caiu depois" — pagamento que entrou tarde, lançado num dia anterior
   (padrão: ontem). Atualiza o daily_sales daquele dia (total_profit + pix_sales + abate
   do total_debt) e guarda cada lançamento em late_pix_entries (histórico + desfazer).
   Movido do DefconHub no redesign do Foco (18/10/2026). Só aparece sem banco de trabalho. */
import { useEffect, useState } from "react";
import { History, Loader2, Plus, Smartphone, X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { avisar } from "@/shared/lib/avisar";
import { formatBrazilDate } from "@/shared/lib/date-utils";
import { formatCurrency } from "@/shared/lib/utils";
import { MoneyInput } from "@/shared/ui/money-input";
import { useToast } from "@/shared/hooks/use-toast";
import { BRAND_COLORS } from "@/shared/lib/theme-colors";

interface LatePixEntry {
  id: string;
  amount: number;
  sale_date: string;
  created_at: string;
}

export function PixDepois() {
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
            total_debt: Math.max(0, (Number(existing.total_debt) || 0) - value),
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
      avisar.erro("Foco: lançar Pix atrasado", e);
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
        const { error: updErr } = await supabase
          .from("daily_sales")
          .update({
            total_profit: Math.max(0, (Number(ds.total_profit) || 0) - Number(entry.amount)),
            pix_sales: Math.max(0, (Number(ds.pix_sales) || 0) - Number(entry.amount)),
            // Desfazer: o valor volta a "faltar cair".
            total_debt: (Number(ds.total_debt) || 0) + Number(entry.amount),
          })
          .eq("id", ds.id);
        if (updErr) throw updErr;
      }
      const { error: delErr } = await supabase.from("late_pix_entries").delete().eq("id", entry.id);
      if (delErr) throw delErr;
      setHistory((prev) => prev.filter((e) => e.id !== entry.id));
      toast({
        title: "Lançamento removido",
        description: `${formatCurrency(Number(entry.amount))} descontado de ${prettyDate(entry.sale_date)}`,
      });
    } catch (e) {
      avisar.erro("Foco: remover Pix atrasado", e);
      toast({ title: "Erro ao remover", variant: "destructive" });
    } finally {
      setDeletingId(null);
    }
  };

  // O que já foi lançado PRO DIA selecionado (pra não lançar de novo sem querer).
  const entriesForDate = history.filter((e) => e.sale_date === date);
  const totalForDate = entriesForDate.reduce((s, e) => s + Number(e.amount || 0), 0);

  return (
    <div className="space-y-3">
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
