import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// 15/11: an approved Pix that was never typed must ADD to what was sold that day, so it can't
// cover the calote of the street sales (13/11: R$ 520 resale hid R$ 40 of calote).
const sql = readFileSync(resolve(__dirname, "../../supabase/migrations/20261115200000_venda_a_parte_nao_cobre_calote.sql"), "utf8");

describe("approved sale that was never typed", () => {
  it("counts only approved Pix that are still a sale, minus the typed ones of the same value", () => {
    expect(sql).toContain("rv.status = 'aprovada'");
    expect(sql).toContain("c.motivo is null");
    expect(sql).toContain("where ap.rn > coalesce(d.n, 0)");
  });

  it("is added to the typed sales used by the reconcile, the report and the ranking cap", () => {
    expect(sql).toMatch(/banco_lancado_dia[\s\S]*\+ public\.banco_vendas_a_parte\(p_user, p_dia\)/);
    expect(sql).toContain("round(sum(s.amount), 2) + public.banco_vendas_a_parte(cs.user_id, cs.date) as v");
  });

  it("is not callable from the app", () => {
    expect(sql).toContain("revoke all on function public.banco_vendas_a_parte(uuid, date) from public, anon, authenticated;");
  });
});
