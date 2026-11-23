#!/usr/bin/env node
// Builds the STAGING database "VANT Homologacao" (hpwndqpawoknxwzbrudn). Run on Rick's computer.
// v2 (23/11/2026), after Rick's review of v1:
//   * identity first: the connection must name the staging project (allow-list, not deny-list) and the
//     database itself must carry the marker row "projeto:<staging ref>" -- checked before any write;
//   * the production structure goes in ONE transaction: the first failing command stops everything,
//     is printed with the exact error and nothing is kept (re-running starts clean);
//   * the structure is compared object by object (tables, columns, functions, policies, indexes,
//     triggers, views, constraints, grants) with production BEFORE it is committed;
//   * each rehearsal migration is its own transaction, recorded in the marker;
//   * fictitious users are created or re-keyed (rerun = new passwords), then a real login is tested;
//   * at the end: full structure + permissions check, and proof that no real integration exists.
// Files next to it (private, never committed: the repo is public): 1-estrutura.sql, 2-*.sql,
// 3-dados-ficticios.sql, esperado.json. Usage: node importar.mjs
import fs from "node:fs";
import crypto from "node:crypto";
import readline from "node:readline";
import pg from "pg";

const HOMOLOGACAO = "hpwndqpawoknxwzbrudn";
const PRODUCAO = "qbcsjsdwjjpybvzbxszi";
const API = `https://${HOMOLOGACAO}.supabase.co`;
const CHAVE_PUBLICA = "sb_publishable_DelZGHn_NgEj81HJCsTrsw_E3zAJp4v"; // publishable: public by design
const MARCA = `projeto:${HOMOLOGACAO}`;
const USUARIOS = ["faz@vant-homologacao.test", "revenda@vant-homologacao.test", "novo@vant-homologacao.test"];
const LOTE = 150;
const LOCAL = process.env.VANT_ENSAIO_LOCAL === "1"; // rehearsal on a local Postgres only (never a real project)

const log = (s = "") => console.log(s);
class Parada extends Error {}
const parar = (titulo, detalhes = []) => { throw new Parada([titulo, ...detalhes.map((d) => "   " + d)].join("\n")); };
const sha = (buf) => crypto.createHash("sha256").update(buf).digest("hex");

// ---------- 0. files ----------
if (Number(process.versions.node.split(".")[0]) < 18) { console.error("Precisa do Node 18 ou mais novo (nodejs.org)."); process.exit(2); }
const esperadoTxt = fs.existsSync("esperado.json") ? fs.readFileSync("esperado.json") : null;
if (!esperadoTxt) { console.error("Falta o arquivo esperado.json: rode dentro da pasta descompactada."); process.exit(2); }
const esperado = JSON.parse(esperadoTxt.toString("utf8"));
for (const [arq, h] of Object.entries(esperado.arquivos)) {
  if (!fs.existsSync(arq)) { console.error(`Falta o arquivo ${arq}. Descompacte o ZIP de novo.`); process.exit(2); }
  if (sha(fs.readFileSync(arq)) !== h) { console.error(`O arquivo ${arq} foi alterado ou corrompido. Descompacte o ZIP de novo.`); process.exit(2); }
}

// ---------- 1. connection string (hidden while typing) and identity from it ----------
async function perguntarOculto(msg) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  process.stdout.write(msg);
  rl._writeToOutput = () => {};
  const r = await new Promise((ok) => rl.question("", ok));
  rl.close(); process.stdout.write("\n");
  return r;
}
const bruta = (process.env.DATABASE_URL || (await perguntarOculto("Cole a connection string da HOMOLOGAÇÃO (não aparece na tela) e tecle Enter: "))).trim();

