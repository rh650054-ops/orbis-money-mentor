import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, PencilLine, PlusCircle, Trash2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/shared/hooks/use-toast";
import { formatCurrency, cn } from "@/shared/lib/utils";
import { syncLeaderboardRevenue } from "@/utils/syncDailySales";
import { DefconAjustarDiaModal } from "@/components/defcon/DefconAjustarDiaModal";
import { RegistrarRecebimentoModal, METODO_INFO, type MetodoRecebimento } from "./RegistrarRecebimentoModal";

// Linha do dia como o Relatório já carrega de daily_sales
export interface DiaResumo {
  total_profit?: number | null;
  total_debt?: number | null;
  cash_sales?: number | null;
  pix_sales?: number | null;
  card_sales?: number | null;
  unpaid_units?: number | null;
}

interface Recebimento {
  id: string;
  amount: number;
  sale_date: string;
  created_at: string;
  metodo: MetodoRecebimento | null;
}

interface Props {
  userId: string;
  date: string;            // ISO yyyy-mm-dd
  dia: DiaResumo | null;   // null = nada lançado nesse dia
  onChanged: () => void;   // recarrega o Relatório
}

const prettyDate = (iso: string) => {
  const [, m, d] = iso.split("-");
  return d && m ? `${d}/${m}` : iso;
};
const prettyWhen = (iso: string) => {
  const dt = new Date(iso);
  return `${dt.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} ${dt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
};

/**
 * FECHAMENTO DO DIA — aparece no Relatório quando o filtro é um dia só.
 * Mostra o que vendeu × o que caiu (por forma) × o que faltou (calote), com a frase
 * direta "Você tomou R$ X de calote", e dá dois botões: "Caiu mais dinheiro" (cliente
 * pagou depois) e "Ajustar o dia" (corrigir os números do dia inteiro).
 */
export function FechamentoDoDia({ userId, date, dia, onChanged }: Props) {
  const { toast } = useToast();
  const [openReceb, setOpenReceb] = useState(false);
  const [openAjustar, setOpenAjustar] = useState(false);
  const [recebimentos, setRecebimentos] = useState<Recebimento[]>([]);
  const [loadingReceb, setLoadingReceb] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const dinheiro = Number(dia?.cash_sales) || 0;
  const pix = Number(dia?.pix_sales) || 0;
  const cartao = Number(dia?.card_sales) || 0;
  const caiu = Math.round((dinheiro + pix + cartao) * 100) / 100;
  const faltou = Math.max(0, Number(dia?.total_debt) || 0);
  const vendido = Math.round((caiu + faltou) * 100) / 100;
  const unidades = Number(dia?.unpaid_units) || 0;
  const pctCalote = vendido > 0 ? (faltou / vendido) * 100 : 0;
  const semLancamento = !dia || (vendido <= 0 && (Number(dia?.total_profit) || 0) <= 0);

  const carregarRecebimentos = useCallback(async () => {
    setLoadingReceb(true);
    const { data } = await supabase
      .from("late_pix_entries")
      .select("id, amount, sale_date, created_at, metodo")
      .eq("user_id", userId)
      .eq("sale_date", date)
      .order("created_at", { ascending: false });
    setRecebimentos(((data as unknown) as Recebimento[]) || []);
    setLoadingReceb(false);
  }, [userId, date]);

  useEffect(() => {
    carregarRecebimentos();
  }, [carregarRecebimentos]);

  const recuperado = recebimentos.reduce((s, r) => s + (Number(r.amount) || 0), 0);

  // Desfazer um "caiu depois": tira o valor do dia (na forma certa) e devolve pro "faltou cair".
  const desfazer = async (r: Recebimento) => {
    const metodo: MetodoRecebimento = r.metodo || "pix";
    if (typeof window !== "undefined" &&
        !window.confirm(`Desfazer o lançamento de ${formatCurrency(Number(r.amount))} (${METODO_INFO[metodo].label}) do dia ${prettyDate(r.sale_date)}? O valor volta a contar como calote.`)) {
      return;
    }
    setDeletingId(r.id);
    try {
      const col = METODO_INFO[metodo].col;
      const { data: row } = await supabase
        .from("daily_sales")
        .select("id, total_profit, cash_sales, pix_sales, card_sales, total_debt")
        .eq("user_id", userId)
        .eq("date", r.sale_date)
        .maybeSingle();
      if (row) {
        const ds = row as Record<string, number | null> & { id: string };
        const v = Number(r.amount) || 0;
        const { error: updErr } = await supabase
          .from("daily_sales")
          .update({
            total_profit: Math.max(0, (Number(ds.total_profit) || 0) - v),
            [col]: Math.max(0, (Number(ds[col]) || 0) - v),
            total_debt: (Number(ds.total_debt) || 0) + v,
            updated_at: new Date().toISOString(),
          } as never)
          .eq("id", ds.id);
        if (updErr) throw updErr;
      }
      const { error: delErr } = await supabase.from("late_pix_entries").delete().eq("id", r.id);
      if (delErr) throw delErr;
      await syncLeaderboardRevenue(userId);
      toast({ title: "Lançamento desfeito", description: `${formatCurrency(Number(r.amount))} voltou a contar como calote.` });
      await carregarRecebimentos();
      onChanged();
    } catch {
      toast({ title: "Não consegui desfazer", variant: "destructive" });
    } finally {
      setDeletingId(null);
    }
  };

  const aposSalvar = async () => {
    await carregarRecebimentos();
    onChanged();
  };

  return (
    <section className="rounded-2xl border border-border/60 bg-card p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-foreground leading-tight">Fechamento do dia {prettyDate(date)}</p>
          <p className="text-[11px] text-muted-foreground leading-tight">Vendeu × caiu × calote — e o que caiu depois</p>
        </div>
        <button
          onClick={() => setOpenAjustar(true)}
          className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline shrink-0"
        >
          <PencilLine className="w-3.5 h-3.5" /> {semLancamento ? "Lançar o dia" : "Ajustar o dia"}
        </button>
      </div>

      {/* Frase direta do calote */}
      {semLancamento ? (
        <div className="rounded-xl border border-dashed border-border px-4 py-5 text-center space-y-2">
          <p className="text-sm text-muted-foreground">Nenhum lançamento nesse dia.</p>
          <button
            onClick={() => setOpenAjustar(true)}
            className="text-sm font-bold text-primary hover:underline"
          >
            Lançar quanto vendeu e quanto caiu →
          </button>
        </div>
      ) : faltou > 0 ? (
        <div className="rounded-xl bg-destructive/10 border border-destructive/30 px-4 py-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-destructive/15 border border-destructive/30 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5 text-destructive" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-wider text-destructive font-bold">Calote do dia</p>
            <p className="text-2xl font-black text-destructive tabular-nums leading-tight">
              Você tomou {formatCurrency(faltou)} de calote
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {pctCalote.toFixed(0)}% do que vendeu não caiu
              {unidades > 0 && ` · ${unidades} ${unidades === 1 ? "cliente não pagou" : "clientes não pagaram"}`}
            </p>
          </div>
        </div>
      ) : (
        <div className="rounded-xl bg-success/10 border border-success/30 px-4 py-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-success/15 border border-success/30 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5 text-success" />
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wider text-success font-bold">Sem calote</p>
            <p className="text-lg font-black text-success leading-tight">Tudo que você vendeu caiu 🎉</p>
            {recuperado > 0 && (
              <p className="text-[11px] text-muted-foreground mt-0.5">{formatCurrency(recuperado)} disso caiu depois — você cobrou e recebeu.</p>
            )}
          </div>
        </div>
      )}

      {!semLancamento && (
        <>
          {/* Vendido × caiu × faltou */}
          <div className="grid grid-cols-3 gap-2">
            <Cell label="Vendeu" value={formatCurrency(vendido)} />
            <Cell label="Caiu" value={formatCurrency(caiu)} tone="success" />
            <Cell label="Faltou" value={formatCurrency(faltou)} tone={faltou > 0 ? "destructive" : "muted"} />
          </div>

          {/* Por forma de pagamento */}
          <div className="grid grid-cols-3 gap-2 text-center">
            {(Object.keys(METODO_INFO) as MetodoRecebimento[]).map((m) => {
              const v = m === "dinheiro" ? dinheiro : m === "pix" ? pix : cartao;
              return (
                <div key={m} className="rounded-lg bg-muted/30 px-2 py-2">
                  <p className="text-[10px] text-muted-foreground">{METODO_INFO[m].icon} {METODO_INFO[m].label}</p>
                  <p className="text-sm font-semibold tabular-nums">{formatCurrency(v)}</p>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Botão principal: caiu mais dinheiro */}
      {!semLancamento && (
        <button
          onClick={() => setOpenReceb(true)}
          className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
        >
          <PlusCircle className="w-4 h-4" />
          Caiu mais dinheiro desse dia
        </button>
      )}

      {/* O que já caiu depois */}
      {(recebimentos.length > 0 || loadingReceb) && (
        <div className="space-y-1.5">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
            Caiu depois · {formatCurrency(recuperado)}
          </p>
          {loadingReceb && recebimentos.length === 0 ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="w-3.5 h-3.5 animate-spin" /> carregando…</div>
          ) : (
            <div className="rounded-xl border border-border/60 divide-y divide-border/60 overflow-hidden">
              {recebimentos.map((r) => {
                const m: MetodoRecebimento = r.metodo || "pix";
                return (
                  <div key={r.id} className="flex items-center justify-between gap-2 px-3 py-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold tabular-nums">{METODO_INFO[m].icon} {formatCurrency(Number(r.amount))}</p>
                      <p className="text-[10px] text-muted-foreground">{METODO_INFO[m].label} · lançado {prettyWhen(r.created_at)}</p>
                    </div>
                    <button
                      onClick={() => desfazer(r)}
                      disabled={deletingId === r.id}
                      className="h-9 w-9 rounded-lg flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 disabled:opacity-50"
                      aria-label="Desfazer"
                    >
                      {deletingId === r.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <RegistrarRecebimentoModal
        open={openReceb}
        onOpenChange={setOpenReceb}
        userId={userId}
        date={date}
        faltouCair={faltou}
        onSaved={aposSalvar}
      />
      <DefconAjustarDiaModal
        open={openAjustar}
        onOpenChange={setOpenAjustar}
        userId={userId}
        initialDate={date}
        title={`Fechar o dia ${prettyDate(date)}`}
        onSaved={aposSalvar}
      />
    </section>
  );
}

function Cell({ label, value, tone = "white" }: { label: string; value: string; tone?: "white" | "success" | "destructive" | "muted" }) {
  return (
    <div className="rounded-xl border border-border/60 bg-background/40 px-3 py-2.5">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={cn(
        "text-base font-bold tabular-nums leading-tight",
        tone === "success" && "text-success",
        tone === "destructive" && "text-destructive",
        tone === "muted" && "text-muted-foreground",
      )}>{value}</p>
    </div>
  );
}
