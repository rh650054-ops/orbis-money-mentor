import { describe, expect, it } from "vitest";
import { planoAtivo, respostaDoPlano } from "../../supabase/functions/_shared/pluggy-plano";

describe("respostaDoPlano: only true and false are answers", () => {
  it("reads what the RPC said", () => {
    expect(respostaDoPlano({ data: true, error: null })).toBe(true);
    expect(respostaDoPlano({ data: false, error: null })).toBe(false);
  });
  it("an error, an empty answer or anything else is no answer", () => {
    expect(respostaDoPlano({ data: null, error: { message: "canceling statement due to statement timeout" } })).toBeUndefined();
    expect(respostaDoPlano({ data: true, error: { message: "x" } })).toBeUndefined();
    expect(respostaDoPlano({ data: null, error: null })).toBeUndefined();
    expect(respostaDoPlano({ data: "true", error: null })).toBeUndefined();
    expect(respostaDoPlano(null)).toBeUndefined();
  });
});

describe("planoAtivo: asks once more before giving up", () => {
  const fila = (...r: (boolean | undefined | Error)[]) => {
    let n = 0;
    const perguntar = async () => { const v = r[Math.min(n++, r.length - 1)]; if (v instanceof Error) throw v; return v; };
    return { perguntar, vezes: () => n };
  };
  it("an answer on the first try is final, yes or no", async () => {
    const sim = fila(true); const nao = fila(false);
    expect(await planoAtivo(sim.perguntar, 0)).toBe("sim");
    expect(await planoAtivo(nao.perguntar, 0)).toBe("nao");
    expect(sim.vezes()).toBe(1);
    expect(nao.vezes()).toBe(1);
  });
  it("no answer, then an answer", async () => {
    expect(await planoAtivo(fila(undefined, true).perguntar, 0)).toBe("sim");
    expect(await planoAtivo(fila(new Error("timeout"), false).perguntar, 0)).toBe("nao");
  });
  it("no answer twice is 'indisponivel', never 'nao', and it stops at two tries", async () => {
    const f = fila(undefined, new Error("timeout"), true);
    expect(await planoAtivo(f.perguntar, 0)).toBe("indisponivel");
    expect(f.vezes()).toBe(2);
  });
});
