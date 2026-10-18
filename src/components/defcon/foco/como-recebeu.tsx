/* "Como você recebeu": dinheiro · cartão · Pix do dia, com correção manual. A correção
   redistribui pelos blocos da hora (proporcional ao vendido) e ressincroniza o daily_sales;
   o que faltar pro total vira "não recebido". Movido do DefconHub (18/10/2026). */
import { useState, type ReactNode } from "react";
import { Banknote, Check, Coins, CreditCard, Pencil, Smartphone, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { avisar } from "@/shared/lib/avisar";
import { formatCurrency } from "@/shared/lib/utils";
import { BRAND_COLORS, readThemeColor } from "@/shared/lib/theme-colors";
import { syncBlocksToDailySales } from "@/utils/syncDailySales";
import { useToast } from "@/shared/hooks/use-toast";
import { brl0, PRESS, type DayTotals } from "./foco-tipos";

interface Props { userId: string; planId: string | null; totals: DayTotals; totalVendido: number; onChanged: () => void }

const em2Casas = (v: number) => { const n = Math.round((Number(v) || 0) * 100) / 100; return n ? String(n) : ""; };
const num = (s: string) => Math.round((parseFloat(String(s).replace(",", ".")) || 0) * 100) / 100;

export function ComoRecebeu({ userId, planId, totals, totalVendido, onChanged }: Props) {
  const { toast } = useToast();
  const [editando, setEditando] = useState(false);
  const [cash, setCash] = useState("");
  const [card, setCard] = useState("");
  const [pix, setPix] = useState("");
  const [salvando, setSalvando] = useState(false);

  const abrir = () => { setCash(em2Casas(totals.cash)); setCard(em2Casas(totals.card)); setPix(em2Casas(totals.pix)); setEditando(true); };

  const salvar = async () => {
    if (!planId) return;
    setSalvando(true);
    try {
      const d = num(cash), c = num(card), p = num(pix);
      const { data: blocks } = await supabase.from("hourly_goal_blocks").select("id, valor_dinheiro, valor_cartao, valor_pix, valor_calote").eq("plan_id", planId);
      const total = (blocks || []).reduce((s, b) => s + (b.valor_dinheiro || 0) + (b.valor_cartao || 0) + (b.valor_pix || 0) + (b.valor_calote || 0), 0);
      if (total > 0) {
        const ativos = (blocks || []).filter((b) => (b.valor_dinheiro || 0) + (b.valor_cartao || 0) + (b.valor_pix || 0) + (b.valor_calote || 0) > 0);
        // cada fatia arredondada perde centavos; o último bloco leva exatamente o resto
        let accD = 0, accC = 0, accP = 0;
        for (let i = 0; i < ativos.length; i++) {
          const b = ativos[i]!;
          const bt = (b.valor_dinheiro || 0) + (b.valor_cartao || 0) + (b.valor_pix || 0) + (b.valor_calote || 0);
          const ratio = bt / total, ultimo = i === ativos.length - 1;
          const bd = ultimo ? Math.round((d - accD) * 100) / 100 : Math.round(d * ratio * 100) / 100;
          const bc = ultimo ? Math.round((c - accC) * 100) / 100 : Math.round(c * ratio * 100) / 100;
          const bp = ultimo ? Math.round((p - accP) * 100) / 100 : Math.round(p * ratio * 100) / 100;
          accD += bd; accC += bc; accP += bp;
          const bcal = Math.max(0, Math.round((bt - (bd + bc + bp)) * 100) / 100);
          const { error } = await supabase.from("hourly_goal_blocks").update({ valor_dinheiro: bd, valor_cartao: bc, valor_pix: bp, valor_calote: bcal, achieved_amount: Math.round((bd + bc + bp + bcal) * 100) / 100 }).eq("id", b.id);
          if (error) throw error;
        }
      }
      await syncBlocksToDailySales(userId);
      setEditando(false);
      toast({ title: "Recebimentos atualizados", description: "Dinheiro, cartão e Pix corrigidos." });
      onChanged();
    } catch (e) {
      avisar.erro("Foco: corrigir recebimentos", e);
      toast({ title: "Erro ao salvar", variant: "destructive" });
    } finally { setSalvando(false); }
  };

  const custos = totals.cost + totals.transport + totals.food;
  return (
    <div className="rounded-[20px] border px-4 py-3.5 mt-3" style={{ borderColor: "var(--orbis-line)", background: "var(--orbis-surf)" }}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[14.5px] font-extrabold">Como você recebeu</p>
        {!editando && <button type="button" onClick={abrir} className={`inline-flex items-center gap-1 h-8 px-3 rounded-full text-[12px] font-bold ${PRESS}`} style={{ border: "1px solid rgba(245,184,0,.4)", color: "var(--orbis-gold)" }}><Pencil className="w-3 h-3" /> Corrigir</button>}
      </div>
      {editando ? (
        <div className="mt-3 space-y-2.5">
          <p className="text-xs" style={{ color: "var(--orbis-fg-3)" }}>Ajuste o que entrou em cada forma. O que faltar pro total vira <span style={{ color: "var(--orbis-custo)" }}>não recebido</span>.</p>
          <Linha icon={<Banknote className="w-4 h-4 text-success" />} label="Dinheiro" value={cash} onChange={setCash} />
          <Linha icon={<CreditCard className="w-4 h-4" style={{ color: readThemeColor("--violet-soft") }} />} label="Cartão" value={card} onChange={setCard} />
          <Linha icon={<Smartphone className="w-4 h-4" style={{ color: BRAND_COLORS.PIX }} />} label="Pix" value={pix} onChange={setPix} />
          <div className="flex items-center justify-between pt-1">
            <span className="text-xs tabular-nums" style={{ color: "var(--orbis-fg-3)" }}>Somado <span className="text-foreground font-semibold">{formatCurrency(num(cash) + num(card) + num(pix))}</span> / {formatCurrency(totalVendido)}</span>
            <div className="flex gap-2">
              <button type="button" onClick={() => setEditando(false)} disabled={salvando} className="h-9 px-3 rounded-lg bg-muted text-foreground text-xs font-semibold flex items-center gap-1 active:scale-95 disabled:opacity-50"><X className="w-3.5 h-3.5" /> Cancelar</button>
              <button type="button" onClick={salvar} disabled={salvando} className="h-9 px-3 rounded-lg text-xs font-bold flex items-center gap-1 active:scale-95 disabled:opacity-50" style={{ background: "var(--orbis-gold)", color: "#1A1200" }}><Check className="w-3.5 h-3.5" /> {salvando ? "Salvando..." : "Salvar"}</button>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2 mt-3">
            <Forma icon={<Banknote className="w-4 h-4" />} label="Dinheiro" value={totals.cash} total={totalVendido} color={readThemeColor("--success")} />
            <Forma icon={<CreditCard className="w-4 h-4" />} label="Cartão" value={totals.card} total={totalVendido} color={readThemeColor("--violet-soft")} />
            <Forma icon={<Smartphone className="w-4 h-4" />} label="Pix" value={totals.pix} total={totalVendido} color={BRAND_COLORS.PIX} />
          </div>
          {totals.tips > 0 && (
            <div className="mt-2 rounded-xl px-4 py-3 flex items-center gap-3" style={{ border: "1px solid rgba(245,184,0,.3)", background: "rgba(245,184,0,.06)" }}>
              <Coins className="w-4 h-4 shrink-0" style={{ color: "var(--orbis-gold)" }} />
              <span className="flex-1 text-[12px]" style={{ color: "var(--orbis-fg-2)" }}>Gorjetas · já inclusas no dinheiro</span>
              <span className="orbis-num text-[15px] font-bold" style={{ color: "var(--orbis-gold)" }}>+{formatCurrency(totals.tips)}</span>
            </div>
          )}
          <div className="flex gap-2 mt-2 text-[12px]" style={{ color: "var(--orbis-fg-3)" }}>
            <span>Lucro <b className="orbis-num" style={{ color: "var(--orbis-gold)" }}>{brl0(totals.profit)}</b></span>
            {totals.debt > 0 && <span>· Calotes <b className="orbis-num" style={{ color: "var(--orbis-calote)" }}>{brl0(totals.debt)}</b></span>}
            {custos > 0 && <span>· Custos <b className="orbis-num text-foreground">{brl0(custos)}</b></span>}
          </div>
        </>
      )}
    </div>
  );
}

function Forma({ icon, label, value, total, color }: { icon: ReactNode; label: string; value: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  const on = value > 0;
  return (
    <div className="rounded-xl p-2.5 space-y-1" style={{ background: "rgba(0,0,0,.35)", border: `1px solid ${on ? `${color}55` : "var(--orbis-line)"}` }}>
      <div className="flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-[.06em]" style={{ color: on ? color : "var(--orbis-fg-3)" }}>{icon}{label}</div>
      <p className="orbis-num text-sm font-bold text-foreground leading-tight">{formatCurrency(value)}</p>
      <div className="h-0.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,.06)" }}><div className="h-full rounded-full" style={{ width: `${pct}%`, background: on ? color : "transparent" }} /></div>
      <p className="text-[11px] tabular-nums" style={{ color: "var(--orbis-fg-3)" }}>{pct}% do total</p>
    </div>
  );
}

function Linha({ icon, label, value, onChange }: { icon: ReactNode; label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="relative h-11 rounded-lg bg-background border border-border focus-within:border-primary/60 transition-colors flex items-center">
      <span className="absolute left-3">{icon}</span>
      <span className="absolute left-10 text-xs font-medium text-muted-foreground">{label}</span>
      <span className="absolute right-[68px] text-xs text-muted-foreground">R$</span>
      <input type="number" inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)} placeholder="0" aria-label={label}
        className="w-full h-full bg-transparent text-right text-sm font-bold text-foreground pr-3 pl-28 focus-visible:outline-none rounded-lg placeholder:text-muted-foreground" />
    </div>
  );
}
