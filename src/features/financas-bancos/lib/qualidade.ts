/* Is the consolidated balance complete and recent? Read from what the screen already has (each
   account's balance from financas_home and its connection's status and last read, judged by the
   Vender screen's statusDoBanco rule). It changes no number: it only says when the total is
   partial or carries an old balance, so a partial sum is never shown as the whole money. */
import { statusDoBanco } from "@/features/vender";
import type { LinhaConta } from "./contas";

export interface Qualidade {
  /** accounts whose balance the bank did not send (left out of the total) */
  semSaldo: number;
  /** accounts whose balance IS in the total but is not recent (connection not ATIVO) */
  antigas: number;
  /** of those, how many are disconnected (waiting for the person to authorise again) */
  desconectadas: number;
  /** last read of the oldest balance that is in the total, when it is not recent */
  desde: string | null;
  completo: boolean;
}

export function qualidade(linhas: LinhaConta[], agora = Date.now()): Qualidade {
  let semSaldo = 0, antigas = 0, desconectadas = 0;
  let desde: string | null = null;
  for (const l of linhas) {
    if (l.saldo == null) { semSaldo++; continue; }
    const st = l.conexao ? statusDoBanco(l.conexao.status, l.conexao.last_synced_at, agora) : null;
    if (st?.rotulo === "ATIVO") continue;
    antigas++;
    if (st?.autorizar) desconectadas++;
    const lida = l.conexao?.last_synced_at ?? null;
    if (lida && (!desde || lida < desde)) desde = lida;
  }
  return { semSaldo, antigas, desconectadas, desde, completo: semSaldo === 0 && antigas === 0 };
}

/** The same bank connected more than once (a second account, or a copy after reconnecting). */
export function bancosRepetidos(linhas: LinhaConta[]): Set<string> {
  const vistos = new Map<string, number>();
  for (const l of linhas) {
    const k = l.banco.trim().toLowerCase();
    vistos.set(k, (vistos.get(k) ?? 0) + 1);
  }
  return new Set([...vistos].filter(([, n]) => n > 1).map(([k]) => k));
}

const dia = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" });

/** The warning lines under the total. Empty when the total is complete and recent. */
export function avisosDoSaldo(q: Qualidade): string[] {
  const s = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;
  const out: string[] = [];
  if (q.semSaldo > 0) out.push(`Sem o saldo de ${s(q.semSaldo, "banco", "bancos")}: não entra no total`);
  if (q.antigas > 0) {
    const quem = q.desconectadas === q.antigas ? (q.antigas === 1 ? "desconectado" : "desconectados") : "sem leitura recente";
    out.push(`${s(q.antigas, "banco", "bancos")} ${quem}${q.desde ? `: saldo de ${dia(q.desde)}` : ""}`);
  }
  return out;
}
