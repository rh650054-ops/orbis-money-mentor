// Vant — leitura DIÁRIA do banco (etapa 4 do Open Finance, 02/10/2026).
// Uma vez por dia, de madrugada (pluggy-dia): cartão de crédito, parcelas que
// ainda vêm, empréstimos, investimentos e cheque especial. O extrato da conta
// continua de hora em hora (pluggy-hora); estes mudam devagar e o Open Finance
// limita quantas leituras por dia cada produto aceita.
// Se o vendedor liberou só a conta na tela do banco, os outros endpoints voltam
// vazios ou 403 — tudo segue funcionando, a tela mostra "liga pra ver aqui".
// Nunca grava número de contrato, de conta ou de cartão.

const limpa = (s: unknown) =>
  String(s ?? "").replace(/\d[\d.\-\/]{3,}\d/g, "").replace(/\d{5,}/g, "").replace(/\s+/g, " ").trim().slice(0, 50);
/** "Mary Kay do Brasil 2/3" → "Mary Kay do Brasil" */
const semParcela = (s: unknown) => limpa(String(s ?? "").replace(/\s*\(?\d{1,2}\s*\/\s*\d{1,2}\)?\s*$/, ""));
const num = (v: unknown): number | null => {
  const n = typeof v === "object" && v !== null && "amount" in (v as Record<string, unknown>)
    ? Number((v as Record<string, unknown>).amount) : Number(v);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
};
const dia = (v: unknown): string | null => {
  const s = String(v ?? "");
  return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : null;
};

/** taxa ao mês a partir do que a Pluggy manda (ano → mês por juros compostos) */
// deno-lint-ignore no-explicit-any
function taxaMes(l: any): number | null {
  // deno-lint-ignore no-explicit-any
  const r: any = (l?.interestRates ?? [])[0];
  let t = Number(r?.preFixedRate ?? r?.postFixedRate ?? l?.CET ?? NaN);
  if (!Number.isFinite(t) || t <= 0) return null;
  if (t > 1) t = t / 100;                                   // veio em % (2.9) em vez de fração
  // periodicidade: "MONTH"/"MENSAL" ou "YEAR"/"ANUAL". O CET sozinho é sempre anual.
  const per = String(r?.taxPeriodicity ?? "").toUpperCase();
  const anual = per === "YEAR" || per.startsWith("A") || (!r && l?.CET != null);
  return Math.round((anual ? Math.pow(1 + t, 1 / 12) - 1 : t) * 10000) / 10000;
}

// deno-lint-ignore no-explicit-any
async function get(apiKey: string, url: string): Promise<{ ok: boolean; status: number; j: any }> {
  try {
    const r = await fetch(url, { headers: { "X-API-KEY": apiKey }, signal: AbortSignal.timeout(25000) });
    return { ok: r.ok, status: r.status, j: await r.json().catch(() => null) };
  } catch { return { ok: false, status: 0, j: null }; }
}

// deno-lint-ignore no-explicit-any
const chaves = (o: any) => (o && typeof o === "object" ? Object.keys(o).sort() : []);

