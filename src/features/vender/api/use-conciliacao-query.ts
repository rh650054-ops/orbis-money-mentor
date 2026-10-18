/* Sold × landed, per day, from one server function (vender_conciliacao).
   Until that migration is live it falls back to the two older functions. */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/shared/api";
import { carregarFezCaiu } from "@/components/conectar/fez-caiu";
import { carregarProHoje } from "./pro-hoje";
import { conciliacaoSchema, type Conciliacao, type DiaConc } from "../types";
import { conciliacaoKey } from "./keys";

type Rpc = (f: string, a?: object) => PromiseLike<{ data: unknown; error: unknown }>;
const hojeBR = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });

async function legado(): Promise<Conciliacao> {
  const [linhas, ph] = await Promise.all([carregarFezCaiu(7), carregarProHoje()]);
  const dias: DiaConc[] = linhas.map((d) => ({ ...d, depois: 0, pessoal: 0, qtd: 0 }));
  if (ph && ph.lancou > 0) {
    const d = dias.find((x) => x.dia === ph.dia);
    if (d) d.fez = Math.max(d.fez, ph.lancou);
    else dias.unshift({ dia: ph.dia, fez: ph.lancou, dinheiro: 0, caiu: ph.caiu, depois: 0, pessoal: 0, qtd: ph.qtd, conferido: false });
  }
  return { hoje: hojeBR(), tem_banco: dias.some((d) => d.caiu !== null), ultima_leitura: ph?.ultima_leitura ?? null, dias };
}

export async function carregarConciliacao(): Promise<Conciliacao> {
  const { data, error } = await (supabase.rpc as unknown as Rpc)("vender_conciliacao", { p_dias: 7 });
  if (error || !data) return legado();
  return conciliacaoSchema.parse(data);
}

export function useConciliacaoQuery(userId: string | undefined, ativo: boolean) {
  return useQuery({
    queryKey: conciliacaoKey(userId ?? ""),
    enabled: !!userId && ativo,
    queryFn: carregarConciliacao,
    refetchInterval: 5 * 60_000,
    // exception to the app default: the vendor comes back from the bank's tab
    refetchOnWindowFocus: true,
  });
}
