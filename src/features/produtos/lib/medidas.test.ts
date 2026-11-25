import { describe, expect, it } from "vitest";
import { daBase, paraBase, unidadesDeUso } from "./medidas";
import { precoDe1, qtdNaLeva, resumoDoCusto, usoDoAtalho, type IngredienteRascunho } from "./receitas";
import { reais } from "../components/campos";

const linha = (m: Partial<IngredienteRascunho>): IngredienteRascunho => ({ nome: "x", qtd: 0, unidade: "un", pacote: 1, precoPacote: 0, usa: true, ...m });
const custo = (i: IngredienteRascunho, rende = 1) => qtdNaLeva(i, rende) * precoDe1(i);

describe("Medida de uso (25/11) — o vendedor escolhe como informar, a VANT converte só o que é compatível", () => {
  it("A · caixinha inteira: R$ 3,79, sem perguntar peso", () => {
    const lc = linha({ nome: "Leite condensado", precoPacote: 3.79, embalagem: "caixinha" });
    const i = { ...lc, ...usoDoAtalho("inteira", lc) };
    expect(i.qtd).toBe(1);
    expect(custo(i)).toBeCloseTo(3.79, 10);
  });

  it("B · metade: R$ 1,895 por dentro, R$ 1,90 na tela, sem perguntar peso", () => {
    const lc = linha({ nome: "Leite condensado", precoPacote: 3.79 });
    const i = { ...lc, ...usoDoAtalho("metade", lc) };
    expect(custo(i)).toBeCloseTo(1.895, 10);
    expect(reais(custo(i))).toMatch(/1,90/);
  });

  it("D · 200 g de uma caixinha de 395 g: pede o conteúdo uma vez; depois 0,5063 caixinha = R$ 1,92", () => {
    expect(paraBase(200, "g", "un", null)).toEqual({ ok: false, motivo: "conteudo", dim: "g" });
    const c = paraBase(200, "g", "un", { qtd: 395, unidade: "g" });
    expect(c.ok && c.qtd).toBeCloseTo(200 / 395, 12);
    const i = linha({ precoPacote: 3.79, qtd: c.ok ? c.qtd : 0 });
    expect(reais(custo(i))).toMatch(/1,92/);
    // stock is counted in boxes: producing this recipe takes 0,5063 box, never 200 boxes or 200 g of "un"
    expect(daBase(i.qtd, "g", "un", { qtd: 395, unidade: "g" })).toBe(200);
    expect(paraBase(0.2, "kg", "un", { qtd: 395, unidade: "g" })).toMatchObject({ ok: true });
  });

  it("C · 300 g de um pacote de 1 kg por R$ 14,99 = R$ 4,50; 0,3 kg dá o mesmo", () => {
    const m = linha({ unidade: "g", pacote: 1000, precoPacote: 14.99 });
    const g = paraBase(300, "g", "g");
    const kg = paraBase(0.3, "kg", "g");
    expect(g).toEqual({ ok: true, qtd: 300 });
    expect(kg.ok && kg.qtd).toBeCloseTo(300, 10);
    expect(reais(custo({ ...m, qtd: 300 }))).toMatch(/4,50/);
  });

  it("500 ml de uma garrafa de 1 L", () => {
    expect(paraBase(500, "ml", "ml")).toEqual({ ok: true, qtd: 500 });
    expect(paraBase(0.5, "l", "ml")).toEqual({ ok: true, qtd: 500 });
    const leite = linha({ unidade: "ml", pacote: 1000, precoPacote: 5.49, qtd: 500 });
    expect(custo(leite)).toBeCloseTo(2.745, 10);
  });

  it("nunca mistura: g ↔ ml, kg por unidade, caixinha em g usada em ml", () => {
    expect(paraBase(100, "ml", "g")).toEqual({ ok: false, motivo: "incompativel" });
    expect(paraBase(1, "un", "g")).toEqual({ ok: false, motivo: "incompativel" });
    expect(paraBase(100, "ml", "un", { qtd: 395, unidade: "g" })).toEqual({ ok: false, motivo: "incompativel" });
    expect(unidadesDeUso("g")).toEqual(["g", "kg"]);
    expect(unidadesDeUso("ml")).toEqual(["ml", "l"]);
    expect(unidadesDeUso("un")).toEqual(["un", "g", "kg", "ml", "l"]);
  });

  it("uma embalagem por unidade produzida: rende 5 → 5 garrafas; a caixinha da receita não multiplica", () => {
    const garrafa = linha({ qtd: 1, precoPacote: 1.19, por: "unidade" });
    const lc = linha({ qtd: 1, precoPacote: 3.79, por: "receita" });
    expect(qtdNaLeva(garrafa, 5)).toBe(5);
    expect(qtdNaLeva(lc, 5)).toBe(1);
    expect(resumoDoCusto([lc, garrafa], 5).total).toBe(9.74);   // 3,79 + 5 × 1,19
  });

  it("E · sem o conteúdo da caixinha a linha fica pendente: custo parcial, nenhuma margem definitiva", () => {
    const r = resumoDoCusto([linha({ nome: "Leite condensado", precoPacote: 3.79, qtd: 0, uso: { qtd: 200, unidade: "g" } })], 5);
    expect(r.completo).toBe(false);
    expect(r.faltaQtd).toEqual(["Leite condensado"]);
  });
});
