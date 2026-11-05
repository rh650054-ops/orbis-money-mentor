import { describe, expect, it } from "vitest";
import { categoria, norm } from "../../supabase/functions/_shared/pluggy-piloto";

const saida = (desc: string, cat = "Shopping") => categoria({ description: desc, category: cat }, "saida", norm(desc), false).cat;
const entrada = (desc: string, cat = "Transfer") => categoria({ description: desc, category: cat }, "entrada", norm(desc), false).cat;

describe("categories (Rick, 04/11: tudo caía em Roupas)", () => {
  it("supermarkets go to Mercado, not Roupas", () => {
    expect(saida("COMPRA NO DEBITO SUPERM ATENDE MAIS")).toBe("mercado");
    expect(saida("MERCADINHO IRIANA LTDA")).toBe("mercado");
    expect(saida("COMPRA NO DEBITO OXXO MARINA ROLL")).toBe("mercado");
  });
  it("Mercado Pago is not a supermarket", () => {
    expect(saida("PAGAMENTO MERCADO PAGO LOJA X", "Shopping")).toBe("compras_debito");
  });
  it("generic Shopping → Compras no débito; clothing stays Roupas", () => {
    expect(saida("COMPRA NO DEBITO ANDERS COMERCIO")).toBe("compras_debito");
    expect(saida("LOJA QUALQUER", "Clothing")).toBe("roupas");
    expect(saida("SHEIN COMPRA", "Shopping")).toBe("roupas");
  });
  it("packaging is a work cost; AutoPass is transport; investments are own money", () => {
    expect(saida("MUNDO DAS EMBALAGENS")).toBe("insumos");
    expect(saida("COMPRA NO DEBITO AUTOPASS S A ATM TMOB")).toBe("onibus");
    expect(saida("COMPRA DE RENDA VARIAVEL")).toBe("transferencia_propria");
  });
  it("Mercado Pago 'bolso' both ways is own money", () => {
    expect(saida("Transferência para o bolso", "Transfer")).toBe("transferencia_propria");
    expect(entrada("Transferência do bolso cartão Santander")).toBe("transferencia_propria");
  });
});
