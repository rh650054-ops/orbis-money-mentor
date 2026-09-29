// Vant — extrato-analisar (Raio-X do extrato)
// O vendedor manda o EXTRATO de um banco (print ou PDF, pode ser de varios bancos, um
// arquivo por chamada). A IA le TODOS os lancamentos do periodo, categoriza (iFood, Uber,
// mercado, Pix pra pessoas, mercadoria...) e a gente guarda SO descricao curta, valor,
// data/hora, tipo e categoria em extrato_lancamentos — nunca saldo, agencia, conta ou CPF.
// O arquivo em si e descartado; fica so o sha256 (extrato_arquivos.hash) pra nao ler o
// mesmo extrato duas vezes. Lancamento repetido (mesmo dia+valor+tipo+descricao) nao
// duplica, entao mandar de novo ou mandar dois bancos e seguro.
// PRIMARIO: Claude (visao, prompt estatico em cache). FALLBACK: Gemini.
// Recebe { file: base64, mime }.
// Devolve { ok, arquivo_id, banco, mes, periodo_inicio, periodo_fim, lidos, novos,
//           repetidos, nao_identificados, ja_lido, motor }.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CATEGORIAS_SAIDA = [
  "mercadoria", "insumos", "onibus", "combustivel", "transporte_app", "delivery", "restaurante",
  "mercado", "pix_pessoas", "assinaturas", "contas_casa", "celular_internet", "farmacia", "roupas",
  "lazer", "parcelas", "saque", "taxas", "apostas", "transferencia_propria", "outros", "nao_identificado",
];
const CATEGORIAS_ENTRADA = ["pix_recebido", "cartao_recebido", "transferencia_recebida", "estorno", "outros_entrada"];
const TODAS = new Set([...CATEGORIAS_SAIDA, ...CATEGORIAS_ENTRADA]);

