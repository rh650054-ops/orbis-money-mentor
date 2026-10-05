/* ============================================================
   FATURAMENTO DO ANO (aba Tributário) — 04/10/2026, Mohamed:
   "com os dados do Open Finance, meu verdadeiro faturamento anual, mantendo
   o dinheiro que eu mandei na planilha antiga".
   Mês a mês (faturamento_ano): dinheiro vivo = o que ele lançou; Pix/cartão =
   o maior entre o lançado e o que entrou nas contas de trabalho.
   ============================================================ */
import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, ChevronDown, Landmark } from "lucide-react";
import { Card, CardContent } from "@/shared/ui/card";
import { Skeleton } from "@/shared/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { avisar } from "@/shared/lib/avisar";
import { formatCurrency } from "@/shared/lib/utils";
import { getBrazilDate } from "@/shared/lib/date-utils";

export const LIMITE_MEI_ANO = 81000; // teto vigente em out/2026 (propostas de aumento não aprovadas)
const TOLERANCIA = LIMITE_MEI_ANO * 1.2; // até 20% acima: desenquadra só no ano seguinte

interface Mes { mes: string; dinheiro: number; lancado: number; banco: number; digital: number; total: number; fonte: "banco" | "lancado" }
interface Faturamento { ano: number; total: number; dinheiro: number; digital: number; lancado_total: number; meses_banco: number; contas_venda: string[]; meses: Mes[] }

const nomeMes = (iso: string) =>
  new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");

/** Lê o faturamento do ano; se a função não existir ainda, cai na soma dos lançamentos. */
function useFaturamento(userId: string | undefined, ano: string) {
  const [f, setF] = useState<Faturamento | null>(null);
  useEffect(() => {
    if (!userId) return;
    let vivo = true;
    (async () => {
      const rpc = (supabase as unknown as { rpc: (n: string, a: object) => Promise<{ data: unknown; error: unknown }> }).rpc;
      const { data, error } = await rpc.call(supabase, "faturamento_ano", { p_ano: Number(ano) });
      if (!error && data) { if (vivo) setF(data as Faturamento); return; }
      avisar.silencioso("faturamento_ano", error);
      const { data: s } = await supabase.from("daily_sales").select("cash_sales, pix_sales, card_sales")
        .eq("user_id", userId).gte("date", `${ano}-01-01`).lte("date", `${ano}-12-31`);
      const dinheiro = (s ?? []).reduce((t, r) => t + (Number(r.cash_sales) || 0), 0);
      const digital = (s ?? []).reduce((t, r) => t + (Number(r.pix_sales) || 0) + (Number(r.card_sales) || 0), 0);
      if (vivo) setF({ ano: Number(ano), total: dinheiro + digital, dinheiro, digital, lancado_total: dinheiro + digital, meses_banco: 0, contas_venda: [], meses: [] });
    })();
    return () => { vivo = false; };
  }, [userId, ano]);
  return f;
}

