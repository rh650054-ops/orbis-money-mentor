/* The accounts of the Bancos screen: the balance of financas_home() joined to the connection
   (logo, status, last read) by the connection id. Pure: no fetch, no calculation of balances. */
import type { HomeFinancas } from "@/components/financas/FinancasHome";
import type { BancoLigado } from "@/components/conectar/pluggy";

export interface LinhaConta {
  id: string;
  banco: string;
  /** null = the bank did not send a balance (shown as "indisponível", never as zero) */
  saldo: number | null;
  conexao: BancoLigado | null;
}
export interface Grupos { trabalho: LinhaConta[]; pessoal: LinhaConta[]; semPapel: LinhaConta[] }

/** Same rule as financas_home(): with ONE connection and no role, the account counts as work. */
export function agrupar(h: HomeFinancas, conexoes: BancoLigado[]): Grupos {
  const contas = h.contas ?? [];
  const porId = new Map(conexoes.map((c) => [c.id, c]));
  const g: Grupos = { trabalho: [], pessoal: [], semPapel: [] };
  for (const c of contas) {
    const linha: LinhaConta = { id: c.id, banco: c.banco ?? porId.get(c.id)?.institution_name ?? "Banco", saldo: c.saldo, conexao: porId.get(c.id) ?? null };
    const papel = c.papel ?? (contas.length === 1 ? "trabalho" : null);
    if (papel === "trabalho") g.trabalho.push(linha);
    else if (papel === "pessoal") g.pessoal.push(linha);
    else g.semPapel.push(linha);
  }
  return g;
}

/** Sum of the balances that exist; null when none of them came from the bank. */
export function totalDoGrupo(linhas: LinhaConta[]): number | null {
  const com = linhas.filter((l) => l.saldo != null);
  return com.length === 0 ? null : com.reduce((s, l) => s + (l.saldo ?? 0), 0);
}
