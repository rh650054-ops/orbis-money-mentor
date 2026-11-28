/* THE definition of "saldo disponível" of Finanças (28/11, Rick), used by the Resumo AND the
   Bancos tabs. It changes no number and creates no source: it splits the per-account balances that
   financas_home() already returns by the state of each connection, judged by the existing rule
   (statusDoBanco: ATIVO = good status and a read in the last 26 h):

     recent       → "saldo disponível com leitura recente"
     unconfirmed  → "último saldo conhecido, sem confirmação recente" (disconnected, old read)
     unavailable  → the bank sent no balance (never counted as zero)

   Negative balances stay negative. Credit limits are never here (bank_saldos holds only BANK
   accounts; cards live in bank_cartoes). Fôlego and alerts still read financas_home() as before. */
import type { HomeFinancas } from "@/components/financas/FinancasHome";
import type { BancoLigado } from "@/components/conectar/pluggy";
import { statusDoBanco } from "@/features/vender";
import { agrupar, type LinhaConta } from "./contas";

export type EstadoSaldo = "recente" | "sem_confirmacao" | "indisponivel";
export type Papel = "trabalho" | "pessoal" | "sem";
export interface ContaNoSaldo extends LinhaConta { estado: EstadoSaldo; papel: Papel; desconectada: boolean }
export interface Parte { recente: number | null; semConfirmacao: number | null; contas: number }

export interface Consolidado {
  /** false while the connections (status, last read) are not known: claim nothing yet */
  conferido: boolean;
  contas: ContaNoSaldo[];
  /** sum of the recent balances; null = no account has a recent balance (NOT zero) */
  recente: number | null;
  /** sum of the last known balances without a recent read; null = none */
  semConfirmacao: number | null;
  qtdSemConfirmacao: number;
  qtdDesconectadas: number;
  qtdIndisponiveis: number;
  /** oldest read among the unconfirmed balances */
  desde: string | null;
  /** newest read among the recent balances */
  atualizado: string | null;
  /** something is missing or unconfirmed: the recent sum is not the whole money */
  parcial: boolean;
  partes: Record<Papel, Parte>;
}

const somar = (a: number | null, v: number) => (a ?? 0) + v;

export function consolidar(h: HomeFinancas, conexoes: BancoLigado[] | null, agora = Date.now()): Consolidado {
  const g = agrupar(h, conexoes ?? []);
  const partes: Record<Papel, Parte> = {
    trabalho: { recente: null, semConfirmacao: null, contas: 0 },
    pessoal: { recente: null, semConfirmacao: null, contas: 0 },
    sem: { recente: null, semConfirmacao: null, contas: 0 },
  };
  const c: Consolidado = { conferido: conexoes !== null, contas: [], recente: null, semConfirmacao: null, qtdSemConfirmacao: 0,
    qtdDesconectadas: 0, qtdIndisponiveis: 0, desde: null, atualizado: null, parcial: false, partes };
  const lista: [Papel, LinhaConta[]][] = [["trabalho", g.trabalho], ["pessoal", g.pessoal], ["sem", g.semPapel]];
  for (const [papel, linhas] of lista) for (const l of linhas) {
    const st = l.conexao ? statusDoBanco(l.conexao.status, l.conexao.last_synced_at, agora) : null;
    const lida = l.conexao?.last_synced_at ?? null;
    const estado: EstadoSaldo = l.saldo == null ? "indisponivel" : st?.rotulo === "ATIVO" ? "recente" : "sem_confirmacao";
    const desconectada = !!st?.autorizar;
    c.contas.push({ ...l, estado, papel, desconectada });
    partes[papel].contas++;
    if (estado === "indisponivel") { c.qtdIndisponiveis++; continue; }
    if (estado === "recente") {
      c.recente = somar(c.recente, l.saldo ?? 0);
      partes[papel].recente = somar(partes[papel].recente, l.saldo ?? 0);
      if (lida && (!c.atualizado || lida > c.atualizado)) c.atualizado = lida;
    } else {
      c.semConfirmacao = somar(c.semConfirmacao, l.saldo ?? 0);
      partes[papel].semConfirmacao = somar(partes[papel].semConfirmacao, l.saldo ?? 0);
      c.qtdSemConfirmacao++;
      if (desconectada) c.qtdDesconectadas++;
      if (lida && (!c.desde || lida < c.desde)) c.desde = lida;
    }
  }
  c.parcial = c.qtdSemConfirmacao > 0 || c.qtdIndisponiveis > 0;
  return c;
}

/** Work × personal × unclassified shares of the RECENT money, or null when a bar would mislead
    (nothing recent, or a negative side). */
export function distribuicao(c: Consolidado): Record<Papel, number> | null {
  const v = (p: Papel) => c.partes[p].recente;
  const lados: Papel[] = ["trabalho", "pessoal", "sem"];
  if (lados.some((p) => (v(p) ?? 0) < 0)) return null;
  const total = lados.reduce((s, p) => s + (v(p) ?? 0), 0);
  if (total <= 0 || lados.filter((p) => (v(p) ?? 0) > 0).length < 2) return null;
  const pct = Object.fromEntries(lados.map((p) => [p, Math.round(((v(p) ?? 0) / total) * 100)])) as Record<Papel, number>;
  return pct;
}

export const diaCurto = (iso: string) =>
  new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" });

/** The same bank connected more than once. A fact, never a claim of duplication. */
export function bancosRepetidos(linhas: { banco: string }[]): Set<string> {
  const vistos = new Map<string, number>();
  for (const l of linhas) vistos.set(l.banco.trim().toLowerCase(), (vistos.get(l.banco.trim().toLowerCase()) ?? 0) + 1);
  return new Set([...vistos].filter(([, n]) => n > 1).map(([k]) => k));
}
