/* ============================================================
   RAIO-X — inteligência entre contas (01/10/2026).

   Perguntas que a Vant faz quando tem dúvida, lançamento manual (gasto que não
   está em nenhum extrato) e marcar uma conta como "de vendas" ou "pessoal".
   Toda escrita passa por RPCs que conferem o dono (auth.uid()) no banco.
   ============================================================ */
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { avisar } from "@/shared/lib/avisar";

export interface RaioXOpcao { v: string; r: string; min?: number }
export interface RaioXPergunta {
  id: string;
  motivo: "conta_sua" | "pessoa" | "inconsistente" | "recorrente" | "nao_sei" | "lancamento";
  nome: string | null; qtd: number; total: number; meses: number;
  dados: { min?: number; max?: number; media?: number; data?: string; banco?: string | null; categorias?: string[] };
  opcoes: RaioXOpcao[];
}

export interface LancamentoManual {
  data: string; valor: number; tipo: "saida" | "entrada"; descricao: string; categoria: string; banco: string | null;
}

// RPCs novos ainda não estão nos tipos gerados do Supabase.
type Rpc = (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
const rpc: Rpc = (fn, args) => (supabase as unknown as { rpc: Rpc }).rpc(fn, args);

const n = (v: unknown) => Number(v) || 0;

/** Perguntas abertas (as maiores primeiro). */
export function useRaioXPerguntas(userId: string | undefined) {
  const [perguntas, setPerguntas] = useState<RaioXPergunta[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!userId) { setLoading(false); return; }
    try {
      const { data, error } = await (supabase as any).from("extrato_perguntas")
        .select("id, motivo, nome, qtd, total, meses, dados, opcoes")
        .eq("status", "aberta").order("total", { ascending: false });
      if (error) throw error;
      setPerguntas(((data ?? []) as any[]).map((p) => ({
        ...p, qtd: n(p.qtd), total: n(p.total), meses: n(p.meses),
        dados: p.dados ?? {}, opcoes: Array.isArray(p.opcoes) ? p.opcoes : [],
      })));
    } catch (e) { avisar.erro("RaioX: perguntas", e); }
    setLoading(false);
  }, [userId]);
  useEffect(() => { reload(); }, [reload]);

  /** Responde (ou pula com "__ignorar"). Devolve quantos lançamentos mudaram, ou null se falhou. */
  const responder = useCallback(async (id: string, resposta: string, valorMin?: number): Promise<number | null> => {
    try {
      const { data, error } = await rpc("extrato_responder", { p_id: id, p_resposta: resposta, p_valor_min: valorMin ?? null });
      if (error) throw error;
      setPerguntas((prev) => prev.filter((p) => p.id !== id));
      return n(data);
    } catch (e) { avisar.erro("RaioX: responder", e); return null; }
  }, []);

  return { perguntas, loading, reload, responder };
}

export async function lancarManual(l: LancamentoManual): Promise<{ ok: boolean; erro?: string }> {
  try {
    const { error } = await rpc("extrato_lancar_manual", {
      p_data: l.data, p_valor: l.valor, p_tipo: l.tipo, p_descricao: l.descricao, p_categoria: l.categoria, p_banco: l.banco,
    });
    if (error) throw error;
    return { ok: true };
  } catch (e) {
    avisar.erro("RaioX: lançar manual", e);
    const msg = String((e as { message?: string })?.message ?? "");
    return { ok: false, erro: /data/.test(msg) ? "Data fora do período." : /limite/.test(msg) ? "Muitos lançamentos hoje. Tenta amanhã." : "Não consegui salvar. Tenta de novo." };
  }
}

export async function apagarManual(id: string): Promise<boolean> {
  try {
    const { data, error } = await rpc("extrato_apagar_manual", { p_id: id });
    if (error) throw error;
    return Boolean(data);
  } catch (e) { avisar.erro("RaioX: apagar manual", e); return false; }
}

export async function marcarContaUso(banco: string, uso: "vendas" | "pessoal"): Promise<boolean> {
  try {
    const { error } = await rpc("extrato_conta_uso", { p_banco: banco, p_uso: uso });
    if (error) throw error;
    return true;
  } catch (e) { avisar.erro("RaioX: uso da conta", e); return false; }
}
