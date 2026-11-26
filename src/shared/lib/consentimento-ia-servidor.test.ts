/* The server rules (supabase/functions/_shared) are pure TypeScript, so the app suite tests them:
   which consent releases AI, that app and server agree on the version, and what a bug report
   looks like after personal data is removed. */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { VERSAO_DIVULGACAO_IA } from "./consentimento-ia";
import { consentimentoValido, VERSAO_DIVULGACAO_IA as VERSAO_SERVIDOR } from "../../../supabase/functions/_shared/consentimento-ia-regra";
import { semDadosPessoais } from "../../../supabase/functions/_shared/sem-dados-pessoais";
import { aceitaTemperatura, corpoClaude, pedirClaude } from "../../../supabase/functions/_shared/ia-claude";

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
    // 26/11 text: profit mission and DEFCON message did not name Anthropic yet
    expect(consentimentoValido({ permitido: true, versao: "2026-11-26" })).toBe(false);
    expect(VERSAO_SERVIDOR > "2026-11-26").toBe(true);
    expect(VERSAO_SERVIDOR).toMatch(/^\d{4}-\d{2}-\d{2}$/); // the only shape responder_consentimento_ia accepts
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
    expect(readFileSync("supabase/functions/_shared/consentimento-ia.ts", "utf8")).toMatch(/select\("permitido, versao"\)/);
  });

  // 26/11: a bug report has no account behind it, so nobody's permission can be checked, and a
  // regex filter is not a guarantee of anonymisation → the function sends nothing to any AI
  it("análise de bug: nada vai pra IA (sem autorização possível, o filtro de texto não é garantia)", () => {
    const src = readFileSync("supabase/functions/analisar-bug/index.ts", "utf8");
    expect(src).not.toMatch(/cerebras\.ai|generativelanguage|anthropic\.com|openai\.com|pedirClaude|_API_KEY/);
    // its only request goes to our own database, and never reads the report's text or author
    expect(src.match(/fetch\(/g)).toHaveLength(1);
    expect(src).toMatch(/fetch\(`\$\{SB_URL\}\/rest\/v1\/orbis_bugs/);
    expect(src).not.toMatch(/select=\*|descricao|titulo|reporter|\btela\b/);
    expect(src).toMatch(/analise_ia_desligada/);
  });

  it("Missão de Lucro e Coach: Anthropic primeiro, sempre depois do portão, e a divulgação cita a Anthropic", () => {
    for (const n of ["objetivo-lucro-ia", "defcon-coach"]) {
      const src = readFileSync(`supabase/functions/${n}/index.ts`, "utf8");
      const portao = src.indexOf("iaPermitidaNoServidor(");
      // the mission wraps the request in claude(); what matters is where the handler calls it
      const claude = src.indexOf(n === "defcon-coach" ? "pedirClaude({" : '["claude", () => claude(prompt)]');
      const cerebras = src.lastIndexOf("api.cerebras.ai"); const gemini = src.lastIndexOf("generativelanguage.googleapis.com");
      expect(portao, n).toBeGreaterThan(0);
      expect(claude, n).toBeGreaterThan(portao);
      expect(src, n).toMatch(new RegExp(`quem: "${n}"`));
      if (n === "defcon-coach") { expect(cerebras).toBeGreaterThan(claude); expect(gemini).toBeGreaterThan(cerebras); }
      else expect(src).toMatch(/\[\["claude", \(\) => claude\(prompt\)\], \["cerebras", \(\) => cerebras\(prompt\)\], \["gemini", \(\) => gemini\(prompt\)\]\]/);
    }
    const linha = (arq: string, funcao: string) => readFileSync(arq, "utf8").split("\n").find((l) => l.includes(funcao)) ?? "";
    for (const f of ["Mensagem do DEFCON", "Objetivo de lucro"]) {
      for (const arq of ["src/features/consentimento-ia/components/texto-ia.tsx", "src/pages/Privacidade.tsx"]) {
        const l = linha(arq, f);
        for (const quem of ["Anthropic", "Google", "Cerebras"]) expect(l, `${arq} · ${f}`).toContain(quem);
      }
    }
    // the mission prompt carries the nickname: the row says so
    expect(readFileSync("supabase/functions/objetivo-lucro-ia/index.ts", "utf8")).toMatch(/b\.apelido/);
    expect(linha("src/features/consentimento-ia/components/texto-ia.tsx", "Objetivo de lucro")).toContain("seu apelido");
    expect(linha("src/pages/Privacidade.tsx", "Objetivo de lucro")).toContain("seu apelido");
  });

  // 26/11: Cerebras (402) and Gemini (429) failed unseen for days — the failure is now logged,
  // with the provider and the HTTP status only, never what the vendor sent or what the AI said
  it("Missão de Lucro e Coach registram o provedor que falhou, sem dado do vendedor no log", () => {
    for (const n of ["objetivo-lucro-ia", "defcon-coach"]) {
      const src = readFileSync(`supabase/functions/${n}/index.ts`, "utf8");
      expect(src, n).toMatch(new RegExp(`console\\.warn\\(\`${n}: cerebras \\$\\{\\w+\\.status\\}`));
      expect(src, n).toMatch(new RegExp(`console\\.warn\\(\`${n}: gemini \\$\\{\\w+\\.status\\}`));
      const logs = src.split("\n").filter((l) => /console\.(warn|error|log)\(/.test(l)).map((l) => l.slice(l.search(/console\./)));
      expect(logs.length, n).toBeGreaterThanOrEqual(3);
      for (const l of logs) expect(l, n).not.toMatch(/\b(prompt|template|body|base|apelido|authHeader|key|ckey|text|ct|raw|doClaude)\b/);
    }
    const ajudante = readFileSync("supabase/functions/_shared/ia-claude.ts", "utf8");
    expect(ajudante).toMatch(/aviso\(`\$\{p\.quem\}: claude \$\{res\.status\}`\)/);
    // every log line of the helper interpolates only the caller's name, the HTTP status or the error's class
    const modelos = [...ajudante.matchAll(/aviso\(`([^`]*)`\)/g)].map((m) => m[1] ?? "");
    expect(modelos).toHaveLength(4);
    for (const m of modelos) expect(m.replace("${p.quem}", "").replace("${res.status}", "").replace('${(e as Error)?.name ?? "erro"}', "")).not.toContain("${");
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

describe("pedido à Anthropic (ajudante das funções de texto)", () => {
  const ok = (texto: string) => ({ ok: true, status: 200, json: async () => ({ content: [{ type: "text", text: texto }] }) }) as unknown as Response;
  const pedido = { quem: "teste", system: "S", user: "U", maxTokens: 100, timeoutMs: 1000, temperature: 0.5 };

  it("manda só o que recebeu, com a chave no cabeçalho, e devolve o texto", async () => {
    const chamadas: { url: string; init: RequestInit }[] = [];
    const fetchFn = (async (url: string, init: RequestInit) => { chamadas.push({ url, init }); return ok("  olá  "); }) as unknown as typeof fetch;
    expect(await pedirClaude(pedido, { chave: "k-teste", fetchFn })).toBe("olá");
    expect(chamadas).toHaveLength(1);
    expect(chamadas[0]?.url).toBe("https://api.anthropic.com/v1/messages");
    expect((chamadas[0]?.init.headers as Record<string, string>)["x-api-key"]).toBe("k-teste");
    expect(JSON.parse(String(chamadas[0]?.init.body))).toEqual({ model: "claude-haiku-4-5-20251001", max_tokens: 100, temperature: 0.5, system: "S", messages: [{ role: "user", content: "U" }] });
  });

  it("modelos da linha 5 não recebem temperature (recusariam com 400)", () => {
    expect(aceitaTemperatura("claude-haiku-4-5-20251001")).toBe(true);
    expect(aceitaTemperatura("claude-sonnet-5")).toBe(false);
    expect(corpoClaude(pedido, "claude-sonnet-5")).not.toHaveProperty("temperature");
    expect(corpoClaude({ ...pedido, system: undefined }, "claude-haiku-4-5-20251001")).not.toHaveProperty("system");
  });

  it("sem chave, erro HTTP, resposta vazia ou queda: devolve null, nunca lança, e o aviso só tem quem + código", async () => {
    const avisos: string[] = []; const aviso = (m: string) => avisos.push(m);
    const com = (r: () => Promise<Response>) => pedirClaude(pedido, { chave: "k-teste", aviso, fetchFn: r as unknown as typeof fetch });
    expect(await pedirClaude(pedido, { chave: "", aviso, fetchFn: (() => { throw new Error("não devia chamar"); }) as unknown as typeof fetch })).toBeNull();
    expect(await com(async () => ({ ok: false, status: 529, json: async () => ({}) }) as unknown as Response)).toBeNull();
    expect(await com(async () => ok("   "))).toBeNull();
    expect(await com(async () => { const e = new Error("segredo U S k-teste"); e.name = "TimeoutError"; throw e; })).toBeNull();
    expect(avisos).toEqual(["teste: claude sem chave", "teste: claude 529", "teste: claude vazio", "teste: claude sem resposta (TimeoutError)"]);
  });
});
