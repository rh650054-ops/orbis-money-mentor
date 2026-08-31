import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { Button } from "@/shared/ui/button";
import { Label } from "@/shared/ui/label";
import { MoneyInput } from "@/shared/ui/money-input";
import { useToast } from "@/shared/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { syncLeaderboardRevenue } from "@/utils/syncDailySales";
import { formatCurrency, cn } from "@/shared/lib/utils";

export type MetodoRecebimento = "dinheiro" | "pix" | "cartao";

export const METODO_INFO: Record<MetodoRecebimento, { label: string; icon: string; col: "cash_sales" | "pix_sales" | "card_sales" }> = {
  dinheiro: { label: "Dinheiro", icon: "💵", col: "cash_sales" },
  pix: { label: "Pix", icon: "📱", col: "pix_sales" },
  cartao: { label: "Cartão", icon: "💳", col: "card_sales" },
};

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  userId: string;
  date: string;          // dia da VENDA (ISO yyyy-mm-dd) — é nele que o dinheiro entra
  faltouCair: number;    // calote atual do dia (pra sugerir "caiu tudo")
  onSaved?: () => void;
}

const prettyDate = (iso: string) => {
  const [, m, d] = iso.split("-");
  return d && m ? `${d}/${m}` : iso;
};

/**
 * "Caiu mais dinheiro" — um cliente pagou depois (fiado, Pix atrasado, cartão que só
 * aprovou no dia seguinte). Lança o valor NO DIA DA VENDA, na forma escolhida, e abate
 * do "faltou cair" (calote). Cada lançamento fica guardado em late_pix_entries com o
 * método, então dá pra desfazer e o Relatório sabe quanto do calote você recuperou.
 */
export function RegistrarRecebimentoModal({ open, onOpenChange, userId, date, faltouCair, onSaved }: Props) {
  const { toast } = useToast();
  const [valor, setValor] = useState(0);
  const [metodo, setMetodo] = useState<MetodoRecebimento>("pix");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) { setValor(0); setMetodo("pix"); }
  }, [open]);

  const salvar = async () => {
    const v = Math.round((valor || 0) * 100) / 100;
    if (v <= 0) {
      toast({ title: "Digite o valor que caiu", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const col = METODO_INFO[metodo].col;
      // 1 linha por (user_id, date) — índice único daily_sales_user_date_unique.
      const { data: row, error: selErr } = await supabase
        .from("daily_sales")
        .select("id, total_profit, cash_sales, pix_sales, card_sales, total_debt")
        .eq("user_id", userId)
        .eq("date", date)
        .maybeSingle();
      if (selErr) throw selErr;

      if (row) {
        const r = row as Record<string, number | null> & { id: string };
        const { error: updErr } = await supabase
          .from("daily_sales")
          .update({
            total_profit: (Number(r.total_profit) || 0) + v,
            [col]: (Number(r[col]) || 0) + v,
            // O que caiu depois era parte do que FALTAVA cair: "caiu" sobe, "faltou" desce,
            // "era pra cair" (vendido) continua igual.
            total_debt: Math.max(0, (Number(r.total_debt) || 0) - v),
            updated_at: new Date().toISOString(),
          } as never)
          .eq("id", r.id);
        if (updErr) throw updErr;
      } else {
        const { error: insErr } = await supabase
          .from("daily_sales")
          .insert({ user_id: userId, date, total_profit: v, [col]: v } as never);
        if (insErr) throw insErr;
      }

      // Histórico do lançamento (pra desfazer e pra medir recuperação de calote).
      const { error: histErr } = await supabase
        .from("late_pix_entries")
        .insert({ user_id: userId, amount: v, sale_date: date, metodo } as never);
      if (histErr) console.warn("late_pix_entries:", histErr.message);

      await syncLeaderboardRevenue(userId);
      const restante = Math.max(0, faltouCair - v);
      toast({
        title: `${METODO_INFO[metodo].icon} ${formatCurrency(v)} lançado em ${prettyDate(date)}`,
        description: restante > 0
          ? `Ainda faltam ${formatCurrency(restante)} desse dia.`
          : "Esse dia fechou sem calote 🎉",
      });
      onSaved?.();
      onOpenChange(false);
    } catch {
      toast({ title: "Não consegui salvar", description: "Confere a internet e tenta de novo.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-sm p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>Caiu mais dinheiro · {prettyDate(date)}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-1">
          <p className="text-xs text-muted-foreground leading-relaxed">
            Alguém pagou depois? Lança aqui. O valor entra <b className="text-foreground">no dia da venda</b> e
            abate do que faltou cair.
          </p>

          <div className="space-y-1.5">
            <Label className="text-xs">Quanto caiu</Label>
            <MoneyInput value={valor} onChange={(n) => setValor(n || 0)} placeholder="0,00" />
            {faltouCair > 0 && (
              <button
                type="button"
                onClick={() => setValor(Math.round(faltouCair * 100) / 100)}
                className="text-[11px] text-primary font-semibold hover:underline"
              >
                Caiu tudo que faltava ({formatCurrency(faltouCair)})
              </button>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Caiu como</Label>
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(METODO_INFO) as MetodoRecebimento[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMetodo(m)}
                  className={cn(
                    "h-12 rounded-xl border text-xs font-semibold flex flex-col items-center justify-center gap-0.5 transition-colors",
                    metodo === m
                      ? "bg-primary/15 border-primary text-primary"
                      : "bg-card border-border/60 text-muted-foreground hover:text-foreground hover:border-border",
                  )}
                >
                  <span className="text-base leading-none">{METODO_INFO[m].icon}</span>
                  {METODO_INFO[m].label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col-reverse sm:flex-row gap-2 pt-1">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full sm:flex-1" disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={salvar} className="w-full sm:flex-1" disabled={saving}>
              {saving ? "Salvando..." : "Lançar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
