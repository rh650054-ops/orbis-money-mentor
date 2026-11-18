import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// 17/11: Mercado Pago Empresas reports card machine money as "Liberação de dinheiro ...".
const sql = readFileSync(resolve(__dirname, "../../supabase/migrations/20261117230000_mp_liberacao_de_dinheiro.sql"), "utf8");
const regra = new RegExp(/'(\^\(vendas\?[^']+)'/.exec(sql)?.[1] ?? "^$");

describe("card machine money from Mercado Pago", () => {
  it.each(["liberação de dinheiro", "liberação de dinheiro venda com pix", "liberação de dinheiro venda com qr code",
    "liberacao de dinheiro venda com qrcode", "venda: produto", "recebimento de vendas"])("counts '%s'", (d) => {
    expect(regra.test(d)).toBe(true);
  });
  it.each(["liberação de dinheiro de empréstimo", "pix recebido joao", "resgate rdb", "transferência recebida"])("does not count '%s'", (d) => {
    expect(regra.test(d)).toBe(false);
  });
  it("a single machine sale far above the ticket waits for the admin (own card on the machine)", () => {
    expect(sql).toContain("when b.maq and lower(coalesce(b.description, '')) ~ '^libera[cç][aã]o de dinheiro'");
    expect(sql).toContain("and b.amount > greatest(150, 6 * pf.ticket) and b.aprovacao is distinct from 'total' then 'grande'");
    expect(sql.indexOf("then 'grande'\n        when b.maq then null")).toBeGreaterThan(-1);
  });
  it("the reconcile from a given day is not callable from the app", () => {
    expect(sql).toContain("revoke all on function public.banco_reconciliar(uuid, date) from public, anon, authenticated;");
  });
});
