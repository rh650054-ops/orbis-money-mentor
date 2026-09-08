/* ============================================================
   ARENA X1 — pedaços compartilhados (helpers + tipos + chamadas ao banco).
   Regra do Rick: SEM API externa. Tudo aqui é Supabase (RPC/tabelas).
   ============================================================ */
import { supabase } from "@/integrations/supabase/client";
import { fotoValida } from "@/shared/lib/avatar";
import { getBrazilDate } from "@/shared/lib/date-utils";

export const fmt = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v || 0);
export const primeiroNome = (n: string | null | undefined) => (n || "Vendedor").trim().split(/\s+/)[0] || "Vendedor";
export const iniciais = (n: string | null | undefined) => {
  const p = (n || "?").trim().split(/\s+/).filter(Boolean);
  return ((p[0]?.[0] || "?") + (p[1]?.[0] || "")).toUpperCase();
};
export const foto = (url: string | null | undefined) => (fotoValida(url || "") ? (url as string) : null);

export interface Pessoa { user_id: string; nome: string; avatar_url: string | null }

export interface Recorde {
  vitorias: number; derrotas: number; empates: number; sequencia: number;
  patente: string; nivel: number; aposta_max: number; proxima: number | null; duelos: number;
  /** XP: vitória = 10 pts, missão da semana = 2 pts. Patente sobe por pontos. */
  pontos: number; pontos_proxima: number | null;
  /** média vendida por dia trabalhado (30 dias) */
  potencia: number;
}
export const RECORDE_VAZIO: Recorde = { vitorias: 0, derrotas: 0, empates: 0, sequencia: 0, patente: "NOVATO", nivel: 1, aposta_max: 0, proxima: 5, duelos: 0, pontos: 0, pontos_proxima: 50, potencia: 0 };
export const PONTOS_BASE: Record<string, number> = { NOVATO: 0, BRIGÃO: 50, DUELISTA: 100, CAMPEÃO: 250, LENDA: 500 };
export const proximaPatente = (p: string) => (p === "NOVATO" ? "BRIGÃO" : p === "BRIGÃO" ? "DUELISTA" : p === "DUELISTA" ? "CAMPEÃO" : p === "CAMPEÃO" ? "LENDA" : null);
/** 0..1 do progresso dentro da patente atual */
export const xpPct = (r: Recorde) => {
  if (r.pontos_proxima == null) return 1;
  const base = PONTOS_BASE[r.patente] ?? 0;
  return Math.max(0, Math.min(1, (r.pontos - base) / Math.max(1, r.pontos_proxima - base)));
};

export const PATENTES: { nome: string; min: number; aposta: string }[] = [
  { nome: "NOVATO", min: 0, aposta: "só honra" },
  { nome: "BRIGÃO", min: 50, aposta: "até R$ 50" },
  { nome: "DUELISTA", min: 100, aposta: "até R$ 100" },
  { nome: "CAMPEÃO", min: 250, aposta: "até R$ 200" },
  { nome: "LENDA", min: 500, aposta: "livre" },
];
/** "R$ 50 → volta 90": o que volta pro vencedor (aposta dos dois menos 10%) */
export const voltaPraVoce = (aposta: number) => Math.round(aposta * 2 * 0.9);
/** rodada do dia (6 rodadas de 3h a partir das 6h) */
export const rodadaAgora = () => {
  const h = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" })).getHours();
  return Math.max(1, Math.min(6, Math.floor((h - 6) / 3) + 1));
};
export const horaBR = (iso: string) => { try { return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }); } catch { return ""; } };
export const patenteCor = (nome: string) =>
  nome === "LENDA" ? "#B47CFF" : nome === "CAMPEÃO" ? "#F5B800" : nome === "DUELISTA" ? "#7FD3FF" : nome === "BRIGÃO" ? "#ff7a1a" : "#b3ab9c";

