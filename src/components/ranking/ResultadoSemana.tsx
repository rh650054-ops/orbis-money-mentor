/* Result of the LAST closed week (Mon→Sun), under the official rule of 08/11/2026:
   closed Monday 06:00; "provisório" while something could still change the winner
   (bank not read, Pix under review, spike); "homologado" when the prize is confirmed.
   Reads premio_resultado(): status, winner and how many pendencias — no names of others. */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/shared/lib/utils";
import { semanaAnterior } from "@/hooks/useWeeklyLeaderboard";
import { PREMIO_SEMANA, rotuloSemana } from "./premiacao";

type Resultado = {
  status: "provisorio" | "homologado";
  pendencias: number;
  vencedor: { user_id: string; nome: string | null; valor: number; posicao: number } | null;
} | null;

type Rpc = (fn: string, args?: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
const rpc: Rpc = (fn, args) => (supabase as unknown as { rpc: Rpc }).rpc(fn, args);

export function ResultadoSemana({ hoje, meuId }: { hoje: string; meuId: string | undefined }) {
  const { inicio, fim } = semanaAnterior(hoje);
  const { data } = useQuery({
    queryKey: ["premio", "semana", inicio],
    queryFn: async () => {
      const { data, error } = await rpc("premio_resultado", { p_tipo: "semana", p_inicio: inicio });
      if (error) throw new Error(error.message);
      return (data ?? null) as Resultado;
    },
    staleTime: 60_000,
  });
  if (!data) return null;  // the week was not closed yet (or the closing is off)

  const provisorio = data.status === "provisorio";
  const v = data.vencedor;
  const eu = !!v && v.user_id === meuId;
  const cor = provisorio ? "#F5B800" : "#22c55e";
  return (
    <section aria-label="Resultado da semana anterior" className="rounded-[18px] px-4 py-3"
      style={{ border: `1px solid ${cor}55`, background: `${cor}12` }}>
      <p className="text-[10.5px] font-bold uppercase tracking-[.13em]" style={{ color: cor }}>
        {provisorio ? "Resultado provisório" : "Resultado homologado"} · {rotuloSemana(inicio, fim)}
      </p>
      {v ? (
        <p className="mt-1 text-[14px] font-bold text-foreground">
          {eu ? "Você" : v.nome || "Vendedor"} · {formatCurrency(Number(v.valor))}
          {!provisorio && <span style={{ color: cor }}> · leva R$ {PREMIO_SEMANA}</span>}
        </p>
      ) : (
        <p className="mt-1 text-[13px] text-muted-foreground">Nenhum vendedor verificado nesta semana.</p>
      )}
      <p className="mt-1 text-[12px] text-muted-foreground">
        {provisorio
          ? `Conferindo os bancos: ${data.pendencias} ${data.pendencias === 1 ? "pendência" : "pendências"} que ainda podem mudar o vencedor. O prêmio sai quando tudo bater.`
          : "Conferido no banco. Dinheiro em espécie não entra na disputa."}
      </p>
    </section>
  );
}