export async function importarDia(
  // deno-lint-ignore no-explicit-any
  admin: any, apiKey: string, itemId: string, userId: string, conexaoId: string, banco: string | null,
) {
  const agora = new Date().toISOString();
  const res = { cartoes: 0, parcelas: 0, emprestimos: 0, investimentos: 0, cheque: 0,
    // deno-lint-ignore no-explicit-any
    campos: {} as Record<string, any> };

  // ---- contas: cartão (CREDIT) e cheque especial (BANK.bankData) ----
  const contas = await get(apiKey, `https://api.pluggy.ai/accounts?itemId=${encodeURIComponent(itemId)}`);
  // deno-lint-ignore no-explicit-any
  const lista: any[] = contas.j?.results ?? [];
  for (const c of lista) {
    const tipo = String(c?.type ?? "").toUpperCase();
    if (tipo === "BANK") {
      const bd = c?.bankData ?? {};
      res.campos.bankData = chaves(bd);
      const limite = num(bd?.overdraftContractedLimit);
      const usado = num(bd?.overdraftUsedLimit ?? bd?.unarrangedOverdraftAmount);
      if (limite != null || usado != null) {
        await admin.from("bank_saldos").update({ cheque_limite: limite, cheque_usado: usado }).eq("conta_id", String(c.id));
        res.cheque++;
      }
    }
    if (tipo !== "CREDIT") continue;
    const cd = c?.creditData ?? {};
    res.campos.creditData = chaves(cd);
    const { error } = await admin.from("bank_cartoes").upsert({
      conta_id: String(c.id), user_id: userId, bank_connection_id: conexaoId, banco,
      nome: limpa(c?.marketingName ?? c?.name ?? cd?.brand ?? "Cartão") || "Cartão",
      fatura: num(c?.balance), limite: num(cd?.creditLimit), disponivel: num(cd?.availableCreditLimit),
      vence: dia(cd?.balanceDueDate), fecha: dia(cd?.balanceCloseDate), minimo: num(cd?.minimumPayment),
      atualizado_em: agora,
    }, { onConflict: "conta_id" });
    if (error) { console.error("dia: cartao", error.message); continue; }
    res.cartoes++;

    // parcelas: compras parceladas dos últimos 12 meses que ainda têm parcela por vir
    const de = new Date(Date.now() - 365 * 86_400_000).toISOString().slice(0, 10);
    const limiteFuturo = new Date(Date.now() + 35 * 86_400_000).toISOString().slice(0, 10);
    // deno-lint-ignore no-explicit-any
    const vistas = new Map<string, any>();   // uma linha por compra: a parcela mais recente
    let cursor: string | null = null;
    for (let pag = 0; pag < 10; pag++) {
      const tx = await get(apiKey, `https://api.pluggy.ai/v2/transactions?accountId=${encodeURIComponent(c.id)}&dateFrom=${de}` +
        (cursor ? `&after=${encodeURIComponent(cursor)}` : ""));
      if (!tx.ok) break;
      for (const t of (tx.j?.results ?? [])) {
        const m = t?.creditCardMetadata;
        const atual = Number(m?.installmentNumber), total = Number(m?.totalInstallments);
        if (!(total > 1 && atual >= 1)) continue;
        res.campos.creditCardMetadata = chaves(m);
        // a mesma compra aparece uma vez por mês ("LOJA 1/3", "LOJA 2/3"): junta pelo nome sem o
        // "x/y", pelo total de parcelas e pelo valor da parcela, e fica com a mais recente
        const compra = `${semParcela(t?.description)}|${total}|${Math.abs(num(t?.amount) ?? 0)}`;
        // parcela de fatura que ainda vai fechar daqui a mais de 35 dias é FUTURA (alguns
        // bancos já mandam as próximas): não conta como cobrada
        const fatura = dia(m?.billPostDate ?? m?.billForecastDate ?? t?.date);
        if (fatura && fatura > limiteFuturo) { res.campos.parcelas_futuras = (res.campos.parcelas_futuras ?? 0) + 1; continue; }
        const ja = vistas.get(compra);
        if (!ja || atual > ja.atual) vistas.set(compra, { t, atual, total, m });
      }
      cursor = tx.j?.next ? String(tx.j.next) : null;
      if (!cursor) break;
    }
    // a foto de hoje substitui a de ontem: a parcela 3/10 de ontem vira a 4/10 de hoje
    // (outro id na Pluggy) e não pode contar duas vezes
    const vivas = [...vistas.values()].filter((v) => v.atual < v.total).map((v) => String(v.t.id));
    let limpar = admin.from("bank_parcelas").delete().eq("user_id", userId).eq("conta_id", String(c.id));
    if (vivas.length > 0) limpar = limpar.not("pluggy_tx_id", "in", `(${vivas.map((v) => `"${v}"`).join(",")})`);
    await limpar;
    for (const { t, atual, total, m } of vistas.values()) {
      if (atual >= total) continue;
      const { error: e2 } = await admin.from("bank_parcelas").upsert({
        pluggy_tx_id: String(t.id), user_id: userId, conta_id: String(c.id), banco,
        descricao: semParcela(t?.description) || "Compra parcelada",
        valor_parcela: Math.abs(num(t?.amount) ?? 0), parcela_atual: atual, parcelas_total: total,
        data_compra: dia(m?.purchaseDate), atualizado_em: agora,
      }, { onConflict: "pluggy_tx_id" });
      if (!e2) res.parcelas++;
    }
  }

  // ---- empréstimos ----
  const loans = await get(apiKey, `https://api.pluggy.ai/loans?itemId=${encodeURIComponent(itemId)}`);
  res.campos.loans_http = loans.status;
  for (const l of (loans.j?.results ?? [])) {
    res.campos.loan = chaves(l);
    res.campos.loan_installments = chaves(l?.installments);
    const inst = l?.installments ?? {};
    const total = Number(inst?.totalNumberOfInstallments ?? l?.totalNumberOfInstallments) || null;
    const restantes = Number(inst?.contractRemainingNumber ?? inst?.dueInstallments);
    const pagas = Number(inst?.paidInstallments ?? (total != null && Number.isFinite(restantes) ? total - restantes : NaN));
    const { error } = await admin.from("bank_emprestimos").upsert({
      pluggy_id: String(l.id), user_id: userId, bank_connection_id: conexaoId, banco,
      nome: limpa(l?.productName ?? l?.type ?? "Empréstimo") || "Empréstimo", tipo: limpa(l?.type ?? l?.productSubType),
      valor_contratado: num(l?.contractAmount),
      // quitado (settlementDate ou nada restando) = saldo 0: some da tela de dívidas
      saldo_devedor: l?.settlementDate || Number(inst?.contractRemainingNumber) === 0 ? 0
        : num(l?.totalRemainingAmount ?? l?.outstandingBalance ?? l?.payments?.contractOutstandingBalance),
      parcela_valor: num(l?.nextInstallmentAmount ?? l?.installmentAmount),
      parcelas_total: total, parcelas_pagas: Number.isFinite(pagas) ? pagas : null,
      parcelas_atrasadas: Number(inst?.pastDueInstallments) || 0,
      taxa_mes: taxaMes(l), proximo_vencimento: dia(l?.dueDate),   // dueDate = quando o contrato termina
      atualizado_em: agora,
    }, { onConflict: "pluggy_id" });
    if (error) console.error("dia: emprestimo", error.message); else res.emprestimos++;
  }

  // ---- investimentos (o "guardado") ----
  const invs = await get(apiKey, `https://api.pluggy.ai/investments?itemId=${encodeURIComponent(itemId)}`);
  res.campos.investments_http = invs.status;
  for (const i of (invs.j?.results ?? [])) {
    res.campos.investment = chaves(i);
    const { error } = await admin.from("bank_investimentos").upsert({
      pluggy_id: String(i.id), user_id: userId, bank_connection_id: conexaoId, banco,
      nome: limpa(i?.name ?? i?.type ?? "Investimento") || "Investimento", tipo: limpa(i?.subtype ?? i?.type),
      saldo: num(i?.balance ?? i?.amount), atualizado_em: agora,
    }, { onConflict: "pluggy_id" });
    if (error) console.error("dia: investimento", error.message); else res.investimentos++;
  }
  return res;
}
