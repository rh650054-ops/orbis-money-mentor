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
    expect(fn("analisar-bug")).not.toMatch(/bug\.reporter/);
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