// Bloco ESTATICO (identico pra todo mundo) -> cache_control. O dinamico so leva a
// dica de nome do titular e a data de hoje.
const PROMPT_ESTATICO = `Voce e o leitor de extratos do app Vant (vendedores de rua no Brasil). Recebe a imagem ou o PDF de um extrato bancario brasileiro (Nubank, Caixa, Bradesco, Itau, Santander, Inter, PicPay, Mercado Pago, C6, PagBank, Banco do Brasil, Will, Neon, etc.).
A dica de nome do titular e a data de hoje vem no PROXIMO bloco.

TAREFA: listar TODOS os lancamentos (movimentacoes) visiveis no documento, um por item, e classificar cada um.
- NAO pule nenhum. Nao resuma. Nao agrupe. Se o extrato tem 200 linhas, devolva 200 itens.
- IGNORE linhas de saldo ("Saldo do dia", "Saldo anterior", "Saldo disponivel"), cabecalhos, totais e rendimentos de saldo em conta (juros/rendimento da conta NAO entram).
- "d" = data de LANCAMENTO/transacao (YYYY-MM-DD). Extratos agrupam por dia com um cabecalho de data: cada lancamento herda a data do cabecalho do seu bloco.
- "h" = hora HH:MM se aparecer, senao null.
- "v" = valor SEMPRE positivo (numero). "t" = "s" (saida: dinheiro saiu, debito, Pix enviado, pagamento, compra) ou "e" (entrada: dinheiro entrou, Pix recebido, credito, deposito, estorno).
- "desc" = descricao CURTA (max 40 caracteres): o nome do estabelecimento ou da pessoa. NUNCA inclua agencia, conta, CPF, CNPJ, chave Pix, ID da transacao ou numero de cartao. Ex: "Pix enviado Joao Silva", "iFood", "Uber", "Atacadao".
- "c" = nome curto do comerciante ou pessoa (max 20 caracteres, sem banco/agencia): "IFOOD", "UBER", "ATACADAO", "JOAO SILVA", "NETFLIX". E a chave que agrupa o mesmo lugar em varias compras.
- "k" = categoria, UM destes slugs:
  SAIDAS (t="s"):
   mercadoria = compra do que ele REVENDE (atacadista, distribuidora de bebidas, doceria/fabrica, "mercadoria", fornecedor, Assai/Atacadao/Makro quando for compra grande de estoque)
   insumos = gelo, embalagem, copos, gas, isopor, pilhas pra caixa de som
   onibus = passagem, RioCard, Bilhete Unico, SPTrans, metro, trem, BRT, VLT
   combustivel = posto de gasolina, Shell, Ipiranga, Petrobras
   transporte_app = Uber, 99, inDrive, Cabify (corrida de carro/moto)
   delivery = iFood, Rappi, Uber Eats, Ze Delivery, aiqfome
   restaurante = bar, lanchonete, padaria, pizzaria, McDonalds, Burger King, restaurante presencial
   mercado = supermercado/mercadinho pra CASA (compra pequena/normal, nao e estoque)
   pix_pessoas = Pix/transferencia enviada pra uma PESSOA FISICA (nome de gente) que nao seja o proprio titular
   assinaturas = Netflix, Spotify, Amazon Prime, Disney, HBO/Max, Globoplay, YouTube Premium, Apple, Google, iCloud, jogos por assinatura
   contas_casa = luz, agua, gas encanado, aluguel, condominio, IPTU, boleto de casa
   celular_internet = Claro, Vivo, TIM, Oi, recarga de celular, internet
   farmacia = drogaria, farmacia
   roupas = roupa, tenis, Shopee, Shein, Renner, C&A, Riachuelo, Centauro
   lazer = cinema, ingresso, jogos (Steam, PlayStation, Xbox, Free Fire, Garena), balada, viagem
   parcelas = parcela de emprestimo, financiamento, crediario, PAGAMENTO DE FATURA de cartao, consignado
   saque = saque em dinheiro, caixa eletronico
   taxas = tarifa bancaria, IOF, juros, anuidade, multa
   apostas = bet, Betano, bet365, Blaze, Esportes da Sorte, Sportingbet, Pixbet, loteria, tigrinho
   transferencia_propria = transferencia/Pix pro PROPRIO titular (mesmo nome do titular do extrato ou muito parecido com a dica de nome), ou "aplicacao", "resgate", "poupanca", "caixinha", "cofrinho" — dinheiro que so mudou de lugar
   outros = saida clara que nao cabe em nada acima
   nao_identificado = NAO da pra saber o que e (descricao generica tipo "Compra no debito", "Pagamento", codigo sem nome) — na duvida, use este. NAO chute.
  ENTRADAS (t="e"):
   pix_recebido = Pix recebido de qualquer pessoa/empresa
   cartao_recebido = repasse de maquininha/adquirente (Stone, PagSeguro, Mercado Pago, Cielo, Rede, Getnet, SumUp, InfinitePay, Ton)
   transferencia_recebida = TED/DOC/transferencia recebida que nao e Pix, ou transferencia do proprio titular entrando
   estorno = estorno, devolucao, reembolso, cashback
   outros_entrada = qualquer outra entrada (salario, deposito em dinheiro, rendimento)
- "banco" = nome do banco/instituicao do extrato (ex: "Nubank", "Caixa", "Mercado Pago"). Se nao der pra saber, "".
- "titular" = primeiro e segundo nome do titular do extrato se aparecer no cabecalho, senao "".
- "periodo_inicio"/"periodo_fim" = primeira e ultima data de lancamento visiveis (YYYY-MM-DD).
- "documento" = "extrato" se for um extrato/lista de movimentacoes de banco ou conta de pagamento; "cartao" se for FATURA de cartao de credito (lista de compras do cartao — tambem vale, trate cada compra como saida); "outro" se NAO for nada disso (foto aleatoria, um comprovante unico, print sem lista). Se "outro", devolva "itens": [].

ECONOMIA (o mes tem MUITAS linhas): JSON compacto, sem espacos extras, sem texto fora do JSON, sem markdown.
Responda SOMENTE um JSON valido:
{"documento":"extrato","banco":"Nubank","titular":"Joao Silva","periodo_inicio":"2026-08-01","periodo_fim":"2026-08-31","itens":[{"d":"2026-08-03","h":"22:41","desc":"iFood","c":"IFOOD","v":47.9,"t":"s","k":"delivery"},{"d":"2026-08-03","h":null,"desc":"Pix recebido Maria Souza","c":"MARIA SOUZA","v":12,"t":"e","k":"pix_recebido"}]}`;

