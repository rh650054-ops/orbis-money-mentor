import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Lock, PencilLine, PlusCircle, Trash2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/shared/hooks/use-toast";
import { formatCurrency, cn } from "@/shared/lib/utils";
import { syncLeaderboardRevenue } from "@/utils/syncDailySales";
import { DefconAjustarDiaModal } from "@/components/defcon/DefconAjustarDiaModal";
import { AjustarDinheiro } from "./AjustarDinheiro";
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
  /** Banco conferiu o dia (17/10): Pix e cartão são o que CAIU na conta, não o digitado.
   *  `hoje` = ainda pode cair (banco lento) — não chama de calote. */
  banco?: { pix: number; cartao: number; hoje: boolean } | null;
  /** Tem banco que conta (Open Finance): Pix/cartão/calote vêm do banco à meia-noite,
   *  então "Caiu mais dinheiro" e "Ajustar o dia" ficam só pra quem não tem banco (Rick, 18/10). */
  travado?: boolean;
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
export function FechamentoDoDia({ userId, date, dia, banco = null, travado = false, onChanged }: Props) {
  const { toast } = useToast();
  const [openReceb, setOpenReceb] = useState(false);
  const [openAjustar, setOpenAjustar] = useState(false);
  const [recebimentos, setRecebimentos] = useState<Recebimento[]>([]);
  const [loadingReceb, setLoadingReceb] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const dinheiro = Number(dia?.cash_sales) || 0;
  const pixLancado = Number(dia?.pix_sales) || 0;
  const cartaoLancado = Number(dia?.card_sales) || 0;
  // vendido = o que foi lançado (dinheiro + pix + cartão + o que ficou faltando)
  const vendido = Math.round((dinheiro + pixLancado + cartaoLancado + Math.max(0, Number(dia?.total_debt) || 0)) * 100) / 100;
  const pix = banco ? banco.pix : pixLancado;
  const cartao = banco ? banco.cartao : cartaoLancado;
  const caiu = Math.round((dinheiro + pix + cartao) * 100) / 100;
  const faltou = Math.max(0, Math.round((vendido - caiu) * 100) / 100);
  const aindaPodeCair = !!banco?.hoje && faltou > 0;
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
    <section className="rounded-2xl border border-border/60 bg-card p-3.5 space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-foreground leading-tight">Fechamento do dia {prettyDate(date)}</p>
          <p className="text-[10.5px] text-muted-foreground leading-tight truncate">{travado ? "Pix e cartão vêm do banco · dinheiro você ajusta" : "Vendeu × caiu × calote"}</p>
        </div>
        {!travado && <button
          onClick={() => setOpenAjustar(true)}
          className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-primary hover:underline shrink-0"
        >
          <PencilLine className="w-3.5 h-3.5" /> {semLancamento ? "Lançar o dia" : "Ajustar o dia"}
        </button>}
      </div>

      {semLancamento ? (
        <div className="rounded-xl border border-dashed border-border px-3 py-3.5 text-center space-y-1.5">
          <p className="text-[13px] text-muted-foreground">Nenhum lançamento nesse dia.</p>
          {!travado && <button
            onClick={() => setOpenAjustar(true)}
            className="text-[13px] font-bold text-primary hover:underline"
          >
            Lançar quanto vendeu e quanto caiu →
          </button>}
        </div>
      ) : (
        <>
          {/* 21/10 (Mohamed): vendeu × caiu × faltou first, compact */}
          <div className="grid grid-cols-3 gap-1.5">
            <Cell label="Vendeu" value={formatCurrency(vendido)} />
            <Cell label="Caiu" value={formatCurrency(caiu)} tone="success" />
            <Cell label={aindaPodeCair ? "Falta cair" : "Faltou"} value={formatCurrency(faltou)} tone={faltou > 0 ? "destructive" : "muted"} />
          </div>

          {/* Calote in one compact line */}
          {aindaPodeCair ? (
            <Aviso tom="destructive" icone={<AlertTriangle className="w-4 h-4" />}
              titulo={`${formatCurrency(faltou)} ainda não caiu`} sub={`${pctCalote.toFixed(0)}% · a Vant confere de novo à meia-noite`} />
          ) : faltou > 0 ? (
            <Aviso tom="destructive" icone={<AlertTriangle className="w-4 h-4" />}
              titulo={`Calote de ${formatCurrency(faltou)}`}
              sub={`${pctCalote.toFixed(0)}% do que vendeu${unidades > 0 ? ` · ${unidades} ${unidades === 1 ? "cliente" : "clientes"}` : ""}`} />
          ) : (
            <Aviso tom="success" icone={<CheckCircle2 className="w-4 h-4" />}
              titulo="Sem calote: tudo caiu 🎉" sub={recuperado > 0 ? `${formatCurrency(recuperado)} caiu depois` : undefined} />
          )}

          {/* Por forma: dinheiro sempre ajustável; Pix/cartão travados quando vêm do banco */}
          <div className="grid grid-cols-3 gap-1.5 text-center">
            <AjustarDinheiro userId={userId} date={date} valor={dinheiro} onSaved={onChanged} />
            {(["pix", "cartao"] as MetodoRecebimento[]).map((m) => (
              <div key={m} className="rounded-lg bg-muted/30 px-2 py-1.5 text-left">
                <p className="flex items-center justify-between text-[10px] text-muted-foreground">{METODO_INFO[m].icon} {METODO_INFO[m].label}{travado && <Lock className="h-3 w-3" />}</p>
                <p className="text-[13px] font-semibold tabular-nums">{formatCurrency(m === "pix" ? pix : cartao)}</p>
                {travado && <p className="text-[9.5px] text-muted-foreground">do banco</p>}
              </div>
            ))}
          </div>
        </>
      )}

      {/* Botão principal: caiu mais dinheiro (só sem banco — com banco o Pix entra sozinho) */}
      {!semLancamento && !travado && (
        <button
          onClick={() => setOpenReceb(true)}
          className="w-full h-10 rounded-xl bg-primary text-primary-foreground font-bold text-[13px] flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
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
    <div className="min-w-0 rounded-xl border border-border/60 bg-background/40 px-2 py-1.5">
      <p className="text-[9.5px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={cn(
        "text-[13.5px] font-bold tabular-nums leading-tight whitespace-nowrap",
        tone === "success" && "text-success",
        tone === "destructive" && "text-destructive",
        tone === "muted" && "text-muted-foreground",
      )}>{value}</p>
    </div>
  );
}

function Aviso({ tom, icone, titulo, sub }: { tom: "destructive" | "success"; icone: ReactNode; titulo: string; sub?: string }) {
  const c = tom === "success" ? "bg-success/10 border-success/30 text-success" : "bg-destructive/10 border-destructive/30 text-destructive";
  return (
    <div className={cn("rounded-xl border px-3 py-2 flex items-center gap-2", c)}>
      <span className="shrink-0">{icone}</span>
      <div className="min-w-0">
        <p className="text-[13px] font-bold tabular-nums leading-tight">{titulo}</p>
        {sub && <p className="text-[10.5px] text-muted-foreground leading-tight truncate">{sub}</p>}
      </div>
    </div>
  );
}
