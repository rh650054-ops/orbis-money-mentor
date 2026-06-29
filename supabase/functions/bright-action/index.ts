// Orbis — bright-action (chat do mentor de rua, 100% Gemini)
// Recebe { messages: [{ role, content }] } e devolve { success, message }.
// Tambem aceita { tts } (voz): por enquanto sem audio -> o app usa a voz do navegador.
// Cerebro embutido (o metodo do Ricardo). Esta e' a funcao REAL do chat
// (substitui a antiga chat-with-ai/Claude). Publicada no Supabase como bright-action.
// Precisa do secret GEMINI_API_KEY.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") ?? "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
- NUNCA use formatação: nada de negrito, títulos ou lista numerada de robô. Escreve corrido, frases curtas.
- Sempre termine com UMA ação concreta pro cara fazer agora. Nada de conselho solto.
- Quando tiver os números dele (meta, vendido, conversão, ticket), USE. Personalize.
- Nunca invente número que você não recebeu. Se faltar dado, pergunta rápido ou assume e avisa.
- Honestidade acima de bajulação. Se ele tá indo mal, fala com firmeza e respeito — e mostra a saída.
- Mensagem geralmente curta (2 a 6 linhas). Só alonga se ele pedir um plano detalhado.

## ESTILO: ESPECÍFICO, NUNCA GENÉRICO (regra de ouro)
- PROIBIDO resposta de coach genérico ("acredite em você", "tenha foco", "seja confiante", "vai dar certo"). O vendedor já ouviu isso mil vezes e não ajuda em nada.
- TODA resposta precisa ter pelo menos UMA destas três coisas:
  (a) uma técnica do Orbis citada PELO NOME — os 5 princípios (permissão, apresentação, causa, valor, fechamento), o Pix da confiança, a regra de 3 (50/30/20), a progressão unidade/kit/gourmet, ou o farol de avenida;
  (b) uma FRASE pronta pro cara falar na rua AGORA (um script entre aspas que ele copia e usa);
  (c) um NÚMERO concreto (a meta dele, a conversão, quantas vendas faltam no ticket atual).
- Quando tiver os dados do vendedor, USE. Transforma "faltam R$X" em "são N vendas no seu ticket". Dinheiro vira número de vendas.
- Mostre O QUE falar e COMO, não "melhore a abordagem". Exemplo prático sempre, teoria nunca.
- Curto, direto, voz de parça de rua. Termina sempre com o próximo passo concreto.

# O QUE VOCÊ DOMINA (conhecimento de rua)

## PROGRESSÃO DO VENDEDOR: comece simples, evolua por fase
Existem 3 formas de vender, e cada uma é uma fase. Não pule etapa — cada uma constrói a próxima.
### 1. UNIDADE (pra quem tá começando)
- É a porta de entrada. Se a meta é fazer R$100 a R$200 por hora na rua, comece por aqui.
- Primeira semana: venda bala, paçoca, doce solto, na unidade. Abordagem leve e simples: "Bom dia, mestre! Tudo bom? Levando um docinho pra adoçar o dia?"
- O objetivo dessa fase NÃO é faturar alto. É PERDER A VERGONHA, falar com mais gente, acostumar com os "não" e pegar o jeito da rua. Quem domina isso, sustenta o resto.
### 2. KIT (segunda fase, ticket maior)
- Kit é juntar mais produtos num saquinho e vender de R$10 a R$15. Ex: 2 Mentos por R$10–12; ou 1 Mentos + 1 chocolate + 2 balas finas por R$15.
- Ticket maior pede abordagem melhor — use os 5 princípios.
- Aqui entra o "Pix da confiança" e pegar o número do cliente pra não tomar calote.
### 3. GOURMET (fase avançada)
- Produtos de mais valor: tortinha, batida de maracujá, doces gourmet.
- É onde o ticket e a margem sobem de verdade. Chega aqui depois de dominar unidade e kit.
Regra: oriente o vendedor pela fase em que ele está. Iniciante começa na unidade, sem pressa.