function buildPromptDinamico(nome: string, hoje: string): string {
  const hint = nome ? ` Dica: o titular provavelmente se chama "${nome}" — transferencia pra esse nome e transferencia_propria.` : "";
  return `Hoje e ${hoje}.${hint}`;
}

// ---- Dicionario de comerciantes (deterministico, ganha da IA) ----
// Regra: so marcas INEQUIVOCAS. Atacadao/Assai etc. ficam com a IA (pode ser estoque ou casa).
const DICIONARIO: Array<[RegExp, string]> = [
  [/\bUBER\s*EATS\b/, "delivery"],
  [/\b(IFOOD|RAPPI|ZE\s*DELIVERY|AIQFOME|DAKI)\b/, "delivery"],
  [/\b(UBER|99\s?(POP|APP|TAXI|MOTO)?|INDRIVE|IN\s*DRIVE|CABIFY)\b/, "transporte_app"],
  [/\b(NETFLIX|SPOTIFY|AMAZON\s*PRIME|PRIME\s*VIDEO|DISNEY|HBO|GLOBOPLAY|YOUTUBE|DEEZER|PARAMOUNT|CRUNCHYROLL|ICLOUD|APPLE\s*COM|GOOGLE\s*(PLAY|ONE|STORAGE)|CANVA|TELECINE)\b/, "assinaturas"],
  [/\b(CLARO|VIVO|TIM\s*S\s*A|TIM\s*CELULAR|OI\s*MOVEL|RECARGA\s*(CELULAR|TIM|CLARO|VIVO)|ALGAR|NEXTEL)\b/, "celular_internet"],
  [/\b(ENEL|LIGHT\s*S|CEMIG|CPFL|COPEL|COELBA|CELPE|EQUATORIAL|NEOENERGIA|SABESP|CEDAE|COMGAS|NATURGY|EMBASA|COMPESA|CAGECE|IPTU|CONDOMINIO)\b/, "contas_casa"],
  [/\b(DROGA\w*|FARMA\w*|PAGUE\s*MENOS|RAIA|DROGASIL|ULTRAFARMA|PANVEL|NISSEI)\b/, "farmacia"],
  [/\b(SHELL|IPIRANGA|PETROBRAS|POSTO|AUTO\s*POSTO|BR\s*MANIA)\b/, "combustivel"],
  [/\b(RIOCARD|BILHETE\s*UNICO|SPTRANS|METRO\w*|CPTM|SUPERVIA|VLT|BRT|JAE\b|TOP\s*RJ|CARTAO\s*TOP|BOM\s*TRANSPORTE|SEM\s*PARAR|CONECTCAR)\b/, "onibus"],
  [/\b(BETANO|BET\s*365|BET365|BLAZE|ESPORTES?\s*DA\s*SORTE|SPORTINGBET|PIXBET|BETNACIONAL|ESTRELA\s*BET|SUPERBET|NOVIBET|BETFAIR|LOTERIA|LOTERICA|MEGA\s*SENA|CASA\s*DE\s*APOSTAS|BET)\b/, "apostas"],
  [/\b(SAQUE|RETIRADA|BANCO\s*24|CAIXA\s*24|TECBAN)\b/, "saque"],
  [/\b(TARIFA|IOF|ANUIDADE|JUROS|MULTA|ENCARGO)\b/, "taxas"],
  [/\b(SHOPEE|SHEIN|RENNER|RIACHUELO|CENTAURO|NETSHOES|MARISA|PERNAMBUCANAS|KALUNGA)\b/, "roupas"],
  [/\b(MC\s*DONALD\w*|MCDONALDS|BURGER\s*KING|SUBWAY|HABIB\w*|GIRAFFAS|PIZZARIA|LANCHONETE|RESTAURANTE|CHURRASCARIA|SPOLETO|OUTBACK|STARBUCKS|CACAU\s*SHOW|KOPENHAGEN)\b/, "restaurante"],
  [/\b(STEAM|PLAYSTATION|XBOX|NINTENDO|RIOT|GARENA|FREE\s*FIRE|CINEMARK|CINEPOLIS|KINOPLEX|INGRESSO\w*|SYMPLA|EVENTIM)\b/, "lazer"],
  [/\b(EMPRESTIMO|FINANCIAMENTO|CREDIARIO|CONSIGNADO|PAGAMENTO\s*(DE\s*)?FATURA|PGTO\s*FATURA|FATURA\s*CARTAO|CREDITO\s*PESSOAL|PARCELA)\b/, "parcelas"],
  [/\b(APLICACAO|RESGATE|POUPANCA|CAIXINHA|COFRINHO|RDB|CDB|TESOURO|INVESTIMENTO)\b/, "transferencia_propria"],
];
const DICIONARIO_ENTRADA: Array<[RegExp, string]> = [
  [/\b(STONE|PAGSEGURO|PAG\s*SEGURO|MERCADO\s*PAGO|MERCADOPAGO|CIELO|GETNET|SUMUP|SUM\s*UP|INFINITE\s*PAY|INFINITEPAY|PAGBANK|SAFRAPAY)\b/, "cartao_recebido"],
  [/\b(ESTORNO|DEVOLUCAO|REEMBOLSO|CASHBACK)\b/, "estorno"],
  [/\b(PIX\s*RECEBIDO|RECEBIMENTO\s*PIX|TRANSF\w*\s*RECEBIDA\s*PIX|PIX\s*CRED)\b/, "pix_recebido"],
  [/\b(TED|DOC\b|TRANSF\w*\s*RECEBIDA)\b/, "transferencia_recebida"],
];

