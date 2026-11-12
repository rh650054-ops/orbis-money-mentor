#!/usr/bin/env node
// Compares a PUBLISHED edge function (as downloaded by the Supabase CLI) with a checkout of this
// repository, in BOTH directions:
//   repository → production: every file the function imports here must be in the bundle;
//   production → repository: every file in the bundle must be one the function imports here;
//   and every file present on both sides must have the same bytes.
//
// What a download can and cannot prove (limits, stated in every report):
//   - the bundle holds only the import graph of the entrypoint (index.ts + relative imports,
//     including ../_shared). Files nobody imports are not in production and are not compared;
//   - each function carries ITS OWN copy of the shared files, so they are compared per function;
//   - remote imports (https:, npm:, jsr:) are listed, not compared;
//   - settings (verify_jwt, version) are not in the bundle: the workflow checks them separately;
//   - if the CLI cannot give the original bytes back, files differ and the result is NOT "equal".
//     When nothing matches at all the result is INCONCLUSIVO, never a silent pass.
//
// Usage: node scripts/edge-functions.mjs comparar --repo <checkout> --baixado <dir> --funcao <slug> [--json <file>]
// Exit: 0 IGUAL, 1 DIVERGENTE, 2 INCONCLUSIVO.
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, posix, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const IMPORTA = /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)(["'])([^"'\n]+)\1/g;
const sha = (b) => createHash("sha256").update(b).digest("hex");
const paraPosix = (p) => p.split(sep).join("/");

/** Import graph of a function inside <repo>/supabase/functions. Paths relative to that folder. */
export function dependencias(pastaFuncoes, funcao) {
  const arquivos = new Set();
  const externas = new Set();
  const faltando = [];
  const fila = [posix.join(funcao, "index.ts")];
  while (fila.length) {
    const rel = fila.pop();
    if (arquivos.has(rel)) continue;
    const abs = join(pastaFuncoes, rel);
    if (rel.startsWith("..") || !existsSync(abs)) { faltando.push(rel); continue; }
    arquivos.add(rel);
    const fonte = readFileSync(abs, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    for (const m of fonte.matchAll(IMPORTA)) {
      const alvo = m[2];
      if (alvo.startsWith("./") || alvo.startsWith("../")) fila.push(posix.normalize(posix.join(posix.dirname(rel), alvo)));
      else externas.add(alvo);
    }
  }
  return { arquivos: [...arquivos].sort(), externas: [...externas].sort(), faltando: faltando.sort() };
}

function listar(dir) {
  const saida = [];
  const andar = (d) => {
    for (const nome of readdirSync(d)) {
      const p = join(d, nome);
      if (statSync(p).isDirectory()) andar(p); else saida.push(p);
    }
  };
  if (existsSync(dir)) andar(dir);
  return saida.sort();
}

/** Where a downloaded file belongs, relative to supabase/functions. null = cannot tell. */
export function destinoDoBaixado(relBaixado, funcao, esperados) {
  const p = paraPosix(relBaixado);
  const marca = "supabase/functions/";
  const i = p.lastIndexOf(marca);
  const resto = i >= 0 ? p.slice(i + marca.length) : p;
  if (resto.startsWith(`${funcao}/`) || resto.startsWith("_shared/")) {
    // some CLI versions nest shared files under the function folder
    const aninhado = resto.startsWith(`${funcao}/_shared/`) ? resto.slice(funcao.length + 1) : null;
    if (aninhado && esperados.includes(aninhado) && !esperados.includes(resto)) return aninhado;
    return resto;
  }
  // unknown layout: accept only the ONE expected file that shares the longest path ending
  const fim = (x, y) => { const a = x.split("/").reverse(), b = y.split("/").reverse(); let k = 0; while (k < a.length && k < b.length && a[k] === b[k]) k++; return k; };
  const pontos = esperados.map((e) => fim(resto, e));
  const melhor = Math.max(0, ...pontos);
  const candidatos = esperados.filter((_, i) => melhor > 0 && pontos[i] === melhor);
  return candidatos.length === 1 ? candidatos[0] : null;
}

const semFimDeLinha = (b) => b.toString("utf8").replace(/^﻿/, "").replace(/\r\n?/g, "\n").replace(/\n+$/, "");

export function comparar({ pastaFuncoes, pastaBaixada, funcao }) {
  const dep = dependencias(pastaFuncoes, funcao);
  const r = {
    funcao, iguais: [], diferentes: [], soNoRepositorio: [], soEmProducao: [], desconhecidos: [],
    externas: dep.externas, faltandoNoRepositorio: dep.faltando, manifesto: {}, conclusao: "IGUAL", motivo: "",
  };
  const baixados = new Map();
  for (const abs of listar(pastaBaixada)) {
    const rel = paraPosix(relative(pastaBaixada, abs));
    const destino = destinoDoBaixado(rel, funcao, dep.arquivos);
    if (!destino || baixados.has(destino)) r.desconhecidos.push(rel); else baixados.set(destino, abs);
  }
  for (const rel of dep.arquivos) {
    const noRepo = readFileSync(join(pastaFuncoes, rel));
    const abs = baixados.get(rel);
    if (!abs) { r.soNoRepositorio.push(rel); r.manifesto[rel] = { repositorio: sha(noRepo), producao: null }; continue; }
    const emProd = readFileSync(abs);
    r.manifesto[rel] = { repositorio: sha(noRepo), producao: sha(emProd), bytes: emProd.length };
    if (noRepo.equals(emProd)) r.iguais.push(rel);
    else r.diferentes.push({ arquivo: rel, tipo: semFimDeLinha(noRepo) === semFimDeLinha(emProd) ? "so_fim_de_linha" : "conteudo" });
  }
  for (const [rel, abs] of baixados) {
    if (dep.arquivos.includes(rel)) continue;
    r.soEmProducao.push(rel);
    r.manifesto[rel] = { repositorio: null, producao: sha(readFileSync(abs)) };
  }
  const total = dep.arquivos.length;
  if (dep.faltando.length) { r.conclusao = "INCONCLUSIVO"; r.motivo = "o repositório importa arquivo que não existe"; }
  else if (!baixados.size) { r.conclusao = "INCONCLUSIVO"; r.motivo = "o download não trouxe nenhum arquivo reconhecível"; }
  else if (!baixados.has(posix.join(funcao, "index.ts"))) { r.conclusao = "INCONCLUSIVO"; r.motivo = "o download não trouxe o index.ts da função"; }
  else if (r.desconhecidos.length) { r.conclusao = "INCONCLUSIVO"; r.motivo = "o download trouxe arquivos que não sei onde encaixar"; }
  else if (total >= 2 && r.iguais.length === 0) { r.conclusao = "INCONCLUSIVO"; r.motivo = "nenhum arquivo bate: provável limitação do download, não uma diferença real"; }
  else if (r.diferentes.length || r.soNoRepositorio.length || r.soEmProducao.length) {
    r.conclusao = "DIVERGENTE";
    r.motivo = `${r.diferentes.length} diferente(s), ${r.soNoRepositorio.length} só no repositório, ${r.soEmProducao.length} só em produção`;
  }
  return r;
}

export function relatorio(r) {
  const l = [`${r.conclusao.padEnd(12)} ${r.funcao}  (${r.iguais.length} iguais byte a byte${r.motivo ? `; ${r.motivo}` : ""})`];
  for (const d of r.diferentes) l.push(`  DIFERENTE         ${d.arquivo}  [${d.tipo}]  repo ${r.manifesto[d.arquivo].repositorio.slice(0, 12)} × produção ${r.manifesto[d.arquivo].producao.slice(0, 12)}`);
  for (const a of r.soNoRepositorio) l.push(`  SÓ NO REPOSITÓRIO ${a}  (a função importa aqui, produção não tem)`);
  for (const a of r.soEmProducao) l.push(`  SÓ EM PRODUÇÃO    ${a}  (produção tem, a função não importa aqui)`);
  for (const a of r.desconhecidos) l.push(`  NÃO RECONHECIDO   ${a}`);
  for (const a of r.faltandoNoRepositorio) l.push(`  IMPORT QUEBRADO   ${a}`);
  if (r.externas.length) l.push(`  não comparado: ${r.externas.length} import(s) remoto(s)`);
  return l.join("\n");
}

/** The project the token can see must be production, by every identifier we know. Fails closed. */
export function validarProjeto(lista, esperado) {
  if (!Array.isArray(lista)) return { ok: false, erros: ["a lista de projetos não veio como lista"] };
  const achados = lista.filter((p) => (p.ref ?? p.id) === esperado.ref);
  if (achados.length !== 1) return { ok: false, erros: [`esperava exatamente 1 projeto com ref ${esperado.ref}, achei ${achados.length}`] };
  const p = achados[0];
  const visto = { ref: p.ref ?? p.id, nome: p.name, organizacao: p.organization_id ?? p.organization_slug, regiao: p.region };
  const erros = [];
  for (const k of ["ref", "nome", "organizacao", "regiao"]) {
    if (visto[k] === undefined || visto[k] === null || visto[k] === "") erros.push(`a CLI não informou "${k}": sem isso não confirmo o projeto`);
    else if (visto[k] !== esperado[k]) erros.push(`${k}: esperado "${esperado[k]}", veio "${visto[k]}"`);
  }
  return { ok: erros.length === 0, erros, visto };
}

/** Current state of each function in production (the "previous version" record). Fails closed. */
export function estadoDasFuncoes(lista, funcoes, semJwt) {
  const erros = [];
  const registro = {};
  if (!Array.isArray(lista)) return { ok: false, erros: ["a lista de funções não veio como lista"], registro };
  for (const f of funcoes) {
    const achadas = lista.filter((x) => x.slug === f);
    if (achadas.length !== 1) { erros.push(`${f}: esperava 1 função publicada, achei ${achadas.length}`); continue; }
    const x = achadas[0];
    const jwtEsperado = !semJwt.includes(f);
    if (typeof x.version !== "number") erros.push(`${f}: a CLI não informou a versão`);
    if (typeof x.verify_jwt !== "boolean") erros.push(`${f}: a CLI não informou verify_jwt`);
    else if (x.verify_jwt !== jwtEsperado) erros.push(`${f}: verify_jwt em produção é ${x.verify_jwt}, o esperado é ${jwtEsperado}`);
    if (x.status !== undefined && x.status !== "ACTIVE") erros.push(`${f}: status ${x.status}`);
    registro[f] = { versao: x.version ?? null, verify_jwt: x.verify_jwt ?? null, atualizado_em: x.updated_at ?? null, ezbr_sha256: x.ezbr_sha256 ?? null, status: x.status ?? null };
  }
  return { ok: erros.length === 0, erros, registro };
}

function principal(argv) {
  const [acao, ...resto] = argv;
  const arg = (n) => { const i = resto.indexOf(`--${n}`); return i >= 0 ? resto[i + 1] : undefined; };
  // the CLI may print notices around the JSON; anything that is not a JSON list is refused by the validators
  const ler = (n) => {
    const t = readFileSync(arg(n), "utf8");
    try { return JSON.parse(t); } catch { /* try the list inside */ }
    try { return JSON.parse(t.slice(t.indexOf("["), t.lastIndexOf("]") + 1)); } catch { return null; }
  };
  if (acao === "projeto") {
    const v = validarProjeto(ler("lista"), { ref: process.env.PROJETO_REF, nome: process.env.PROJETO_NOME, organizacao: process.env.PROJETO_ORG, regiao: process.env.PROJETO_REGIAO });
    console.log(v.ok ? `PROJETO CONFIRMADO  ${v.visto.nome} (${v.visto.ref}), organização ${v.visto.organizacao}, região ${v.visto.regiao}` : `PROJETO NÃO CONFIRMADO\n  ${v.erros.join("\n  ")}`);
    return v.ok ? 0 : 3;
  }
  if (acao === "estado") {
    const e = estadoDasFuncoes(ler("lista"), (arg("funcoes") ?? "").split(/\s+/).filter(Boolean), (process.env.SEM_JWT ?? "").split(/\s+/).filter(Boolean));
    for (const [f, x] of Object.entries(e.registro)) console.log(`${f}: versão ${x.versao}, verify_jwt ${x.verify_jwt}, atualizado ${x.atualizado_em}, ezbr ${String(x.ezbr_sha256).slice(0, 12)}`);
    if (!e.ok) console.log(`ESTADO INESPERADO\n  ${e.erros.join("\n  ")}`);
    if (arg("json")) writeFileSync(arg("json"), JSON.stringify(e.registro));
    return e.ok ? 0 : 3;
  }
  if (acao !== "comparar" || !arg("repo") || !arg("baixado") || !arg("funcao")) {
    console.error("uso: edge-functions.mjs comparar --repo <checkout> --baixado <dir> --funcao <slug> [--json <arquivo>]");
    return 2;
  }
  const r = comparar({ pastaFuncoes: join(arg("repo"), "supabase", "functions"), pastaBaixada: arg("baixado"), funcao: arg("funcao") });
  console.log(relatorio(r));
  if (arg("json")) writeFileSync(arg("json"), JSON.stringify(r, null, 2));
  return r.conclusao === "IGUAL" ? 0 : r.conclusao === "DIVERGENTE" ? 1 : 2;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) process.exit(principal(process.argv.slice(2)));
