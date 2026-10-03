/* ============================================================
   X1 · LOTE 5 (03/10/2026) — dados e regras puras.
   Tô na pista · Disponíveis agora · Cinturão da cidade · Torcida certeira ·
   Provocação pronta. Tudo vem de RPCs do banco (sem API externa).
   ============================================================ */
import { supabase } from "@/integrations/supabase/client";
import { avisar } from "@/shared/lib/avisar";

type Rpc = (f: string, a?: object) => Promise<{ data: unknown; error: { message: string } | null }>;
const rpc: Rpc = (f, a) => (supabase as unknown as { rpc: Rpc }).rpc(f, a);

export const FRASES = ["Vai desistir? 😏", "Tô só esquentando", "Isso é tudo?", "Revanche amanhã", "Respeito 🤝"] as const;
export const MAX_PROVOCACOES = 3;

export interface Pista { ligado: boolean; no_defcon: boolean; na_pista: number; te_veem: number }
export interface Disponivel {
  user_id: string; nome: string; avatar_url: string | null; cidade: string | null; vendido_hoje: number;
  na_pista: boolean; no_defcon: boolean; patente: string | null; vitorias: number; posicao: number | null;
}
export interface Campeao { user_id: string; nome: string; avatar_url: string | null; dias: number; defesas: number; vitorias: number; patente: string | null; sou_eu: boolean }
export interface LinhaCinturao { em: string; tipo: "conquistou" | "tomou" | "defendeu"; nome: string; de_nome: string | null }
export interface Cinturao { cidade: string | null; uf: string | null; campeao: Campeao | null; linha: LinhaCinturao[] }
export interface Provocacao { id: number; user_id: string; nome: string; avatar_url: string | null; frase: string; criado_em: string; minha: boolean }

export async function carregarPista(): Promise<Pista | null> {
  const { data, error } = await rpc("x1_minha_pista");
  if (error) { avisar.silencioso("x1_minha_pista", error); return null; }
  return (data as Pista) ?? null;
}

export async function ligarPista(on: boolean): Promise<Pista | null> {
  const { data, error } = await rpc("x1_pista_ligar", { p_on: on });
  if (error) { avisar.silencioso("x1_pista_ligar", error); return null; }
  return (data as Pista) ?? null;
}

export async function carregarDisponiveis(): Promise<Disponivel[]> {
  const { data, error } = await rpc("x1_disponiveis");
  if (error) { avisar.silencioso("x1_disponiveis", error); return []; }
  return ((data as Disponivel[]) || []).map((d) => ({ ...d, vendido_hoje: Number(d.vendido_hoje) || 0, vitorias: Number(d.vitorias) || 0 }));
}

export async function carregarCinturao(): Promise<Cinturao | null> {
  const { data, error } = await rpc("x1_cinturao_cidade");
  if (error) { avisar.silencioso("x1_cinturao_cidade", error); return null; }
  const c = data as Cinturao | null;
  return c ? { ...c, linha: c.linha ?? [] } : null;
}

export async function carregarPalpites(): Promise<{ acertos: number; total: number }> {
  const { data } = await rpc("x1_palpites");
  const r = ((data as Array<{ acertos: number; total: number }>) || [])[0];
  return { acertos: Number(r?.acertos) || 0, total: Number(r?.total) || 0 };
}

export async function carregarProvocacoes(id: string): Promise<Provocacao[]> {
  const { data, error } = await rpc("x1_provocacoes_da_luta", { p_id: id });
  if (error) { avisar.silencioso("x1_provocacoes_da_luta", error); return []; }
  return (data as Provocacao[]) || [];
}

export async function provocar(id: string, frase: string): Promise<string | null> {
  const { error } = await rpc("x1_provocar", { p_id: id, p_frase: frase });
  return error ? error.message : null;
}

/** "Vence ele no dia → o cinturão é seu" / defesas / como pegar. */
export function chamadaCinturao(c: Cinturao | null): string {
  if (!c?.campeao) return "Ninguém tem o cinturão da sua cidade ainda. O primeiro X1 que você vencer, ele é seu.";
  if (c.campeao.sou_eu) return c.campeao.defesas > 0
    ? `Você defendeu ${c.campeao.defesas} ${c.campeao.defesas === 1 ? "vez" : "vezes"}. Quem te vencer leva o cinturão.`
    : "O cinturão é seu. Quem da cidade te vencer, leva.";
  return "Vence ele no dia e o cinturão é seu.";
}

/** Quantas provocações eu ainda posso mandar nesta luta. */
export function provocacoesRestantes(lista: Provocacao[]): number {
  return Math.max(0, MAX_PROVOCACOES - lista.filter((p) => p.minha).length);
}
