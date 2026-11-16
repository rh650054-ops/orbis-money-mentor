import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// 16/11: CRM list "Trial que não assinou", split equally between the closers.
const sql = readFileSync(resolve(__dirname, "../../supabase/migrations/20261116100000_crm_resgate_trial.sql"), "utf8");
const crm = readFileSync(resolve(__dirname, "../../public/crm.js"), "utf8");

describe("CRM resgate_trial list", () => {
  it("only takes people whose trial ended and who never paid", () => {
    expect(sql).toContain("and p.trial_end < now()");
    expect(sql).toContain("not exists (select 1 from public.subscriptions s where s.user_id = p.user_id)");
    expect(sql).toContain("not exists (select 1 from public._crm_compras_hotmart h where h.user_id = p.user_id)");
    expect(sql).toContain("not exists (select 1 from public.crm_equipe e where e.user_id = p.user_id)");
  });
  it("splits round-robin between the active closers, in random order", () => {
    expect(sql).toContain("row_number() over (order by random())");
    expect(sql).toContain("v_closers[1 + ((c.rn - 1) % v_n)]");
  });
  it("the one-off load is not callable from the app; the sync needs the CRM role", () => {
    expect(sql).toContain("revoke all on function public.crm_resgate_carregar() from public, anon, authenticated;");
    expect(sql).toContain("if not public.is_orbis_crm() then raise exception");
  });
  it("the CRM page shows the list and never swaps it with other lists", () => {
    expect(crm).toContain('resgate_trial:"resgate"');
    expect(crm).toContain('chamar("crm_funil",{p_pipeline:"resgate_trial"})');
    expect(crm).toContain("if(ehMovida(k)||ehMovida(f.e)){");
  });
});
