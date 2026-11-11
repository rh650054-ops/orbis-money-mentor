// SQL regression tests for the financial chain (bank entry -> sale -> reconcile -> ranking -> prize).
// Builds a throwaway database with the tables as they are in production and the LAST definition
// of each function found in this repo (migrations + baseline), then runs every file in casos/.
// Needs only Node and psql. Connection: PGHOST / PGPORT / PGUSER / PGPASSWORD (never production).
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ultimasDefinicoes } from "../../scripts/funcoes-sql.mjs";

const aqui = dirname(fileURLToPath(import.meta.url));
const raiz = join(aqui, "../..");
const host = process.env.PGHOST ?? "127.0.0.1";
if (/supabase\.(co|com)/i.test(host)) { console.error("Recusado: estes testes nunca rodam contra o Supabase."); process.exit(2); }
const env = { ...process.env, PGHOST: host, PGPORT: process.env.PGPORT ?? "54329", PGUSER: process.env.PGUSER ?? "postgres" };
const psql = (db, args, opt = {}) => execFileSync("psql", ["-X", "-q", "-v", "ON_ERROR_STOP=1", "-d", db, ...args], { env, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], ...opt });

// The chain under test. Everything else these functions call is a double (schema/02_dubles.sql).
const CADEIA = [
  "banco_eh_maquininha", "banco_nao_e_venda", "banco_pagador", "banco_mesma_pessoa", "banco_conta_de_venda",
  "banco_entradas_classificadas", "banco_entradas_detalhe", "banco_entradas_por_dia", "banco_pix_por_dia",
  "banco_lancado_dia", "banco_ligou_em", "banco_reconciliar", "banco_conferencia",
  "ranking_banco_desde", "ranking_pode_verificar", "ranking_valor_dias", "ranking_total_mes", "ranking_atualizar",
  "ranking_congelado_ate", "ranking_cache_atualizar", "get_weekly_ranking_verified",
  "premio_pendencias", "premio_congelar", "premio_congelar_agora", "premio_reavaliar", "premio_homologar_manual", "premio_resultado",
];
const OPCIONAIS = ["premio_homologacao_automatica"]; // exist only after their fix lands
// Migrations that change grants or policies (not functions) and must be applied whole, in order.
const APLICAR_INTEIRAS = ["20261110121000_premio_fechamento_sem_leitura_direta.sql"];

const manifesto = JSON.parse(readFileSync(join(raiz, "supabase/baseline/manifesto-producao.json"), "utf8"));
const defs = ultimasDefinicoes(raiz);
const tmp = mkdtempSync(join(tmpdir(), "vant-sql-"));
const BASE = "vant_teste_base";

console.log("1) Montando o banco de teste");
psql("postgres", ["-c", `drop database if exists ${BASE}`]);
psql("postgres", ["-c", `create database ${BASE}`]);
psql(BASE, ["-c", `alter database ${BASE} set timezone to 'UTC'`]);
for (const f of ["00_supabase.sql", "01_tabelas.sql", "02_dubles.sql", "03_asserts.sql"]) psql(BASE, ["-f", join(aqui, "schema", f)]);

let sql = "set check_function_bodies = off;\n";
const iguais = [], mudadas = [];
for (const nome of [...CADEIA, ...OPCIONAIS]) {
  const d = defs.get(nome);
  if (!d) { if (OPCIONAIS.includes(nome)) continue; console.error(`Funcao da cadeia sem definicao no repositorio: ${nome}`); process.exit(2); }
  sql += `\n-- ${nome}  <- ${d.arquivo}\n${d.sql}\n`;
  ((manifesto.funcoes[nome] ?? []).includes(d.hash) ? iguais : mudadas).push(`${nome}  (${d.arquivo})`);
}
const arq = join(tmp, "funcoes.sql");
writeFileSync(arq, sql);
psql(BASE, ["-f", arq]);
for (const m of APLICAR_INTEIRAS) {
  const caminho = join(raiz, "supabase/migrations", m);
  if (existsSync(caminho)) { psql(BASE, ["-f", caminho]); console.log(`   migration aplicada inteira: ${m}`); }
}
console.log(`   ${iguais.length} funcoes identicas a producao (${manifesto.capturado_em})`);
if (mudadas.length) { console.log(`   ${mudadas.length} alteradas neste branch:`); mudadas.forEach((m) => console.log(`     - ${m}`)); }

console.log("2) Casos");
const casos = readdirSync(join(aqui, "casos")).filter((f) => f.endsWith(".sql")).sort();
let falhas = 0, passou = 0, pendentes = 0, promover = 0;
for (const caso of casos) {
  const db = "vant_caso_" + caso.replace(/\W+/g, "_").toLowerCase().slice(0, 40);
  psql("postgres", ["-c", `drop database if exists ${db}`]);
  psql("postgres", ["-c", `create database ${db} template ${BASE}`]);
  console.log(`\n   ${caso}`);
  try {
    psql(db, ["-f", join(aqui, "casos", caso)]);
  } catch (e) {
    falhas++; console.log(`     ERRO DE SQL: ${String(e.stderr || e.message).trim().split("\n").slice(0, 4).join(" | ")}`);
    continue;
  }
  const linhas = JSON.parse(psql(db, ["-At", "-c", "select coalesce(json_agg(r order by r.id), '[]') from t.resultados r"]));
  if (linhas.length === 0) { falhas++; console.log("     ERRO: o caso nao registrou nenhuma verificacao"); }
  for (const r of linhas) {
    if (r.tipo === "pendente") {
      if (r.ok) { promover++; console.log(`     PROMOVER  [${r.achado}] ${r.nome}: ja passa (${r.obtido}). Troque t.pendente por t.igual.`); }
      else { pendentes++; console.log(`     pendente  [${r.achado}] ${r.nome}: hoje ${r.obtido}, correto ${r.esperado}`); }
    } else if (r.ok) { passou++; console.log(`     ok        ${r.nome}`); }
    else { falhas++; console.log(`     FALHOU    ${r.nome}: obtido ${r.obtido}, esperado ${r.esperado}`); }
  }
  psql("postgres", ["-c", `drop database if exists ${db}`]);
}
console.log(`\nResultado: ${passou} ok, ${falhas} falhas, ${pendentes} bugs conhecidos ainda abertos, ${promover} a promover`);
process.exit(falhas > 0 || promover > 0 ? 1 : 0);