export function FaturamentoAnoCard({ userId }: { userId: string | undefined }) {
  const hoje = getBrazilDate();
  const ano = hoje.slice(0, 4);
  const f = useFaturamento(userId, ano);
  const [aberto, setAberto] = useState(false);
  if (!f) return <Card><CardContent className="p-4"><Skeleton className="h-24 w-full" /></CardContent></Card>;

  const total = f.total;
  const pct = Math.min(100, (total / LIMITE_MEI_ANO) * 100);
  const diaDoAno = Math.max(1, Math.round((Date.parse(`${hoje}T12:00:00`) - Date.parse(`${ano}-01-01T12:00:00`)) / 86_400_000) + 1);
  const projecao = (total / diaDoAno) * 365;
  const passou = total > LIMITE_MEI_ANO;
  const muito = total > TOLERANCIA;
  const cor = pct >= 90 ? "destructive" : pct >= 70 ? "warning" : "success";
  const badge = { success: "bg-success/15 text-success border-success/30", warning: "bg-warning/15 text-warning border-warning/30", destructive: "bg-destructive/15 text-destructive border-destructive/30" }[cor];
  const barra = { success: "bg-success", warning: "bg-warning", destructive: "bg-destructive" }[cor];

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">Faturamento do ano ({ano})</p>
          <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${badge}`}>{(total / LIMITE_MEI_ANO * 100).toFixed(0)}% do limite</span>
        </div>
        <p className="text-2xl font-bold tracking-tight">{formatCurrency(total)}</p>
        <div className="h-2 rounded-full bg-muted overflow-hidden"><div className={`h-full ${barra}`} style={{ width: `${pct}%` }} /></div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          {formatCurrency(f.dinheiro)} em dinheiro (seus lançamentos) + {formatCurrency(f.digital)} em Pix e cartão
          {f.meses_banco > 0 ? <> · <Landmark className="inline w-3 h-3 -mt-0.5" /> {f.meses_banco} {f.meses_banco === 1 ? "mês conferido" : "meses conferidos"} pelo banco</> : ""}.
          {passou ? "" : ` Falta ${formatCurrency(LIMITE_MEI_ANO - total)} pro teto de ${formatCurrency(LIMITE_MEI_ANO)}/ano.`}
        </p>

        {passou ? (
          <div className="flex items-start gap-2 rounded-lg px-3 py-2 text-[11px] leading-relaxed bg-destructive/10 border border-destructive/30">
            <AlertTriangle className="w-3.5 h-3.5 text-destructive shrink-0 mt-0.5" />
            <span className="text-muted-foreground">
              {muito
                ? <>Passou <b className="text-destructive">mais de 20%</b> do teto ({formatCurrency(TOLERANCIA)}). Nesse caso o desenquadramento do MEI volta a <b className="text-foreground">janeiro deste ano</b> e os impostos do Simples valem pro ano todo. Fala com um contador o quanto antes.</>
                : <>Passou do teto, mas dentro de 20% ({formatCurrency(TOLERANCIA)}). Você paga um DAS extra sobre o que passou e vira ME a partir de <b className="text-foreground">janeiro do ano que vem</b>. Vale falar com um contador.</>}
            </span>
          </div>
        ) : projecao > 0 && (
          <div className={`flex items-start gap-2 rounded-lg px-3 py-2 text-[11px] leading-relaxed ${projecao > LIMITE_MEI_ANO ? "bg-destructive/10 border border-destructive/30" : "bg-muted/40 border border-border/40"}`}>
            {projecao > LIMITE_MEI_ANO ? <AlertTriangle className="w-3.5 h-3.5 text-destructive shrink-0 mt-0.5" /> : <CheckCircle2 className="w-3.5 h-3.5 text-success shrink-0 mt-0.5" />}
            <span className="text-muted-foreground">
              No seu ritmo, você fecha o ano em <b className="text-foreground">{formatCurrency(projecao)}</b>.
              {projecao > LIMITE_MEI_ANO ? " Isso passa do limite do MEI: cuidado com o desenquadramento." : " Dentro do limite do MEI."}
            </span>
          </div>
        )}

        {f.meses.length > 0 && (
          <>
            <button type="button" onClick={() => setAberto((v) => !v)} className="w-full flex items-center justify-between text-xs font-semibold text-muted-foreground" aria-expanded={aberto}>
              Ver mês a mês <ChevronDown className={`w-4 h-4 transition-transform ${aberto ? "rotate-180" : ""}`} />
            </button>
            {aberto && (
              <div className="divide-y divide-border/50">
                {f.meses.map((m) => (
                  <div key={m.mes} className="py-2">
                    <div className="flex items-center gap-3">
                      <span className="w-9 text-xs font-bold uppercase text-muted-foreground">{nomeMes(m.mes)}</span>
                      <span className="flex-1 text-sm font-bold tabular-nums">{formatCurrency(m.total)}</span>
                      <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border ${m.fonte === "banco" ? "border-success/40 text-success" : "border-border text-muted-foreground"}`}>{m.fonte === "banco" ? "banco" : "lançado"}</span>
                    </div>
                    <p className="pl-12 text-[10.5px] text-muted-foreground tabular-nums">
                      lançou {formatCurrency(m.dinheiro + m.lancado)} · banco viu {formatCurrency(m.banco)}
                    </p>
                  </div>
                ))}
              </div>
            )}
            <p className="text-[10.5px] text-muted-foreground leading-relaxed">
              Pix e cartão: vale o maior entre o que você lançou e o que entrou nas contas de trabalho{f.contas_venda.length ? ` (${f.contas_venda.join(", ")})` : ""}, sem contar transferência entre suas contas. Dinheiro vivo só você vê: entra pelo que você lança.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
