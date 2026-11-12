import { describe, expect, it } from "vitest";
import { decidirPedido, itemPedido } from "../../supabase/functions/pluggy-connect-token/pedido";

const uid = "vendedor-1";

describe("pluggy-connect-token: what a token request may do", () => {
  it("new bank with a free slot: token for a new connection, refusing duplicates", () => {
    expect(decidirPedido({ uid, item: null, ehDele: false, limite: { pode_conectar: true, usados: 0, limite: 1 } }))
      .toEqual({ corpo: { options: { clientUserId: uid, avoidDuplicates: true } } });
  });

  it("new bank without a slot: asks for the extra bank and says how many are used", () => {
    expect(decidirPedido({ uid, item: null, ehDele: false, limite: { pode_conectar: false, usados: 1, limite: 1 } }))
      .toEqual({ erro: "precisa_banco_extra", usados: 1, limite: 1 });
  });

  it("reauthorising a bank that is the vendor's: same Item, and it never needs a slot", () => {
    expect(decidirPedido({ uid, item: "item-9", ehDele: true, limite: { pode_conectar: false, usados: 1, limite: 1 } }))
      .toEqual({ corpo: { itemId: "item-9", options: { clientUserId: uid } } });
  });

  it("reauthorising a bank that is NOT (or no longer) the vendor's: says so, never a new connection", () => {
    expect(decidirPedido({ uid, item: "item-de-outro", ehDele: false, limite: { pode_conectar: true } })).toEqual({ erro: "item_nao_encontrado" });
    // before 11/11 this fell through to the slot check and could ask the vendor to buy a slot
    expect(decidirPedido({ uid, item: "item-apagado", ehDele: false, limite: { pode_conectar: false, usados: 1, limite: 1 } })).toEqual({ erro: "item_nao_encontrado" });
  });

  it("the limit did not answer: behaves as before (opens)", () => {
    expect(decidirPedido({ uid, item: null, ehDele: false, limite: null })).toEqual({ corpo: { options: { clientUserId: uid, avoidDuplicates: true } } });
  });

  it("reads the item id only from a non-empty string", () => {
    expect(itemPedido({ itemId: " item-1 " })).toBe("item-1");
    expect(itemPedido({ itemId: "" })).toBeNull();
    expect(itemPedido({ itemId: 12 })).toBeNull();
    expect(itemPedido({})).toBeNull();
    expect(itemPedido(null)).toBeNull();
  });
});
