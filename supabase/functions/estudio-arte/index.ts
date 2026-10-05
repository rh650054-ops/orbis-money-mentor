// Vant — estudio-arte v24 (caixinha/frase/contato do papo do estúdio; v23: (ordem dos provedores pelo banco: OpenAI primeiro, Gemini de rede): gera o ADESIVO do vendedor com IA. O briefing vem da
// GALERIA (modelo_id da biblioteca estudio_modelos) OU do CHAT da Orbis IA (estilo em
// texto + referência opcional enviada pelo PRÓPRIO usuário). Deixa ÁREA BRANCA pro app
// colocar o QR Pix REAL.
// PROVEDORES (em ordem): 1) Gemini (GEMINI_IMAGE_MODEL, padrao gemini-3.1-flash-image;
// exige billing ativado na conta Google) → 2) OpenAI GPT Image (se OPENAI_API_KEY
// existir nos secrets) — o MESMO gerador de imagem do ChatGPT.
// v5: OpenAI usa gpt-image-2 (o mesmo do ChatGPT atual) com fallback 1.5 -> 1;
// qualidade via OPENAI_IMAGE_QUALITY ("medium" — ~US$0,041 por arte 1024x1536).
// v9 (custo + funil):
//   - TRIAL (3 dias grátis) TAMBÉM gera arte, com limite menor, e a arte sai com
//     marca d'água — pra baixar limpa ele assina. Antes o trial era tratado igual
//     a assinante e baixava tudo de graça.
//   - limites por dia via ESTUDIO_LIMITE_PAGANTE / _TRIAL. Em 14/08/2026 abertos
//     pra 30/30 na fase de teste (eram 4 e 2), junto com MODO_TESTE_LIBERADO=1.
//   - TODA geração é registrada em estudio_geracoes (briefing + provedor + depois
//     a URL e se o vendedor baixou) — é o dado que ensina o que funciona.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") ?? "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function bytesToB64(bytes: Uint8Array): string {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(bin);
}
function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const json = (obj: unknown, status = 200) =>
    new Response(JSON.stringify(obj), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const authH = req.headers.get("Authorization") ?? "";
    if (!authH) return json({ error: "login_necessario" }, 401);
    const supa = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_ANON_KEY") ?? "", { global: { headers: { Authorization: authH } } });
    const { data: u } = await supa.auth.getUser();
    if (!u?.user?.id) return json({ error: "sessao_expirada" }, 401);
    const userId = u.user.id;

    const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
    const { data: prof } = await admin.from("profiles")
      .select("plan_status,is_trial_active,trial_end,billing_exempt,is_demo")
      .eq("user_id", userId).maybeSingle();
    const hoje = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });

    // PAGANTE = assinatura ativa (ou conta liberada). TRIAL = os 3 dias grátis.
    // Os dois geram arte; só o pagante baixa sem marca d'água.
    const pagante = !!prof && (prof.billing_exempt || prof.is_demo || prof.plan_status === "active");
    const trial = !!prof && !pagante && !!prof.is_trial_active && String(prof.trial_end ?? "") >= hoje;

    // FASE DE TESTE (14/08/2026): com a porta antiga, quem tinha o trial VENCIDO nem
    // gerava — e isso era a maioria (dos 352 cadastrados, 18 com trial válido e 54
    // pagando). Enquanto MODO_TESTE_LIBERADO=1, qualquer logado cria arte; a marca
    // d'água continua valendo pra quem não paga, então a monetização segue de pé.
    // Pra voltar ao normal: secret MODO_TESTE_LIBERADO = "0".
    // v18: MODO_TESTE_LIBERADO desligado por padrão — teste vencido só gera
    // assinando (o funil do vídeo depende disso). Reabrir: secret = "1".
    // Limites vindos da tabela ai_limites (uma ida ao banco traz todos).
    let lim: Record<string, number> = {};
    try {
      const { data: L } = await admin.rpc("orbis_limites");
      lim = (L ?? {}) as Record<string, number>;
    } catch { /* banco fora: valem os padroes abaixo */ }
    const limNum = (chave: string, padrao: number) => {
      const v = Number(lim?.[chave]);
      return Number.isFinite(v) ? v : padrao;
    };
    const liberadoTeste = limNum("modo_teste_liberado", 0) === 1;
    // Qualidade da arte pelo banco: 1=low (US$0,005) 2=medium (US$0,041) 3=high (US$0,165).
    // Assim da' pra baixar de high pra medium no meio de um pico viral, num UPDATE,
    // sem publicar nada — 4x mais barato por arte se a conta apertar.
    const qualidadeImagem = ({ 1: "low", 2: "medium", 3: "high" } as Record<number, string>)[limNum("imagem_qualidade", 3)] ?? "high";
    // Modelo da arte, tambem pelo banco (25/08/2026). O "mini" custa ~4,6x menos
    // NA MESMA faixa de qualidade alta: US$ 0,054 contra US$ 0,20 por arte retrato.
    // 1 = gpt-image-1-mini (barato)  2 = gpt-image-1.5  3 = gpt-image-2 (caro)
    const modeloImagem = ({ 1: "gpt-image-1-mini", 2: "gpt-image-1.5", 3: "gpt-image-2" } as Record<number, string>)[limNum("imagem_modelo", 1)] ?? "gpt-image-1-mini";
    if (!pagante && !trial && !liberadoTeste) return json({ error: "assinatura_necessaria" }, 403);

    // Tetos abertos na fase de teste. Não é "sem limite": é alto demais pra alguém
    // encostar de propósito, e serve de freio se algo entrar em loop.
    // v18 (25/08/2026, véspera do vídeo): fim da fase aberta. Assinante faz 4
    // artes/dia sem marca d'água; teste grátis faz 2/dia com marca d'água.
    const limite = pagante
      ? limNum("estudio_limite_pagante", 4)
      : limNum("estudio_limite_trial", 2);
    // ===== TRAVAS DE GASTO (17/08/2026) — protegem o crédito das APIs =====
    // 1) Por CONTA, em dólar/dia: mal-intencionado ou bug em loop para aqui.
    // 2) GLOBAL, em dólar/dia: disjuntor — se o app inteiro estourar, imagem pausa.
    // 3) Por CONTA, no MÊS: o teto diário sozinho não segura quem volta todo dia.
    // Ajustes por secret: AI_TRAVA_USER_DIA_USD / AI_TRAVA_GLOBAL_DIA_USD / ESTUDIO_LIMITE_MES.
    try {
      const travaUser = limNum("trava_user_dia_usd", 0.40);
      const { data: gastoU } = await admin.rpc("orbis_gasto_usuario_hoje", { p_user: userId });
      if (Number(gastoU) >= travaUser) {
        console.error("trava de gasto POR CONTA acionada", userId, gastoU);
        return json({ error: "trava_gasto_conta" });
      }
      const travaGlobal = limNum("trava_global_dia_usd", 12);
      const { data: gastoG } = await admin.rpc("orbis_gasto_global_hoje");
      if (Number(gastoG) >= travaGlobal) {
        console.error("DISJUNTOR GLOBAL de gasto acionado", gastoG);
        return json({ error: "trava_gasto_global" });
      }
      const limiteMes = limNum("estudio_limite_mes", 60);
      const { data: usoMes } = await admin.rpc("orbis_uso_mes", { p_user: userId, p_feature: "estudio" });
      if (Number(usoMes) >= limiteMes) return json({ error: "limite_mensal", limite: limiteMes });
    } catch (e) { console.error("checagem de trava falhou (seguindo):", String(e).slice(0, 150)); }

    const { data: usage } = await supa.rpc("bump_ai_usage", { p_feature: "estudio", p_limit: limite });
    if ((usage as any)?.over) {
      return json({
        error: "limite_diario", limite, plano: pagante ? "pagante" : "trial",
        mensagem: pagante
          ? `Você já fez suas ${limite} artes de hoje — amanhã libera de novo.`
          : `No teste grátis são ${limite} artes por dia. Assinando o Orbis, sobe pra 4 por dia e a arte baixa limpa, sem marca d'água.`,
      });
    }

    const body = await req.json().catch(() => ({}));
    const modeloId = String(body?.modelo_id ?? "").trim();
    const marca = String(body?.marca ?? "").slice(0, 30).trim();
    const produto = String(body?.produto ?? "").slice(0, 140).trim();
    const cores = String(body?.cores ?? "").slice(0, 80).trim();
    const extras = String(body?.extras ?? "").slice(0, 200).trim();
    // Dados que o vendedor aprovou no papo do estúdio (04/10): frase, contato e os
    // 3 valores de caixinha que ficam do lado do Pix.
    const frase = String(body?.frase ?? "").slice(0, 80).trim();
    const contato = String(body?.contato ?? "").slice(0, 80).trim();
    const caixinha = String(body?.valores_caixinha ?? "").slice(0, 60).trim();
    const origem = String(body?.origem ?? "estudio") === "chat" ? "chat" : "estudio";
    // Briefing vindo do CHAT — estilo em texto e/ou referência ENVIADA pelo usuário.
    const estilo = String(body?.estilo ?? "").slice(0, 300).trim();
    let refUserB64 = typeof body?.ref_b64 === "string" ? body.ref_b64 : "";
    let refUserMime = String(body?.ref_mime ?? "image/jpeg").split(";")[0] || "image/jpeg";
    if (refUserB64.length > 3_000_000) return json({ error: "referencia_grande" });

    // AJUSTE: em vez de desenhar do zero, pega a arte que JÁ existe e muda só o que
    // o vendedor pediu. ref_url é a arte anterior (Storage); ajuste é o pedido dele.
    const ajuste = String(body?.ajuste ?? "").slice(0, 300).trim();
    const refUrl = String(body?.ref_url ?? "").trim();
    if (refUrl && !refUserB64 && /^https:\/\/[a-z0-9.-]+\.supabase\.co\/storage\//i.test(refUrl)) {
      try {
        const ir = await fetch(refUrl, { signal: AbortSignal.timeout(20000) });
        if (ir.ok) {
          refUserMime = ir.headers.get("content-type")?.split(";")[0] || "image/png";
          refUserB64 = bytesToB64(new Uint8Array(await ir.arrayBuffer()));
        }
      } catch { /* sem a arte anterior, cai pra geração normal */ }
    }
    const modoAjuste = !!ajuste && !!refUserB64;

    if (!marca || !produto || (!modeloId && !estilo && !refUserB64)) return json({ error: "dados_incompletos" });

    let modelo: { nome?: unknown; descricao?: unknown; imagem_url?: unknown; imagem_b64?: unknown } | null = null;
    if (modeloId) {
      const { data } = await admin.from("estudio_modelos")
        .select("nome, descricao, imagem_url, imagem_b64").eq("id", modeloId).eq("ativo", true).maybeSingle();
      if (!data) return json({ error: "modelo_nao_encontrado" });
      modelo = data;
    }

    // Referência visual: a foto do PRÓPRIO usuário tem prioridade; senão, a do modelo da biblioteca.
    let refB64 = refUserB64 || String(modelo?.imagem_b64 ?? "");
    let refMime = refUserB64 ? refUserMime : "image/jpeg";
    if (!refB64 && modelo?.imagem_url) {
      try {
        const ir = await fetch(String(modelo.imagem_url), { signal: AbortSignal.timeout(10000) });
        if (ir.ok) {
          refMime = ir.headers.get("content-type")?.split(";")[0] || "image/jpeg";
          refB64 = bytesToB64(new Uint8Array(await ir.arrayBuffer()));
        }
      } catch { /* segue sem referência visual */ }
    }

    // Registra a geração ANTES de desenhar: assim a gente vê até os briefings que
    // falharam (provedor fora do ar), que é justamente onde mora o aprendizado.
    let geracaoId = "";
    try {
      const { data: g } = await admin.from("estudio_geracoes").insert({
        user_id: userId,
        origem,
        plano: pagante ? "pagante" : "trial",
        marca, produto,
        estilo: (modoAjuste ? `AJUSTE: ${ajuste}` : (estilo || String(modelo?.nome ?? ""))).slice(0, 300),
        cores, extras,
        modelo_id: modeloId || null,
        com_referencia: !!refB64,
      }).select("id").maybeSingle();
      geracaoId = String((g as any)?.id ?? "");
    } catch { /* registro nunca pode derrubar a geração */ }

    const marcaDagua = !pagante;
    // ===== BURACO FECHADO (25/08/2026) =====
    // Estas duas escritas eram "dispara e esquece" (.then sem await). A funcao
    // devolvia a imagem e MORRIA antes do banco responder — entao o provedor ficava
    // null e, pior, o CUSTO DA ARTE NUNCA ERA REGISTRADO em ai_custos.
    // Como o disjuntor global soma ai_custos, ele estava cego justamente pro item
    // mais caro do app: uma arte custa US$ 0,165 (qualidade high) contra US$ 0,013
    // de uma mensagem de chat — 12x mais. Num video, o teto seria furado sem que
    // ninguem visse. Agora as duas escritas sao aguardadas antes de responder.
    const okResp = async (imagem: string, mime: string, provedor: string) => {
      if (geracaoId) {
        try { await admin.from("estudio_geracoes").update({ provedor }).eq("id", geracaoId); }
        catch { /* auditoria nunca derruba a entrega da arte */ }
      }
      // MEDIDOR DE GASTO: preço por imagem 1024x1536 no gpt-image (ago/2026):
      // low US$0,005 | medium US$0,041 | high US$0,165. Gemini/fallbacks: 0.
      try {
        // Precos conferidos em 25/08/2026, ja' ajustados pro retrato 1024x1536 (~1,5x
        // o preco do quadrado). Sem isto o medidor mentia: cobrava preco de modelo
        // caro mesmo rodando o mini, e o disjuntor cortava antes da hora.
        const tabelaPorModelo: Record<string, Record<string, number>> = {
          "gpt-image-1-mini": { low: 0.008, medium: 0.017, high: 0.054 },
          "gpt-image-1.5":    { low: 0.014, medium: 0.051, high: 0.200 },
          "gpt-image-2":      { low: 0.017, medium: 0.063, high: 0.250 },
        };
        const usadoAgora = provedor.replace("openai:", "");
        const tab = tabelaPorModelo[usadoAgora] ?? tabelaPorModelo["gpt-image-1.5"]!;
        // ATENCAO: aqui morava o mesmo buraco que fechamos hoje de manha, so' que
        // pro Gemini. A conta gemini custava ZERO no medidor — e no dia em que o
        // Gemini virasse o motor principal (faturamento ativado), o disjuntor
        // global ficaria cego de novo, exatamente como estava pras imagens.
        // Preco do Gemini: US$60 por milhao de tokens de imagem; uma arte retrato
        // gasta ~1.900 tokens => ~US$0,11. E' ESTIMATIVA: da' pra calibrar no banco
        // (chave imagem_preco_gemini_usd) depois de ver a fatura real do Google.
        const usd = provedor.startsWith("openai")
          ? (tab[qualidadeImagem] ?? 0.20)
          : limNum("imagem_preco_gemini_usd", 0.11);
        await admin.from("ai_custos").insert({
          user_id: userId, servico: "imagem", modelo: `${provedor}:${qualidadeImagem}`,
          qtd: 1, unidade: "imagem", custo_usd: usd,
        });
      } catch { /* medidor nunca atrapalha a entrega da arte */ }
      return json({ imagem, mime, provedor, geracao_id: geracaoId, marca_dagua: marcaDagua, plano: pagante ? "pagante" : "trial" });
    };

    const estiloDesc = modelo ? `${modelo.nome}: ${modelo.descricao}` : (estilo || "estilo livre, bonito e profissional");

    // Regras que valem nos DOIS modos. A de direito autoral é ESTREITA de propósito:
    // usar referência pra estilo, composição, paleta e até "ter um mascote" é
    // trabalho normal de design. O que não pode é sair com a identidade do OUTRO
    // (nome, telefone, Pix) ou com personagem licenciado/famoso.
    const REGRAS_COMUNS = `- Todo texto em português do Brasil, com ortografia PERFEITA. Pouco texto: o nome da marca, no máximo um slogan curto, o título "PAGUE COM PIX" ou "PAGUE COM CONFIANÇA" e, só se vierem listados abaixo, o contato e os valores de caixinha. Nada além disso.
- Deixe uma ÁREA QUADRADA TOTALMENTE BRANCA E VAZIA (sem nada dentro, sem moldura interna, sem QR desenhado) ocupando cerca de 25% da largura, na parte inferior direita — é onde o aplicativo encaixa o QR Pix verdadeiro depois.
- NÃO desenhe QR code nem código de barras.
- Direito autoral (regra estreita, só isto): não escreva o nome de marca, telefone, @ ou chave Pix de outra pessoa que apareça na referência, e não reproduza personagem famoso ou licenciado. Estilo, composição, paleta, clima e até "ter um mascote" são livres — o mascote só precisa ser um desenho NOVO, não a cópia do personagem de alguém.
- Qualidade de gráfica profissional: apetitoso, caprichado, pronto pra imprimir.`;

    const prompt = modoAjuste
      // MODO AJUSTE: a imagem anexa é a arte ATUAL do vendedor. Mexer só no pedido.
      ? `Você é um designer profissional. A imagem anexa é uma arte que VOCÊ já fez para este vendedor e que ele aprovou.

Sua tarefa é UMA SÓ: aplicar exatamente esta mudança pedida por ele:
"${ajuste}"

O QUE NÃO PODE MUDAR (isto é o mais importante da tarefa):
Mantenha TODO o resto absolutamente idêntico — mesma composição, mesmo enquadramento, mesmas cores, mesma tipografia e mesmo desenho das letras, mesmo personagem com o mesmo traço e a mesma pose, mesmos elementos decorativos, mesma área branca reservada no mesmo lugar e do mesmo tamanho. Não redesenhe a arte, não "melhore" nada que não foi pedido, não mude o estilo. Alguém que olhe as duas lado a lado tem que dizer "é a mesma arte, só mudou ${ajuste}".

Contexto (mantenha igual, salvo se a mudança pedida for justamente esta):
- Marca: "${marca}"
- Produto: ${produto}

${REGRAS_COMUNS}`
      // MODO NORMAL: arte nova, do zero.
      : `Você é um designer profissional de adesivos e rótulos para vendedores ambulantes brasileiros.
${refB64 ? "A imagem anexa é a REFERÊNCIA que o vendedor escolheu: siga o estilo, a composição, a paleta e o clima dela de perto — é isso que ele quer" : "Estilo de referência"} (${estiloDesc}).
Crie um adesivo NOVO nesse mesmo espírito, em orientação vertical (proporção 3:4), para:
- Marca: "${marca}" (escreva EXATAMENTE assim, com destaque)
- Produto: ${produto}
${cores ? `- Cores da marca: ${cores}` : ""}
${extras ? `- Detalhes pedidos pelo vendedor: ${extras}` : ""}
${frase ? `- Slogan (escreva EXATAMENTE assim): "${frase}"` : ""}
${contato ? `- Contato, pequeno e bem legível (escreva EXATAMENTE assim): ${contato}` : ""}
${caixinha ? `- Bem ao lado da área branca do Pix, uma faixa curta "CAIXINHA" com 3 selos arredondados de valor, escritos EXATAMENTE assim: ${caixinha}` : ""}

REGRAS OBRIGATÓRIAS:
${REGRAS_COMUNS}`;

    // ===== ORDEM DOS PROVEDORES, ESCOLHIDA NO BANCO (25/08/2026) =====
    // Antes o Gemini vinha SEMPRE primeiro e a OpenAI era so' reserva. Isso brigava
    // com a estrategia: o Rick quer a qualidade do gpt-image enquanto houver credito,
    // e o Gemini como rede pra arte NUNCA parar quando a OpenAI secar.
    // Chave imagem_provedor: 1 = OpenAI primeiro (padrao)  2 = Gemini primeiro
    //                        3 = so' OpenAI               4 = so' Gemini
    const ordemProvedor = limNum("imagem_provedor", 1);

    const tentarGemini = async (): Promise<Response | null> => {
    const gkey = Deno.env.get("GEMINI_API_KEY");
    if (gkey) {
      try {
        const model = Deno.env.get("GEMINI_IMAGE_MODEL") ?? "gemini-3.1-flash-image";
        const parts: unknown[] = [{ text: prompt }];
        if (refB64) parts.push({ inlineData: { mimeType: refMime, data: refB64 } });
        const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${gkey}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: AbortSignal.timeout(60000),
          body: JSON.stringify({ contents: [{ role: "user", parts }], generationConfig: { responseModalities: ["TEXT", "IMAGE"] } }),
        });
        if (r.ok) {
          const j = await r.json();
          const part = j?.candidates?.[0]?.content?.parts?.find((p: any) => p?.inlineData?.data);
          if (part?.inlineData?.data) return await okResp(part.inlineData.data, part.inlineData.mimeType || "image/png", "gemini");
          console.error("gemini sem imagem", JSON.stringify(j?.candidates?.[0]?.finishReason ?? "").slice(0, 120));
        } else {
          console.error("gemini imagem erro", r.status, (await r.text().catch(() => "")).slice(0, 200));
        }
      } catch (e) { console.error("gemini imagem excecao", String(e).slice(0, 150)); }
    }

      return null;
    };

    const tentarOpenAI = async (): Promise<Response | null> => {
    const okey = Deno.env.get("OPENAI_API_KEY");
    if (okey) {
      // "high" desde 15/08/2026: o Rick achou as artes em medium "meio ruins" — e
      // a arte é O produto do Estúdio, não vale economizar nela. Custo por arte
      // 1024x1536: medium ~US$0,04 | high ~US$0,17 (~R$0,90). Pra voltar ao
      // barato, é só criar o secret OPENAI_IMAGE_QUALITY = "medium".
      const oQuality = qualidadeImagem;
      // Tenta o modelo atual primeiro; se a conta/endpoint não aceitar, cai pro legado.
      const oModels = [...new Set([modeloImagem, "gpt-image-1.5", "gpt-image-1"])];
      for (const om of oModels) {
        try {
          // Com referência: images/edits (multipart). Sem: images/generations.
          let r: Response;
          if (refB64) {
            const fd = new FormData();
            fd.append("model", om);
            fd.append("prompt", prompt.slice(0, 30000));
            fd.append("size", "1024x1536");
            fd.append("quality", oQuality);
            fd.append("image[]", new Blob([b64ToBytes(refB64)], { type: refMime }), "referencia.jpg");
            r = await fetch("https://api.openai.com/v1/images/edits", {
              method: "POST",
              headers: { Authorization: `Bearer ${okey}` },
              // 220s: em qualidade high a OpenAI passa de 90s — com o prazo antigo a\n              // arte era abortada no meio (TimeoutError em 14/08/2026).\n              signal: AbortSignal.timeout(220000),
              body: fd,
            });
          } else {
            r = await fetch("https://api.openai.com/v1/images/generations", {
              method: "POST",
              headers: { Authorization: `Bearer ${okey}`, "Content-Type": "application/json" },
              signal: AbortSignal.timeout(220000),
              body: JSON.stringify({ model: om, prompt: prompt.slice(0, 30000), size: "1024x1536", quality: oQuality }),
            });
          }
          if (r.ok) {
            const j = await r.json();
            const b64 = j?.data?.[0]?.b64_json;
            if (b64) return await okResp(b64, "image/png", `openai:${om}`);
            console.error("openai sem imagem", om);
            break;
          } else {
            console.error("openai imagem erro", om, r.status, (await r.text().catch(() => "")).slice(0, 300));
            // 400/404 = provavelmente modelo não aceito → tenta o próximo; outros erros: para.
            if (r.status !== 400 && r.status !== 404) break;
          }
        } catch (e) { console.error("openai imagem excecao", om, String(e).slice(0, 150)); break; }
      }
    }

      return null;
    };

    // Roda na ordem escolhida. Se o primeiro nao entregar, o segundo cobre sozinho —
    // e' isso que faz a arte continuar saindo no minuto em que um saldo acabar.
    const fila: Array<() => Promise<Response | null>> =
      ordemProvedor === 4 ? [tentarGemini]
      : ordemProvedor === 3 ? [tentarOpenAI]
      : ordemProvedor === 2 ? [tentarGemini, tentarOpenAI]
      : [tentarOpenAI, tentarGemini];
    for (const tentar of fila) {
      const resp = await tentar();
      if (resp) return resp;
    }

    // Nenhum provedor disponível/funcionando
    if (geracaoId) { try { await admin.from("estudio_geracoes").update({ provedor: "falhou" }).eq("id", geracaoId); } catch { /* noop */ } }
    const temChave = !!(Deno.env.get("GEMINI_API_KEY") || Deno.env.get("OPENAI_API_KEY"));
    return json({ error: temChave ? "geracao_falhou" : "sem_chave", detalhe: "provedor_de_imagem_indisponivel" });
  } catch (e) {
    console.error("estudio-arte erro", e);
    return json({ error: "erro_interno" }, 500);
  }
});
