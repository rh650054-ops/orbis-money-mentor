import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { comparar, dependencias, destinoDoBaixado, estadoDasFuncoes, validarProjeto } from "../../scripts/edge-functions.mjs";

// Published function × repository, both directions (owner's review of PR #299).
function pasta(arquivos: Record<string, string>): string {
  const raiz = mkdtempSync(join(tmpdir(), "edge-"));
  for (const [rel, conteudo] of Object.entries(arquivos)) {
    mkdirSync(dirname(join(raiz, rel)), { recursive: true });
    writeFileSync(join(raiz, rel), conteudo);
  }
  return raiz;
}
const INDEX = `import { a } from "../_shared/a.ts";\nimport { serve } from "https://deno.land/std/http/server.ts";\nserve(() => a());\n`;
const A = `import { b } from "./b.ts";\nexport const a = () => b;\n`;
const B = `export const b = 1;\n`;
const repo = () => pasta({ "robo/index.ts": INDEX, "_shared/a.ts": A, "_shared/b.ts": B, "_shared/ninguem-importa.ts": "export {};\n", "outra/index.ts": B });
const baixado = (extra: Record<string, string> = {}, base: Record<string, string> = { "supabase/functions/robo/index.ts": INDEX, "supabase/functions/_shared/a.ts": A, "supabase/functions/_shared/b.ts": B }) => pasta({ ...base, ...extra });
const cmp = (pastaBaixada: string, pastaFuncoes = repo()) => comparar({ pastaFuncoes, pastaBaixada, funcao: "robo" });

describe("import graph of a function", () => {
  it("follows relative imports through shared files, lists remote ones, ignores what nobody imports", () => {
    const d = dependencias(repo(), "robo");
    expect(d.arquivos).toEqual(["_shared/a.ts", "_shared/b.ts", "robo/index.ts"]);
    expect(d.externas).toEqual(["https://deno.land/std/http/server.ts"]);
    expect(d.faltando).toEqual([]);
  });
  it("an import inside a comment does not count; a broken import is reported", () => {
    const r = pasta({ "robo/index.ts": `// import { x } from "./fantasma.ts";\nimport { y } from "./some.ts";\n` });
    const d = dependencias(r, "robo");
    expect(d.arquivos).toEqual(["robo/index.ts"]);
    expect(d.faltando).toEqual(["robo/some.ts"]);
  });
});

describe("published × repository, both directions", () => {
  it("same bytes on every file of the graph → IGUAL", () => {
    const r = cmp(baixado());
    expect(r.conclusao).toBe("IGUAL");
    expect(r.iguais).toHaveLength(3);
  });
  it("production → repository: a file only production has → DIVERGENTE", () => {
    const r = cmp(baixado({ "supabase/functions/_shared/remendo.ts": "export const quente = 1;\n" }));
    expect(r.conclusao).toBe("DIVERGENTE");
    expect(r.soEmProducao).toEqual(["_shared/remendo.ts"]);
  });
  it("repository → production: a dependency production does not have → DIVERGENTE", () => {
    const r = cmp(baixado({}, { "supabase/functions/robo/index.ts": INDEX, "supabase/functions/_shared/a.ts": A }));
    expect(r.conclusao).toBe("DIVERGENTE");
    expect(r.soNoRepositorio).toEqual(["_shared/b.ts"]);
  });
  it("one changed byte in a SHARED file → DIVERGENTE, and it says which file", () => {
    const r = cmp(baixado({ "supabase/functions/_shared/b.ts": "export const b = 2;\n" }));
    expect(r.conclusao).toBe("DIVERGENTE");
    expect(r.diferentes).toEqual([{ arquivo: "_shared/b.ts", tipo: "conteudo" }]);
  });
  it("only line endings differ → still DIVERGENTE, labelled so it can be explained", () => {
    const r = cmp(baixado({ "supabase/functions/_shared/a.ts": A.replace(/\n/g, "\r\n") }));
    expect(r.conclusao).toBe("DIVERGENTE");
    expect(r.diferentes).toEqual([{ arquivo: "_shared/a.ts", tipo: "so_fim_de_linha" }]);
  });
  it("a file of the repository that nobody imports is not expected in production", () => {
    expect(cmp(baixado()).soNoRepositorio).toEqual([]);
  });
});

