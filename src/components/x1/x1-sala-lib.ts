/* ============================================================
   SALA DE COMPETIÇÃO (X1 em grupo) — Rick + Mohamed, 02/10/2026.
   Tipos e chamadas ao banco. Tudo em RPC (Supabase).
   SÓ PONTOS (14/10/2026): sala não tem aposta, pote nem prêmio em dinheiro.
   Regras (iguais às do banco — x1_sala_settle_due):
     • 2 a 8 lutadores; vale a colocação (quem vende mais no dia)
     • empate numa colocação divide a posição
     • entra até 18h; menos de 2 à meia-noite cancela
   Lib única da Sala (A + B unificadas em 02/10/2026 — a antiga sala-lib.ts
   da versão B foi absorvida aqui). O placar são as vendas do DEFCON do dia.
   ============================================================ */
import { supabase } from "@/integrations/supabase/client";
import { erroBonito } from "./x1-lib";

export const SALA_VAGAS = [2, 3, 4, 5, 6, 8];
export const SALA_HORA_ENTRADA = 18;
export const SALA_HORA_SAIDA = 12;

/** Hora atual em Brasília (0..23). O banco usa a mesma régua (x1_sala_agora_brt). */
export const horaBRT = () => new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" })).getHours();
/** Ainda dá pra abrir sala / entrar numa sala hoje (até 18h). */
export const aindaEntra = () => horaBRT() < SALA_HORA_ENTRADA;
/** Ainda dá pra sair sem perder a vaga do dia (até 12h). */
export const aindaSai = () => horaBRT() < SALA_HORA_SAIDA;

export interface SalaResumo {
  id: string; dono: string; nome: string; vagas: number; status: string; created_at: string;
  dentro: number; meu_status: "dentro" | "convidado" | "saiu" | "recusou" | null; convidado_por_nome: string | null;
  dono_nome: string; dono_avatar: string | null; lider_id: string | null; lider_nome: string | null; lider_total: number;
  minha_posicao: number | null; meu_total: number | null; rostos: { nome: string; avatar: string | null }[];
}

export interface SalaLutador {
  user_id: string; status: "dentro" | "convidado" | "saiu" | "recusou"; nome: string; avatar: string | null; patente: string;
  total: number; posicao: number | null; convidado_por: string | null;
}
export interface Sala {
  id: string; dono: string; nome: string; scheduled_date: string; vagas: number; status: string;
  result_notes: string | null; created_at: string; lutadores: SalaLutador[];
}

const num = (v: unknown) => Number(v) || 0;

export async function carregarSalasHoje(): Promise<SalaResumo[]> {
  const { data, error } = await (supabase as any).rpc("x1_salas_hoje");
  if (error) throw new Error(erroBonito(error.message));
  return ((data as any[]) || []).map((s) => ({
    ...s, vagas: num(s.vagas), dentro: num(s.dentro), lider_total: num(s.lider_total),
    meu_total: s.meu_total == null ? null : num(s.meu_total), minha_posicao: s.minha_posicao == null ? null : num(s.minha_posicao),
    rostos: Array.isArray(s.rostos) ? s.rostos : [],
  })) as SalaResumo[];
}

export async function carregarSala(id: string): Promise<Sala | null> {
  const { data, error } = await (supabase as any).rpc("x1_sala", { p_id: id });
  // erro de rede/permissão vira mensagem; "não existe" é só quando o banco não devolve linha
  if (error) throw new Error(erroBonito(error.message));
  const rows = (data as any[]) || [];
  if (rows.length === 0) return null;
  const r0 = rows[0];
  const lutadores: SalaLutador[] = rows.map((r) => ({
    user_id: r.user_id, status: r.p_status, nome: r.p_nome || "Vendedor", avatar: r.p_avatar || null, patente: r.p_patente || "NOVATO",
    total: num(r.p_total), posicao: r.p_posicao == null ? null : num(r.p_posicao), convidado_por: r.convidado_por || null,
  }));
  return {
    id: r0.id, dono: r0.dono, nome: r0.nome, scheduled_date: r0.scheduled_date, vagas: num(r0.vagas),
    status: r0.status, result_notes: r0.result_notes, created_at: r0.created_at, lutadores,
  };
}

export async function carregarGolpesSala(id: string): Promise<{ user_id: string; amount: number; created_at: string }[]> {
  const { data } = await (supabase as any).rpc("x1_sala_golpes", { p_id: id });
  return ((data as any[]) || []).map((g) => ({ ...g, amount: num(g.amount) }));
}

async function chamar<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await (supabase as any).rpc(fn, args);
  if (error) throw new Error(erroBonito(error.message));
  return data as T;
}
/** Abre a sala. Sempre sem aposta: o servidor também recusa qualquer valor. */
export const criarSala = (o: { nome: string; vagas: number; convidados: string[] }) =>
  chamar<string>("x1_sala_criar", { p_nome: o.nome, p_stakes: 0, p_vagas: o.vagas, p_convidados: o.convidados });
export const entrarSala = (id: string) => chamar<null>("x1_sala_entrar", { p_id: id });
export const sairSala = (id: string) => chamar<null>("x1_sala_sair", { p_id: id });
export const convidarSala = (id: string, ids: string[]) => chamar<number>("x1_sala_convidar", { p_id: id, p_convidados: ids });

/** Colocação: ordena por total e dá a mesma posição pra empate (igual ao rank() do banco).
 *  Sala fechada: vale a posição gravada pelo banco (p_posicao), que é a oficial. */
export function ordenarPlacar(lutadores: SalaLutador[]): (SalaLutador & { pos: number })[] {
  const dentro = lutadores.filter((l) => l.status === "dentro").sort((a, b) => b.total - a.total);
  let pos = 0, ultimo = Number.NaN;
  return dentro.map((l, i) => { if (l.total !== ultimo) { pos = i + 1; ultimo = l.total; } return { ...l, pos: l.posicao ?? pos }; });
}

export const linkSala = (id: string) => `${typeof window !== "undefined" ? window.location.origin : "https://app.orbis.inf.br"}/x1/sala/${id}`;
