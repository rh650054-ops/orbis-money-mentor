/* The purchase flow against a fake StoreKit that behaves like the real one where it matters: a paid
   transaction stays "unfinished" and keeps coming back until someone finishes it. Each scenario is
   one of the list Rick asked for (27/11/2026). No real purchase, no network. */
import { describe, expect, it, vi } from "vitest";
import { criarFluxo, type RespostaDoServidor } from "./fluxo-compra";
import type { Ponte } from "./ponte";
import { PRODUTO, type RespostaDaLoja, type TransacaoApple } from "../types";

const CONTA_A = "11111111-1111-4111-8111-111111111111";
const CONTA_B = "22222222-2222-4222-8222-222222222222";

function lojaFalsa() {
  let n = 100;
  const naoConcluidas = new Map<string, TransacaoApple>();
  const direitos = new Map<string, TransacaoApple>();
  const chamadas: string[] = [];
  let proxima: "comprar" | "pendente" | "cancelar" | { erro: string } = "comprar";
  const nova = (produto: string, conta: string | undefined, original?: string): TransacaoApple => {
    const id = String(++n);
    const t: TransacaoApple = { jws: `jws-${id}`, transacao: id, original: original ?? id, produto, conta };
    naoConcluidas.set(id, t); direitos.set(t.original, t);
    return t;
  };
  const ponte: Ponte = {
    podePagar: async () => ({ pode: true }),
    produtos: async () => ({ produtos: [] }),
    comprar: async ({ produto, conta }): Promise<RespostaDaLoja> => {
      chamadas.push(`comprar:${produto}`);
      if (typeof proxima === "object") throw Object.assign(new Error("x"), { code: proxima.erro });
      if (proxima === "cancelar") return { estado: "cancelada", produto };
      if (proxima === "pendente") return { estado: "pendente", produto };
      return { estado: "comprada", ...nova(produto, conta) };
    },
    concluir: async ({ transacao }) => { chamadas.push(`concluir:${transacao}`); return { concluida: naoConcluidas.delete(transacao) }; },
    pendentes: async () => ({ transacoes: [...naoConcluidas.values()] }),
    direitos: async () => ({ transacoes: [...direitos.values()] }),
    sincronizar: async () => { chamadas.push("sincronizar"); },
    gerenciar: async () => undefined,
    addListener: async () => ({ remove: async () => undefined }),
  };
  return { ponte, chamadas, naoConcluidas, nova, proximaCompra: (x: typeof proxima) => { proxima = x; } };
}

function montar(conta: string | null = CONTA_A) {
  const loja = lojaFalsa();
  const servidor = { resposta: ((): RespostaDoServidor => ({ tipo: "ok", resultados: [{ resultado: "gravada" }] })) as (jws: string[]) => RespostaDoServidor, recebidos: [] as string[] };
  const sessao = { conta };
  const validar = vi.fn(async (jws: string[]) => { servidor.recebidos.push(...jws); loja.chamadas.push(`validar:${jws.join(",")}`); return servidor.resposta(jws); });
  const fluxo = criarFluxo({ ponte: loja.ponte, validar, conta: () => sessao.conta });
  return { loja, servidor, sessao, validar, fluxo };
}

describe("a purchase that goes well", () => {
  it.each([["Essencial", PRODUTO.essencial], ["Pro mensal", PRODUTO.proMensal], ["Pro anual", PRODUTO.proAnual], ["banco adicional", PRODUTO.banco]])(
    "%s: bought for the logged-in account, validated on the server, and finished ONLY after the server stored it", async (_n, produto) => {
      const { fluxo, loja } = montar();
      expect(await fluxo.comprar(produto)).toEqual({ estado: "liberada", produto });
      expect(loja.chamadas).toEqual([`comprar:${produto}`, "validar:jws-101", "concluir:101"]);
      expect(loja.naoConcluidas.size).toBe(0);
    });

  it("the server already had it (a repeated or out-of-order copy): finished too, nothing to redo", async () => {
    for (const resultado of ["antigo_ignorado", "periodo_antigo"]) {
      const { fluxo, loja, servidor } = montar();
      servidor.resposta = () => ({ tipo: "ok", resultados: [{ resultado }] });
      expect((await fluxo.comprar(PRODUTO.proMensal)).estado).toBe("liberada");
      expect(loja.naoConcluidas.size).toBe(0);
    }
  });
});

