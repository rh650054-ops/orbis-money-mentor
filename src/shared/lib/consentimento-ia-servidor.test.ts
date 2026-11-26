/* The server rules (supabase/functions/_shared) are pure TypeScript, so the app suite tests them:
   which consent releases AI, that app and server agree on the version, and what a bug report
   looks like after personal data is removed. */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { VERSAO_DIVULGACAO_IA } from "./consentimento-ia";
import { consentimentoValido, VERSAO_DIVULGACAO_IA as VERSAO_SERVIDOR } from "../../../supabase/functions/_shared/consentimento-ia-regra";
import { semDadosPessoais } from "../../../supabase/functions/_shared/sem-dados-pessoais";

describe("consentimento de IA no servidor (por versão)", () => {
  it("app e servidor exigem a mesma versão da divulgação", () => {
    expect(VERSAO_SERVIDOR).toBe(VERSAO_DIVULGACAO_IA);
  });
  it("sem linha, recusa, revogação ou linha inválida → não envia", () => {
    expect(consentimentoValido(null)).toBe(false);
    expect(consentimentoValido({ permitido: false, versao: VERSAO_SERVIDOR })).toBe(false);
    expect(consentimentoValido({ permitido: "true", versao: VERSAO_SERVIDOR })).toBe(false);
  });
  it("autorização antiga (texto de 23/11, sem Cerebras) → não envia", () => {
    expect(consentimentoValido({ permitido: true, versao: "2026-11-23" })).toBe(false);
    expect(consentimentoValido({ permitido: true, versao: null })).toBe(false);
    expect(consentimentoValido({ permitido: true })).toBe(false);
  });
  it("autorização atual → envia", () => {
    expect(consentimentoValido({ permitido: true, versao: VERSAO_SERVIDOR })).toBe(true);
  });
  it("as 10 funções que falam com IA chamam o portão do servidor", () => {
    const fn = (n: string) => readFileSync(`supabase/functions/${n}/index.ts`, "utf8");
    for (const n of ["bright-action", "generate-insights", "objetivo-lucro-ia", "verificar-extrato", "extrato-analisar", "nota-ler", "estudio-arte", "verificar-deposito", "defcon-coach", "clima-vendedor"]) {
      expect(fn(n), n).toMatch(/iaPermitidaNoServidor\(/);
    }
    expect(fn("analisar-anomalia")).toMatch(/iaPermitidaParaUsuario\(userId\)/);
    // the reporter is never sent: its only use is being REMOVED from the free text
    expect(fn("analisar-bug")).not.toMatch(/Reportado por/);
    expect(fn("analisar-bug").match(/bug\.reporter/g)).toEqual(["bug.reporter"]);
    expect(fn("analisar-bug")).toMatch(/const quem = \[bug\.reporter\];/);
    expect(readFileSync("supabase/functions/_shared/consentimento-ia.ts", "utf8")).toMatch(/select\("permitido, versao"\)/);
  });
});

describe("relato de bug sem dados pessoais antes da IA", () => {
  it("troca CPF, e-mail, telefone, cartão, conta, CEP, endereço, links e segredos por marcas", () => {
    const t = semDadosPessoais(
      "Sou o Zé, CPF 123.456.789-09, zé@gmail.com, zap (11) 98765-4321. Cartão 4111 1111 1111 1111, ag 1234 conta 56789-0, " +
      "moro na Rua das Flores, 120, CEP 06700-000. pix: 11987654321 senha: abc123 https://app.vantapp.com.br/x?t=eyJabc",
    );
    for (const vazou of ["123.456.789-09", "gmail.com", "98765-4321", "4111 1111", "56789-0", "06700-000", "Flores", "abc123", "vantapp.com.br", "11987654321"]) {
      expect(t, vazou).not.toContain(vazou);
    }
    expect(t).toContain("[CPF]");
    expect(t).toContain("[EMAIL]");
    expect(t).toContain("[TELEFONE]");
  });
  it("mantém o bug compreensível (tela, valores do app, horários)", () => {
    const t = semDadosPessoais("Na tela de Vender, ao tocar em +R$ 25,00 às 14:30 o total fica R$ 0,00 no bloco 3");
    expect(t).toBe("Na tela de Vender, ao tocar em +R$ 25,00 às 14:30 o total fica R$ 0,00 no bloco 3");
  });
  it("respeita o limite de tamanho", () => {
    expect(semDadosPessoais("a".repeat(5000), 2000)).toHaveLength(2000);
  });
});

describe("relato de bug: texto livre (26/11, segunda passada)", () => {
  const vaza = (texto: string, proibidos: string[], nomes: unknown[] = []) => {
    const t = semDadosPessoais(texto, 2000, nomes);
    for (const p of proibidos) expect(t, `${p} em: ${t}`).not.toContain(p);
    return t;
  };
  it("nomes: o de quem reportou, depois de uma deixa, e prenome comum com sobrenome", () => {
    expect(vaza("Meu nome é João Carlos da Silva e não consigo entrar", ["João", "Carlos", "Silva"])).toBe("Meu nome é [NOME] e não consigo entrar");
    expect(vaza("o Bryan da Silva me pagou e sumiu", ["Bryan", "Silva"])).toBe("o [NOME] me pagou e sumiu");
    expect(vaza("a cliente Kethellyn Souza reclamou; sra. Odete pediu estorno", ["Kethellyn", "Souza", "Odete"])).toContain("cliente [NOME]");
    expect(vaza("Zeferino aqui: o app do zeferino travou, falar com ZEFERINO Prates", ["Zeferino", "zeferino", "ZEFERINO", "Prates"], ["Zeferino Prates"])).toContain("[NOME]");
  });
  it("telefone espaçado ou sem DDD, RG, cvv, nascimento, @usuário, e-mail disfarçado", () => {
    const t = vaza("whats 11 9 8765 4321 ou 987654321; RG 12.345.678-9; cvv 123; nascido em 03/05/1990; insta @joaovendas; joao (arroba) gmail ponto com",
      ["8765", "987654321", "12.345.678", "cvv 123", "03/05/1990", "joaovendas", "gmail"]);
    for (const marca of ["[TELEFONE]", "[DOCUMENTO]", "[SEGREDO]", "[NASCIMENTO]", "[USUARIO]", "[EMAIL]"]) expect(t).toContain(marca);
  });
  it.each([
    "Na tela Minha Conta o botão Vant Pro não abre o Mercado Pago",
    "Cliente pagou R$ 30 no Pix e o total do Foco não somou às 18:45",
    "O vendedor Pro não vê o Open Finance; erro 500 no dia 26/11/2026",
    "Vendi 12 batidas a R$ 10 e o Relatório mostrou R$ 100 em vez de R$ 120",
    "Depois de atualizar no Android o DEFCON 4 fecha sozinho no bloco 3 de 5",
    "Estoque: 1.250 unidades, custo R$ 1.234,56, margem 35%",
  ])("não estraga o relato de bug: %s", (texto) => {
    expect(semDadosPessoais(texto)).toBe(texto);
  });
});