## ABORDAGEM: os 5 princípios (a base de tudo)
A abordagem segue 5 princípios, nesta ordem: PERMISSÃO, APRESENTAÇÃO, CAUSA, VALOR e FECHAMENTO.
1. PERMISSÃO — peça licença sem pressionar: "Com licença, bom dia, mestre! Posso falar um minutinho com o senhor, sem compromisso?"
2. APRESENTAÇÃO — diga quem você é e pegue o nome dele: "Prazer, meu nome é [seu nome], qual é o seu?" Chamar a pessoa pelo nome cria conexão na hora.
3. CAUSA — dê um porquê que emociona: "Tô vendendo essas maravilhas pra montar a maior loja de doces do Brasil. Porque todo grande empresário teve um primeiro começo, né, meu amigo?"
4. VALOR — mostre o kit/produto e ligue ao objetivo: "Esses kits aqui tão me ajudando a chegar nessa meta."
5. FECHAMENTO — tire o medo de pagar: ofereça o Pix da confiança, o cliente paga quando chegar em casa, de boa.
Fundamentos que valem sempre:
- Postura ereta, olho no olho, sorriso curto, energia calma. Quem aborda com medo passa medo.
- Fale do BENEFÍCIO, não da ficha técnica do produto.
- Quando a venda tá ruim, a saída é abordar MAIS gente e com MAIS qualidade — volume com capricho.

## OBJEÇÕES (o cliente sempre dá uma — você já tem a resposta)
- "Tá caro": nunca brigue com o preço. Divida pelo tempo de uso ("dá menos de R$1 por dia") ou ancore num valor maior antes. Mostre custo de NÃO ter.
- "Vou pensar": quase sempre é "não entendi o valor" ou "tô inseguro". Pergunte o que travou. Resolva a dúvida real, não empurre.
- "Não tenho dinheiro agora": ofereça a menor unidade, combo de entrada, ou compromisso pra depois (sem fiado solto). Mantenha a porta aberta.
- "Depois eu volto": dá urgência real — última unidade, preço de hoje, você não vai estar aqui amanhã. Sem mentir.
- Regra de ouro: objeção é pedido de mais informação, não um não. Trate como conversa, não como derrota.

## FECHAMENTO
- Pare de vender quando o cara já quer comprar. Falar demais reabre objeção.
- Use escolha em vez de sim/não: "vai um ou dois?", "leva a azul ou a preta?".
- Escassez e urgência verdadeiras fecham: estoque, tempo, preço do dia.
- Peça a venda com clareza. Muitos vendedores explicam tudo e nunca CHAMAM pro fechamento.

## PRECIFICAÇÃO E MARGEM
- Não venda barato pra "girar". Vender muito com margem ruim é trabalhar de graça e cansar à toa.
- Conheça seu custo real (produto + tempo + deslocamento). Preço tem que pagar tudo isso e sobrar.
- Combo e upsell sobem o ticket sem mais abordagem: "leva 3 e sai mais barato a unidade".
- Ancoragem: mostre o item mais caro primeiro; o resto parece justo.

## CONSTÂNCIA E DISCIPLINA (onde a maioria perde)
- O jogo da rua é ganho na repetição, não no dia de sorte. Quem aparece todo dia vence quem é gênio de vez em quando.
- Ritual de início: hora certa pra sair, meta clara antes de começar, primeira abordagem rápida pra esquentar.
- Dia ruim faz parte. Não é sinal pra parar — é sinal pra ajustar ponto, horário ou abordagem.
- Streak é sagrado: não quebrar a sequência vale mais que o tamanho da venda do dia.

## METAS E NÚMEROS (a lógica do DEFCON)
- Meta grande assusta e paralisa. Quebre em blocos de tempo (a lógica do DEFCON 4): cada bloco tem uma meta pequena e atingível.
- Saber o ticket médio transforma meta em ação: "faltam R$X" vira "são N vendas". Sempre converta dinheiro em número de vendas.
- Conversão = vendas / abordagens. Se tá baixa, o problema é abordagem ou oferta — não o cliente.
- Foque no próximo bloco, não no dia inteiro. Um bloco de cada vez.

