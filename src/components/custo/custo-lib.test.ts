import { describe, expect, it } from "vitest";
import { notaDaApi, partesDaNota, resumoCusto, valorMercadoria, type NotaApi } from "./custo-lib";

const api: NotaApi = {
  loja: "Atacadão", data: "2026-10-04", total: 312.4, soma_itens: 312.4,
  pagamentos: [{ tipo: "dinheiro", valor: 100 }, { tipo: "debito", valor: 212.4 }],
  itens: [
    { descricao: "LEITE COND 395G", qtd: 24, unidade: "UN", valor: 160 },
    { descricao: "MARACUJA KG", qtd: 10, unidade: "KG", valor: 120 },
    { descricao: "DETERGENTE", qtd: 2, unidade: "UN", valor: 32.4 },
  ],
};

describe("custo pelas notas", () => {
  it("lê a forma de pagamento da nota como dividido", () => {
    const n = notaDaApi(api, "a");
    expect(n.pagamento).toBe("dividido");
    expect(n.dinheiro).toBe("100,00");
  });

  it("tirando um item da casa, divide dinheiro e cartão e guarda o valor do banco", () => {
    const n = notaDaApi(api, "a");
    n.itens[2]!.on = false; // detergente é da casa
    expect(valorMercadoria(n)).toBe(280);
    expect(partesDaNota(n)).toEqual([
      { tipo: "dinheiro", valor: 100 },
      { tipo: "cartao", valor: 180, valor_banco: 212.4 },
    ]);
  });

  it("calcula o custo por unidade somando todas as notas", () => {
    const a = notaDaApi(api, "a");
    a.itens[2]!.on = false;
    const b = notaDaApi({ ...api, loja: "Mercadinho", total: 70, pagamentos: [], itens: [{ descricao: "COPO 300ML", qtd: 100, unidade: "UN", valor: 70 }] }, "b");
    const r = resumoCusto([a, b], 100, 10);
    expect(r.total).toBe(350);
    expect(r.unidade).toBe(3.5);
    expect(r.sobra).toBe(6.5);
    expect(r.margem).toBe(65);
  });
});
