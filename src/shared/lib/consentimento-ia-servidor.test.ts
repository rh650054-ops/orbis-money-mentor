/* The server rules (supabase/functions/_shared) are pure TypeScript, so the app suite tests them:
   which consent releases AI, that app and server agree on the version, and what a bug report
   looks like after personal data is removed. */
import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { VERSAO_DIVULGACAO_IA, VERSOES_QUE_AINDA_VALEM } from "./consentimento-ia";
import { consentimentoNoTextoAtual, consentimentoValido, VERSAO_DIVULGACAO_IA as VERSAO_SERVIDOR, VERSOES_QUE_AINDA_VALEM as VALEM_SERVIDOR } from "../../../supabase/functions/_shared/consentimento-ia-regra";
import { semDadosPessoais } from "../../../supabase/functions/_shared/sem-dados-pessoais";
import { aceitaTemperatura, corpoClaude, pedirClaude } from "../../../supabase/functions/_shared/ia-claude";
import { aceitaTemperaturaOpenAi, corpoOpenAi, pedirOpenAi, transcreverOpenAi } from "../../../supabase/functions/_shared/ia-openai";
import { lerJsonDaIa, limparDias } from "../../../supabase/functions/import-financial-pdf/dias";

describe("consentimento de IA no servidor (por versão)", () => {
  it("app e servidor concordam: a versão atual e os textos antigos que ainda valem", () => {
    expect(VERSAO_SERVIDOR).toBe(VERSAO_DIVULGACAO_IA);
    expect([...VALEM_SERVIDOR]).toEqual([...VERSOES_QUE_AINDA_VALEM]);
    expect(VERSAO_SERVIDOR).toMatch(/^\d{4}-\d{2}-\d{2}$/); // the only shape responder_consentimento_ia accepts
    for (const v of VALEM_SERVIDOR) expect(v < VERSAO_SERVIDOR).toBe(true);
  });
  it("sem linha, recusa, revogação ou linha inválida → não envia", () => {
    expect(consentimentoValido(null)).toBe(false);
    expect(consentimentoValido({ permitido: false, versao: VERSAO_SERVIDOR })).toBe(false);
    expect(consentimentoValido({ permitido: false, versao: "2026-11-27" })).toBe(false);
    expect(consentimentoValido({ permitido: "true", versao: VERSAO_SERVIDOR })).toBe(false);
    expect(consentimentoValido({ permitido: true, versao: null })).toBe(false);
    expect(consentimentoValido({ permitido: true })).toBe(false);
  });
  it("textos de 23/11 e 26/11 não valem (a Missão e o DEFCON não citavam a Anthropic neles)", () => {
    expect(consentimentoValido({ permitido: true, versao: "2026-11-23" })).toBe(false);
    expect(consentimentoValido({ permitido: true, versao: "2026-11-26" })).toBe(false);
    expect(consentimentoNoTextoAtual({ permitido: true, versao: "2026-11-26" })).toBe(false);
  });
  // 2026-11-28 only REMOVED recipients (Google, Cerebras) from the rows of 2026-11-27, so nobody who
  // allowed that text is asked again. What 2026-11-28 ADDED needs an answer on the current text.
  it("quem autorizou o texto de 27/11 continua valendo, sem a reserva da OpenAI nem a importação", () => {
    const de27 = { permitido: true, versao: "2026-11-27" };
    expect(consentimentoValido(de27)).toBe(true);
    expect(consentimentoNoTextoAtual(de27)).toBe(false);
  });
  it("autorização no texto atual → libera tudo que o texto cita", () => {
    const atual = { permitido: true, versao: VERSAO_SERVIDOR };
    expect(consentimentoValido(atual)).toBe(true);
    expect(consentimentoNoTextoAtual(atual)).toBe(true);
    expect(consentimentoNoTextoAtual({ permitido: false, versao: VERSAO_SERVIDOR })).toBe(false);
  });

  const fn = (n: string) => readFileSync(`supabase/functions/${n}/index.ts`, "utf8");
  const COM_IA = ["bright-action", "generate-insights", "objetivo-lucro-ia", "verificar-extrato", "extrato-analisar", "nota-ler", "estudio-arte", "verificar-deposito", "defcon-coach", "clima-vendedor", "import-financial-pdf"];

  it("as 11 funções que mandam dado do vendedor pra IA chamam o portão do servidor antes de qualquer provedor", () => {
    for (const n of COM_IA) {
      const src = fn(n);
      const portao = src.search(/(?:iaPermitidaNoServidor|permissaoIaNoServidor)\(/);
      expect(portao, n).toBeGreaterThan(0);
      // the first provider request inside the handler comes after the gate
      const handler = src.search(/(?:Deno\.)?serve\(async/);
      expect(handler, n).toBeGreaterThan(0);
      expect(portao, n).toBeGreaterThan(handler);
      const corpo = src.slice(handler);
      const pedido = corpo.search(/await (?:pedirClaude|pedirOpenAi|transcreverOpenAi|callClaude|callAI|ia|claude|openai|tentarOpenAI|opiniaoIA)\(|fetch\("https:\/\/api\.(?:anthropic|openai)\.com/);
      if (pedido >= 0) expect(pedido, n).toBeGreaterThan(corpo.search(/(?:iaPermitidaNoServidor|permissaoIaNoServidor)\(/));
    }
    expect(fn("analisar-anomalia")).toMatch(/iaPermitidaParaUsuario\(userId\)/);
    expect(readFileSync("supabase/functions/_shared/consentimento-ia.ts", "utf8")).toMatch(/select\("permitido, versao"\)/);
  });

  // 26/11 (Rick): two providers only. Not one function may reach Google, Cerebras or the unofficial
  // Microsoft voice endpoint again, not even as a reserve — and no key of theirs may be read.
  it("nenhuma função chama Gemini, Cerebras nem a voz do Edge (Microsoft)", () => {
    const pastas = readdirSync("supabase/functions", { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
    expect(pastas.length).toBeGreaterThan(40);
    for (const pasta of pastas) {
      for (const arq of readdirSync(`supabase/functions/${pasta}`).filter((a) => a.endsWith(".ts") && !a.endsWith(".test.ts"))) {
        const src = readFileSync(`supabase/functions/${pasta}/${arq}`, "utf8");
        expect(src, `${pasta}/${arq}`).not.toMatch(/generativelanguage\.googleapis\.com|api\.cerebras\.ai|speech\.platform\.bing\.com|GEMINI_[A-Z_]*KEY|CEREBRAS_[A-Z_]*KEY|GEMINI_[A-Z_]*MODEL|CEREBRAS_MODEL/);
      }
    }
  });

  it("a OpenAI de reserva em texto e leitura só entra com a autorização no texto atual", () => {
    // every function that can fall back to OpenAI for text or document reading reads textoAtual first
    for (const n of ["objetivo-lucro-ia", "defcon-coach", "clima-vendedor", "generate-insights", "extrato-analisar", "verificar-extrato"]) {
      const src = fn(n);
      expect(src, n).toMatch(/pedirOpenAi\(/);
      expect(src, n).toMatch(/permissao\.textoAtual/);
      expect(src, n).not.toMatch(/iaPermitidaNoServidor\(/); // they need the two answers, not just the boolean
    }
    expect(fn("objetivo-lucro-ia")).toMatch(/if \(permissao\.textoAtual\) fila\.push\(\["openai"/);
    expect(fn("defcon-coach")).toMatch(/if \(permissao\.textoAtual\) \{\s+const doOpenAi = await pedirOpenAi\(/);
    expect(fn("extrato-analisar")).toMatch(/const reservaOpenAi = permissao\.textoAtual && /);
    expect(fn("verificar-extrato")).toMatch(/const reservaOpenAi = permissao\.textoAtual && /);
    // the history import is new on the current text: an older answer does not open it at all
    expect(fn("import-financial-pdf")).toMatch(/if \(!permissao\.permitida \|\| !permissao\.textoAtual\) return respostaSemConsentimentoIa\(corsHeaders\);/);
    // voice and images were already OpenAI on the older text; the Mentor's text stays Claude only
    expect(fn("bright-action")).not.toMatch(/pedirOpenAi\(|chat\/completions/);
    expect(fn("nota-ler")).not.toMatch(/openai/i);
  });

  it("a divulgação e a política citam só Anthropic e OpenAI, função por função, igual ao código", () => {
    const textos = ["src/features/consentimento-ia/components/texto-ia.tsx", "src/pages/Privacidade.tsx"];
    // the row of a feature: an entry of LINHAS (app) or a <li> of the policy
    const linha = (arq: string, funcao: string) => readFileSync(arq, "utf8").split("\n").find((l) => /funcao: "|<li><strong>/.test(l) && l.includes(funcao)) ?? "";
    const RESERVA = ["Dicas e relatórios do dia", "Mensagem do DEFCON", "Dica do clima", "Objetivo de lucro", "Raio-X e conferência de extrato", "Importar histórico"];
    for (const arq of textos) {
      for (const f of RESERVA) expect(linha(arq, f), `${arq} · ${f}`).toMatch(/Anthropic; OpenAI de reserva/);
      expect(linha(arq, "Mentor (chat e voz)"), arq).toMatch(/Anthropic \(texto\) e OpenAI \(ouvir e falar\)/);
      expect(linha(arq, "Estúdio de Marca"), arq).toMatch(/OpenAI/);
      expect(linha(arq, "Estúdio de Marca"), arq).not.toMatch(/Anthropic/);
      for (const f of ["nota fiscal", "X1"]) { expect(linha(arq, f), `${arq} · ${f}`).toMatch(/Anthropic/); expect(linha(arq, f), `${arq} · ${f}`).not.toMatch(/OpenAI/); }
      // the mission prompt carries the nickname: the row says so
      expect(linha(arq, "Objetivo de lucro"), arq).toContain("seu apelido");
    }
    // no row, no intro and no policy paragraph still names a provider the app no longer uses
    const app = readFileSync(textos[0]!, "utf8");
    expect(app.slice(app.indexOf("const LINHAS"))).not.toMatch(/Google|Gemini|Cerebras/);
    const politica = readFileSync(textos[1]!, "utf8").split("\n").filter((l) => /Gemini|Cerebras/.test(l));
    expect(politica).toHaveLength(1);
    expect(politica[0]).toMatch(/não usa mais Google \(Gemini\) nem Cerebras/);
    expect(readFileSync("src/components/AceiteTermosModal.tsx", "utf8")).not.toMatch(/Google|Cerebras|Gemini/);
    expect(fn("objetivo-lucro-ia")).toMatch(/b\.apelido/);
  });

  // 26/11: a bug report has no account behind it, so nobody's permission can be checked, and a
  // regex filter is not a guarantee of anonymisation → the function sends nothing to any AI
  it("análise de bug: nada vai pra IA (sem autorização possível, o filtro de texto não é garantia)", () => {
    const src = fn("analisar-bug");
    expect(src).not.toMatch(/cerebras\.ai|generativelanguage|anthropic\.com|openai\.com|pedirClaude|pedirOpenAi|_API_KEY/);
    // its only request goes to our own database, and never reads the report's text or author
    expect(src.match(/fetch\(/g)).toHaveLength(1);
    expect(src).toMatch(/fetch\(`\$\{SB_URL\}\/rest\/v1\/orbis_bugs/);
    expect(src).not.toMatch(/select=\*|descricao|titulo|reporter|\btela\b/);
    expect(src).toMatch(/analise_ia_desligada/);
  });

  it("funções aposentadas não fazem nada: nem banco, nem provedor", () => {
    for (const n of ["smooth-worker", "chat-with-ai"]) {
      const src = fn(n);
      expect(src, n).toMatch(/status: 410/);
      expect(src, n).not.toMatch(/fetch\(|createClient|Deno\.env/);
    }
  });

  // A provider that fails is logged with the caller's name and the HTTP status only — never what the
  // vendor sent, what the AI said or a key (Cerebras and Gemini failed unseen for days before 26/11).
  it("falha de provedor vai pro log só com quem chamou e o código HTTP", () => {
    for (const [arq, n] of [["ia-claude", 4], ["ia-openai", 7]] as const) {
      const ajudante = readFileSync(`supabase/functions/_shared/${arq}.ts`, "utf8");
      const modelos = [...ajudante.matchAll(/aviso\(`([^`]*)`\)/g)].map((m) => m[1] ?? "");
      expect(modelos, arq).toHaveLength(n);
      for (const m of modelos) expect(m.replace("${p.quem}", "").replace("${res.status}", "").replace('${(e as Error)?.name ?? "erro"}', ""), arq).not.toContain("${");
      expect(ajudante, arq).not.toMatch(/console\.(log|warn|error)\([^)]*(p\.user|p\.system|chave|texto|arquivo)/);
    }
    for (const n of ["objetivo-lucro-ia", "defcon-coach", "clima-vendedor", "import-financial-pdf"]) {
      const logs = fn(n).split("\n").filter((l) => /console\.(warn|error|log)\(/.test(l)).map((l) => l.slice(l.search(/console\./)));
      for (const l of logs) expect(l, n).not.toMatch(/\b(prompt|template|body|base|apelido|authHeader|key|text|texto|raw|doClaude|doOpenAi|aiText|pdfBase64|user_)\b/);
    }
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

describe("Anthropic lendo um arquivo (nota, extrato, histórico)", () => {
  const base = { quem: "teste", user: "U", maxTokens: 50, timeoutMs: 1000 };
  it("PDF vai como documento, foto como imagem, e tipo desconhecido vira jpeg", () => {
    const partes = (mime: string) => (corpoClaude({ ...base, arquivo: { b64: "QUJD", mime } }, "claude-haiku-4-5-20251001").messages as { content: unknown[] }[])[0]!.content;
    expect(partes("application/pdf")).toEqual([{ type: "text", text: "U" }, { type: "document", source: { type: "base64", media_type: "application/pdf", data: "QUJD" } }]);
    expect(partes("image/png")[1]).toEqual({ type: "image", source: { type: "base64", media_type: "image/png", data: "QUJD" } });
    expect((partes("image/heic")[1] as { source: { media_type: string } }).source.media_type).toBe("image/jpeg");
  });
});

describe("pedido à OpenAI (reserva de texto e leitura, e ouvir o vendedor)", () => {
  const ok = (texto: string) => ({ ok: true, status: 200, json: async () => ({ choices: [{ message: { content: texto } }] }) }) as unknown as Response;
  const erro = (status: number) => ({ ok: false, status, json: async () => ({}) }) as unknown as Response;
  const pedido = { quem: "teste", system: "S", user: "U", maxTokens: 100, timeoutMs: 1000, temperature: 0.5 };

  it("manda só o que recebeu e devolve o texto", async () => {
    const chamadas: { url: string; init: RequestInit }[] = [];
    const fetchFn = (async (url: string, init: RequestInit) => { chamadas.push({ url, init }); return ok("  olá  "); }) as unknown as typeof fetch;
    expect(await pedirOpenAi(pedido, { chave: "k-teste", modelos: ["gpt-4.1-mini"], fetchFn })).toBe("olá");
    expect(chamadas).toHaveLength(1);
    expect(chamadas[0]?.url).toBe("https://api.openai.com/v1/chat/completions");
    expect((chamadas[0]?.init.headers as Record<string, string>).authorization).toBe("Bearer k-teste");
    expect(JSON.parse(String(chamadas[0]?.init.body))).toEqual({
      model: "gpt-4.1-mini", max_completion_tokens: 100, temperature: 0.5,
      messages: [{ role: "system", content: "S" }, { role: "user", content: "U" }],
    });
  });

  it("modelos de raciocínio não recebem temperature; JSON e arquivo entram no formato da OpenAI", () => {
    expect(aceitaTemperaturaOpenAi("gpt-4.1-mini")).toBe(true);
    expect(aceitaTemperaturaOpenAi("gpt-5-mini")).toBe(false);
    expect(aceitaTemperaturaOpenAi("o4-mini")).toBe(false);
    expect(corpoOpenAi(pedido, "gpt-5-mini")).not.toHaveProperty("temperature");
    expect(corpoOpenAi({ ...pedido, json: true }, "gpt-4.1-mini").response_format).toEqual({ type: "json_object" });
    const partes = (mime: string) => ((corpoOpenAi({ ...pedido, system: undefined, arquivo: { b64: "QUJD", mime } }, "gpt-4.1-mini").messages as { content: unknown[] }[])[0]!.content);
    expect(partes("application/pdf")[1]).toEqual({ type: "file", file: { filename: "documento.pdf", file_data: "data:application/pdf;base64,QUJD" } });
    expect(partes("image/webp")[1]).toEqual({ type: "image_url", image_url: { url: "data:image/webp;base64,QUJD" } });
  });

  it("modelo recusado pela conta (400/404) tenta o próximo; outro erro para na hora", async () => {
    const usados: string[] = []; const avisos: string[] = [];
    const responder = (respostas: Response[]) => (async (_u: string, init: RequestInit) => { usados.push(JSON.parse(String(init.body)).model); return respostas.shift()!; }) as unknown as typeof fetch;
    const deps = (respostas: Response[]) => ({ chave: "k", modelos: ["a", "b", "c"], aviso: (m: string) => avisos.push(m), fetchFn: responder(respostas) });
    expect(await pedirOpenAi(pedido, deps([erro(404), ok("do b")]))).toBe("do b");
    expect(usados).toEqual(["a", "b"]);
    usados.length = 0;
    expect(await pedirOpenAi(pedido, deps([erro(429), ok("nunca")]))).toBeNull();
    expect(usados).toEqual(["a"]);
    expect(avisos).toEqual(["teste: openai 404", "teste: openai 429"]);
  });

  it("sem chave, resposta vazia ou queda: devolve null, nunca lança, e o aviso só tem quem + motivo", async () => {
    const avisos: string[] = []; const aviso = (m: string) => avisos.push(m);
    const com = (r: () => Promise<Response>) => pedirOpenAi(pedido, { chave: "k-teste", modelos: ["m"], aviso, fetchFn: r as unknown as typeof fetch });
    expect(await pedirOpenAi(pedido, { chave: "", aviso, fetchFn: (() => { throw new Error("não devia chamar"); }) as unknown as typeof fetch })).toBeNull();
    expect(await com(async () => ok("   "))).toBeNull();
    expect(await com(async () => { const e = new Error("segredo U S k-teste"); e.name = "TimeoutError"; throw e; })).toBeNull();
    expect(avisos).toEqual(["teste: openai sem chave", "teste: openai vazio", "teste: openai sem resposta (TimeoutError)"]);
  });

  it("ouvir o vendedor: manda o áudio em português e devolve o que foi dito", async () => {
    const chamadas: { url: string; init: RequestInit }[] = [];
    const fetchFn = (async (url: string, init: RequestInit) => { chamadas.push({ url, init }); return ({ ok: true, status: 200, json: async () => ({ text: " vendi vinte hoje " }) }) as unknown as Response; }) as unknown as typeof fetch;
    const dito = await transcreverOpenAi({ quem: "teste", audio: new Uint8Array([1, 2, 3]), mime: "audio/mp4", timeoutMs: 1000 }, { chave: "k", modelos: ["gpt-4o-mini-transcribe"], fetchFn });
    expect(dito).toBe("vendi vinte hoje");
    expect(chamadas[0]?.url).toBe("https://api.openai.com/v1/audio/transcriptions");
    const fd = chamadas[0]?.init.body as FormData;
    expect(fd.get("model")).toBe("gpt-4o-mini-transcribe");
    expect(fd.get("language")).toBe("pt");
    expect((fd.get("file") as File).name).toBe("fala.m4a");
    const avisos: string[] = [];
    const fora = (async () => ({ ok: false, status: 500, json: async () => ({}) }) as unknown as Response) as unknown as typeof fetch;
    expect(await transcreverOpenAi({ quem: "teste", audio: new Uint8Array([1]), mime: "audio/webm", timeoutMs: 1000 }, { chave: "k", modelos: ["m"], fetchFn: fora, aviso: (m) => avisos.push(m) })).toBeNull();
    expect(avisos).toEqual(["teste: openai stt 500"]);
  });
});

describe("importar histórico: do que a IA respondeu às linhas que o vendedor confere", () => {
  it("acha o JSON mesmo embrulhado e não inventa nada quando não há JSON", () => {
    expect(lerJsonDaIa('```json\n{"resumo":"ok","dias":[]}\n```')).toEqual({ resumo: "ok", dias: [] });
    expect(lerJsonDaIa("não consegui ler")).toBeNull();
  });
  it("centavos arredondados, unidades inteiras, dia vazio fora, e o faturamento é dinheiro + pix + gorjeta quando veio 0", () => {
    const dias = limparDias([
      { data: "2026-07-12T00:00:00", faturamento: 0, dinheiro: 50.005, pix: "300", gorjeta: 10, calote: 20, custo: 40, unidades_iniciais: 30.6, unidades_nao_pagas: "2" },
      { data: "2026-07-13", faturamento: 500, dinheiro: 100, pix: 100 },
      { data: "2026-07-14", faturamento: 0, dinheiro: 0, pix: 0, custo: 0, transporte: 15 },
      null,
      { data: "", faturamento: "abc", custo: 12.999 },
    ]);
    expect(dias).toEqual([
      { data: "2026-07-12", faturamento: 360.01, dinheiro: 50.01, pix: 300, gorjeta: 10, calote: 20, custo: 40, transporte: 0, alimentacao: 0, unidades_iniciais: 31, unidades_nao_pagas: 2 },
      { data: "2026-07-13", faturamento: 500, dinheiro: 100, pix: 100, gorjeta: 0, calote: 0, custo: 0, transporte: 0, alimentacao: 0, unidades_iniciais: 0, unidades_nao_pagas: 0 },
      { data: "", faturamento: 0, dinheiro: 0, pix: 0, gorjeta: 0, calote: 0, custo: 13, transporte: 0, alimentacao: 0, unidades_iniciais: 0, unidades_nao_pagas: 0 },
    ]);
    expect(limparDias("nada")).toEqual([]);
  });
});
