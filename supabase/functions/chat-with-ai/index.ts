import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") ?? "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ===================== ORBIS — CÉREBRO DE RUA (v1) =====================
// Fonte da verdade canônica em supabase/functions/_shared/orbis-brain.ts.
// Embutido aqui porque o deploy pelo painel é por função.
const ORBIS_BRAIN = `
Você é a ORBIS IA — o mentor de rua do vendedor ambulante brasileiro dentro do app Orbis.
Você NÃO é um chatbot genérico. Você é o parça experiente que já vendeu muito na rua, levou
não na cara, apanhou de dia ruim e aprendeu na prática. Fala a língua do vendedor, sem
floreio corporativo, sem teoria de livro. Conselho que funciona na calçada, hoje, agora.

# COMO VOCÊ FALA
- Português do Brasil, tom de quem tá do lado do cara, na correria junto.
- Direto e curto. Resposta de rua é objetiva. Sem rodeio, sem "depende".
- Pode usar gíria leve e natural (parça, bora, fechou, tá ligado), sem forçar.
- ZERO emoji. O visual do app é premium; o texto também é. Nunca use emoji.
- Sempre termine com UMA ação concreta pro cara fazer agora. Nada de conselho solto.
- Quando tiver os números dele (meta, vendido, conversão, ticket), USE. Personalize.
- Nunca invente número que você não recebeu. Se faltar dado, pergunta rápido ou assume e avisa.
- Honestidade acima de bajulação. Se ele tá indo mal, fala com firmeza e respeito — e mostra a saída.
- Mensagem geralmente curta (2 a 6 linhas). Só alonga se ele pedir um plano detalhado.

# O QUE VOCÊ DOMINA (conhecimento de rua)

## 1. ABORDAGEM (os primeiros 5 segundos)
- Vender começa antes da palavra: postura ereta, olho no olho, sorriso curto, energia calma.
- Quem aborda com medo passa medo. Aproxime como quem oferece algo bom, não como quem implora.
- Quebre o gelo com algo do contexto, não com "quer comprar?". Ex: comentário rápido, elogio honesto, pergunta simples.
- Fale do BENEFÍCIO pra vida dele, não da ficha técnica do produto.
- Volume importa: mais abordagem = mais venda. Conversão fraca quase sempre é falta de volume + abordagem morna.

## 2. OBJEÇÕES (o cliente sempre dá uma — você já tem a resposta)
- "Tá caro": nunca brigue com o preço. Divida pelo tempo de uso ("dá menos de R$1 por dia") ou ancore num valor maior antes. Mostre custo de NÃO ter.
- "Vou pensar": quase sempre é "não entendi o valor" ou "tô inseguro". Pergunte o que travou. Resolva a dúvida real, não empurre.
- "Não tenho dinheiro agora": ofereça a menor unidade, combo de entrada, ou compromisso pra depois (sem fiado solto). Mantenha a porta aberta.
- "Depois eu volto": dá urgência real — última unidade, preço de hoje, você não vai estar aqui amanhã. Sem mentir.
- Regra de ouro: objeção é pedido de mais informação, não um não. Trate como conversa, não como derrota.

## 3. FECHAMENTO
- Pare de vender quando o cara já quer comprar. Falar demais reabre objeção.
- Use escolha em vez de sim/não: "vai um ou dois?", "leva a azul ou a preta?".
- Escassez e urgência verdadeiras fecham: estoque, tempo, preço do dia.
- Peça a venda com clareza. Muitos vendedores explicam tudo e nunca CHAMAM pro fechamento.

## 4. PRECIFICAÇÃO E MARGEM
- Não venda barato pra "girar". Vender muito com margem ruim é trabalhar de graça e cansar à toa.
- Conheça seu custo real (produto + tempo + deslocamento). Preço tem que pagar tudo isso e sobrar.
- Combo e upsell sobem o ticket sem mais abordagem: "leva 3 e sai mais barato a unidade".
- Ancoragem: mostre o item mais caro primeiro; o resto parece justo.

## 5. CONSTÂNCIA E DISCIPLINA (onde a maioria perde)
- O jogo da rua é ganho na repetição, não no dia de sorte. Quem aparece todo dia vence quem é gênio de vez em quando.
- Ritual de início: hora certa pra sair, meta clara antes de começar, primeira abordagem rápida pra esquentar.
- Dia ruim faz parte. Não é sinal pra parar — é sinal pra ajustar ponto, horário ou abordagem.
- Streak é sagrado: não quebrar a sequência vale mais que o tamanho da venda do dia.

## 6. METAS E NÚMEROS (a lógica do DEFCON)
- Meta grande assusta e paralisa. Quebre em blocos de tempo (a lógica do DEFCON 4): cada bloco tem uma meta pequena e atingível.
- Saber o ticket médio transforma meta em ação: "faltam R$X" vira "são N vendas". Sempre converta dinheiro em número de vendas.
- Conversão = vendas / abordagens. Se tá baixa, o problema é abordagem ou oferta — não o cliente.
- Foque no próximo bloco, não no dia inteiro. Um bloco de cada vez.

## 7. ESCOLHA DE PONTO
- Ponto bom é fluxo de gente certa na hora certa. Movimento sem público comprador não adianta.
- Horário de pico do SEU produto manda. Mapeie onde e quando vende mais e repita.
- Não case com um ponto ruim por costume. Teste, mede pelo resultado, troca sem dó.

## 8. CALOTE E FIADO
- Fiado sem critério é dinheiro que vira prejuízo. A regra padrão é: não fiou.
- Se for fiar, só pra cliente conhecido, valor pequeno, com data combinada na hora.
- Calote registrado é aprendizado: o Orbis registra pra você ver o padrão e cortar o vazamento.

## 9. MINDSET
- O "não" é pedágio, não parede. Cada não aproxima do próximo sim. Conte os nãos com orgulho.
- Não se compare com o dia bom dos outros. Compare com o seu ontem.
- Visão longa: cada dia na rua é tijolo. Você não tá só vendendo hoje, tá construindo uma vida.
- Quando travar: respira, abordagem simples e rápida pra destravar, e segue. Ação mata ansiedade.

# REGRAS DE SEGURANÇA
- Não dê conselho jurídico, médico ou de investimento arriscado. Foco é venda, rotina e disciplina.
- Não prometa ganho garantido. Resultado vem de trabalho e constância, e você fala isso de boa.
- Não humilhe. Firmeza sim, desrespeito nunca. O cara tá lutando — você tá do lado dele.
`.trim();
// =======================================================================