function lerConexao(s) {
  const m = /^postgres(?:ql)?:\/\/([^:/?#]+):(.*)@([^@/?#:]+)(?::(\d+))?\/([^?#]*)(?:\?.*)?$/.exec(s);
  if (!m) parar("Connection string inválida. Use a do painel: Connect → Session pooler (começa com postgresql://).");
  const [, user, senha, host, porta, banco] = m;
  if (!senha || senha.includes("[YOUR-PASSWORD]")) parar("Troque [YOUR-PASSWORD] pela senha do banco da homologação.");
  return { user: decodeURIComponent(user), password: decodeURIComponent(senha), host, port: Number(porta || 5432), database: decodeURIComponent(banco || "postgres") };
}
let cfg;
try {
  if (bruta.includes(PRODUCAO)) parar("RECUSADO: essa connection string é da PRODUÇÃO. Nada foi executado.");
  cfg = lerConexao(bruta);
  const local = /^(localhost|127\.0\.0\.1)$/.test(cfg.host);
  if (local && !LOCAL) parar("RECUSADO: conexão local. Use a connection string do projeto VANT Homologacao.");
  if (!local) {
    const refs = new Set();
    const u = /^postgres\.([a-z0-9]{20})$/.exec(cfg.user); if (u) refs.add(u[1]);
    const h = /^db\.([a-z0-9]{20})\.supabase\.co$/.exec(cfg.host); if (h) refs.add(h[1]);
    if (!/(\.pooler\.supabase\.com|\.supabase\.co)$/.test(cfg.host)) parar(`RECUSADO: o servidor ${cfg.host} não é do Supabase.`);
    if (refs.size === 0) parar("RECUSADO: não achei o ID do projeto na connection string. Use Connect → Session pooler do projeto VANT Homologacao.");
    if ([...refs].some((r) => r !== HOMOLOGACAO)) parar(`RECUSADO: a connection string é do projeto ${[...refs].join(", ")}, não da homologação (${HOMOLOGACAO}).`);
  }
} catch (e) { console.error("\n" + e.message); process.exit(2); }

const db = new pg.Client({ ...cfg, ssl: LOCAL ? false : { rejectUnauthorized: false }, application_name: "vant-importar-homologacao" });
const q = (sql, p) => db.query(sql, p);
const um = async (sql, p) => (await q(sql, p)).rows[0];
const ERRO_ARQ = "erro-homologacao.txt";

function descreverErro(e) {
  return [`erro: ${e.message}`, e.code && `código: ${e.code}`, e.detail && `detalhe: ${e.detail}`, e.hint && `dica: ${e.hint}`,
    e.where && `onde: ${String(e.where).split("\n")[0]}`, e.position && `posição: ${e.position}`].filter(Boolean);
}

// ---------- inventory: one row per object, hashed; the same query ran on production ----------
const INVENTARIO = fs.readFileSync("verificar.sql", "utf8");
async function inventario() {
  const m = {};
  for (const r of (await q(INVENTARIO)).rows) (m[r.k] ??= {})[r.n] = r.h;
  return m;
}
const NOMES = { T: "tabelas e colunas", F: "funções", P: "regras de acesso (RLS)", I: "índices", G: "gatilhos", V: "views", C: "restrições",
  E: "tipos", S: "sequências", X: "gatilhos de auth/storage", B: "buckets", Q: "regras do storage", U: "realtime", A: "permissões de tabelas", R: "permissões de funções" };
function comparar(real, alvo, equivalentes = {}) {
  const dif = []; const resumo = [];
  for (const k of Object.keys(NOMES)) {
    const a = alvo[k] ?? {}; const r = real[k] ?? {};
    let ok = 0;
    for (const [n, h] of Object.entries(a)) {
      if (!(n in r)) dif.push(`falta ${NOMES[k]}: ${n}`);
      else if (r[n] !== h && equivalentes[`${k}\t${n}`] !== r[n]) dif.push(`diferente (${NOMES[k]}): ${n}`);
      else ok++;
    }
    for (const n of Object.keys(r)) if (!(n in a)) dif.push(`sobrando (${NOMES[k]}): ${n}`);
    resumo.push(`${NOMES[k]}: ${ok}/${Object.keys(a).length}`);
  }
  return { dif, resumo };
}

async function principal() {
  await db.connect();
  await q("select pg_advisory_lock(hashtext('vant-importar-homologacao'))");

  // ---------- 2. identity inside the database, read-only, before any write ----------
  log("1/6 Conferindo que este banco é a homologação (só leitura)…");
  await q("begin read only");
  const id = await um(`select current_setting('server_version_num')::int v,
      to_regclass('public.ambiente_homologacao') is not null marca,
      (select count(*) from pg_class where relnamespace = 'public'::regnamespace and relname not in ('ambiente_homologacao')) objetos,
      (select count(*) from pg_proc where pronamespace = 'public'::regnamespace) funcoes,
      (select count(*) from auth.users) usuarios,
      (select count(*) from auth.users where email is null or email not like '%@vant-homologacao.test') reais,
      (select count(*) from storage.buckets) buckets,
      to_regclass('public.profiles') is not null tem_perfis`);
  let marcaOk = false; let outros = [];
  if (id.marca) {
    const notas = (await q("select nota from public.ambiente_homologacao")).rows.map((r) => r.nota);
    marcaOk = notas.includes(MARCA);
    outros = notas.filter((n) => n.startsWith("projeto:") && n !== MARCA);
  }
  const perfis = id.tem_perfis ? Number((await um("select count(*) n from public.profiles")).n) : 0;
  await q("commit");
  const virgem = Number(id.objetos) === 0 && Number(id.funcoes) === 0 && Number(id.reais) === 0 && Number(id.buckets) === 0;
  if (id.v < 170000) parar(`RECUSADO: Postgres ${id.v}; a homologação é Postgres 17.`);
  if (outros.length) parar(`RECUSADO: a marca deste banco aponta para outro projeto (${outros.join(", ")}).`);
  if (Number(id.reais) > 0) parar(`RECUSADO: este banco tem ${id.reais} usuário(s) que não são fictícios. A homologação só tem @vant-homologacao.test.`);
  if (perfis >= 20) parar(`RECUSADO: este banco tem ${perfis} perfis. A homologação tem no máximo 3.`);
  if (!marcaOk) {
    // the marker is created only on a brand-new project, after the connection was proven to be staging
    if (!virgem) parar("RECUSADO: este banco não tem a marca da homologação e não está vazio. Nada foi alterado.");
    await q("begin");
    await q(`create table if not exists public.ambiente_homologacao (criado_em timestamptz default now(), nota text default 'Banco de HOMOLOGACAO da VANT: so dados ficticios.')`);
    await q("alter table public.ambiente_homologacao enable row level security");
    await q("revoke all on public.ambiente_homologacao from public, anon, authenticated");
    await q("insert into public.ambiente_homologacao (nota) values ($1)", [MARCA]);
    await q("commit");
    log("   marca da homologação criada.");
  }
  log(`   ok: projeto ${HOMOLOGACAO}, Postgres ${String(id.v).slice(0, 2)}, ${id.usuarios} usuário(s) fictício(s), nenhum dado real.`);

  const feito = async (nota) => (await um("select exists (select 1 from public.ambiente_homologacao where nota = $1) ok", [nota])).ok;
  const feitoComeco = async (pre) => (await um("select exists (select 1 from public.ambiente_homologacao where nota like $1) ok", [pre + "%"])).ok;

  // ---------- 3. production structure: one transaction, stop on the first error ----------
  const estruturaTxt = fs.readFileSync("1-estrutura.sql", "utf8");
  if (await feitoComeco("estrutura:")) {
    log("2/6 Estrutura de produção: já aplicada e conferida numa execução anterior.");
  } else {
    if (!virgem) parar("PAROU: o banco já tem objetos, mas a estrutura nunca foi concluída por este script.",
      ["Não vou misturar. Me mande esta mensagem: o banco precisa ser zerado antes (eu passo o passo a passo)."]);
    const blocos = estruturaTxt.split("\n--@@\n").map((s) => s.trim()).filter(Boolean);
    log(`2/6 Estrutura de produção (sem dados): ${blocos.length} comandos numa única transação…`);
    await q("begin");
    await q("set local statement_timeout = 0");
    await q("set local check_function_bodies = off");
    try {
      for (let i = 0; i < blocos.length; i += LOTE) {
        const lote = blocos.slice(i, i + LOTE);
        await q("savepoint lote");
        try { await q(lote.join("\n")); }
        catch (eLote) {
          await q("rollback to savepoint lote");
          for (let j = 0; j < lote.length; j++) {
            try { await q(lote[j]); }
            catch (e) { throw Object.assign(e, { numero: i + j + 1, comando: lote[j] }); }
          }
          throw Object.assign(eLote, { numero: i + 1, comando: "(lote) " + lote[0] });
        }
        await q("release savepoint lote");
        process.stdout.write(`\r   ${Math.min(i + LOTE, blocos.length)}/${blocos.length}`);
      }
      process.stdout.write("\n");
      log("   conferindo objeto por objeto com a produção (antes de gravar)…");
      const { dif, resumo } = comparar(await inventario(), esperado.producao, esperado.equivalentes);
      if (dif.length) { const e = new Error(`${dif.length} diferença(s) com a produção`); e.lista = dif; throw e; }
      resumo.forEach((r) => log("   ✓ " + r));
      await q("insert into public.ambiente_homologacao (nota) values ($1)", [`estrutura:${sha(estruturaTxt).slice(0, 16)}`]);
      await q("commit");
    } catch (e) {
      await q("rollback").catch(() => {});
      const linhas = e.lista ? ["nada foi gravado.", ...e.lista.slice(0, 40)]
        : [`comando nº ${e.numero} de ${blocos.length}: ${String(e.comando ?? "").replace(/\s+/g, " ").slice(0, 300)}`, ...descreverErro(e), "nada foi gravado: o banco voltou ao estado anterior."];
      parar("PAROU na estrutura.", linhas);
    }
    log("   estrutura gravada.");
  }

  // ---------- 4. rehearsal migrations: one transaction each ----------
  log("3/6 Migrações em ensaio…");
  for (const f of Object.keys(esperado.arquivos).filter((x) => /^2-\d+_.*\.sql$/.test(x)).sort()) {
    if (await feito(`migracao:${f}`)) { log(`   ${f}: já aplicada`); continue; }
    try {
      await q("begin");
      await q(fs.readFileSync(f, "utf8"));
      await q("insert into public.ambiente_homologacao (nota) values ($1)", [`migracao:${f}`]);
      await q("commit");
      log(`   ${f}: ok`);
    } catch (e) {
      await q("rollback").catch(() => {});
      parar(`PAROU na migração ${f}.`, [...descreverErro(e), "essa migração não foi gravada; as anteriores ficam. Rodar de novo continua daqui."]);
    }
  }

  // ---------- 5. fictitious users (rerun = new passwords) and fictitious data ----------
  log("4/6 Usuários fictícios…");
  const senhas = [];
  await q("begin");
  try {
    for (const email of USUARIOS) {
      const senha = crypto.randomBytes(12).toString("base64url");
      let u = await um(`update auth.users set encrypted_password = extensions.crypt($2, extensions.gen_salt('bf')), email_confirmed_at = coalesce(email_confirmed_at, now()),
          banned_until = null, deleted_at = null, updated_at = now() where email = $1 returning id`, [email, senha]);
      if (!u) {
        u = await um(`insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
            created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token, email_change_token_current, phone_change, phone_change_token, reauthentication_token)
          values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', $1, extensions.crypt($2, extensions.gen_salt('bf')), now(),
            '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '', '', '', '', '') returning id`, [email, senha]);
      }
      await q(`insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
        select gen_random_uuid(), $1::uuid, $1::text, jsonb_build_object('sub', $1::text, 'email', $2::text, 'email_verified', true), 'email', now(), now(), now()
         where not exists (select 1 from auth.identities where user_id = $1::uuid and provider = 'email')`, [u.id, email]);
      senhas.push([email, senha]);
    }
    await q("commit");
  } catch (e) {
    await q("rollback").catch(() => {});
    parar("PAROU nos usuários fictícios.", [...descreverErro(e), "nenhum usuário foi alterado."]);
  }
  log("5/6 Dados fictícios…");
  try {
    await q(fs.readFileSync("3-dados-ficticios.sql", "utf8"));
    // staging accounts see the Pro screens (Products is Pro): exempt from billing, nothing to pay
    // protect_profile_billing_columns only lets the service role change billing_exempt
    await q("begin");
    await q(`select set_config('request.jwt.claims', '{"role":"service_role"}', true), set_config('request.jwt.claim.role', 'service_role', true)`);
    await q("update public.profiles set billing_exempt = true where user_id in (select id from auth.users where email like '%@vant-homologacao.test') and billing_exempt is distinct from true");
    await q("commit");
    const isentos = await um("select count(*) n from public.profiles p join auth.users u on u.id = p.user_id where u.email like '%@vant-homologacao.test' and p.billing_exempt");
    if (Number(isentos.n) !== USUARIOS.length) parar(`PAROU: só ${isentos.n} de ${USUARIOS.length} contas fictícias ficaram isentas de cobrança.`);
  } catch (e) {
    await q("rollback").catch(() => {});
    parar("PAROU nos dados fictícios.", [...descreverErro(e), "os dados fictícios não foram gravados. Rodar de novo tenta de novo."]);
  }

  // ---------- 6. final check: structure, permissions, no integrations, real login ----------
  log("6/6 Conferência final…");
  const { dif, resumo } = comparar(await inventario(), esperado.final, esperado.equivalentes);
  if (dif.length) parar("PAROU: a estrutura final não confere. Não use a homologação; me mande este erro.", dif.slice(0, 40));
  resumo.forEach((r) => log("   ✓ " + r));

  const integ = await um(`select
      (select count(*) from pg_extension where extname in ('pg_cron', 'pg_net', 'http', 'dblink', 'postgres_fdw', 'wrappers')) ext,
      (select count(*) from pg_proc where pronamespace = 'public'::regnamespace and prosrc ~* '(net\\.http_|http_request|dblink|extensions\\.http)') chamadas,
      (select count(*) from pg_proc where pronamespace = 'public'::regnamespace and prosrc like '%' || $1 || '%') ref_producao,
      (select count(*) from pg_trigger t join pg_proc p on p.oid = t.tgfoid join pg_namespace n on n.oid = p.pronamespace where n.nspname in ('supabase_functions', 'net')) webhooks,
      (select count(*) from auth.users where email not like '%@vant-homologacao.test') reais`, [PRODUCAO]);
  integ.segredos = (await um("select to_regclass('vault.secrets') is not null ok")).ok ? (await um("select count(*) n from vault.secrets")).n : 0;
  const falhas = Object.entries(integ).filter(([, v]) => Number(v) > 0).map(([k, v]) => `${k}: ${v}`);
  if (falhas.length) parar("PAROU: encontrei algo que poderia acionar integração real.", falhas);
  log("   ✓ sem pg_cron/pg_net, sem webhooks, sem chamadas HTTP no banco, sem segredos, sem referência à produção");

  if (LOCAL) {
    log("   (ensaio local: teste de login pulado)");
  } else {
    const H = { apikey: CHAVE_PUBLICA, "Content-Type": "application/json" };
    const anon = await fetch(`${API}/rest/v1/profiles?select=user_id`, { headers: H });
    const anonLinhas = anon.ok ? await anon.json() : [];
    if (anonLinhas.length) parar("PAROU: sem login, a API mostrou perfis. As permissões não conferem.");
    for (const [email, senha] of senhas) {
      const r = await fetch(`${API}/auth/v1/token?grant_type=password`, { method: "POST", headers: H, body: JSON.stringify({ email, password: senha }) });
      const corpo = await r.json().catch(() => ({}));
      if (!r.ok || !corpo.access_token) parar(`PAROU: o login de ${email} falhou (HTTP ${r.status}: ${corpo.error_description || corpo.msg || corpo.error || "sem detalhe"}).`);
      const p = await fetch(`${API}/rest/v1/profiles?select=user_id`, { headers: { ...H, Authorization: `Bearer ${corpo.access_token}` } });
      const linhas = p.ok ? await p.json() : null;
      if (!linhas || linhas.length !== 1 || linhas[0].user_id !== corpo.user?.id) parar(`PAROU: ${email} entrou, mas não vê só o próprio perfil (HTTP ${p.status}).`);
    }
    log("   ✓ os 3 logins entram; cada um vê só o próprio perfil; sem login não vê nada");
  }

  log("\nHOMOLOGAÇÃO PRONTA. Logins (guarde; rodar de novo troca as senhas):");
  senhas.forEach(([e, s]) => log(`   ${e}   ${s}`));
  log("Nenhum dado de produção foi copiado. Nenhuma integração real existe neste banco.");
}

try {
  await principal();
  if (fs.existsSync(ERRO_ARQ)) fs.unlinkSync(ERRO_ARQ);
  await db.end();
} catch (e) {
  const texto = e instanceof Parada ? e.message : ["PAROU com um erro inesperado.", ...descreverErro(e).map((d) => "   " + d)].join("\n");
  console.error("\n" + texto);
  try { fs.writeFileSync(ERRO_ARQ, `${new Date().toISOString()}\n${texto}\n`); console.error(`(salvo em ${ERRO_ARQ}: pode me mandar esse arquivo, ele não tem senha)`); } catch {}
  await db.end().catch(() => {});
  process.exit(1);
}
