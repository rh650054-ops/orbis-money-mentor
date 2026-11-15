import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// Guards the order of the checks in banco_entradas_classificadas (15/11): an approval must never
// turn an own transfer, a refund or a platform payout into a sale, and the seller's own mark only
// lifts the personal-account check.
const sql = readFileSync(resolve(__dirname, "../../supabase/migrations/20261115190000_pix_venda_aprovada.sql"), "utf8");
const caso = sql.slice(sql.indexOf("case\n"), sql.indexOf("end as motivo"));
const pos = (trecho: string) => {
  const i = caso.indexOf(trecho);
  expect(i, trecho).toBeGreaterThan(-1);
  return i;
};

describe("Pix marked as a sale", () => {
  it("never lifts own transfers, refunds or platform payouts", () => {
    const aprovacao = pos("when b.aprovacao = 'total' then null");
    expect(pos("then 'plataforma'")).toBeLessThan(aprovacao);
    expect(pos("then 'reembolso'")).toBeLessThan(aprovacao);
    expect(caso.lastIndexOf("then 'propria'")).toBeLessThan(aprovacao);
  });

  it("the admin's approval lifts every later check", () => {
    const aprovacao = pos("when b.aprovacao = 'total' then null");
    for (const m of ["conta_pessoal", "ida_volta", "recorrente", "grande", "vendedor"]) {
      expect(pos(`then '${m}'`)).toBeGreaterThan(aprovacao);
    }
  });

  it("the seller's own mark lifts only the personal-account check", () => {
    expect(caso).toContain("when b.aprovacao is distinct from 'pessoal'\n         and not public.banco_conta_de_venda");
    expect(sql).toContain("if coalesce(m, '') <> 'conta_pessoal' then raise exception");
  });

  it("the seller function is not open to anonymous calls", () => {
    expect(sql).toContain("revoke all on function public.banco_pix_e_venda(text, boolean) from public, anon;");
    expect(sql).toContain("if u is null then raise exception 'sem login'");
  });
});
