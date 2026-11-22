import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// Etapa 1 (22/11): static guards for the production-integrity migration. The behaviour itself is
// proven by the SQL cases 20-22 (npm run test:sql); these keep the promises visible in preflight.
const raiz = resolve(__dirname, "../..");
const sql = readFileSync(resolve(raiz, "supabase/migrations/20261122120000_producao_integridade.sql"), "utf8");
const rollback = readFileSync(resolve(raiz, "supabase/producao-integridade/rollback-etapa1.sql"), "utf8");
const codigo = sql.replace(/--[^\n]*/g, "");

describe("production integrity (Etapa 1)", () => {
  it("never clamps stock: missing ingredients block instead of going to zero", () => {
    expect(codigo).not.toMatch(/greatest\s*\(\s*coalesce\s*\(\s*stock_quantity/i);
    expect(codigo).not.toMatch(/greatest\s*\([^)]*stock_quantity[^)]*,\s*0\s*\)/i);
    expect(codigo).toContain("hint = 'VANT_FALTA_INGREDIENTE'");
    expect(codigo).toContain("hint = 'VANT_UNIDADES_VENDIDAS'");
  });

  it("does not redefine any existing function or table", () => {
    const criadas = [...codigo.matchAll(/create (?:or replace )?(?:function|table) public\.(\w+)/gi)].map((m) => m[1] ?? "");
    expect(criadas.length).toBeGreaterThan(0);
    for (const nome of criadas) expect(nome).toMatch(/^producao_/);
    expect(codigo).not.toMatch(/alter table public\.(?!producao_)/i);
    expect(codigo).not.toMatch(/\b(update|delete from|insert into) public\.(production_batches|mercado_\w+|defcon_sales|daily_sales)\b/i);
  });

  it("never changes costs or prices", () => {
    expect(codigo).not.toMatch(/set[^;]*\b(cost|cost_per_unit|sale_price)\s*=/i);
  });

  it("only the three entry points are callable by a logged user", () => {
    const liberadas = [...codigo.matchAll(/grant execute on function public\.(\w+)/gi)].map((m) => m[1]);
    expect(liberadas.sort()).toEqual(["producao_corrigir", "producao_desfazer", "producao_registrar"]);
    expect(codigo).toContain("revoke all on function public.producao_aplicar(uuid, uuid, uuid, jsonb) from public, anon, authenticated;");
    expect(codigo).not.toMatch(/grant (insert|update|delete|all) on public\.producao_/i);
  });

  it("every SECURITY DEFINER function pins its search_path", () => {
    const blocos = codigo.split(/create or replace function/i).slice(1);
    for (const b of blocos) if (/security definer/i.test(b.split("$$")[0] ?? "")) expect(b.split("$$")[0]).toMatch(/set search_path = public/i);
  });

  it("the rollback refuses while history exists and drops only producao_* objects", () => {
    expect(rollback).toContain("Rollback recusado");
    const derrubados = [...rollback.matchAll(/drop (?:function|table) if exists ([^;(]+)/gi)].flatMap((m) => (m[1] ?? "").split(","));
    for (const d of derrubados) expect(d.trim()).toMatch(/^public\.producao_/);
  });

  it("no screen calls the new functions yet (Etapa 1 changes no screen)", () => {
    const arquivos = (dir: string): string[] =>
      readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? arquivos(resolve(dir, e.name)) : [resolve(dir, e.name)]));
    const usos = arquivos(resolve(raiz, "src"))
      .filter((f) => /\.(ts|tsx)$/.test(f) && !f.includes("/test/"))
      .filter((f) => /producao_(registrar|corrigir|desfazer)/.test(readFileSync(f, "utf8")));
    expect(usos).toEqual([]);
  });
});
