// Reads every `create [or replace] function public.x(...)` from supabase/migrations and
// supabase/baseline, in file-name order, and keeps the LAST definition of each function:
// that is what a database built from this repo would run.
import { readdirSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";

const PADRAO = /create\s+(?:or\s+replace\s+)?function\s+(?:public\.)?"?([a-z0-9_]+)"?\s*\(([\s\S]*?)\)\s*returns[\s\S]*?(\$[a-z_]*\$)([\s\S]*?)\3[^;]*;/gi;

/** Same fingerprint the production manifest uses: md5 of the lower-cased body without whitespace. */
export const impressao = (corpo) => createHash("md5").update(corpo.toLowerCase().replace(/\s+/g, "")).digest("hex").slice(0, 10);

export function ultimasDefinicoes(raiz) {
  const arquivos = [];
  for (const pasta of ["supabase/migrations", "supabase/baseline"]) {
    for (const f of readdirSync(join(raiz, pasta))) if (f.endsWith(".sql")) arquivos.push({ nome: f, caminho: join(raiz, pasta, f), pasta });
  }
  arquivos.sort((a, b) => (a.nome < b.nome ? -1 : a.nome > b.nome ? 1 : 0));
  const defs = new Map();
  for (const a of arquivos) {
    const txt = readFileSync(a.caminho, "utf8");
    for (const m of txt.matchAll(PADRAO)) {
      const nome = m[1].toLowerCase();
      const ant = defs.get(nome);
      defs.set(nome, { nome, sql: m[0], corpo: m[4], hash: impressao(m[4]), arquivo: `${a.pasta}/${a.nome}`, versoes: (ant?.versoes ?? 0) + 1 });
    }
  }
  return defs;
}
