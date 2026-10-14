// Regras da recuperação de senha (sem rede). Roda no vitest do app (preflight).
import { describe, expect, it } from "vitest";
import { type Deps, pedir, trocar, verificar } from "./recuperacao-senha";

const CPF = "52998224725";
const TOKEN = "a".repeat(64);
const UUID = "6f1c1d1e-0000-4000-8000-000000000001";

function fake(over: Partial<Deps> = {}) {
  const logs: string[] = [];
  const chamadas: string[] = [];
  let id = 0;
  const deps: Deps = {
    frear: async () => true,
    criarDesafio: async () => ({ email: "ana@ex.com", nome: "Ana", codigo: "123456" }),
    invalidarDesafio: async () => { chamadas.push("invalidar"); },
    verificarDesafio: async (_i, c) => (c === "123456" ? { status: "ok", token: TOKEN } : { status: "errado", token: null }),
    consumirTroca: async (t) => (t === TOKEN ? { desafioId: UUID, userId: "u1" } : null),
    reabrirTroca: async () => { chamadas.push("reabrir"); },
    concluirTroca: async () => { chamadas.push("concluir"); },
    trocarSenha: async () => true,
    enviarCodigo: async () => { chamadas.push("enviar"); },
    hash: async (t) => [...t].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7).toString(16).padStart(64, "0"),
    novoId: () => `00000000-0000-4000-8000-00000000000${++id}`,
    log: (e) => logs.push(e),
    ...over,
  };
  return { deps, logs, chamadas };
}

describe("pedir", () => {
  it("responde igual para conta com e sem e-mail confirmado", async () => {
    const com = fake();
    const sem = fake({ criarDesafio: async () => null });
    const a = pedir(CPF, "1.1.1.1", com.deps);
    const b = pedir(CPF, "1.1.1.1", sem.deps);
    await Promise.all([a.trabalho, b.trabalho]);
    expect(Object.keys(a.resposta)).toEqual(Object.keys(b.resposta));
    expect(a.resposta.ok).toBe(true);
    expect(com.chamadas).toContain("enviar");
    expect(sem.chamadas).not.toContain("enviar");
  });

  it("CPF inválido não toca no freio nem no banco, e responde igual", async () => {
    let tocou = false;
    const f = fake({ frear: async () => { tocou = true; return true; }, criarDesafio: async () => { tocou = true; return null; } });
    const r = pedir("123", "ip", f.deps);
    await r.trabalho;
    expect(r.resposta.ok).toBe(true);
    expect(tocou).toBe(false);
  });

  it("freio fora do ar = não processa (falha fechada)", async () => {
    let criou = false;
    const f = fake({ frear: async () => { throw new Error("db"); }, criarDesafio: async () => { criou = true; return null; } });
    const r = pedir(CPF, "ip", f.deps);
    await r.trabalho;
    expect(r.resposta.ok).toBe(true);
    expect(criou).toBe(false);
    expect(f.logs).toContain("freio_indisponivel");
  });

  it("freio respondendo null/estranho também bloqueia", async () => {
    let criou = false;
    const f = fake({ frear: async () => null as unknown as boolean, criarDesafio: async () => { criou = true; return null; } });
    await pedir(CPF, "ip", f.deps).trabalho;
    expect(criou).toBe(false);
  });

  it("limite por IP e por CPF usam chaves com hash (sem CPF/IP em claro)", async () => {
    const chaves: string[] = [];
    const f = fake({ frear: async (c) => { chaves.push(c); return true; } });
    await pedir(CPF, "9.9.9.9", f.deps).trabalho;
    expect(chaves).toHaveLength(2);
    expect(chaves.join()).not.toContain(CPF);
    expect(chaves.join()).not.toContain("9.9.9.9");
  });

  it("e-mail falhou: invalida o desafio e não vaza nada", async () => {
    const f = fake({ enviarCodigo: async () => { throw new Error("Resend 500 ana@ex.com 123456"); } });
    const r = pedir(CPF, "ip", f.deps);
    await r.trabalho;
    expect(r.resposta.ok).toBe(true);
    expect(f.chamadas).toContain("invalidar");
    expect(f.logs).toEqual(["email_falhou"]);
  });

  it("banco falhou: resposta igual, log sem dados", async () => {
    const f = fake({ criarDesafio: async () => { throw new Error(`cpf ${CPF}`); } });
    const r = pedir(CPF, "ip", f.deps);
    await r.trabalho;
    expect(r.resposta.ok).toBe(true);
    expect(f.logs.join()).not.toContain(CPF);
  });
});