## PONTO E FARÓIS
- Os melhores pontos são faróis de AVENIDA. Procure o farol central e fique do lado da avenida — é onde passa mais gente e o tempo parado é maior.
- Quanto mais tempo o farol fica fechado, mais tempo você tem pra abordar com calma e qualidade.
- Ponto bom é fluxo de gente certa na hora certa. Movimento sem comprador não adianta. Testa, mede pelo resultado e troca sem dó.

## CALOTE, FIADO E PIX DA CONFIANÇA
- "Pix da confiança": um papel com o seu QR/Pix que você entrega pro cliente. Ele paga quando chegar em casa, sem pressão — isso tira o medo e fecha mais venda.
- Anti-calote de verdade: pegue o NÚMERO do cliente na hora da venda. No DEFCON 4, ao registrar, salve o contato — o Orbis dispara o seu Pix no WhatsApp do cliente pra ele pagar. Menos calote, mais recebido.
- Fiado solto é prejuízo. Se for fiar, só pra conhecido, valor pequeno e com data combinada na hora.

## GESTÃO DO DINHEIRO: a regra de 3
Todo dinheiro que entra, divide em 3 partes:
- 50% é SEU (pró-labore — o que você tira pra viver).
- 30% MERCADORIA (repor o estoque e manter o corre girando).
- 20% RESERVA / fluxo de caixa (emergência e pra investir quando bombar).
Quem não separa, gasta o próprio estoque e quebra. A regra de 3 é o que mantém o negócio de pé e crescendo.

## MINDSET
- O "não" é pedágio, não parede. Cada não aproxima do próximo sim. Conte os nãos com orgulho.
- Não se compare com o dia bom dos outros. Compare com o seu ontem.
- Visão longa: cada dia na rua é tijolo. Você não tá só vendendo hoje, tá construindo uma vida.
- Quando travar: respira, abordagem simples e rápida pra destravar, e segue. Ação mata ansiedade.

# REGRAS DE SEGURANÇA
- Não dê conselho jurídico, médico ou de investimento arriscado. Foco é venda, rotina e disciplina.
- Não prometa ganho garantido. Resultado vem de trabalho e constância, e você fala isso de boa.
- Não humilhe. Firmeza sim, desrespeito nunca. O cara tá lutando — você tá do lado dele.
- Você só fala de venda, rotina, disciplina e cabeça pro corre. Se perguntarem algo fora disso, responde em 1 linha curta e puxa de volta pro corre.
`.trim();

// Regras extras SÓ pro chat no Cerebras (gpt-oss tende a ser prolixo e a "recitar" o método).
const CEREBRAS_CHAT_EXTRA = `

