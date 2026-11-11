// Drift check: does the repo still describe what production runs?
// Compares the last definition of each financial function in the repo with the fingerprints
// captured from production (supabase/baseline/manifesto-producao.json).
//   igual        repo == production
//   mudou        the repo's last definition is NEWER than the manifest: a change being proposed
//                (or deployed and waiting for a fresh manifest). Listed, does not fail.
//   divergente   repo's last definition is older than the manifest and different: production was
//                changed outside the repo. FAILS unless listed in pendentes-de-registro.json.
//   ausente      production has it, the repo has no definition. Same rule.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ultimasDefinicoes } from "./funcoes-sql.mjs";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const manifesto = JSON.parse(readFileSync(join(raiz, "supabase/baseline/manifesto-producao.json"), "utf8"));
const pendentes = new Set(JSON.parse(readFileSync(join(raiz, "supabase/baseline/pendentes-de-registro.json"), "utf8")).funcoes);
const corte = manifesto.capturado_em.replaceAll("-", "");
const defs = ultimasDefinicoes(raiz);

const r = { igual: [], mudou: [], divergente: [], ausente: [] };
for (const [nome, hashes] of Object.entries(manifesto.funcoes)) {
  const d = defs.get(nome);
  if (!d) { r.ausente.push(nome); continue; }
  if (hashes.includes(d.hash)) { r.igual.push(nome); continue; }
  const data = d.arquivo.split("/").pop().slice(0, 8);
  const novo = d.arquivo.startsWith("supabase/migrations") && data >= corte;
  (novo ? r.mudou : r.divergente).push(`${nome}  (${d.arquivo})`);
}
const semRegistro = [...r.divergente.map((x) => x.split(" ")[0]), ...r.ausente].filter((n) => !pendentes.has(n));
console.log(`Producao em ${manifesto.capturado_em}: ${Object.keys(manifesto.funcoes).length} funcoes financeiras`);
console.log(`  iguais ao repositorio ............ ${r.igual.length}`);
console.log(`  mudanca proposta no repositorio .. ${r.mudou.length}`); r.mudou.forEach((x) => console.log(`      ${x}`));
console.log(`  divergentes (producao != repo) ... ${r.divergente.length}`);
console.log(`  so existem em producao ........... ${r.ausente.length}`);
console.log(`  ja conhecidas, aguardando registro ${[...pendentes].length}`);
if (semRegistro.length > 0) {
  console.error(`\nFALHA: ${semRegistro.length} funcao(oes) divergem de producao sem registro:`);
  semRegistro.forEach((n) => console.error(`  - ${n}`));
  process.exit(1);
}
console.log("\nOK: nenhuma divergencia nova.");
