import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// 15/11: a recalculated day must reach the live list (ranking_dia_cache) at once, not at the next :25.
const sql = readFileSync(resolve(__dirname, "../../supabase/migrations/20261115210000_ranking_cache_na_hora.sql"), "utf8");

describe("ranking_atualizar writes the cache too", () => {
  it("writes the seller's closed days, never today or a frozen day", () => {
    expect(sql).toContain("insert into public.ranking_dia_cache");
    expect(sql).toContain("where r.dia < hoje and r.dia > v_congelado");
  });
  it("month total and cache come from the same computation", () => {
    expect(sql).toContain("from public.ranking_valor_dias(v_de, v_ate, p_user) x");
    expect(sql).toContain("select coalesce(sum(r.valor), 0)::numeric as total from r");
  });
});