describe("limits of the CLI download never become a silent pass", () => {
  it("empty download → INCONCLUSIVO", () => expect(cmp(pasta({})).conclusao).toBe("INCONCLUSIVO"));
  it("no index.ts in the download → INCONCLUSIVO", () => {
    expect(cmp(baixado({}, { "supabase/functions/_shared/a.ts": A, "supabase/functions/_shared/b.ts": B })).conclusao).toBe("INCONCLUSIVO");
  });
  it("a downloaded file that fits nowhere → INCONCLUSIVO", () => {
    const r = cmp(baixado({ "eszip/metadata.json": "{}" }));
    expect(r.conclusao).toBe("INCONCLUSIVO");
    expect(r.desconhecidos).toEqual(["eszip/metadata.json"]);
  });
  it("nothing matches at all (e.g. transpiled output) → INCONCLUSIVO, not a list of 'differences'", () => {
    const r = cmp(baixado({}, { "supabase/functions/robo/index.ts": "x", "supabase/functions/_shared/a.ts": "y", "supabase/functions/_shared/b.ts": "z" }));
    expect(r.conclusao).toBe("INCONCLUSIVO");
  });
  it("other layouts: shared files nested under the function, or no supabase/functions prefix", () => {
    expect(cmp(baixado({}, { "supabase/functions/robo/index.ts": INDEX, "supabase/functions/robo/_shared/a.ts": A, "supabase/functions/robo/_shared/b.ts": B })).conclusao).toBe("IGUAL");
    expect(cmp(baixado({}, { "robo/index.ts": INDEX, "_shared/a.ts": A, "_shared/b.ts": B })).conclusao).toBe("IGUAL");
    expect(destinoDoBaixado("source/index.ts", "robo", ["robo/index.ts", "_shared/a.ts"])).toBe("robo/index.ts");
    expect(destinoDoBaixado("x/index.ts", "robo", ["robo/index.ts", "robo/sub/index.ts"])).toBeNull(); // ambiguous
  });
});

describe("the project must be production, unequivocally", () => {
  const esperado = { ref: "abcprod", nome: "Loja", organizacao: "org1", regiao: "sa-east-1" };
  const prod = { id: "abcprod", ref: "abcprod", name: "Loja", organization_id: "org1", region: "sa-east-1" };
  it("ref, name, organization and region all match → confirmed", () => {
    expect(validarProjeto([{ id: "outro", name: "Teste", organization_id: "org1", region: "sa-east-1" }, prod], esperado).ok).toBe(true);
  });
  it.each([
    ["the token does not see production", [{ ...prod, id: "x", ref: "x" }]],
    ["same ref, another name", [{ ...prod, name: "Loja (cópia)" }]],
    ["same ref, another organization", [{ ...prod, organization_id: "org2" }]],
    ["same ref, another region", [{ ...prod, region: "us-east-1" }]],
    ["the CLI stops reporting the organization", [{ id: "abcprod", name: "Loja", region: "sa-east-1" }]],
    ["not a list", { erro: "401" }],
  ])("%s → refused", (_nome, lista) => expect(validarProjeto(lista, esperado).ok).toBe(false));
});

describe("state of the published functions (the 'previous version' record)", () => {
  const lista = [
    { slug: "robo", version: 27, verify_jwt: false, status: "ACTIVE", updated_at: 1, ezbr_sha256: "aa" },
    { slug: "app", version: 29, verify_jwt: true, status: "ACTIVE", updated_at: 2, ezbr_sha256: "bb" },
  ];
  it("records version and hash, and checks the JWT gate each function must have", () => {
    const e = estadoDasFuncoes(lista, ["robo", "app"], ["robo"]);
    expect(e.ok).toBe(true);
    expect(e.registro.robo).toMatchObject({ versao: 27, verify_jwt: false, ezbr_sha256: "aa" });
  });
  it("a cron function found WITH the JWT gate, a missing function or a missing version → refused", () => {
    expect(estadoDasFuncoes(lista, ["app"], ["app"]).ok).toBe(false);
    expect(estadoDasFuncoes(lista, ["nao-existe"], []).ok).toBe(false);
    expect(estadoDasFuncoes([{ slug: "robo", verify_jwt: false }], ["robo"], ["robo"]).ok).toBe(false);
  });
});