const HAIKU = "claude-haiku-4-5-20251001";
const SONNET = "claude-sonnet-4-6";
// Limites diários e modelo por plano (controle de custo). Fácil de ajustar aqui.
const PLAN_LIMITS: Record<string, { key: string; limit: number; model: string }> = {
  trial:     { key: "trial",     limit: 5,  model: HAIKU },
  active:    { key: "essencial", limit: 12, model: HAIKU },  // plano atual R$19,90
  essencial: { key: "essencial", limit: 12, model: HAIKU },  // R$19,90
  pro:       { key: "pro",       limit: 30, model: HAIKU },  // R$49,90
  premium:   { key: "premium",   limit: 25, model: SONNET }, // R$79,90
};
function resolvePlan(prof: any) {
  if (prof?.is_demo || prof?.billing_exempt) return { key: "demo", limit: 100, model: SONNET };
  const t = String(prof?.plan_type || prof?.plan_status || "trial").toLowerCase();
  return PLAN_LIMITS[t] || PLAN_LIMITS["trial"];
}
// Guardrail de escopo (fixo, nao editavel pelo admin): a IA so fala do corre.
const SCOPE_RULE = [
  "# ESCOPO (regra fixa, acima de tudo)",
  "Voce so responde sobre o corre do vendedor: venda, abordagem, cliente, objecao, preco, meta, dinheiro, produtividade, rotina de trabalho, disciplina, mentalidade PARA O TRABALHO e crescimento do negocio.",
  "Se a pergunta fugir disso (relacionamento, \"terminou comigo\", terapia, fofoca, politica, dever de casa, assunto pessoal sem ligacao com o trabalho), NAO responda o merito e NAO atue como psicologo. Responda em UMA linha curta puxando de volta pro corre, tipo: \"To aqui pro teu corre de vendedor - manda algo sobre venda, meta ou grana que eu te ajudo de verdade.\"",
  "Nunca elabore em tema fora do escopo. Gentil, mas firme e curto.",
].join("\n");

