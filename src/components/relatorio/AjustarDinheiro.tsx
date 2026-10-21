import { useState } from "react";
import { Check, Loader2, PencilLine, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/shared/hooks/use-toast";
import { formatCurrency } from "@/shared/lib/utils";
import { MoneyInput } from "@/shared/ui/money-input";
import { syncLeaderboardRevenue } from "@/utils/syncDailySales";

/**
 * Cash ("Dinheiro") of one day, editable in place (Mohamed 21/10). The bank never sees
 * cash, so even with Open Finance the seller must be able to fix it. Pix/card stay as
 * they are (the bank owns them). "Vendeu" is kept: total_debt = vendeu − what fell.
 * After saving, the bank reconciliation runs again so Pix/calote stay coherent, and
 * the ranking revenue is re-synced.
 */
export function AjustarDinheiro({ userId, date, valor, onSaved }: { userId: string; date: string; valor: number; onSaved: () => void }) {
  const { toast } = useToast();
  const [editando, setEditando] = useState(false);
  const [novo, setNovo] = useState(valor);
  const [salvando, setSalvando] = useState(false);

  const salvar = async () => {
    setSalvando(true);
    try {
      const { data: row, error: selErr } = await supabase
        .from("daily_sales")
        .select("id, cash_sales, pix_sales, card_sales, total_debt")
        .eq("user_id", userId)
        .eq("date", date)
        .maybeSingle();
      if (selErr) throw selErr;
      if (!row) throw new Error("sem dia");
      const r = row as { id: string; cash_sales: number | null; pix_sales: number | null; card_sales: number | null; total_debt: number | null };
      const pix = Number(r.pix_sales) || 0;
      const card = Number(r.card_sales) || 0;
      const vendeu = (Number(r.cash_sales) || 0) + pix + card + Math.max(0, Number(r.total_debt) || 0);
      const caiu = Math.round((novo + pix + card) * 100) / 100;
      const debt = Math.max(0, Math.round((vendeu - caiu) * 100) / 100);
      const { error } = await supabase
        .from("daily_sales")
        .update({ cash_sales: novo, total_profit: caiu, total_debt: debt, unpaid_sales: debt > 0 ? 1 : 0, updated_at: new Date().toISOString() } as never)
        .eq("id", r.id);
      if (error) throw error;
      try { await (supabase as any).rpc("banco_reconciliar_me"); } catch { /* no bank: nothing to do */ }
      await syncLeaderboardRevenue(userId);
      toast({ title: "Dinheiro ajustado ✓", description: formatCurrency(novo) });
      setEditando(false);
      onSaved();
    } catch {
      toast({ title: "Não consegui salvar", description: "Tente de novo.", variant: "destructive" });
    } finally {
      setSalvando(false);
    }
  };

  if (!editando) {
    return (
      <button type="button" onClick={() => { setNovo(valor); setEditando(true); }}
        className="orbis-press w-full rounded-lg border border-primary/40 bg-primary/10 px-2 py-1.5 text-left">
        <p className="flex items-center justify-between text-[10px] text-muted-foreground">💵 Dinheiro <PencilLine className="h-3 w-3 text-primary" /></p>
        <p className="text-[13px] font-semibold tabular-nums">{formatCurrency(valor)}</p>
        <p className="text-[9.5px] font-bold text-primary">toque p/ ajustar</p>
      </button>
    );
  }
  return (
    <div className="col-span-3 flex items-center gap-1.5 rounded-lg border border-primary/50 bg-primary/10 p-1.5">
      <span className="shrink-0 pl-1 text-[11px] font-semibold">💵 Dinheiro</span>
      <MoneyInput value={novo} onChange={setNovo} autoFocus className="h-9 min-w-0 flex-1 text-[14px]" />
      <button type="button" onClick={() => setEditando(false)} disabled={salvando} aria-label="Cancelar" className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-muted-foreground">
        <X className="h-4 w-4" />
      </button>
      <button type="button" onClick={() => void salvar()} disabled={salvando} aria-label="Salvar dinheiro" className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground">
        {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
      </button>
    </div>
  );
}
