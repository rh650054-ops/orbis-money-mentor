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
  it("the reconcile from a given day is not callable from the app", () => {
    expect(sql).toContain("revoke all on function public.banco_reconciliar(uuid, date) from public, anon, authenticated;");
  });
});