// ---- Helpers de audio: Gemini TTS devolve PCM16; embrulhamos em WAV pro navegador tocar ----
function pcmToWav(pcm: Uint8Array, sampleRate: number): Uint8Array {
  const numChannels = 1, bitsPerSample = 16;
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const dataSize = pcm.length;
  const buf = new ArrayBuffer(44 + dataSize);
  const v = new DataView(buf);
  const ws = (o: number, str: string) => { for (let i = 0; i < str.length; i++) v.setUint8(o + i, str.charCodeAt(i)); };
  ws(0, "RIFF"); v.setUint32(4, 36 + dataSize, true); ws(8, "WAVE"); ws(12, "fmt ");
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, numChannels, true);
  v.setUint32(24, sampleRate, true); v.setUint32(28, byteRate, true);
  v.setUint16(32, blockAlign, true); v.setUint16(34, bitsPerSample, true);
  ws(36, "data"); v.setUint32(40, dataSize, true);
  new Uint8Array(buf, 44).set(pcm);
  return new Uint8Array(buf);
}
function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function bytesToB64(bytes: Uint8Array): string {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(bin);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      throw new Error("Missing authorization header");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      throw new Error("Unauthorized");
    }

    // ---- Plano + limite diario da IA (controle de custo) ----
    const today = new Date(Date.now() - 3 * 3600 * 1000).toISOString().split("T")[0];
    const svcKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const svc = svcKey ? createClient(supabaseUrl, svcKey) : null;
    let plan = PLAN_LIMITS["trial"];
    let usedToday = 0;
    if (svc) {
      const { data: prof } = await svc
        .from("profiles")
        .select("plan_type, plan_status, is_demo, billing_exempt")
        .eq("user_id", user.id)
        .maybeSingle();
      plan = resolvePlan(prof);
      const { data: usage } = await svc
        .from("ai_usage")
        .select("count")
        .eq("user_id", user.id)
        .eq("date", today)
        .maybeSingle();
      usedToday = usage?.count ?? 0;
      if (usedToday >= plan.limit) {
        return new Response(
          JSON.stringify({
            success: true,
            limitReached: true,
            message: "Voce bateu seu limite de mensagens com a IA por hoje. Volta amanha, ou sobe de plano pra falar mais com o mentor. E bora pra rua - venda tambem e treino.",
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    const { messages, context, tts } = await req.json();

    // ===== TTS: gera o audio da fala (Gemini TTS, gratis, mesma chave) =====
    if (tts && typeof tts === "string" && tts.trim()) {
      const key = Deno.env.get("GEMINI_API_KEY");
      if (!key) {
        return new Response(JSON.stringify({ error: "sem GEMINI_API_KEY" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const ttsModel = Deno.env.get("GEMINI_TTS_MODEL") ?? "gemini-2.5-flash-preview-tts";
      const voiceName = Deno.env.get("GEMINI_TTS_VOICE") ?? "Kore";
      // Direção de tom (deixa a voz mais humana). Editável pelo secret GEMINI_TTS_STYLE.
      const style = Deno.env.get("GEMINI_TTS_STYLE") ??
        "Leia o texto a seguir com voz natural, calorosa e conversacional, no jeito de um mentor de rua brasileiro falando de perto com um parceiro — sem pressa, com energia boa, entonação viva e pausas naturais. Não leia esta instrução, apenas aplique o tom:";
      const sayText = `${style}\n\n${tts.slice(0, 1500)}`;
      const tRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${ttsModel}:generateContent?key=${key}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: sayText }] }],
            generationConfig: {
              responseModalities: ["AUDIO"],
              speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName } } },
            },
          }),
        },
      );
      if (!tRes.ok) {
        const errТxt = await tRes.text();
        console.error("Gemini TTS erro:", tRes.status, errТxt.slice(0, 300));
        return new Response(JSON.stringify({ error: `tts ${tRes.status}` }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const tJson = await tRes.json();
      const inline = tJson?.candidates?.[0]?.content?.parts?.find((pp: any) => pp.inlineData)?.inlineData;
      if (!inline?.data) {
        return new Response(JSON.stringify({ error: "tts vazio" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const mime: string = inline.mimeType || "audio/L16;rate=24000";
      const rate = parseInt((mime.match(/rate=(\d+)/) || [])[1] || "24000");
      const wav = pcmToWav(b64ToBytes(inline.data), rate);
      return new Response(JSON.stringify({ audio: bytesToB64(wav), mime: "audio/wav" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (!messages || !Array.isArray(messages)) {
      throw new Error("Invalid messages format");
    }
    if (messages.length === 0 || messages.length > 50) {
      throw new Error("Messages array must contain between 1 and 50 messages");
    }

    const sanitizedMessages = messages.map((msg: any) => {
      if (!msg || typeof msg !== "object") throw new Error("Invalid message format");
      if (!msg.role || !["user", "assistant", "system"].includes(msg.role)) {
        throw new Error("Invalid message role");
      }
      if (!msg.content || typeof msg.content !== "string") {
        throw new Error("Invalid message content");
      }
      const content = msg.content.trim();
      if (content.length === 0) throw new Error("Message content cannot be empty");
      return { role: msg.role, content: content.length > 4000 ? content.substring(0, 4000) : content };
    });

    // ---------------- Contexto do usuário (servidor) ----------------
    const firstDayOfMonth = new Date();
    firstDayOfMonth.setDate(1);
    const monthStart = firstDayOfMonth.toISOString().split("T")[0];

    const { data: salesData } = await supabase
      .from("daily_sales")
      .select("*")
      .eq("user_id", user.id)
      .gte("date", monthStart)
      .order("date", { ascending: false });

    const { data: routineData } = await supabase
      .from("routines")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let userContext = "";
    if (salesData && salesData.length > 0) {
      const totalIncome = salesData.reduce((s: number, d: any) => s + (d.total_profit || 0), 0);
      const totalExpenses = salesData.reduce((s: number, d: any) => s + (d.total_debt || 0), 0);
      const balance = totalIncome - totalExpenses;
      userContext += `- Vendas no mês: R$ ${totalIncome.toFixed(2)}
- Calotes no mês: R$ ${totalExpenses.toFixed(2)}
- Saldo líquido: R$ ${balance.toFixed(2)}
- Dias trabalhados no mês: ${salesData.length}`;
    }
    if (routineData) {
      userContext += `\n- Rotina: acorda ${routineData.wake_time ?? "?"}, trabalha ${routineData.work_start ?? "?"}–${routineData.work_end ?? "?"}, meta diária R$ ${routineData.daily_profit || 0}`;
    }

    // Contexto AO VIVO opcional, enviado pelo front (ex.: tela atual / DEFCON em andamento)
    if (context && typeof context === "object") {
      const c = context as Record<string, unknown>;
      const parts: string[] = [];
      if (c.screen) parts.push(`- Tela atual: ${c.screen}`);
      if (c.defconBlock) parts.push(`- DEFCON bloco: ${c.defconBlock}`);
      if (c.vendido != null) parts.push(`- Já vendido no bloco/dia: R$ ${c.vendido}`);
      if (c.metaRestante != null) parts.push(`- Falta pra meta: R$ ${c.metaRestante}`);
      if (c.abordagens != null) parts.push(`- Abordagens: ${c.abordagens}`);
      if (c.conversao != null) parts.push(`- Conversão: ${c.conversao}%`);
      if (c.ticketMedio != null) parts.push(`- Ticket médio: R$ ${c.ticketMedio}`);
      if (c.tempoRestante) parts.push(`- Tempo restante no bloco: ${c.tempoRestante}`);
      if (parts.length) userContext += (userContext ? "\n" : "") + parts.join("\n");
    }

    // Cérebro editável: busca seções do banco (service role). Fallback = ORBIS_BRAIN embutido.
    let brain = ORBIS_BRAIN;
    try {
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      if (serviceKey) {
        const admin = createClient(supabaseUrl, serviceKey);
        const { data: sections } = await admin
          .from("ai_brain")
          .select("content, sort_order, enabled")
          .eq("enabled", true)
          .order("sort_order", { ascending: true });
        const joined = (sections || [])
          .map((s: any) => (s.content || "").trim())
          .filter(Boolean)
          .join("\n\n");
        if (joined.length > 0) brain = joined;
      }
    } catch (e) {
      console.error("ai_brain fetch failed, using embedded brain:", e);
    }

    const systemPrompt = brain + "\n\n" + SCOPE_RULE + (
      userContext.trim().length > 0
        ? `\n\n# CONTEXTO AO VIVO DESTE VENDEDOR\nUse pra personalizar. Converta dinheiro em número de vendas sempre que der.\n${userContext.trim()}`
        : `\n\n# CONTEXTO\nSem dados recentes agora. Dê conselho prático de rua e puxe ele pra ação.`
    );

    // ---------------- Provedor de IA: Gemini (grátis) OU Claude (pago) ----------------
    // Se GEMINI_API_KEY estiver setada, usa o Google Gemini (camada gratuita).
    // Senão, usa o Claude via ANTHROPIC_API_KEY. Você troca só pela chave.
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    const noSystem = sanitizedMessages.filter((m: { role: string }) => m.role !== "system");
    let assistantMessage = "";

    if (GEMINI_API_KEY) {
      // Google Gemini — grátis. Roles do Gemini: "user" e "model".
      const geminiModel = Deno.env.get("GEMINI_MODEL") ?? "gemini-flash-latest";
      const contents = noSystem.map((m: { role: string; content: string }) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      }));
      const gRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: systemPrompt }] },
            contents,
            generationConfig: { maxOutputTokens: 1024, temperature: 0.85 },
          }),
        },
      );
      if (!gRes.ok) {
        const errTxt = await gRes.text();
        console.error("Erro na Gemini API:", gRes.status, errTxt);
        if (gRes.status === 429) {
          throw new Error("Limite gratuito da IA atingido por agora. Tenta de novo em alguns minutos.");
        }
        throw new Error(`Erro ao gerar resposta da IA (${gRes.status})`);
      }
      const gJson = await gRes.json();
      assistantMessage = gJson?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
      if (!assistantMessage) {
        console.error("Resposta inesperada da Gemini API:", JSON.stringify(gJson).substring(0, 300));
        throw new Error("A IA retornou uma resposta inválida");
      }
    } else if (ANTHROPIC_API_KEY) {
      const model = Deno.env.get("ORBIS_CHAT_MODEL") ?? plan.model;
      const aiResponse = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model,
          max_tokens: 1024,
          system: [{ type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } }],
          messages: noSystem,
        }),
      });
      if (!aiResponse.ok) {
        const errorText = await aiResponse.text();
        console.error("Erro na Anthropic API:", aiResponse.status, errorText);
        if (aiResponse.status === 429) {
          throw new Error("Limite de uso da IA excedido. Tente novamente em alguns minutos.");
        }
        throw new Error(`Erro ao gerar resposta da IA (${aiResponse.status})`);
      }
      const aiJson = await aiResponse.json();
      assistantMessage = aiJson?.content?.[0]?.text ?? "";
      if (!assistantMessage || typeof assistantMessage !== "string") {
        console.error("Resposta inesperada da Anthropic API:", JSON.stringify(aiJson).substring(0, 200));
        throw new Error("A IA retornou uma resposta inválida");
      }
    } else {
      throw new Error("Nenhuma chave de IA configurada. Adicione GEMINI_API_KEY (grátis) ou ANTHROPIC_API_KEY no painel do Supabase.");
    }

    if (svc) {
      await svc.from("ai_usage").upsert(
        { user_id: user.id, date: today, count: usedToday + 1, updated_at: new Date().toISOString() },
        { onConflict: "user_id,date" },
      );
    }

    return new Response(
      JSON.stringify({ message: assistantMessage, success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Error in chat-with-ai");
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    return new Response(
      JSON.stringify({ error: errorMessage, success: false }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
