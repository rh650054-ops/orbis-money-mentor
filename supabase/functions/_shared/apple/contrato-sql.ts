/* TEST ONLY. The contract between the edge functions and the database: for each SQL function the
   Apple functions call, its parameters as declared in the draft migrations. The handler tests check
   every recorded call against it, so a renamed or missing argument fails in the unit tests instead
   of at the first real notification. */
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

export interface Parametro { nome: string; obrigatorio: boolean }

export function contratoSql(): Map<string, Parametro[]> {
  const pasta = fileURLToPath(new URL("../../../migrations/", import.meta.url));
  const mapa = new Map<string, Parametro[]>();
  for (const arq of readdirSync(pasta).filter((f) => f.startsWith("20261127") && f.endsWith(".sql")).sort()) {
    const sql = readFileSync(pasta + arq, "utf8");
    const re = /create or replace function public\.([a-z_0-9]+)\s*\(([\s\S]*?)\)\s*returns/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(sql))) {
      const params = String(m[2]).split(",").map((p) => p.trim()).filter(Boolean).map((p) => ({ nome: String(p.split(/\s+/)[0]), obrigatorio: !/\sdefault\s/i.test(p) }));
      mapa.set(String(m[1]), params);
    }
  }
  return mapa;
}

/** Problems of one call ("" = none): an argument the function does not have, or a required one missing. */
export function conferirChamada(contrato: Map<string, Parametro[]>, funcao: string, args: Record<string, unknown>): string {
  const params = contrato.get(funcao);
  if (!params) return `funcao desconhecida: ${funcao}`;
  const nomes = new Set(params.map((p) => p.nome));
  const sobrando = Object.keys(args).filter((k) => !nomes.has(k));
  const faltando = params.filter((p) => p.obrigatorio && !(p.nome in args)).map((p) => p.nome);
  return [sobrando.length ? `sobrando ${sobrando.join(",")}` : "", faltando.length ? `faltando ${faltando.join(",")}` : ""].filter(Boolean).join("; ");
}
