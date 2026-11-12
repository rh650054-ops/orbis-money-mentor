// pluggy-connect-token — what a token request may do (A1) and, since A6, what happens when one of
// the three questions asked before the bank's screen opens cannot be answered.
import { describe, expect, it } from "vitest";
import { decidirPedido, itemPedido, lerLimite, prepararPedido, type Consultas } from "../../supabase/functions/pluggy-connect-token/pedido";

const uid = "vendedor-1";
const comVaga = { pode: true, usados: 0, limite: 1 };
const semVaga = { pode: false, usados: 1, limite: 1 };

describe("pluggy-connect-token: what a token request may do", () => {
  it("new bank with a free slot: token for a new connection, refusing duplicates", () => {
    expect(decidirPedido({ uid, item: null, pro: true, ehDele: undefined, limite: comVaga }))
      .toEqual({ corpo: { options: { clientUserId: uid, avoidDuplicates: true } } });
  });

  it("new bank without a slot: asks for the extra bank and says how many are used", () => {
    expect(decidirPedido({ uid, item: null, pro: true, ehDele: undefined, limite: semVaga }))
      .toEqual({ erro: "precisa_banco_extra", usados: 1, limite: 1 });
  });

  it("reauthorising a bank that is the vendor's: same Item, and it never needs a slot", () => {
    expect(decidirPedido({ uid, item: "item-9", pro: true, ehDele: true, limite: undefined }))
      .toEqual({ corpo: { itemId: "item-9", options: { clientUserId: uid } } });
    expect(decidirPedido({ uid, item: "item-9", pro: true, ehDele: true, limite: semVaga }))
      .toEqual({ corpo: { itemId: "item-9", options: { clientUserId: uid } } });
  });

  it("reauthorising a bank that is NOT (or no longer) the vendor's: says so, never a new connection", () => {
    expect(decidirPedido({ uid, item: "item-de-outro", pro: true, ehDele: false, limite: comVaga })).toEqual({ erro: "item_nao_encontrado" });
    // before 11/11 this fell through to the slot check and could ask the vendor to buy a slot
    expect(decidirPedido({ uid, item: "item-apagado", pro: true, ehDele: false, limite: semVaga })).toEqual({ erro: "item_nao_encontrado" });
  });

  it("not Pro: refused before anything else", () => {
    expect(decidirPedido({ uid, item: null, pro: false, ehDele: undefined, limite: comVaga })).toEqual({ erro: "precisa_pro" });
    expect(decidirPedido({ uid, item: "item-9", pro: false, ehDele: true, limite: comVaga })).toEqual({ erro: "precisa_pro" });
  });

  it("A6: a question that could not be answered is not an answer", () => {
    // the plan: a subscriber is not told to subscribe
    expect(decidirPedido({ uid, item: null, pro: undefined, ehDele: undefined, limite: comVaga })).toEqual({ erro: "consulta_indisponivel" });
    // the ownership: the seller is not told the bank is gone
    expect(decidirPedido({ uid, item: "item-9", pro: true, ehDele: undefined, limite: undefined })).toEqual({ erro: "consulta_indisponivel" });
    // the slot: the bank's screen does not open (it used to)
    expect(decidirPedido({ uid, item: null, pro: true, ehDele: undefined, limite: undefined })).toEqual({ erro: "consulta_indisponivel" });
  });

  it("reads the item id only from a non-empty string", () => {
    expect(itemPedido({ itemId: " item-1 " })).toBe("item-1");
    expect(itemPedido({ itemId: "" })).toBeNull();
    expect(itemPedido({ itemId: 12 })).toBeNull();
    expect(itemPedido({})).toBeNull();
    expect(itemPedido(null)).toBeNull();
  });
});

describe("lerLimite — open_finance_limite's answer", () => {
  it("a yes or a no is read as such, with the numbers when they come", () => {
    expect(lerLimite({ usados: 1, isento: false, limite: 1, pode_conectar: false })).toEqual({ pode: false, usados: 1, limite: 1 });
    expect(lerLimite({ usados: 0, limite: 2, pode_conectar: true })).toEqual({ pode: true, usados: 0, limite: 2 });
    expect(lerLimite({ usados: 5, isento: true, limite: null, pode_conectar: true })).toEqual({ pode: true, usados: 5 }); // exempt
  });
  it("anything without a clear yes or no cannot be told — and is never 'may connect'", () => {
    for (const ruim of [null, undefined, "", 1, [], [{ pode_conectar: true }], {}, { usados: 0, limite: 1 }, { pode_conectar: "true" }, { pode_conectar: null }]) {
      expect(lerLimite(ruim)).toBeUndefined();
    }
  });
});

