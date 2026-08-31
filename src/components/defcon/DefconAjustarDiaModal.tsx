import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { MoneyInput } from "@/shared/ui/money-input";
import { useToast } from "@/shared/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { getBrazilDate, getBrazilDateDaysAgo } from "@/shared/lib/date-utils";
import { syncLeaderboardRevenue } from "@/utils/syncDailySales";
import { formatCurrency } from "@/shared/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  userId: string;
  onSaved?: () => void;
  // Abrir já em um dia específico (ex.: vindo do Relatório com o dia filtrado).
  initialDate?: string;
  title?: string;
}

// Estado dos campos do dia (tudo em número, 0 = vazio).
// vendido = quanto ERA PRA CAIR no dia (total vendido). O calote NÃO se digita:
// é calculado sozinho = vendido − o que caiu (din+pix+cartão).
type Campos = {
  vendido: number; cash: number; pix: number; card: number; tip: number;
  cost: number; transport: number; food: number; unpaidUnits: number;
};
const zerado: Campos = { vendido: 0, cash: 0, pix: 0, card: 0, tip: 0, cost: 0, transport: 0, food: 0, unpaidUnits: 0 };

/**
 * Ajustar/lançar os números de um dia que já passou (ex.: passou da meia-noite e não
 * deu tempo de fechar o dia). Carrega o que já existe naquela data e SUBSTITUI pelo que
 * você digitar — é correção, não soma. Faturamento = dinheiro + pix + cartão (mesmo
 * critério do modo foco). Gorjeta e calote entram à parte.
 */
