/* The three rows of "Organização financeira", from financas_painel() as the old rows read it. */
import type { Painel } from "@/components/financas/FinancasPainel";

/** What each row says. Exported for the tests. */
export function linhasDaOrganizacao(p: Painel) {
  const usado = p.cartoes.reduce((s, c) => s + Math.max(0, c.fatura ?? 0), 0);
  const devendo = p.emprestimos.reduce((s, e) => s + (e.saldo_devedor ?? 0), 0) + p.especial_usado;
  return {
    cartao: { valor: p.tem_cartao ? usado : null, sub: p.tem_cartao ? (p.parcelas.length ? `usado · ${p.parcelas.length} parcela${p.parcelas.length > 1 ? "s" : ""}` : "valor usado") : "o banco não liberou" },
    guardado: { valor: p.tem_investimento ? p.guardado : null, sub: p.tem_investimento ? ((p.reserva ?? 0) > 0 ? "inclui a sua reserva" : "reservas e investimentos") : "nada guardado nos bancos" },
    dividas: { valor: devendo > 0 ? devendo : 0, sub: devendo > 0 ? "empréstimo e cheque" : "nada em aberto" },
  };
}
