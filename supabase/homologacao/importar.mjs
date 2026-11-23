#!/usr/bin/env node
// Builds the STAGING database (23/11/2026). Run on Rick's computer, never against production:
//   1) the production structure (no data), rebuilt from the catalog and checked object by object
//      (1-estrutura.sql, delivered privately, never committed: the repo is public);
//   2) the migrations being rehearsed (Etapa 1, yield per flavour, Products/Mercado/Production);
//   3) three fictitious users (passwords printed HERE only) and the fictitious seed.
// Usage (in the folder with the files): npm i pg && node importar.mjs
// It asks for the staging connection string (Supabase panel → Connect → Session pooler).
import fs from "node:fs";
import crypto from "node:crypto";
import readline from "node:readline/promises";
import pg from "pg";

const PRODUCAO = "qbcsjsdwjjpybvzbxszi";
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const url = (process.env.DATABASE_URL || (await rl.question("Cole a connection string da HOMOLOGAÇÃO: "))).trim();
rl.close();
if (url.includes(PRODUCAO)) { console.error("Recusado: essa é a conexão de PRODUÇÃO."); process.exit(2); }

const db = new pg.Client({ connectionString: url, ssl: /@(localhost|127\.0\.0\.1)[:/]/.test(url) ? false : { rejectUnauthorized: false } });
await db.connect();
const um = async (sql, p) => (await db.query(sql, p)).rows[0];

// only a fresh staging database, marked as such
const marca = await um("select to_regclass('public.ambiente_homologacao') is not null as ok");
if (!marca.ok) { console.error("Recusado: este banco não tem a marca public.ambiente_homologacao."); process.exit(2); }
const jaTem = await um("select to_regclass('public.products') is not null as ok");

if (!jaTem.ok) {
  console.log("1/4 Estrutura de produção (sem dados)…");
  const blocos = fs.readFileSync("1-estrutura.sql", "utf8").split("\n--@@\n").map((s) => s.trim()).filter(Boolean);
  let ok = 0; const erros = [];
  for (const s of blocos) {
    try { await db.query(s); ok++; } catch (e) { erros.push(`${String(e.message).slice(0, 160)}  ←  ${s.slice(0, 80).replace(/\s+/g, " ")}`); }
  }
  console.log(`   ${ok} comandos aplicados, ${erros.length} com erro`);
  erros.slice(0, 25).forEach((e) => console.log("   - " + e));
} else {
  console.log("1/4 Estrutura já existe: pulando.");
}

console.log("2/4 Migrações em ensaio…");
for (const f of fs.readdirSync(".").filter((x) => /^2-\d+_.*\.sql$/.test(x)).sort()) {
  const ja = await um("select exists (select 1 from public.ambiente_homologacao where nota = $1) as ok", [`migracao:${f}`]);
  if (ja.ok) { console.log(`   ${f}: já aplicada`); continue; }
  try {
    await db.query("begin");
    await db.query(fs.readFileSync(f, "utf8"));
    await db.query("insert into public.ambiente_homologacao (nota) values ($1)", [`migracao:${f}`]);
    await db.query("commit");
    console.log(`   ${f}: ok`);
  } catch (e) {
    await db.query("rollback");
    console.error(`   ${f}: ERRO ${e.message}`); process.exit(1);
  }
}

console.log("3/4 Usuários fictícios (anote as senhas: aparecem só aqui)…");
const senhas = [];
for (const email of ["faz@vant-homologacao.test", "revenda@vant-homologacao.test", "novo@vant-homologacao.test"]) {
  const existe = await um("select id from auth.users where email = $1", [email]);
  if (existe) { senhas.push([email, "(já existia, senha anterior)"]); continue; }
  const senha = crypto.randomBytes(9).toString("base64url");
  const id = crypto.randomUUID();
  await db.query(`insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token)
    values ('00000000-0000-0000-0000-000000000000', $1, 'authenticated', 'authenticated', $2, extensions.crypt($3, extensions.gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '')`, [id, email, senha]);
  await db.query(`insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (gen_random_uuid(), $1::uuid, $2::text, jsonb_build_object('sub', $2::text, 'email', $3::text, 'email_verified', true), 'email', now(), now(), now())`, [id, id, email]);
  senhas.push([email, senha]);
}

console.log("4/4 Dados fictícios…");
await db.query(fs.readFileSync("3-dados-ficticios.sql", "utf8"));
// staging accounts see the Pro screens (Products is Pro): exempt from billing, nothing to pay
await db.query("update public.profiles set billing_exempt = true where user_id in (select id from auth.users where email like '%@vant-homologacao.test')");

console.log("\nPRONTO. Logins da homologação:");
senhas.forEach(([e, s]) => console.log(`   ${e}   ${s}`));
console.log("Nenhum dado de produção foi copiado.");
await db.end();
