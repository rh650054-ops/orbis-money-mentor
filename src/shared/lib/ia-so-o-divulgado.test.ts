// @vitest-environment node
/* Only what the AI disclosure lists may go to an AI provider (26/11/2026, "cortar no servidor").
   The disclosure in the store build is fixed; these tests keep the SERVER inside it. */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { contextoSemLocal, top3SemNomes } from "../../../supabase/functions/_shared/ia-so-o-divulgado";

const fn = (n: string) => readFileSync(`supabase/functions/${n}/index.ts`, "utf8");
const texto = readFileSync("src/features/consentimento-ia/components/texto-ia.tsx", "utf8");
const linhaDoTexto = (funcao: string) => texto.split("\n").find((l) => l.includes(`funcao: "${funcao}"`)) ?? "";

describe("Mentor: the context the app builds loses city and selling spot on the server", () => {
  const CTX = [
    "DADOS REAIS DESTE VENDEDOR (use pra personalizar; NUNCA invente número):",
    "- Nome: Rick. Vende: batidas e doces. Onde: sinal da Av. Brasil com a Rua 7. Cidade: Cotia/SP.",
    "- Últimos 7 dias: faturou R$ 1.200,00, lucro líquido R$ 800,00. Últimos 30 dias: R$ 4.000,00.",
    "- Ranking do mês: posição 4 com R$ 4.000,00 (20 dias trabalhados).",
  ].join("\n");

  it("drops 'Onde' and 'Cidade', keeps the name, what he sells and every other line", () => {
    const limpo = contextoSemLocal(CTX);
    expect(limpo).not.toMatch(/Onde:|Cidade:|Cotia|Av\. Brasil|Rua 7|\/SP/);
    expect(limpo.split("\n")[1]).toBe("- Nome: Rick. Vende: batidas e doces.");
    expect(limpo.split("\n")).toHaveLength(4);
    expect(limpo).toContain("Últimos 7 dias: faturou R$ 1.200,00");
    expect(limpo).toContain("Ranking do mês: posição 4");
  });
  it("only city, only the spot, or neither", () => {
    expect(contextoSemLocal("- Nome: Ana. Vende: trufas. Cidade: Porto Alegre/RS.")).toBe("- Nome: Ana. Vende: trufas.");
    expect(contextoSemLocal("- Nome: Ana. Onde: praia do Rosa.")).toBe("- Nome: Ana.");
    expect(contextoSemLocal("- Nome: Ana. Vende: trufas.")).toBe("- Nome: Ana. Vende: trufas.");
  });
  it("a line that is not the name line is never touched, and odd input does not throw", () => {
    expect(contextoSemLocal("- Contas chegando: Aluguel R$ 900,00 vence 05/12. Onde: x")).toBe("- Contas chegando: Aluguel R$ 900,00 vence 05/12. Onde: x");
    expect(contextoSemLocal(undefined)).toBe("");
    expect(contextoSemLocal("")).toBe("");
  });
  it("bright-action passes the app's context through it before anything else uses it", () => {
    const src = fn("bright-action");
    expect(src).toMatch(/\$\{contextoSemLocal\(body\.context\.trim\(\)\)\}/);
    expect(src.match(/body\??\.context/g)!.length).toBe(src.match(/typeof body\?\.context === "string" && body\.context\.trim\(\)/g)!.length * 2 + 1);
    expect(linhaDoTexto("Mentor (chat e voz)")).not.toMatch(/cidade|onde/i);
  });
});

describe("Mentor: the ranking goes without other vendors' names", () => {
  it("top 3 = position and revenue only", () => {
    const linhas = [
      { nome_usuario: "Zeca do Sinal", faturamento_total_mes: 9000, posicao_faturamento: 1 },
      { nome_usuario: "Maria Trufas", faturamento_total_mes: "7000.50", posicao_faturamento: 2 },
      { nome_usuario: "João", faturamento_total_mes: 6000, posicao_faturamento: 3 },
      { nome_usuario: "Quarto", faturamento_total_mes: 10, posicao_faturamento: 4 },
    ];
    const top = top3SemNomes(linhas);
    expect(top).toEqual([
      { posicao: 1, faturamento_total_mes: 9000 },
      { posicao: 2, faturamento_total_mes: 7000.5 },
      { posicao: 3, faturamento_total_mes: 6000 },
    ]);
    expect(JSON.stringify(top)).not.toMatch(/Zeca|Maria|João|nome/);
    expect(top3SemNomes(null)).toEqual([]);
    expect(top3SemNomes([null])).toEqual([{ posicao: 0, faturamento_total_mes: 0 }]);
  });
  it("bright-action does not even read the names for the AI", () => {
    const src = fn("bright-action");
    expect(src).not.toMatch(/nome_usuario/);
    expect(src).toMatch(/top3: top3SemNomes\(topR\.data\)/);
  });
});

describe("Dicas e relatórios: only what the row lists", () => {
  const src = fn("generate-insights");
  it("the row in the disclosure is the one this test was written against", () => {
    expect(linhaDoTexto("Dicas e relatórios do dia")).toContain('dados: "vendas, meta, horários, produtos, custos e gastos"');
  });
  it("no nickname, city or selling spot is read from the profile", () => {
    expect(src).toMatch(/from\("profiles"\)\.select\("what_i_sell,monthly_goal,streak_days"\)/);
    expect(src).not.toMatch(/nickname|where_i_sell|\bcity\b|QUEM É/);
  });
  it("the savings goals the app sends are not forwarded", () => {
    expect(src).not.toMatch(/body\.caixinhas|caixinhasLinhas|CAIXINHAS \(objetivos\)/);
  });
});

describe("Análise de fraude: no AI, because the disclosure in the app does not list it", () => {
  const src = fn("analisar-anomalia");
  it("the disclosure has no row for it", () => {
    expect(texto).not.toMatch(/fraude|anomalia|anti-?trapa/i);
  });
  it("the function reads nothing and calls no provider", () => {
    expect(src).not.toMatch(/createClient|fetch\(|api\.anthropic\.com|api\.openai\.com|ANTHROPIC_API_KEY|defcon_user_history|import /);
    expect(src).toMatch(/analise_ia_desligada/);
  });
});