describe("the customer gives up, or the store fails before any payment", () => {
  it("cancelled on Apple's sheet: nothing sent to the server, nothing to finish", async () => {
    const { fluxo, loja, validar } = montar();
    loja.proximaCompra("cancelar");
    expect(await fluxo.comprar(PRODUTO.proAnual)).toEqual({ estado: "cancelada" });
    loja.proximaCompra({ erro: "cancelada" });
    expect(await fluxo.comprar(PRODUTO.proAnual)).toEqual({ estado: "cancelada" });
    expect(validar).not.toHaveBeenCalled();
  });

  it("no internet, product unavailable, purchases disabled, any other store failure: reported as 'nothing was charged'", async () => {
    const { fluxo, loja, validar } = montar();
    for (const [erro, motivo] of [["sem_internet", "sem_internet"], ["produto_indisponivel", "produto_indisponivel"], ["compra_nao_permitida", "compra_nao_permitida"], ["qualquer_outra", "falha_na_loja"]]) {
      loja.proximaCompra({ erro: String(erro) });
      expect(await fluxo.comprar(PRODUTO.essencial)).toEqual({ estado: "falhou", motivo });
    }
    expect(validar).not.toHaveBeenCalled();
    expect(loja.naoConcluidas.size).toBe(0);
  });

  it("nobody logged in: Apple's sheet is not even opened", async () => {
    const { fluxo, loja } = montar(null);
    expect(await fluxo.comprar(PRODUTO.essencial)).toEqual({ estado: "falhou", motivo: "sem_sessao" });
    expect(loja.chamadas).toEqual([]);
  });
});

describe("pending purchase (Ask to Buy, bank approval)", () => {
  it("nothing is validated and no access is asked for; when Apple approves, the transaction arrives and is processed like any other", async () => {
    const { fluxo, loja, validar } = montar();
    loja.proximaCompra("pendente");
    expect(await fluxo.comprar(PRODUTO.proMensal)).toEqual({ estado: "pendente_aprovacao", produto: PRODUTO.proMensal });
    expect(validar).not.toHaveBeenCalled();
    const aprovada = loja.nova(PRODUTO.proMensal, CONTA_A);   // what the listener delivers later
    expect(await fluxo.processar(aprovada)).toEqual({ estado: "liberada", produto: PRODUTO.proMensal });
    expect(loja.naoConcluidas.size).toBe(0);
  });
});

describe("PAID, and the server cannot confirm it now", () => {
  it.each([["no internet after the payment", { tipo: "sem_internet" } as RespostaDoServidor, "sem_internet"],
    ["server down (5xx)", { tipo: "servidor" } as RespostaDoServidor, "servidor"],
    ["server asks to try again (503)", { tipo: "ok", resultados: [{ resultado: "tente_de_novo" }] } as RespostaDoServidor, "servidor"],
    ["session expired", { tipo: "sessao" } as RespostaDoServidor, "sessao"]])(
    "%s: the transaction is NOT finished, and the recovery finishes it later WITHOUT a new purchase", async (_n, falha, motivo) => {
      const { fluxo, loja, servidor } = montar();
      servidor.resposta = () => falha;
      expect(await fluxo.comprar(PRODUTO.proAnual)).toEqual({ estado: "aguardando_servidor", produto: PRODUTO.proAnual, motivo });
      expect(loja.naoConcluidas.size).toBe(1);
      expect(loja.chamadas.some((c) => c.startsWith("concluir"))).toBe(false);
      // still failing: it stays there, however many times the app tries
      expect(await fluxo.recuperar()).toEqual([{ estado: "aguardando_servidor", produto: PRODUTO.proAnual, motivo }]);
      expect(loja.naoConcluidas.size).toBe(1);
      // the server is back
      servidor.resposta = () => ({ tipo: "ok", resultados: [{ resultado: "gravada" }] });
      expect(await fluxo.recuperar()).toEqual([{ estado: "liberada", produto: PRODUTO.proAnual }]);
      expect(loja.naoConcluidas.size).toBe(0);
      expect(loja.chamadas.filter((c) => c.startsWith("comprar"))).toHaveLength(1);
    });

  it("the call to the server blows up: treated as no internet, never as 'done'", async () => {
    const { fluxo, loja, validar } = montar();
    validar.mockRejectedValueOnce(new Error("Failed to fetch"));
    expect((await fluxo.comprar(PRODUTO.essencial)).estado).toBe("aguardando_servidor");
    expect(loja.naoConcluidas.size).toBe(1);
  });

  it("the app was closed right after paying: at the next launch the purchase is found and released", async () => {
    const { fluxo, loja } = montar();
    loja.nova(PRODUTO.proMensal, CONTA_A);   // paid in a previous run, never validated
    expect(await fluxo.recuperar()).toEqual([{ estado: "liberada", produto: PRODUTO.proMensal }]);
    expect(loja.chamadas).toEqual(["validar:jws-101", "concluir:101"]);
  });
});

