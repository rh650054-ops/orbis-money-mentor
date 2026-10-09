/* ============================================================
   CONFERIDO PELO BANCO — relatório (Mohamed, 09/10/2026).
   Quem é Pro e ligou o banco vê, dia a dia, o que lançou × o que caiu na conta
   (Pix + maquininha das contas de trabalho) × o que faltou cair. O relatório
   continua com o valor lançado; o RANKING usa o que caiu (nunca mais que o
   lançado). Vale desde o 1º dia que o histórico do banco cobre, então aparece
   sozinho assim que o banco é ligado. Sem banco → não renderiza nada.
   ============================================================ */
import { useQuery } from "@tanstack/react-query";
import { Landmark } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/shared/lib/utils";

export interface DiaConferido {
  dia: string; lancou: number; pix_cartao: number; dinheiro: number; caiu: number; maquininha: number; conta_ranking: number; faltou: number;
}

const n = (v: unknown) => Number(v) || 0;
const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

async function carregar(de: string, ate: string): Promise<DiaConferido[]> {
  const { data, error } = await (supabase as unknown as { rpc: (f: string, a: object) => Promise<{ data: unknown; error: unknown }> })
    .rpc("banco_conferencia", { p_de: de, p_ate: ate });
  if (error) throw error;
  return ((data as Record<string, unknown>[]) || []).map((r) => ({
    dia: String(r.dia), lancou: n(r.lancou), pix_cartao: n(r.pix_cartao), dinheiro: n(r.dinheiro), caiu: n(r.caiu),
    maquininha: n(r.maquininha), conta_ranking: n(r.conta_ranking), faltou: n(r.faltou),
  }));
}

export function ConferenciaBanco({ de, ate }: { de: string; ate: string }) {
  const { data: dias = [] } = useQuery({
    queryKey: ["relatorio", "banco-conferencia", de, ate],
    queryFn: () => carregar(de, ate),
    staleTime: 30_000, retry: 1, refetchOnWindowFocus: false,
  });
  if (dias.length === 0) return null;
  const tot = dias.reduce((t, d) => ({ lancou: t.lancou + d.lancou, caiu: t.caiu + d.caiu, ranking: t.ranking + d.conta_ranking, faltou: t.faltou + d.faltou }),
    { lancou: 0, caiu: 0, ranking: 0, faltou: 0 });
  return (
    <section className="orbis-card-in rounded-2xl border border-border/60 bg-card overflow-hidden">
      <div className="flex items-center gap-2.5 px-4 pt-3.5 pb-2.5">
        <Landmark className="w-[18px] h-[18px] shrink-0" style={{ color: "#8cc2ff" }} />
        <span className="flex-1 text-sm font-bold">Conferido pelo banco</span>
        <span className="text-xs text-muted-foreground">vai pro ranking <b className="text-foreground tabular-nums">{formatCurrency(tot.ranking)}</b></span>
      </div>
      <div className="grid grid-cols-3 border-t border-border/60 text-center">
        <Num rotulo="Lançou" valor={tot.lancou} />
        <Num rotulo="Caiu no banco" valor={tot.caiu} cor="var(--orbis-ok,#3DD68C)" />
        <Num rotulo="Faltou cair" valor={tot.faltou} cor={tot.faltou > 0 ? "var(--orbis-calote,#FF5C5C)" : undefined} />
      </div>
      <div className="border-t border-border/60 divide-y divide-border/60">
        {dias.map((d) => (
          <div key={d.dia} className="flex items-center gap-3 px-4 h-11 text-[13px] tabular-nums">
            <span className="w-11 font-bold text-muted-foreground">{ddmm(d.dia)}</span>
            <span className="flex-1 truncate">{formatCurrency(d.lancou)} <span className="text-muted-foreground">→ caiu</span> <b style={{ color: "var(--orbis-ok,#3DD68C)" }}>{formatCurrency(d.caiu)}</b></span>
            <span className="font-bold" style={{ color: d.faltou > 0 ? "var(--orbis-calote,#FF5C5C)" : "hsl(var(--muted-foreground))" }}>
              {d.faltou > 0 ? `−${formatCurrency(d.faltou)}` : "ok"}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

function Num({ rotulo, valor, cor }: { rotulo: string; valor: number; cor?: string }) {
  return (
    <div className="px-2 py-3">
      <p className="text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">{rotulo}</p>
      <p className="text-[15px] font-extrabold tabular-nums mt-0.5" style={cor ? { color: cor } : undefined}>{formatCurrency(valor)}</p>
    </div>
  );
}
