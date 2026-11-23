#!/usr/bin/env node
// Rehearses the FULL replay of supabase/migrations on an empty Postgres (what a new staging project
// would run), instead of the trimmed schema of `npm run test:sql`. Read-only for the repo; it only
// touches the database named below on the local server given by PGHOST/PGPORT/PGUSER.
// Usage: PGHOST=127.0.0.1 PGPORT=54329 PGUSER=postgres node supabase/homologacao/reconstruir.mjs
import { execFileSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const aqui = dirname(fileURLToPath(import.meta.url));
const pasta = join(aqui, "..", "migrations");
const BANCO = process.env.BANCO ?? "vant_reconstrucao";
const psql = (args, db = "postgres") => execFileSync("psql", ["-X", "-q", "-v", "ON_ERROR_STOP=1", "-d", db, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });

psql(["-c", `drop database if exists ${BANCO}`, "-c", `create database ${BANCO}`]);
psql(["-f", join(aqui, "00_plataforma.sql")], BANCO);
const arquivos = readdirSync(pasta).filter((f) => f.endsWith(".sql")).sort();
// CONTINUAR=1: keep going after a failure and list every migration that does not replay
const continuar = process.env.CONTINUAR === "1";
let ok = 0;
const falhas = [];
for (const f of arquivos) {
  try { psql(["-1", "-f", join(pasta, f)], BANCO); ok++; }
  catch (e) {
    const msg = String(e.stderr ?? e.message).split("\n").filter((l) => /ERROR|ERRO/.test(l)).slice(0, 1).join(" ").replace(/^psql:[^ ]+ /, "");
    falhas.push(`${f}: ${msg}`);
    if (!continuar) { console.log(`FALHOU em ${f} (${ok}/${arquivos.length} aplicadas)\n   ${msg}`); process.exit(1); }
  }
}
if (falhas.length) { console.log(`${falhas.length} migrações não reaplicam do zero:\n- ${falhas.join("\n- ")}`); }
const resumo = psql(["-At", "-c", "select (select count(*) from pg_tables where schemaname='public')||' tabelas, '||(select count(*) from pg_proc where pronamespace='public'::regnamespace)||' funções, '||(select count(*) from pg_policies where schemaname='public')||' políticas'"], BANCO).trim();
console.log(`${falhas.length ? "PARCIAL" : "OK"}: ${ok}/${arquivos.length} migrações aplicadas do zero — ${resumo}`);
if (falhas.length) process.exit(1);