describe("changing account during a purchase", () => {
  it("a purchase made for account A is never sent as account B's and is NOT finished; when A logs in again it is released", async () => {
    const { fluxo, loja, sessao, validar } = montar(CONTA_A);
    const deA = loja.nova(PRODUTO.proAnual, CONTA_A);
    sessao.conta = CONTA_B;
    expect(await fluxo.processar(deA)).toEqual({ estado: "de_outra_conta", produto: PRODUTO.proAnual });
    expect(await fluxo.recuperar()).toEqual([{ estado: "de_outra_conta", produto: PRODUTO.proAnual }]);
    expect(validar).not.toHaveBeenCalled();
    expect(loja.naoConcluidas.size).toBe(1);
    sessao.conta = CONTA_A;
    expect(await fluxo.recuperar()).toEqual([{ estado: "liberada", produto: PRODUTO.proAnual }]);
    expect(loja.naoConcluidas.size).toBe(0);
  });

  it("the server says it belongs to another account: not finished either", async () => {
    const { fluxo, loja, servidor } = montar();
    servidor.resposta = () => ({ tipo: "ok", resultados: [{ resultado: "pertence_a_outra_conta" }] });
    expect(await fluxo.processar(loja.nova(PRODUTO.essencial, undefined))).toEqual({ estado: "de_outra_conta", produto: PRODUTO.essencial });
    expect(loja.naoConcluidas.size).toBe(1);
  });

  it("logged out in the middle: nothing is sent and nothing is finished", async () => {
    const { fluxo, loja, sessao, validar } = montar();
    const t = loja.nova(PRODUTO.essencial, CONTA_A);
    sessao.conta = null;
    expect((await fluxo.processar(t)).estado).toBe("aguardando_servidor");
    expect(await fluxo.recuperar()).toEqual([]);
    expect(validar).not.toHaveBeenCalled();
    expect(loja.naoConcluidas.size).toBe(1);
  });
});

describe("renewal, refund, upgrade and downgrade arrive through the listener", () => {
  it("a renewal is a new transaction of the same subscription: validated and finished", async () => {
    const { fluxo, loja } = montar();
    await fluxo.comprar(PRODUTO.proMensal);
    const renovacao = loja.nova(PRODUTO.proMensal, CONTA_A, "101");
    expect(await fluxo.processar(renovacao)).toEqual({ estado: "liberada", produto: PRODUTO.proMensal });
    expect(loja.chamadas.slice(-2)).toEqual(["validar:jws-102", "concluir:102"]);
  });

  it("a refund: the server records it; a refunded transaction presented later is finished and gives nothing", async () => {
    const { fluxo, loja, servidor } = montar();
    servidor.resposta = () => ({ tipo: "ok", resultados: [{ resultado: "reembolsada" }] });
    expect(await fluxo.processar({ ...loja.nova(PRODUTO.proAnual, CONTA_A), revogada: Date.now() })).toEqual({ estado: "recusada", produto: PRODUTO.proAnual, motivo: "reembolsada" });
    expect(loja.naoConcluidas.size).toBe(0);
  });

  it("upgrade (Essencial -> Pro) and downgrade asked (Pro -> Essencial): each is a transaction of the same subscription, sent with its own product", async () => {
    const { fluxo, loja, servidor } = montar();
    await fluxo.comprar(PRODUTO.essencial);
    expect(await fluxo.processar(loja.nova(PRODUTO.proMensal, CONTA_A, "101"))).toEqual({ estado: "liberada", produto: PRODUTO.proMensal });
    expect(await fluxo.processar(loja.nova(PRODUTO.essencial, CONTA_A, "101"))).toEqual({ estado: "liberada", produto: PRODUTO.essencial });
    expect(servidor.recebidos).toEqual(["jws-101", "jws-102", "jws-103"]);
    expect(loja.naoConcluidas.size).toBe(0);
  });

  it("the same transaction arriving twice at once (the purchase result and the listener) goes to the server once", async () => {
    const { fluxo, loja, validar } = montar();
    const t = loja.nova(PRODUTO.proMensal, CONTA_A);
    const [a, b] = await Promise.all([fluxo.processar(t), fluxo.processar(t)]);
    expect(a).toEqual(b);
    expect(validar).toHaveBeenCalledTimes(1);
    expect(loja.chamadas.filter((c) => c.startsWith("concluir"))).toHaveLength(1);
  });

  it("a signature the server refuses on a transaction StoreKit did NOT verify: not finished and reported, never released", async () => {
    const { fluxo, loja, servidor } = montar();
    servidor.resposta = () => ({ tipo: "ok", resultados: [{ resultado: "assinatura_invalida" }] });
    const t = { ...loja.nova(PRODUTO.proMensal, CONTA_A), verificadaNoAparelho: false };
    expect(await fluxo.processar(t)).toEqual({ estado: "recusada", produto: PRODUTO.proMensal, motivo: "assinatura_invalida" });
    expect(loja.naoConcluidas.size).toBe(1);
  });

  it("27/11: a purchase StoreKit verified but the server refused (our side failing): payment kept, not finished, retried until confirmed", async () => {
    const { fluxo, loja, servidor } = montar();
    servidor.resposta = () => ({ tipo: "ok", resultados: [{ resultado: "assinatura_invalida" }] });
    const t = { ...loja.nova(PRODUTO.essencial, CONTA_A), verificadaNoAparelho: true };
    expect(await fluxo.processar(t)).toEqual({ estado: "aguardando_servidor", produto: PRODUTO.essencial, motivo: "servidor" });
    expect(loja.naoConcluidas.size).toBe(1);
    // the server is fixed: the same unfinished purchase is confirmed by the legitimate path, once
    servidor.resposta = () => ({ tipo: "ok", resultados: [{ resultado: "gravada" }] });
    expect(await fluxo.recuperar()).toEqual([{ estado: "liberada", produto: PRODUTO.essencial }]);
    expect(loja.naoConcluidas.size).toBe(0);
  });
});

