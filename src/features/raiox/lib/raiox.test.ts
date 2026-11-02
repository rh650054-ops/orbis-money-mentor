import { describe, expect, it, vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
import { alertasValidos, aplicarFiltros, destinatarios, estadoCategoria, maisPesou, mesAnterior, variacao } from "./raiox";
import type { CatAnalise } from "@/components/financas/analise/tipos";
import { FILTROS_VAZIOS, type CategoriaRX, type LancamentoRX } from "../types";

const cat = (o: Partial<CategoriaRX>): CategoriaRX => ({ categoria: "pix_pessoas", rotulo: "Pix pra pessoas", esfera: "pessoal", total: 100, qtd: 1, pct: 10, anterior: 100, ...o });
const l = (o: Partial<LancamentoRX>): LancamentoRX => ({ id: "1", data: "2026-10-10", hora: null, descricao: "PIX", comerciante: "JOAO", valor: 50, categoria: "pix_pessoas", esfera: "pessoal", banco: "Itaú", tipo: "saida", movimento: "normal", ...o });

describe("raio-x", () => {
  it("compares with last month and colors by state", () => {
    expect(variacao(120, 100)).toBe(20);
    expect(variacao(10, 0)).toBeNull();
    expect(mesAnterior("2026-01-01")).toBe("2025-12-01");
    expect(estadoCategoria(cat({ total: 120 }), undefined, false, "2026-09-01").texto).toBe("+20% vs set.");
    expect(estadoCategoria(cat({ total: 300 }), undefined, false, "2026-09-01").texto).toBe("3x set");
    expect(estadoCategoria(cat({ anterior: 0 }), undefined, false, "2026-09-01").texto).toBe("novo este mês");
  });

  it("top 3 leaves out transfers, card bill payments and unknowns", () => {
    const top = maisPesou([cat({ categoria: "transferencia_propria", total: 9999 }), cat({ categoria: "fatura_cartao", total: 999 }),
      cat({ categoria: "a", total: 10 }), cat({ categoria: "b", total: 30 }), cat({ categoria: "c", total: 20 }), cat({ categoria: "d", total: 5 })]);
    expect(top.map((c) => c.categoria)).toEqual(["b", "c", "a"]);
  });

  it("filters combine and transfers stay apart from spending", () => {
    const lista = [l({ id: "1" }), l({ id: "2", banco: "Nubank", valor: 500 }), l({ id: "3", movimento: "entre_contas" }), l({ id: "4", categoria: "nao_identificado" })];
    expect(aplicarFiltros(lista, FILTROS_VAZIOS).map((x) => x.id)).toEqual(["1", "2", "4"]);
    expect(aplicarFiltros(lista, { ...FILTROS_VAZIOS, transferencias: true }).map((x) => x.id)).toEqual(["3"]);
    expect(aplicarFiltros(lista, { ...FILTROS_VAZIOS, bancos: ["Nubank"], min: 100 }).map((x) => x.id)).toEqual(["2"]);
    expect(aplicarFiltros(lista, { ...FILTROS_VAZIOS, identificacao: "nao" }).map((x) => x.id)).toEqual(["4"]);
    expect(aplicarFiltros(lista, { ...FILTROS_VAZIOS, texto: "joao" })).toHaveLength(3);
  });

  it("groups recipients", () => {
    expect(destinatarios([l({ valor: 10 }), l({ valor: 20 }), l({ comerciante: "MARIA", valor: 5 })])[0]).toEqual({ nome: "JOAO", total: 30, qtd: 2 });
  });

  const ref = (o: Partial<CatAnalise>): CatAnalise => ({ categoria: "mercado", rotulo: "Mercado de casa", total: 369, qtd: 2, normal: 1500, esperado: 202, fixa: false, tem_teto: true, historico: 240, passado_mesmo_dia: 0, ...o });

  it("with a teto, says how much of it is gone (not 'abaixo do normal')", () => {
    expect(estadoCategoria(cat({ total: 369 }), ref({}), true, "2026-10-01").texto).toBe("25% do teto");
    expect(estadoCategoria(cat({ total: 1600 }), ref({ total: 1600 }), true, "2026-10-01").texto).toBe("passou do teto (107%)");
  });

  it("a running month is not compared as -89% against a closed one", () => {
    const e = estadoCategoria(cat({ total: 410, anterior: 3700 }), undefined, true, "2026-10-01");
    expect(e.texto).toBe("11% do que foi em out");
  });

  it("teto alerts only once half of the teto is gone", () => {
    const refs = { mercado: ref({}), restaurante: ref({ categoria: "restaurante", normal: 300 }), lazer: undefined };
    const a = [{ categoria: "mercado", total: 369 }, { categoria: "restaurante", total: 287 }, { categoria: "lazer", total: 90 }];
    expect(alertasValidos(a, refs).map((x) => x.categoria)).toEqual(["restaurante", "lazer"]);
  });
});