// ---- the three questions, asked for real against fake answers
type Passo<T> = T | "sem_resposta" | "excecao";
function consultas(r: { pro?: Passo<boolean>[]; dele?: Passo<boolean>[]; limite?: Passo<unknown>[] }) {
  const n = { pro: 0, dele: 0, limite: 0 };
  const passo = <T,>(lista: Passo<T>[] | undefined, i: number, padrao: T): T | undefined => {
    const v = lista ? lista[Math.min(i, lista.length - 1)] : padrao;
    if (v === "excecao") throw new Error("rede caiu");
    return v === "sem_resposta" ? undefined : (v as T);
  };
  const c: Consultas = {
    ehPro: async () => passo(r.pro, n.pro++, true),
    ehDele: async () => passo(r.dele, n.dele++, true),
    limite: async () => passo(r.limite, n.limite++, { pode_conectar: true, usados: 0, limite: 1 }),
  };
  return { c, n };
}
const novo = undefined; // body of a request for a new bank
const reautorizar = { itemId: "item-7" };

describe("prepararPedido — A6: plan, ownership and slot checked before the bank's screen opens", () => {
  it("everything answers: new bank opens, reauthorisation opens on the same Item", async () => {
    const a = consultas({});
    expect(await prepararPedido(a.c, uid, novo, 0)).toEqual({ corpo: { options: { clientUserId: uid, avoidDuplicates: true } } });
    expect(a.n).toEqual({ pro: 1, dele: 0, limite: 1 }); // ownership is not asked for a new bank
    const b = consultas({});
    expect(await prepararPedido(b.c, uid, reautorizar, 0)).toEqual({ corpo: { itemId: "item-7", options: { clientUserId: uid } } });
    expect(b.n).toEqual({ pro: 1, dele: 1, limite: 0 }); // the slot is not asked when reauthorising
  });

  it("the limit cannot be read (twice): the bank's screen does NOT open", async () => {
    for (const falha of ["sem_resposta", "excecao"] as const) {
      const a = consultas({ limite: [falha] });
      expect(await prepararPedido(a.c, uid, novo, 0)).toEqual({ erro: "consulta_indisponivel" });
      expect(a.n.limite).toBe(2); // asked once more before giving up
    }
  });
  it("the limit answers without a clear yes or no: the screen does not open either", async () => {
    for (const ruim of [null, {}, { usados: 0, limite: 1 }]) {
      expect(await prepararPedido(consultas({ limite: [ruim] }).c, uid, novo, 0)).toEqual({ erro: "consulta_indisponivel" });
    }
  });
  it("the limit is known and exceeded: still 'precisa_banco_extra', with the numbers", async () => {
    expect(await prepararPedido(consultas({ limite: [{ pode_conectar: false, usados: 1, limite: 1 }] }).c, uid, novo, 0))
      .toEqual({ erro: "precisa_banco_extra", usados: 1, limite: 1 });
  });

  it("the plan cannot be read (twice): a subscriber is NOT told to subscribe, and nothing else is asked", async () => {
    for (const falha of ["sem_resposta", "excecao"] as const) {
      const a = consultas({ pro: [falha] });
      expect(await prepararPedido(a.c, uid, novo, 0)).toEqual({ erro: "consulta_indisponivel" });
      expect(a.n).toEqual({ pro: 2, dele: 0, limite: 0 });
    }
  });
  it("the plan answers 'not Pro': still 'precisa_pro', asked only once", async () => {
    const a = consultas({ pro: [false] });
    expect(await prepararPedido(a.c, uid, reautorizar, 0)).toEqual({ erro: "precisa_pro" });
    expect(a.n).toEqual({ pro: 1, dele: 0, limite: 0 });
  });

  it("the ownership cannot be read (twice): the seller is NOT told the bank is gone", async () => {
    for (const falha of ["sem_resposta", "excecao"] as const) {
      const a = consultas({ dele: [falha] });
      expect(await prepararPedido(a.c, uid, reautorizar, 0)).toEqual({ erro: "consulta_indisponivel" });
      expect(a.n.dele).toBe(2);
    }
  });
  it("the ownership answers 'not yours': still 'item_nao_encontrado'", async () => {
    expect(await prepararPedido(consultas({ dele: [false] }).c, uid, reautorizar, 0)).toEqual({ erro: "item_nao_encontrado" });
  });
  it("reauthorising never depends on the slot: it opens even if the limit could not be read", async () => {
    const a = consultas({ limite: ["excecao"] });
    expect(await prepararPedido(a.c, uid, reautorizar, 0)).toEqual({ corpo: { itemId: "item-7", options: { clientUserId: uid } } });
    expect(a.n.limite).toBe(0);
  });

  it("a failure that passes on the second try is not a refusal", async () => {
    const a = consultas({ pro: ["sem_resposta", true], limite: ["excecao", { pode_conectar: true, usados: 0, limite: 1 }] });
    expect(await prepararPedido(a.c, uid, novo, 0)).toEqual({ corpo: { options: { clientUserId: uid, avoidDuplicates: true } } });
    expect(a.n).toEqual({ pro: 2, dele: 0, limite: 2 });
    const b = consultas({ dele: ["sem_resposta", true] });
    expect(await prepararPedido(b.c, uid, reautorizar, 0)).toEqual({ corpo: { itemId: "item-7", options: { clientUserId: uid } } });
  });
  it("by default it waits a little between the two tries", async () => {
    const a = consultas({ pro: ["sem_resposta", true] });
    const t0 = Date.now();
    await prepararPedido(a.c, uid, novo);
    expect(Date.now() - t0).toBeGreaterThanOrEqual(250);
  });
});
