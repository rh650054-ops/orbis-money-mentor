import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// 16/11: goal of the "Trial que não assinou" list — leads called per day, per closer.
const sql = readFileSync(resolve(__dirname, "../../supabase/migrations/20261116120000_crm_metas_resgate.sql"), "utf8");
const crm = readFileSync(resolve(__dirname, "../../public/crm.js"), "utf8");

describe("CRM resgate goal", () => {
  it("counts each lead once per day per closer", () => {
    expect(sql).toContain("select count(distinct k.cartao_id) from public.crm_contatos k");
  });
  it("automatic moves never count as a contact", () => {
    expect(sql).toContain("perform set_config('crm.automatico', '1', true);");
    expect(sql).toContain("coalesce(current_setting('crm.automatico', true), '') = '1'");
  });
  it("only cards of this list are logged", () => {
    expect(sql).toContain("for each row when (new.pipeline = 'resgate_trial'");
    expect(sql).toContain("if v_pipe is distinct from 'resgate_trial' then return new; end if;");
  });
  it("the log is not readable by the app directly", () => {
    expect(sql).toContain("revoke all on public.crm_contatos from anon, authenticated;");
  });
  it("each closer sees only their own goal; admin sees everyone", () => {
    expect(crm).toContain("const pessoas=minhaVisao()?M.pessoas.filter(p=>p.user_id===EU):M.pessoas;");
  });
});