export function DefconAjustarDiaModal({ open, onOpenChange, userId, onSaved, initialDate, title }: Props) {
  const { toast } = useToast();
  const hoje = getBrazilDate();
  const [date, setDate] = useState<string>(initialDate || getBrazilDateDaysAgo(1)); // padrão: ontem
  const [campos, setCampos] = useState<Campos>(zerado);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Se quem abriu pediu um dia específico, a data acompanha a cada abertura.
  useEffect(() => {
    if (open && initialDate) setDate(initialDate);
  }, [open, initialDate]);

  // Ao abrir ou trocar a data, carrega o que já está gravado naquele dia pra você editar.
  useEffect(() => {
    if (!open) return;
    let cancelado = false;
    setLoading(true);
    (async () => {
      const { data: row } = await supabase
        .from("daily_sales")
        .select("cash_sales, pix_sales, card_sales, tip_sales, total_debt, cost, transport_cost, food_cost, unpaid_units")
        .eq("user_id", userId)
        .eq("date", date)
        .maybeSingle();
      if (cancelado) return;
      const r = (row || {}) as Record<string, number | null>;
      const caiuSalvo = (Number(r.cash_sales) || 0) + (Number(r.pix_sales) || 0) + (Number(r.card_sales) || 0);
      setCampos({
        // vendido pré-preenche com caiu + calote já gravado (round-trip sem perder nada)
        vendido: Math.round((caiuSalvo + (Number(r.total_debt) || 0)) * 100) / 100,
        cash: Number(r.cash_sales) || 0,
        pix: Number(r.pix_sales) || 0,
        card: Number(r.card_sales) || 0,
        tip: Number(r.tip_sales) || 0,
        cost: Number(r.cost) || 0,
        transport: Number(r.transport_cost) || 0,
        food: Number(r.food_cost) || 0,
        unpaidUnits: Number(r.unpaid_units) || 0,
      });
      setLoading(false);
    })();
    return () => { cancelado = true; };
  }, [open, date, userId]);

  const set = (k: keyof Campos) => (n: number) => setCampos((c) => ({ ...c, [k]: n || 0 }));
  // CAIU = o que entrou de fato. FALTOU CAIR (calote) = vendido − caiu, calculado sozinho —
  // era exatamente a diferença que não aparecia clara no relatório.
  const faturamento = Math.round((campos.cash + campos.pix + campos.card) * 100) / 100;
  const faltouCair = Math.round(Math.max(0, campos.vendido - faturamento) * 100) / 100;

  const salvar = async () => {
    setSaving(true);
    try {
      const row = {
        user_id: userId,
        date,
        total_profit: faturamento,
        cash_sales: campos.cash,
        pix_sales: campos.pix,
        card_sales: campos.card,
        tip_sales: campos.tip,
        total_debt: faltouCair,
        cost: campos.cost,
        transport_cost: campos.transport,
        food_cost: campos.food,
        unpaid_units: campos.unpaidUnits,
        unpaid_sales: faltouCair > 0 ? 1 : 0,
        updated_at: new Date().toISOString(),
      };
      // 1 linha por (user_id, date) — substitui a do dia (índice único daily_sales_user_date_unique).
      const { error } = await supabase
        .from("daily_sales")
        .upsert(row as never, { onConflict: "user_id,date" });
      if (error) throw error;
      await syncLeaderboardRevenue(userId);
      toast({ title: "Dia ajustado ✓", description: `${formatCurrency(faturamento)} de faturamento salvos.` });
      onSaved?.();
      onOpenChange(false);
    } catch {
      toast({ title: "Erro ao salvar", description: "Tente de novo.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-md p-4 sm:p-6 max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title || "Ajustar dia anterior"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <p className="text-xs text-muted-foreground leading-relaxed">
            {initialDate
              ? <>Preencha quanto <b className="text-foreground">vendeu</b> e quanto <b className="text-foreground">caiu</b> em cada forma. O calote sai da diferença. O que você digitar <b className="text-foreground">substitui</b> o dia (não soma).</>
              : <>Passou da meia-noite e faltou fechar o dia? Escolha a data e preencha. O que você digitar
                <b className="text-foreground"> substitui</b> o dia (não soma). Já vem preenchido com o que houver.</>}
          </p>

          <div className="space-y-2">
            <Label>Data</Label>
            <Input
              type="date"
              value={date}
              max={hoje}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          {/* Total vendido (era pra cair) — o calote sai da diferença, sem conta de cabeça */}
          <div className="space-y-1.5">
            <Label className="text-xs">Total vendido no dia (era pra cair)</Label>
            <MoneyInput value={campos.vendido} onChange={set("vendido")} placeholder="0,00" />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Dinheiro</Label>
              <MoneyInput value={campos.cash} onChange={set("cash")} placeholder="0,00" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Pix</Label>
              <MoneyInput value={campos.pix} onChange={set("pix")} placeholder="0,00" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Cartão</Label>
              <MoneyInput value={campos.card} onChange={set("card")} placeholder="0,00" />
            </div>
          </div>

          {/* Resumo CLARO: era pra cair × caiu × faltou (vira o calote do relatório) */}
          <div className="rounded-lg bg-primary/10 border border-primary/30 px-3 py-2.5 space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Era pra cair</span>
              <span className="font-bold tabular-nums">{formatCurrency(Math.max(campos.vendido, faturamento))}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Caiu de verdade</span>
              <span className="font-bold text-primary tabular-nums">{formatCurrency(faturamento)}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Faltou cair (vira o calote)</span>
              <span className={`font-bold tabular-nums ${faltouCair > 0 ? "text-destructive" : "text-muted-foreground"}`}>
                {formatCurrency(faltouCair)}
              </span>
            </div>
            {campos.vendido > 0 && campos.vendido < faturamento && (
              <p className="text-[10px] text-warning pt-0.5">O vendido está menor que o que caiu — confere os valores.</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Gorjeta</Label>
            <MoneyInput value={campos.tip} onChange={set("tip")} placeholder="0,00" />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Mercadoria</Label>
              <MoneyInput value={campos.cost} onChange={set("cost")} placeholder="0,00" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Transporte</Label>
              <MoneyInput value={campos.transport} onChange={set("transport")} placeholder="0,00" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Alimentação</Label>
              <MoneyInput value={campos.food} onChange={set("food")} placeholder="0,00" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Unidades não pagas (calote)</Label>
            <Input
              type="number"
              min="0"
              value={campos.unpaidUnits || ""}
              onChange={(e) => setCampos((c) => ({ ...c, unpaidUnits: parseInt(e.target.value) || 0 }))}
              placeholder="0"
            />
          </div>

          <div className="flex flex-col-reverse sm:flex-row gap-2 pt-1">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full sm:flex-1" disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={salvar} className="w-full sm:flex-1" disabled={saving || loading}>
              {saving ? "Salvando..." : "Salvar dia"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