export interface Duelo {
  id: string; challenger_id: string; opponent_id: string | null; status: string;
  scheduled_date: string | null; stakes_amount: number; prize_amount: number;
  winner_user_id: string | null; last_proposed_by: string | null; tipo: string | null;
  expires_at: string | null; created_at: string; money_status: string | null;
}

export const amanhaBR = () => {
  const d = new Date(getBrazilDate() + "T12:00:00");
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
};
export const quandoTexto = (iso: string | null) => {
  if (!iso) return "a combinar";
  if (iso === getBrazilDate()) return "hoje";
  if (iso === amanhaBR()) return "amanhã";
  try { return new Date(iso + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }); } catch { return iso; }
};
export const expiraEm = (iso: string | null) => {
  if (!iso) return "";
  const h = Math.max(0, Math.round((new Date(iso).getTime() - Date.now()) / 3600000));
  return h <= 0 ? "expira já" : h < 1 ? "expira em minutos" : `expira em ${h}h`;
};
export const horasAteMeiaNoite = () => {
  const agora = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  return Math.max(0, 24 - agora.getHours() - (agora.getMinutes() > 0 ? 1 : 0));
};

/** Mensagem de erro do banco → frase pro vendedor (sem prefixo técnico). */
export const erroBonito = (msg: string | undefined) => {
  const m = msg || "não rolou";
  const i = m.indexOf(":");
  return i > 0 && i < 24 ? m.slice(i + 1).trim() : m;
};

export async function carregarRecorde(uid: string): Promise<Recorde> {
  const { data } = await (supabase as any).rpc("x1_recorde", { p_user: uid });
  const r = ((data as any[]) || [])[0];
  if (!r) return RECORDE_VAZIO;
  return {
    vitorias: Number(r.vitorias) || 0, derrotas: Number(r.derrotas) || 0, empates: Number(r.empates) || 0,
    sequencia: Number(r.sequencia) || 0, patente: String(r.patente || "NOVATO"), nivel: Number(r.nivel) || 1,
    aposta_max: Number(r.aposta_max) || 0, proxima: r.proxima == null ? null : Number(r.proxima), duelos: Number(r.duelos) || 0,
    pontos: Number(r.pontos) || 0, pontos_proxima: r.pontos_proxima == null ? null : Number(r.pontos_proxima), potencia: Number(r.potencia) || 0,
  };
}

export async function carregarPessoas(ids: string[]): Promise<Record<string, Pessoa>> {
  const uniq = Array.from(new Set(ids.filter(Boolean)));
  if (uniq.length === 0) return {};
  const { data } = await supabase.from("public_profiles").select("user_id, nickname, avatar_url").in("user_id", uniq);
  const out: Record<string, Pessoa> = {};
  for (const p of (data as any[]) || []) out[p.user_id] = { user_id: p.user_id, nome: p.nickname || "Vendedor", avatar_url: p.avatar_url || null };
  return out;
}

export async function carregarPessoa(uid: string): Promise<Pessoa> {
  const m = await carregarPessoas([uid]);
  return m[uid] || { user_id: uid, nome: "Vendedor", avatar_url: null };
}

export async function criarDuelo(opts: { oponente: string | null; data: string; aposta: number; tipo: "direto" | "aberto" }) {
  const { data, error } = await (supabase as any).rpc("x1_criar", {
    p_opponent: opts.oponente, p_date: opts.data, p_stakes: opts.aposta, p_tipo: opts.tipo,
  });
  if (error) throw new Error(erroBonito(error.message));
  return data as string;
}

/** Resultado de um duelo fechado, do ponto de vista de `uid`. */
export const resultadoDe = (d: Duelo, uid: string): "vitoria" | "derrota" | "empate" =>
  d.winner_user_id === uid ? "vitoria" : d.winner_user_id ? "derrota" : "empate";

export const chaveVisto = (id: string) => `orbis_x1_visto_${id}`;