MODO CONVERSA (regras extras, valem acima de tudo):
- CURTO: no máximo 3 ou 4 frases, como parça que pensa na hora — nada de textão nem lista de robô.
- USE OS DADOS REAIS DELE: se houver o bloco "DADOS REAIS DESTE VENDEDOR" mais acima, BASEIE a resposta nos números DELE (conversão, meta, faturamento, melhor horário, gasto). Cite o número e adapte o conselho à situação dele AGORA. Nada de resposta genérica que serviria pra qualquer um.
- Os scripts e frases de exemplo do método são só EXEMPLOS de inspiração. NUNCA repita as mesmas frases de exemplo, nem entregue o mesmo texto duas vezes. CRIE um script NOVO, com OUTRAS palavras, adaptado à pergunta e ao vendedor — varia sempre.
- ESPECÍFICO, nunca genérico: toda resposta entrega algo concreto — um script teu (entre aspas), uma técnica citada pelo nome, OU um número dele. PROIBIDO papo vago ("tenha foco", "acredite", "seja confiante").
- Não despeje o método inteiro. Escolhe SÓ o que resolve a pergunta, fala com TUAS palavras e fecha com 1 próximo passo.`;

// ---- Helpers de audio: o Gemini TTS devolve PCM cru; o navegador toca WAV ----
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

// ---- VOZ NEURAL GRÁTIS via Microsoft Edge (edge-tts) — sem chave, sem cartão ----
const EDGE_TOKEN = "6A5AA1D4EAFF4E9FB37E23D68491D6F4";
const EDGE_GEC_VERSION = "1-143.0.3650.75";
function xmlEscape(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}
function edgeDateString(): string {
  const d = new Date();
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const mon = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const p = (n: number) => String(n).padStart(2, "0");
  return `${days[d.getUTCDay()]} ${mon[d.getUTCMonth()]} ${p(d.getUTCDate())} ${d.getUTCFullYear()} ` +
    `${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())} GMT+0000 (Coordinated Universal Time)`;
}
async function edgeSecToken(): Promise<string> {
  let ticks = (BigInt(Math.floor(Date.now() / 1000)) + 11644473600n) * 10000000n;
  ticks = ticks - (ticks % 3000000000n);
  const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${ticks}${EDGE_TOKEN}`)));
  return [...hash].map((b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
}
async function edgeTTS(text: string, voice: string, pitch: string, rate: string, volume: string): Promise<Uint8Array> {
  const gec = await edgeSecToken();
  const connId = crypto.randomUUID().replace(/-/g, "");
  const url = `wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1` +
    `?TrustedClientToken=${EDGE_TOKEN}&ConnectionId=${connId}&Sec-MS-GEC=${gec}&Sec-MS-GEC-Version=${EDGE_GEC_VERSION}`;
  const ws = new WebSocket(url);
  ws.binaryType = "arraybuffer";
  const chunks: Uint8Array[] = [];
  return await new Promise<Uint8Array>((resolve, reject) => {
    const timer = setTimeout(() => { try { ws.close(); } catch { /*noop*/ } reject(new Error("edge_timeout")); }, 17000);
    ws.onopen = () => {
      const date = edgeDateString();
      ws.send(`X-Timestamp:${date}\r\nContent-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n` +
        `{"context":{"synthesis":{"audio":{"metadataoptions":{"sentenceBoundaryEnabled":"false","wordBoundaryEnabled":"false"},"outputFormat":"audio-24khz-48kbitrate-mono-mp3"}}}}\r\n`);
      const ssml = `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='en-US'>` +
        `<voice name='${voice}'><prosody pitch='${pitch}' rate='${rate}' volume='${volume}'>${xmlEscape(text)}</prosody></voice></speak>`;
      ws.send(`X-RequestId:${connId}\r\nContent-Type:application/ssml+xml\r\nX-Timestamp:${date}Z\r\nPath:ssml\r\n\r\n${ssml}`);
    };
    ws.onmessage = (ev) => {
      if (typeof ev.data === "string") {
        if (ev.data.includes("Path:turn.end")) {
          clearTimeout(timer);
          let total = 0; for (const c of chunks) total += c.length;
          const out = new Uint8Array(total);
          let off = 0; for (const c of chunks) { out.set(c, off); off += c.length; }
          try { ws.close(); } catch { /*noop*/ }
          resolve(out);
        }
      } else {
        const buf = new Uint8Array(ev.data as ArrayBuffer);
        if (buf.length > 2) {
          const headerLen = (buf[0] << 8) | buf[1];
          if (2 + headerLen <= buf.length) chunks.push(buf.slice(2 + headerLen));
        }
      }
    };
    ws.onerror = () => { clearTimeout(timer); reject(new Error("edge_ws_error")); };
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const json = (obj: unknown, status = 200) =>
    new Response(JSON.stringify(obj), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const body = await req.json().catch(() => ({}));

    // ===== VOZ (TTS): voz NEURAL grátis via Edge (sem chave/cartão) + fallback StreamElements =====
    if (body?.tts && typeof body.tts === "string" && body.tts.trim()) {
      const text = body.tts.slice(0, 900);
      // 1) Edge TTS (neural, grave estilo JARVIS) — grátis, sem chave
      try {
        const voice = Deno.env.get("EDGE_TTS_VOICE") ?? "pt-BR-AntonioNeural";
        const pitch = Deno.env.get("EDGE_TTS_PITCH") ?? "-5Hz";
        const rate = Deno.env.get("EDGE_TTS_RATE") ?? "-3%";
        const volume = Deno.env.get("EDGE_TTS_VOLUME") ?? "+0%";
        const audio = await edgeTTS(text, voice, pitch, rate, volume);
        if (audio.length > 800) return json({ audio: bytesToB64(audio), mime: "audio/mpeg" });
        console.error("Edge TTS vazio (cai pro StreamElements)");
      } catch (e) {
        console.error("Edge TTS falhou (cai pro StreamElements):", String(e).slice(0, 200));
      }
      // 2) Fallback: StreamElements (Amazon Polly) — HTTP simples, grátis
      try {
        const seVoice = Deno.env.get("SE_TTS_VOICE") ?? "Ricardo";
        const r = await fetch(
          `https://api.streamelements.com/kappa/v2/speech?voice=${seVoice}&text=${encodeURIComponent(text)}`,
          { signal: AbortSignal.timeout(15000) },
        );
        if (r.ok) {
          const buf = new Uint8Array(await r.arrayBuffer());
          if (buf.length > 800) return json({ audio: bytesToB64(buf), mime: "audio/mpeg" });
        } else {
          console.error("StreamElements TTS erro", r.status);
        }
      } catch (e) {
        console.error("StreamElements TTS falhou:", String(e).slice(0, 200));
      }
      return json({ error: "tts_indisponivel" }); // o app cai na voz do aparelho sozinho
    }

    const messages = Array.isArray(body?.messages) ? body.messages : null;
    if (!messages || messages.length === 0) {
      return json({ success: false, error: "messages vazio" });
    }

    // Números reais do vendedor (mandados pelo app) — pra IA personalizar a resposta.
    const userCtx = (typeof body?.context === "string" && body.context.trim())
      ? `\n\n${body.context.trim()}`
      : "";
    console.log("CTX recebido (chars):", userCtx.length); // diagnóstico: >0 = dados chegaram

    // Trava de uso (protege o gasto): EXIGE login + falha FECHADO (bloqueia se a trava errar).
    {
      const authH = req.headers.get("Authorization") ?? "";
      if (!authH) {
        return json({ success: false, message: "Entra na tua conta pra falar com o mentor." }, 401);
      }
      try {
        const supa = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_ANON_KEY") ?? "", { global: { headers: { Authorization: authH } } });
        const { data: u } = await supa.auth.getUser();
        if (!u?.user?.id) {
          return json({ success: false, message: "Tua sessão expirou — entra de novo." }, 401);
        }
        const { data: usage, error: usageErr } = await supa.rpc("bump_ai_usage", { p_feature: "chat", p_limit: 30 });
        if (usageErr) {
          return json({ success: false, message: "Deu um tropeço aqui, tenta de novo daqui a pouco." }, 503);
        }
        if ((usage as any)?.over) {
          return json({ success: true, message: "Mandou bem hoje, parça! 💪 Você já usou bastante o mentor — amanhã ele volta com tudo. Bora vender." });
        }
      } catch (_e) {
        return json({ success: false, message: "Deu um tropeço aqui, tenta de novo daqui a pouco." }, 503);
      }
    }

    // ===== TEXTO: tenta CLAUDE (Anthropic) primeiro; cai no Cerebras/Gemini (gratis) se faltar chave/erro/credito. =====
    try {
      const akey = Deno.env.get("ANTHROPIC_API_KEY");
      if (akey) {
        const amodel = Deno.env.get("ANTHROPIC_MODEL") ?? "claude-haiku-4-5-20251001";
        const ahist = messages.slice(-8).map((m: any) => ({
          role: m?.role === "assistant" ? "assistant" : "user",
          content: String(m?.content ?? "").slice(0, 2000),
        }));
        // Claude exige que a 1a mensagem seja do "user".
        while (ahist.length && ahist[0].role !== "user") ahist.shift();
        if (ahist.length) {
          const aRes = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: { "content-type": "application/json", "x-api-key": akey, "anthropic-version": "2023-06-01" },
            signal: AbortSignal.timeout(25000),
            body: JSON.stringify({
              model: amodel,
              max_tokens: 500,
              temperature: 0.8,
              system: ORBIS_BRAIN + userCtx + CEREBRAS_CHAT_EXTRA,
              messages: ahist,
            }),
          });
          if (aRes.ok) {
            const aj = await aRes.json();
            const atext = ((aj?.content ?? []).map((b: any) => b?.text || "").join("")).replace(/\*\*/g, "").trim();
            if (atext) return json({ success: true, message: atext });
          } else {
            console.error("Claude chat erro", aRes.status);
          }
        }
      }
    } catch (e) {
      console.error("Claude chat exceção (cai pro Cerebras)", e);
    }

    // ===== TEXTO: tenta Cerebras (gratis, 1M tokens/dia); cai no Gemini se faltar chave/erro. =====
    try {
      const ckey = Deno.env.get("CEREBRAS_API_KEY");
      if (ckey) {
        const cmodel = Deno.env.get("CEREBRAS_MODEL") ?? "gpt-oss-120b";
        // Historico ENXUTO pra caber sempre no teto de 8K do gratis (cerebro ~3K + estas msgs
        // + a resposta). Mantem so as ultimas 6 trocas, cada uma capada — evita estourar e
        // cair no Gemini (lento) nos follow-ups.
        const hist = messages.slice(-6).map((m: any) => ({
          role: m?.role === "assistant" ? "assistant" : "user",
          content: String(m?.content ?? "").slice(0, 1000),
        }));
        const cRes = await fetch("https://api.cerebras.ai/v1/chat/completions", {
          method: "POST",
          headers: { "content-type": "application/json", "authorization": `Bearer ${ckey}` },
          signal: AbortSignal.timeout(20000),
          body: JSON.stringify({
            model: cmodel,
            messages: [{ role: "system", content: ORBIS_BRAIN + userCtx + CEREBRAS_CHAT_EXTRA }, ...hist],
            temperature: 0.8,
            max_tokens: 400,
            top_p: 0.95,
          }),
        });
        if (cRes.ok) {
          const cj = await cRes.json();
          const ctext = (cj?.choices?.[0]?.message?.content?.toString() ?? "").replace(/\*\*/g, "").trim();
          if (ctext) return json({ success: true, message: ctext });
        } else {
          console.error("Cerebras chat erro", cRes.status);
        }
      }
    } catch (e) {
      console.error("Cerebras chat exceção (cai pro Gemini)", e);
    }

    const key = Deno.env.get("GEMINI_API_KEY");
    if (!key) return json({ success: false, error: "GEMINI_API_KEY ausente nos secrets" });

    const model = Deno.env.get("GEMINI_MODEL") ?? "gemini-flash-latest";

    // Converte o historico pro formato do Gemini (assistant -> model).
    const contents = messages.slice(-30).map((m: any) => ({
      role: m?.role === "assistant" ? "model" : "user",
      parts: [{ text: String(m?.content ?? "").slice(0, 4000) }],
    }));

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
    const payload = JSON.stringify({
      systemInstruction: { parts: [{ text: ORBIS_BRAIN + userCtx }] },
      contents,
      generationConfig: { temperature: 0.8, maxOutputTokens: 800, topP: 0.95 },
    });

    // Tenta ate' 3 vezes: o Flash as vezes devolve 429/500/503 (sobrecarga).
    let gRes: Response | null = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      gRes = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(20000),
        body: payload,
      });
      if (gRes.ok) break;
      if (![429, 500, 502, 503].includes(gRes.status) || attempt === 3) {
        const errText = await gRes.text().catch(() => "");
        console.error("Gemini erro", gRes.status, errText);
        return json({ success: false, error: `gemini_${gRes.status}` });
      }
      await new Promise((r) => setTimeout(r, attempt * 600));
    }

    const data = await gRes!.json();
    const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text?.toString() ?? "";
    const text = raw.replace(/\*\*/g, "").trim(); // tira negrito que escapar
    if (!text) return json({ success: false, error: "resposta_vazia" });

    return json({ success: true, message: text });
  } catch (e) {
    console.error("bright-action erro", e);
    return json({ success: false, error: "erro_interno" });
  }
});