describe("verificar", () => {
  it("código certo devolve token", async () => {
    expect(await verificar(UUID, "123456", "ip", fake().deps)).toEqual({ ok: true, token: TOKEN });
  });

  it("errado, expirado, bloqueado e inexistente respondem igual", async () => {
    for (const status of ["errado", "expirado", "bloqueado", "invalido"]) {
      const f = fake({ verificarDesafio: async () => ({ status, token: null }) });
      expect(await verificar(UUID, "654321", "ip", f.deps)).toEqual({ ok: false, erro: "codigo" });
    }
    expect(await verificar("nao-e-uuid", "123456", "ip", fake().deps)).toEqual({ ok: false, erro: "codigo" });
  });

  it("freio fora do ar bloqueia", async () => {
    const f = fake({ frear: async () => { throw new Error("x"); } });
    expect(await verificar(UUID, "123456", "ip", f.deps)).toEqual({ ok: false, erro: "limite" });
  });

  it("banco fora do ar: indisponível", async () => {
    const f = fake({ verificarDesafio: async () => { throw new Error("db"); } });
    expect(await verificar(UUID, "123456", "ip", f.deps)).toEqual({ ok: false, erro: "indisponivel" });
  });
});

describe("trocar", () => {
  it("troca a senha e derruba as sessões", async () => {
    const f = fake();
    expect(await trocar(TOKEN, "senhaNova1", "senhaNova1", "ip", f.deps)).toEqual({ ok: true });
    expect(f.chamadas).toEqual(["concluir"]);
  });

  it("senha com menos de 8, diferente ou longa demais não consome o token", async () => {
    let consumiu = false;
    const f = fake({ consumirTroca: async () => { consumiu = true; return null; } });
    expect(await trocar(TOKEN, "1234567", "1234567", "ip", f.deps)).toEqual({ ok: false, erro: "senha_curta" });
    expect(await trocar(TOKEN, "senhaNova1", "senhaNova2", "ip", f.deps)).toEqual({ ok: false, erro: "senhas_diferentes" });
    expect(await trocar(TOKEN, "x".repeat(73), "x".repeat(73), "ip", f.deps)).toEqual({ ok: false, erro: "senha_longa" });
    expect(consumiu).toBe(false);
  });

  it("token inválido ou já usado", async () => {
    expect(await trocar("b".repeat(64), "senhaNova1", "senhaNova1", "ip", fake().deps)).toEqual({ ok: false, erro: "token" });
    expect(await trocar("curto", "senhaNova1", "senhaNova1", "ip", fake().deps)).toEqual({ ok: false, erro: "token" });
  });

  it("Auth recusou a senha: reabre o token", async () => {
    const f = fake({ trocarSenha: async () => false });
    expect(await trocar(TOKEN, "senhaNova1", "senhaNova1", "ip", f.deps)).toEqual({ ok: false, erro: "senha_recusada" });
    expect(f.chamadas).toEqual(["reabrir"]);
  });

  it("Auth fora do ar: reabre e avisa indisponível", async () => {
    const f = fake({ trocarSenha: async () => { throw new Error("503"); } });
    expect(await trocar(TOKEN, "senhaNova1", "senhaNova1", "ip", f.deps)).toEqual({ ok: false, erro: "indisponivel" });
    expect(f.chamadas).toEqual(["reabrir"]);
  });

  it("derrubar sessões falhou: tenta 3 vezes", async () => {
    let n = 0;
    const f = fake({ concluirTroca: async () => { n++; if (n < 3) throw new Error("db"); } });
    expect(await trocar(TOKEN, "senhaNova1", "senhaNova1", "ip", f.deps)).toEqual({ ok: true });
    expect(n).toBe(3);
  });

  it("freio fora do ar bloqueia", async () => {
    const f = fake({ frear: async () => { throw new Error("x"); } });
    expect(await trocar(TOKEN, "senhaNova1", "senhaNova1", "ip", f.deps)).toEqual({ ok: false, erro: "limite" });
  });

  it("nenhum log carrega senha, token ou código", async () => {
    const f = fake({ trocarSenha: async () => { throw new Error("senhaNova1"); }, reabrirTroca: async () => { throw new Error(TOKEN); } });
    await trocar(TOKEN, "senhaNova1", "senhaNova1", "ip", f.deps);
    expect(f.logs.join()).not.toMatch(/senhaNova1|a{64}|123456/);
  });
});