describe("restoring purchases", () => {
  it("asks the App Store again, sends what the Apple account has, and releases", async () => {
    const { fluxo, loja } = montar();
    const t = loja.nova(PRODUTO.proAnual, CONTA_A);
    loja.naoConcluidas.clear();   // bought and finished on another iPhone
    expect(await fluxo.restaurar()).toMatchObject({ estado: "restaurada" });
    expect(loja.chamadas).toEqual(["sincronizar", `validar:${t.jws}`, `concluir:${t.transacao}`]);
  });

  it("nothing to restore; a purchase of another VANT account; the server down", async () => {
    const vazio = montar();
    expect((await vazio.fluxo.restaurar()).estado).toBe("nada");
    const outra = montar(CONTA_B);
    outra.loja.nova(PRODUTO.proAnual, CONTA_A);
    expect((await outra.fluxo.restaurar()).estado).toBe("de_outra_conta");
    expect(outra.validar).not.toHaveBeenCalled();
    const fora = montar();
    fora.loja.nova(PRODUTO.proAnual, CONTA_A);
    fora.servidor.resposta = () => ({ tipo: "servidor" });
    expect((await fora.fluxo.restaurar()).estado).toBe("aguardando_servidor");
    expect(fora.loja.naoConcluidas.size).toBe(1);
  });
});

describe("stored is not unlocked (27/11/2026: an Apple test purchase on an account that is not a VANT test account)", () => {
  it("the server stored it but the account has no plan: 'sem_acesso', never 'liberada'; finished, since it is stored", async () => {
    const { fluxo, loja, servidor } = montar();
    servidor.resposta = () => ({ tipo: "ok", resultados: [{ resultado: "gravada" }], acesso: { plano: false } });
    expect(await fluxo.comprar(PRODUTO.proAnual)).toEqual({ estado: "recusada", produto: PRODUTO.proAnual, motivo: "sem_acesso" });
    expect(loja.naoConcluidas.size).toBe(0);
  });

  it("the server stored it and the account has the plan: 'liberada', as before", async () => {
    const { fluxo, servidor } = montar();
    servidor.resposta = () => ({ tipo: "ok", resultados: [{ resultado: "gravada" }], acesso: { plano: true } });
    expect((await fluxo.comprar(PRODUTO.essencial)).estado).toBe("liberada");
  });

  it("restoring a purchase that unlocks nothing says so, not 'nothing found'", async () => {
    const { fluxo, loja, servidor } = montar();
    loja.nova(PRODUTO.proAnual, CONTA_A);
    servidor.resposta = () => ({ tipo: "ok", resultados: [{ resultado: "gravada" }], acesso: { plano: false } });
    expect((await fluxo.restaurar()).estado).toBe("sem_acesso");
  });
});
