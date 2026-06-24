import { useState } from "react";
import DefconHub from "@/components/defcon/DefconHub";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { formatBrazilDate } from "@/shared/lib/date-utils";
import { formatCurrency } from "@/shared/lib/utils";
import { useToast } from "@/shared/hooks/use-toast";
import { Smartphone, Plus } from "lucide-react";
import { BRAND_COLORS } from "@/shared/lib/theme-colors";

// "Pix que caiu depois" — pagamento que entrou tarde e precisa ser lançado num
// dia anterior (padrão: ontem). Atualiza o daily_sales daquele dia (total_profit
// + pix_sales) pra entrar nos relatórios e finanças.
function LatePixSection() {
  const { user } = useAuth();
  const { toast } = useToast();
  const yesterday = formatBrazilDate(new Date(Date.now() - 86400000));
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(yesterday);
  const [saving, setSaving] = useState(false);

  // DD/MM a partir do yyyy-MM-dd (sem mexer no fuso pra não pular um dia).
  const prettyDate = (iso: string) => {
    const [, m, d] = iso.split("-");
    return d && m ? `${d}/${m}` : iso;
  };

  const handleSubmit = async () => {
    if (!user) return;
    const value = parseFloat(amount) || 0;
    if (value <= 0 || !date) return;
    setSaving(true);
    try {
      const { data: existing, error: selErr } = await supabase
        .from("daily_sales")
        .select("id, total_profit, pix_sales")
        .eq("user_id", user.id)
        .eq("date", date)
        .maybeSingle();
      if (selErr) throw selErr;

      if (existing) {
        const { error: updErr } = await supabase
          .from("daily_sales")
          .update({
            total_profit: (Number(existing.total_profit) || 0) + value,
            pix_sales: (Number(existing.pix_sales) || 0) + value,
          })
          .eq("id", existing.id);
        if (updErr) throw updErr;
      } else {
        const { error: insErr } = await supabase
          .from("daily_sales")
          .insert({
            user_id: user.id,
            date,
            total_profit: value,
            pix_sales: value,
          });
        if (insErr) throw insErr;
      }

      toast({
        title: "Pix lançado",
        description: `Pix de ${formatCurrency(value)} lançado em ${prettyDate(date)}`,
      });
      setAmount("");
    } catch (e) {
      toast({ title: "Erro ao lançar o Pix", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-1 mb-4">
      <div className="rounded-2xl bg-card border border-border p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Smartphone className="w-4 h-4" style={{ color: BRAND_COLORS.PIX }} />
          <h3 className="text-sm font-semibold text-foreground">Pix que caiu depois</h3>
        </div>
        <p className="text-xs text-muted-foreground -mt-1">
          Pagamento que entrou atrasado. Lança no dia em que a venda aconteceu.
        </p>
        <div className="space-y-2">
          <div className="flex gap-2">
            <div className="relative flex-1 min-w-0">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-medium">
                R$
              </span>
              <input
                type="number"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Quanto caiu"
                aria-label="Quanto caiu (R$)"
                className="w-full h-11 bg-background border border-border rounded-xl pl-9 pr-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary placeholder:text-muted-foreground"
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
      </div>
    </div>
  );
}

export default function DailyGoals() {
  // O DEFCON acompanha o tema do app (claro/escuro) — sem trava de cor.
  return (
    <div className="bg-background text-foreground -mx-4 px-4 pt-3 pb-8 min-h-[72vh]">
      <LatePixSection />
      <DefconHub />
    </div>
  );
}
