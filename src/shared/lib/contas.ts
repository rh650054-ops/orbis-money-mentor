/* Next effective due date of a bill, the SAME rule the Financeiro uses (Rick, 01/11/2026:
   "paguei tudo certinho e anotei" — the weather screen read `paid` + raw `due_date` and
   called October's paid Luz/Água/Aluguel "vence hoje" since September).
   Recurring: the registered date is fixed, only its day-of-month matters; each month paid
   is stamped in `paid_cycle` ("YYYY-MM"). One-off: `due_date` itself, until `paid`. */
export interface ContaLinha {
  name: string; amount: number | string | null; due_date: string | null; paid: boolean | null;
  recurring?: boolean | null; paid_cycle?: string | null; duration_months?: number | null; cycles_paid?: number | null;
}

const iso = (y: number, m: number, d: number) => `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

/** "YYYY-MM-DD" of the next due date, or null when the bill is settled / has no date. */
export function proximoVencimento(b: ContaLinha, hoje: string): string | null {
  if (!b.due_date) return null;
  if (!b.recurring) return b.paid ? null : b.due_date;
  if (b.duration_months != null && (b.cycles_paid ?? 0) >= b.duration_months) return null; // all installments paid
  if (b.due_date > hoje) return b.due_date; // first due date still ahead
  const dia = Number(b.due_date.slice(8, 10));
  let ano = Number(hoje.slice(0, 4)), mes = Number(hoje.slice(5, 7)) - 1;
  if (b.paid_cycle === hoje.slice(0, 7)) { mes += 1; if (mes > 11) { mes = 0; ano += 1; } } // this month paid → next
  const ultimo = new Date(Date.UTC(ano, mes + 1, 0)).getUTCDate();
  return iso(ano, mes, Math.min(dia, ultimo));
}

/** Days from today to the next due date (negative = overdue), or null when settled. */
export function diasParaVencer(b: ContaLinha, hoje: string): number | null {
  const v = proximoVencimento(b, hoje);
  if (!v) return null;
  return Math.round((Date.UTC(+v.slice(0, 4), +v.slice(5, 7) - 1, +v.slice(8, 10)) - Date.UTC(+hoje.slice(0, 4), +hoje.slice(5, 7) - 1, +hoje.slice(8, 10))) / 86400000);
}

/** Bills still open within [-atrasoMax, +janela] days, soonest first. */
export function contasAbertas<T extends ContaLinha>(bills: T[], hoje: string, janela = 7, atrasoMax = 3): (T & { dias: number })[] {
  return bills
    .map((b) => ({ b, dias: diasParaVencer(b, hoje) }))
    .filter((x): x is { b: T; dias: number } => x.dias != null && x.dias >= -atrasoMax && x.dias <= janela)
    .sort((a, z) => a.dias - z.dias)
    .map(({ b, dias }) => ({ ...b, dias }));
}
