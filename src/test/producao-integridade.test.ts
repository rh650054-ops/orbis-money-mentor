import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// Etapa 1 (22/11): static guards for the production-integrity migration. The behaviour itself is
// proven by the SQL cases 20-22 (npm run test:sql); these keep the promises visible in preflight.
const raiz = resolve(__dirname, "../..");
const sql = readFileSync(resolve(raiz, "supabase/migrations/20261122120000_producao_integridade.sql"), "utf8");
const parte2 = readFileSync(resolve(raiz, "supabase/migrations/20261122130000_receita_historico_e_conta_teste.sql"), "utf8").replace(/--[^\n]*/g, "");
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
    for (const nome of criadas) expect(nome).toMatch(/^(producao_|receita_alteracoes$)/);
    expect(codigo).not.toMatch(/alter table public\.(?!producao_|receita_alteracoes)/i);
    expect(codigo).not.toMatch(/\b(update|delete from|insert into) public\.(production_batches|mercado_\w+|defcon_sales|daily_sales)\b/i);
  });

  it("typed consumption: floor below the recipe, reason required, recipe without yield blocked", () => {
    expect(codigo).toContain("select 0.10::numeric");
    expect(codigo).toContain("hint = 'VANT_CONSUMO_ABAIXO_DO_MINIMO'");
    expect(codigo).toContain("hint = 'VANT_JUSTIFICATIVA_OBRIGATORIA'");
    expect(codigo).toContain("hint = 'VANT_RECEITA_SEM_RENDIMENTO'");
    // an emptied recipe stays a draft but never produces, with or without a reason (case 27)
    expect(codigo).toContain("hint = 'VANT_RECEITA_INCOMPLETA'");
    // only a manufactured product with a valid recipe is produced; resale grows by purchase
    expect(codigo).toContain("hint = 'VANT_PRODUTO_SEM_RECEITA'");
    expect(codigo.indexOf("hint = 'VANT_RECEITA_INCOMPLETA'")).toBeLessThan(codigo.indexOf("hint = 'VANT_RECEITA_REDUZIDA'"));
    expect(codigo).toContain("check (not consumo_ajustado or justificativa_consumo is not null)");
  });

  it("history leaves with the account and nobody deletes it row by row", () => {
    expect(codigo).toContain("user_id uuid not null references auth.users (id) on delete cascade,");
    expect(codigo).not.toMatch(/current_user\s*=\s*'service_role'/);
  });

  it("never changes costs or prices", () => {
    expect(codigo).not.toMatch(/set[^;]*\b(cost|cost_per_unit|sale_price)\s*=/i);
    expect(parte2).not.toMatch(/\b(cost|cost_per_unit|sale_price)\b/i);
  });

  it("part 2 only logs recipe changes and extends conta_teste_zerar", () => {
    const criadas = [...parte2.matchAll(/create (?:or replace )?function public\.(\w+)/gi)].map((m) => m[1]);
    expect(criadas.sort()).toEqual(["conta_teste_zerar", "receita_registrar"]);
    // the recipe triggers write only to the log, never back to products/recipes/ingredients
    const gatilho = parte2.slice(parte2.indexOf("function public.receita_registrar"), parte2.indexOf("create trigger"));
    expect(gatilho).not.toMatch(/\b(update|delete from)\b/i);
    expect([...gatilho.matchAll(/insert into public\.(\w+)/gi)].every((m) => m[1] === "receita_alteracoes")).toBe(true);
    expect([...parte2.matchAll(/create trigger \w+\s+(after|before)/gi)].map((m) => m[1]?.toLowerCase())).toEqual(["after", "after"]);
    expect(parte2).toContain("'producao_registros','receita_alteracoes'];");
  });

  it("the 90% floor is documented as temporary", () => {
    expect(sql).toContain("TEMPORARY PROTECTION");
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
    const derrubados = [...rollback.matchAll(/drop (?:function|table|trigger) if exists ([^;(]+)/gi)].flatMap((m) => (m[1] ?? "").split(","));
    for (const d of derrubados) expect(d.trim()).toMatch(/^(public\.producao_|public\.receita_|receita_alteracoes_registrar on public\.(products|product_recipes))/);
    expect(rollback).toContain("receita_alteracoes mantida");
  });

  it("23/11: the new functions are called from ONE place only (the production API of the Produtos feature)", () => {
    const arquivos = (dir: string): string[] =>
      readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? arquivos(resolve(dir, e.name)) : [resolve(dir, e.name)]));
    const usos = arquivos(resolve(raiz, "src"))
      .filter((f) => /\.(ts|tsx)$/.test(f) && !f.includes("/test/"))
      .filter((f) => !/\.test\.tsx?$/.test(f))
      .filter((f) => /rpc\(\s*["']producao_(registrar|corrigir|desfazer)/.test(readFileSync(f, "utf8")))
      .map((f) => f.slice(resolve(raiz, "src").length + 1));
    expect(usos).toEqual(["features/produtos/api/use-producao-escrita.ts"]);
  });
});
