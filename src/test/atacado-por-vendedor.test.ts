import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// 20/11: wholesale Pix not typed in the app, switched on per seller (banco_regras_vendedor).
const sql = readFileSync(resolve(__dirname, "../../supabase/migrations/20261120090000_atacado_nao_lancado_por_vendedor.sql"), "utf8");
const caso = sql.slice(sql.indexOf("case\n"), sql.indexOf("end as motivo"));

describe("wholesale rule per seller", () => {
  it("is off unless the seller has a row (null limit never matches)", () => {
    expect(sql).toContain("regra as (select r.pix_atacado_acima from public.banco_regras_vendedor r where r.user_id = p_user)");
    expect(caso).toContain("when b.amount > (select r.pix_atacado_acima from regra r)");
  });
  it("a sale of the same value typed that day still counts; machine money is untouched", () => {
    expect(caso).toContain("and not b.maq");
    expect(caso).toContain("cs.date = b.transaction_date and abs(s.amount - b.amount) < 0.01) then 'atacado'");
  });
  it("own transfers and own card are decided first; an admin approval still lifts it", () => {
    const atacado = caso.indexOf("then 'atacado'");
    expect(caso.lastIndexOf("then 'propria'")).toBeLessThan(atacado);
    expect(caso.indexOf("then 'cartao_proprio'")).toBeLessThan(atacado);
    expect(caso.indexOf("when b.aprovacao = 'total' then null")).toBeLessThan(atacado);
  });
  it("the settings table is not reachable from the app", () => {
    expect(sql).toContain("revoke all on public.banco_regras_vendedor from anon, authenticated;");
  });
});