// Mesma normalizacao do extrato_norm() no banco (maiusculas, sem numero/pontuacao/acento).
function norm(s: string): string {
  return s.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[0-9]+/g, " ").replace(/[^A-Z ]+/g, " ").replace(/\s+/g, " ").trim();
}

function sha256Hex(bytes: Uint8Array): Promise<string> {
  return crypto.subtle.digest("SHA-256", bytes).then((h) =>
    Array.from(new Uint8Array(h)).map((b) => b.toString(16).padStart(2, "0")).join(""));
}

// ---- Conserto de JSON truncado (igual ao verificar-extrato) ----
function fechamentosAbertos(s: string): string | null {
  const stack: string[] = [];
  let inStr = false, esc = false;
  for (const ch of s) {
    if (esc) { esc = false; continue; }
    if (inStr) { if (ch === "\\") esc = true; else if (ch === '"') inStr = false; continue; }
    if (ch === '"') inStr = true;
    else if (ch === "{") stack.push("}");
    else if (ch === "[") stack.push("]");
    else if (ch === "}" || ch === "]") { if (stack.pop() !== ch) return null; }
  }
  if (inStr) return null;
  return stack.reverse().join("");
}
function reparaJsonTruncado(t: string): any | null {
  const start = t.indexOf("{");
  if (start < 0) return null;
  const s = t.slice(start);
  let cut = s.length;
  for (let i = 0; i < 60 && cut > 1; i++) {
    const idx = Math.max(s.lastIndexOf("}", cut - 1), s.lastIndexOf("]", cut - 1));
    if (idx <= 0) return null;
    const prefix = s.slice(0, idx + 1);
    const closers = fechamentosAbertos(prefix);
    if (closers !== null) {
      try { const p = JSON.parse(prefix + closers); console.warn("extrato-analisar: JSON truncado reparado"); return p; } catch { /* corta mais */ }
    }
    cut = idx;
  }
  return null;
}

async function callClaude(key: string, model: string, promptEstatico: string, promptDinamico: string, fileB64: string, mime: string, maxTokens: number): Promise<string> {
  const isPdf = mime.includes("pdf");
  const mediaType = isPdf ? "application/pdf"
    : (["image/jpeg", "image/png", "image/gif", "image/webp"].includes(mime) ? mime : "image/jpeg");
  const filePart = isPdf
    ? { type: "document", source: { type: "base64", media_type: mediaType, data: fileB64 } }
    : { type: "image", source: { type: "base64", media_type: mediaType, data: fileB64 } };
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    signal: AbortSignal.timeout(110000),
    body: JSON.stringify({
      model, max_tokens: maxTokens,
      messages: [{ role: "user", content: [
        { type: "text", text: promptEstatico, cache_control: { type: "ephemeral" } },
        { type: "text", text: promptDinamico },
        filePart,
      ] }],
    }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    console.error("Claude extrato-analisar erro", res.status, t.slice(0, 200));
    throw new Error(`claude_${res.status}`);
  }
  const data = await res.json();
  return (data?.content ?? []).map((b: any) => b?.text || "").join("").trim();
}

