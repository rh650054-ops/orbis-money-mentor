// Reads every `create [or replace] function public.x(...)` from supabase/migrations and
// supabase/baseline, in file-name order, and keeps the LAST definition of each function:
// that is what a database built from this repo would run.
// Overloads (same name, other argument types) are separate functions in Postgres: the value of each
// name is its last definition (what drift compares), and `assinaturas` keeps the last definition of
// EVERY signature, so the test database gets all of them (22/11: banco_reconciliar(uuid) and
// banco_reconciliar(uuid, date) both exist since #325; keeping only one broke cases 01-04).
import { readdirSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";

const PADRAO = /create\s+(?:or\s+replace\s+)?function\s+(?:public\.)?"?([a-z0-9_]+)"?\s*\(([\s\S]*?)\)\s*returns[\s\S]*?(\$[a-z_]*\$)([\s\S]*?)\3[^;]*;/gi;

/** Same fingerprint the production manifest uses: md5 of the lower-cased body without whitespace. */
export const impressao = (corpo) => createHash("md5").update(corpo.toLowerCase().replace(/\s+/g, "")).digest("hex").slice(0, 10);

// Argument types only (names, modes and defaults dropped): "p_user uuid, p_desde date default null" -> "uuid,date".
const MULTI = new Set(["timestamp", "time", "double", "character", "bit", "interval"]);
export function assinatura(args) {
  const partes = [];
  let nivel = 0, atual = "";
  for (const ch of args) {
    if (ch === "(") nivel++;
    if (ch === ")") nivel--;
    if (ch === "," && nivel === 0) { partes.push(atual); atual = ""; } else atual += ch;
  }
  if (atual.trim()) partes.push(atual);
  return partes.map((p) => {
    const semDefault = p.replace(/\s+default\s+[\s\S]*$/i, "").replace(/\s*=\s*[\s\S]*$/, "").trim().toLowerCase();
    let t = semDefault.split(/\s+/);
    if (["in", "out", "inout", "variadic"].includes(t[0] ?? "")) t = t.slice(1);
    if (t.length > 1 && !MULTI.has(t[0] ?? "")) t = t.slice(1);
    return ALIAS[t.join(" ").replace(/^public\./, "")] ?? t.join(" ").replace(/^public\./, "");
  }).join(",");
}
// Postgres spells the same type several ways; one spelling per type so a redefinition replaces it.
const ALIAS = {
  timestamptz: "timestamp with time zone", timestamp: "timestamp without time zone", int: "integer", int4: "integer",
  int8: "bigint", int2: "smallint", bool: "boolean", float8: "double precision", float4: "real",
  varchar: "character varying", decimal: "numeric",
};
const DROP = /drop\s+function\s+(?:if\s+exists\s+)?(?:public\.)?"?([a-z0-9_]+)"?\s*(?:\(([^)]*)\))?/gi;

export function ultimasDefinicoes(raiz) {
  const arquivos = [];
  for (const pasta of ["supabase/migrations", "supabase/baseline"]) {
    for (const f of readdirSync(join(raiz, pasta))) if (f.endsWith(".sql")) arquivos.push({ nome: f, caminho: join(raiz, pasta, f), pasta });
  }
  arquivos.sort((a, b) => (a.nome < b.nome ? -1 : a.nome > b.nome ? 1 : 0));
  const defs = new Map();
  for (const a of arquivos) {
    const txt = readFileSync(a.caminho, "utf8");
    // creates and drops in the order they appear: a later `drop function x(args)` removes that signature
    const eventos = [...[...txt.matchAll(PADRAO)].map((m) => ({ m, drop: false })), ...[...txt.matchAll(DROP)].map((m) => ({ m, drop: true }))]
      .sort((x, y) => (x.m.index ?? 0) - (y.m.index ?? 0));
    for (const { m, drop } of eventos) {
      const nome = (m[1] ?? "").toLowerCase();
      const ant = defs.get(nome);
      if (drop) {
        if (!ant) continue;
        if (m[2] === undefined) ant.assinaturas.clear(); else ant.assinaturas.delete(assinatura(m[2]));
        continue;
      }
      const def = { nome, sql: m[0], corpo: m[4], hash: impressao(m[4]), arquivo: `${a.pasta}/${a.nome}`, versoes: (ant?.versoes ?? 0) + 1 };
      const assinaturas = new Map(ant?.assinaturas ?? []);
      assinaturas.delete(assinatura(m[2]));          // re-insert: the map keeps the newest last
      assinaturas.set(assinatura(m[2]), def);
      defs.set(nome, { ...def, assinaturas });
    }
  }
  return defs;
}
