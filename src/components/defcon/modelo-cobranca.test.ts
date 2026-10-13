import { describe, expect, it } from "vitest";
import { limparModelo } from "./modelo-cobranca";

describe("modelo de cobrança", () => {
  it("tira o bloco do link do Mercado Pago que tinha grudado (e duplicado) no modelo", () => {
    const sujo = "Confirmando sua compra de {valor}.\n\nPra finalizar, é só pagar no meu Pix 👇\nChave Pix: (11983269507)\n\n" +
      "Depois me envia o comprovante por aqui, por favor!\n\nÉ só pagar por aqui, cai na hora:\n\n\n" +
      "É só pagar por aqui, cai na hora:\nhttps://www.mercadopago.com.br/payments/183964205160/ticket?caller_id=1&hash=x";
    expect(limparModelo(sujo)).toBe(
      "Confirmando sua compra de {valor}.\n\nPra finalizar, é só pagar no meu Pix 👇\nChave Pix: (11983269507)\n\nDepois me envia o comprovante por aqui, por favor!",
    );
  });

  it("não mexe na mensagem que ele escreveu", () => {
    const meu = "Fala! Deu {valor}.\n\nPix: 11983269507\n\nValeu demais 🙌";
    expect(limparModelo(meu)).toBe(meu);
  });
});