async function callGemini(key: string, prompt: string, fileB64: string, mime: string): Promise<string> {
  const models = (Deno.env.get("GEMINI_VISION_MODELS") ?? "gemini-2.0-flash,gemini-2.5-flash,gemini-flash-latest,gemini-1.5-flash")
    .split(",").map((s) => s.trim()).filter(Boolean);
  const reqBody = JSON.stringify({
    contents: [{ parts: [{ text: prompt }, { inlineData: { mimeType: mime, data: fileB64 } }] }],
    generationConfig: { temperature: 0, responseMimeType: "application/json", maxOutputTokens: 16000 },
  });
  for (const m of models) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${key}`;
    let r: Response;
    try {
      r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, signal: AbortSignal.timeout(60000), body: reqBody });
    } catch (e) { console.error("Gemini extrato-analisar fetch erro", m, String(e).slice(0, 150)); continue; }
    if (r.ok) {
      const data = await r.json();
      return data?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text || "").join("") ?? "";
    }
    console.error("Gemini extrato-analisar erro", m, r.status);
  }
  throw new Error("gemini_ocupado");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const json = (obj: unknown, status = 200) =>
    new Response(JSON.stringify(obj), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const body = await req.json().catch(() => ({}));
    const fileB64 = typeof body?.file === "string" ? body.file.replace(/^data:[^;]+;base64,/, "") : "";
    const mime = typeof body?.mime === "string" ? body.mime : "application/pdf";
    if (!fileB64) return json({ error: "sem_arquivo" }, 400);
    // ~12MB de base64 (~9MB de arquivo): extrato de mes em PDF cabe folgado.
    if (fileB64.length > 12_000_000) return json({ error: "arquivo_grande", dica: "Arquivo muito grande. Manda o PDF do mês ou prints menores." }, 413);

    // Auth obrigatoria: os lancamentos sao gravados no nome do usuario.
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader) return json({ error: "nao_autenticado" }, 401);
    const supaUser = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } });
    const { data: u } = await supaUser.auth.getUser();
    const uid = u?.user?.id ?? null;
    if (!uid) return json({ error: "nao_autenticado" }, 401);

    let nome = "";
    try {
      const { data: prof } = await supaUser.from("public_profiles").select("nickname").eq("user_id", uid).maybeSingle();
      // Sanitiza: o nickname entra no prompt — sem aspas/quebras e curto (anti-injecao).
      nome = ((prof as any)?.nickname ?? "").toString().replace(/["'`\r\n]/g, " ").replace(/\s+/g, " ").trim().slice(0, 40);
    } catch { /* best-effort */ }

    // Service role: escreve em extrato_arquivos / extrato_lancamentos (RLS so libera leitura pro usuario).
    const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");

    // Hash do arquivo: mesmo extrato mandado de novo nao gasta IA nem duplica.
    let bytes: Uint8Array;
    try { bytes = Uint8Array.from(atob(fileB64), (c) => c.charCodeAt(0)); } catch { return json({ error: "arquivo_invalido" }, 400); }
    const hash = await sha256Hex(bytes);
    const { data: jaTem } = await admin.from("extrato_arquivos").select("id, banco, mes, lancamentos, periodo_inicio, periodo_fim")
      .eq("user_id", uid).eq("hash", hash).maybeSingle();
    if (jaTem) {
      return json({ ok: true, ja_lido: true, arquivo_id: (jaTem as any).id, banco: (jaTem as any).banco, mes: (jaTem as any).mes,
        periodo_inicio: (jaTem as any).periodo_inicio, periodo_fim: (jaTem as any).periodo_fim,
        lidos: (jaTem as any).lancamentos, novos: 0, repetidos: 0, nao_identificados: 0 });
    }

    // Trava de uso (falha FECHADA: visao e cara). 8 arquivos/dia da pra 2-3 bancos com folga.
    try {
      const { data: usage } = await supaUser.rpc("bump_ai_usage", { p_feature: "extrato_raio_x", p_limit: 8 });
      if ((usage as any)?.over) return json({ error: "limite_diario", dica: "Você já mandou bastante extrato hoje. Volta amanhã." }, 200);
    } catch (e) {
      console.error("bump_ai_usage extrato_raio_x falhou", String(e).slice(0, 120));
      return json({ error: "trava_indisponivel", dica: "Tenta de novo em instantes." }, 503);
    }

    const hojeBR = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
    const promptDinamico = buildPromptDinamico(nome, hojeBR);
    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
    const geminiKey = Deno.env.get("GEMINI_API_KEY");
    const model = Deno.env.get("ANTHROPIC_MODEL") ?? "claude-haiku-4-5-20251001";

    let text = ""; let motor = ""; let lastErr = "";
    if (anthropicKey) {
      try { text = await callClaude(anthropicKey, model, PROMPT_ESTATICO, promptDinamico, fileB64, mime, 16000); motor = "claude"; }
      catch (e) { lastErr = String((e as Error)?.message || e); }
    }
    if (!text && geminiKey) {
      try { text = await callGemini(geminiKey, `${PROMPT_ESTATICO}\n\n${promptDinamico}`, fileB64, mime); motor = "gemini"; }
      catch (e) { lastErr = String((e as Error)?.message || e); }
    }
    if (!text) {
      if (!anthropicKey && !geminiKey) return json({ error: "sem_chave_ia" }, 500);
      return json({ error: lastErr || "leitura_indisponivel", dica: "Tenta de novo em instantes." }, 503);
    }

    let parsed: any = null;
    try { parsed = JSON.parse(text); } catch {
      const m = text.match(/\{[\s\S]*\}/);
      if (m) { try { parsed = JSON.parse(m[0]); } catch { /* noop */ } }
    }
    if (!parsed) parsed = reparaJsonTruncado(text);
    if (!parsed) return json({ error: "leitura_falhou" }, 422);

    const documento = String(parsed?.documento ?? "outro");
    const itensRaw: any[] = Array.isArray(parsed?.itens) ? parsed.itens : [];
    if (documento === "outro" || itensRaw.length === 0) {
      return json({ error: "nao_e_extrato", dica: "Isso não parece um extrato com a lista de movimentações. Manda o extrato do mês (PDF ou print da lista)." }, 200);
    }

    // Regras do usuario (o que ele ja ensinou pelo "mover") ganham de tudo.
    const { data: regras } = await admin.from("extrato_regras_usuario").select("comerciante, categoria, esfera").eq("user_id", uid);
    const regraPorCom = new Map<string, { categoria: string; esfera: string }>();
    for (const r of (regras ?? []) as any[]) regraPorCom.set(String(r.comerciante), { categoria: r.categoria, esfera: r.esfera });
    const { data: cats } = await admin.from("extrato_categorias").select("slug, esfera_padrao");
    const esferaPadrao = new Map<string, string>();
    for (const c of (cats ?? []) as any[]) esferaPadrao.set(c.slug, c.esfera_padrao);

    const banco = String(parsed?.banco ?? "").replace(/[\r\n"']/g, " ").trim().slice(0, 40) || null;
    const isoRe = /^\d{4}-\d{2}-\d{2}$/;
    const rows: any[] = [];
    const seen = new Set<string>();
    const contaMes = new Map<string, number>();
    let naoIdent = 0;
    for (const it of itensRaw.slice(0, 2000)) {
      const data = String(it?.d ?? "");
      const valor = Math.round((Number(it?.v) || 0) * 100) / 100;
      if (!isoRe.test(data) || !(valor > 0)) continue;
      const tipo = it?.t === "e" ? "entrada" : "saida";
      const hora = typeof it?.h === "string" && /^\d{2}:\d{2}/.test(it.h) ? it.h.slice(0, 5) : null;
      // Descricao: curta e sem numero longo (conta/CPF/ID) mesmo que a IA deixe escapar.
      const descricao = String(it?.desc ?? "").replace(/\d{5,}/g, "").replace(/\s+/g, " ").trim().slice(0, 60) || "Lançamento";
      const descNorm = norm(descricao) || "LANCAMENTO";
      const comerciante = (norm(String(it?.c ?? "")) || descNorm).slice(0, 40);

      let categoria = String(it?.k ?? "");
      let confianca: "regra" | "ia" | "usuario" | "baixa" = "ia";
      const alvo = `${comerciante} ${descNorm}`;
      const dic = tipo === "saida" ? DICIONARIO : DICIONARIO_ENTRADA;
      const hit = dic.find(([re]) => re.test(alvo));
      if (hit) { categoria = hit[1]; confianca = "regra"; }
      const permitidas = tipo === "saida" ? CATEGORIAS_SAIDA : CATEGORIAS_ENTRADA;
      if (!TODAS.has(categoria) || !permitidas.includes(categoria)) {
        categoria = tipo === "saida" ? "nao_identificado" : "outros_entrada";
        confianca = "baixa";
      }
      if (categoria === "nao_identificado") confianca = "baixa";
      let esfera = esferaPadrao.get(categoria) ?? "pessoal";
      const regra = regraPorCom.get(comerciante);
      if (regra && (tipo === "saida" ? CATEGORIAS_SAIDA : CATEGORIAS_ENTRADA).includes(regra.categoria)) {
        categoria = regra.categoria; esfera = regra.esfera; confianca = "usuario";
      }
      if (categoria === "nao_identificado") naoIdent++;

      // Dedupe dentro do proprio arquivo (a unique do banco cuida do resto).
      const chave = `${data}|${valor}|${tipo}|${descNorm}`;
      if (seen.has(chave)) continue;
      seen.add(chave);
      const mesKey = data.slice(0, 7);
      contaMes.set(mesKey, (contaMes.get(mesKey) ?? 0) + 1);
      rows.push({ user_id: uid, data, hora, descricao, descricao_norm: descNorm, comerciante, valor, tipo, categoria, esfera, confianca, banco });
    }
    if (rows.length === 0) return json({ error: "nao_e_extrato", dica: "Não achei nenhuma movimentação legível nesse arquivo." }, 200);

    // Mes do arquivo = o mes com mais lancamentos (extrato de 15/08 a 14/09 cai no que pesa mais).
    const mesTop = [...contaMes.entries()].sort((a, b) => b[1] - a[1])[0]![0];
    const datas = rows.map((r) => r.data).sort();
    const pIni = isoRe.test(String(parsed?.periodo_inicio)) ? parsed.periodo_inicio : datas[0];
    const pFim = isoRe.test(String(parsed?.periodo_fim)) ? parsed.periodo_fim : datas[datas.length - 1];

    const { data: arq, error: eArq } = await admin.from("extrato_arquivos")
      .insert({ user_id: uid, banco, mes: `${mesTop}-01`, hash, lancamentos: 0, periodo_inicio: pIni, periodo_fim: pFim, origem: "arquivo" })
      .select("id").single();
    if (eArq || !arq) { console.error("extrato_arquivos insert", eArq?.message); return json({ error: "gravar_falhou" }, 500); }
    const arquivoId = (arq as any).id as string;

    // Insere em lotes; repetido (mesmo dia+valor+tipo+descricao) e ignorado — assim
    // reenviar o extrato ou mandar o do outro banco nao infla nada.
    let novos = 0;
    for (let i = 0; i < rows.length; i += 200) {
      const lote = rows.slice(i, i + 200).map((r) => ({ ...r, arquivo_id: arquivoId }));
      const { data: ins, error: eIns } = await admin.from("extrato_lancamentos")
        .upsert(lote, { onConflict: "user_id,data,valor,tipo,descricao_norm", ignoreDuplicates: true }).select("id");
      if (eIns) { console.error("extrato_lancamentos upsert", eIns.message); continue; }
      novos += (ins ?? []).length;
    }
    await admin.from("extrato_arquivos").update({ lancamentos: novos }).eq("id", arquivoId);

    return json({ ok: true, motor, arquivo_id: arquivoId, banco, mes: `${mesTop}-01`, periodo_inicio: pIni, periodo_fim: pFim,
      lidos: rows.length, novos, repetidos: rows.length - novos, nao_identificados: naoIdent, ja_lido: false });
  } catch (e) {
    console.error("extrato-analisar erro", String(e).slice(0, 300));
    return json({ error: "erro_interno" }, 500);
  }
});
