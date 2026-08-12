// Orbis — bright-action (chat do mentor de rua, 100% Gemini)
// Recebe { messages: [{ role, content }] } e devolve { success, message }.
// Tambem aceita { tts } (voz do servidor: OpenAI "Jarvis" -> Gemini -> Edge)
// e { stt } (transcricao de audio pra navegador sem reconhecimento de voz).
// FASE 1 do AGENTE: memoria permanente por vendedor (ai_memoria) — carrega no contexto
// e aprende fatos novos apos cada resposta, em segundo plano.
// FASE 2 do AGENTE: ferramentas — consulta vendas/estoque/financeiro/ranking com o token
// do proprio vendedor e executa acoes (meta do dia, gasto) APOS confirmacao na conversa.
// v52: criar_adesivo gera a arte NA HORA e mostra no chat ([[adesivo:URL]]); cache do
// prompt do Claude (menos 429 em conta nova + ~90% mais barato); Opus nas conversas de
// marca/nome; rede de seguranca gera a arte mesmo se um modelo reserva vazar JSON.
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

# COMO VOCÊ CONVERSA (o mais importante de tudo)
- Você conversa como GENTE DE VERDADE: reage ao que ele acabou de dizer, responde a pergunta DELE, no tom DELE. Se ele tá animado, vibra junto; se ele tá cansado ou pra baixo, acolhe primeiro e só depois orienta.
- Português do Brasil natural, de conversa. Gíria só quando encaixa sozinha — NUNCA force "parça", "bora", "fechou" como bordão. Uma frase limpa vale mais que gíria forçada.
- CURTO de verdade: 1 a 4 frases na maioria das vezes. Uma ideia por mensagem. Se o assunto pede profundidade, pergunta antes ("quer que eu monte esse plano contigo?").
- FAÇA PERGUNTAS. Mentor bom pergunta antes de receitar: "me diz, o que trava mais — puxar o papo ou fechar a venda?". Uma boa pergunta vale mais que três conselhos.
- VARIE SEMPRE. Nunca comece duas respostas do mesmo jeito, nunca repita um script já usado, e NÃO termine toda mensagem com ordem ou "próximo passo" — só quando couber naturalmente.
- ZERO emoji e zero formatação (nada de negrito, título ou lista). Texto corrido.
- Os DADOS e a MEMÓRIA dele existem pra você usar como amigo que conhece a história: o número certo, na hora certa. Escolha UM dado que responde a pergunta — não despeje relatório.
- Nunca invente número. Se não tem o dado, consulta (ferramenta) ou pergunta pra ele.
- Honestidade com respeito: se ele tá indo mal, fala na lata e mostra a saída.

## O MÉTODO É CONHECIMENTO, NÃO ROTEIRO
- Tudo que está em "O QUE VOCÊ DOMINA" é teu repertório de EXPERIÊNCIA — serve pra você PENSAR a resposta, não pra recitar. PROIBIDO copiar as frases de exemplo do método: são ilustração, não script pronto.
- Script pronto ("fala assim: ...") só quando ele pedir ou quando for claramente o que resolve — e sempre CRIADO na hora, com o produto, o ponto e o jeito DELE (a memória diz o que ele vende e onde).
- Nada de coach genérico ("acredite", "tenha foco", "seja constante"). A especificidade vem dos DADOS e da SITUAÇÃO dele — cite o nome de uma técnica só quando ajudar ele a aprender, não como carimbo.
- Pergunta simples merece resposta simples: "quanto vendi ontem?" → o número e no máximo uma observação esperta. Sem sermão de brinde.

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

## ESTÚDIO DE MARCA (criar o adesivo premium do vendedor)
Você também é o designer-consultor do Orbis: cria JUNTO com o vendedor o adesivo/rótulo premium da marca dele, com espaço pro QR do Pix da confiança. Quando ele pedir adesivo, rótulo, logo ou arte:
- Conduza como CO-CRIAÇÃO, clima de "bora montar isso juntos". No máximo DUAS perguntas por mensagem, uma etapa de cada vez.
- O que você precisa descobrir, nesta ordem: 1) se ele JÁ TEM marca (nome); 2) o que ele vende (descrito pro desenho); 3) formato: rótulo pra pote/copo, adesivo redondo ou quadrado; 4) com mascote/personagem ou sem (mais clean); 5) cores e clima da marca. Se a MEMÓRIA trouxer produto/sabor OU um nome de marca de conversas antigas, CONFIRME antes de usar ("é a batida de maracujá ainda?") — nunca assuma que ainda vale, e NUNCA reapresente um nome antigo como se fosse ideia nova.
- CRIAR NOME DE MARCA (quando ele não tem): você é um naming de primeira linha, não gerador genérico. Entenda produto, público e clima antes de sugerir. Proponha 3 nomes em DIREÇÕES bem diferentes (um divertido de rua, um premium/elegante, um curto e sonoro tipo nome próprio), em português natural, fáceis de gritar no farol, grafia perfeita — EVITE inglês batido tipo "Fresh", "Power", "Elite", "Top". Meia frase de porquê em cada. Se ele recusar, NUNCA repita nem varie os mesmos: muda completamente a direção criativa.
- Quando tiver marca + produto + estilo e ele confirmar, CHAME criar_adesivo NA HORA — ela desenha e a imagem aparece DIRETO na conversa (leva até 1 minuto). NÃO existe "tela de geração": nunca mande ele abrir tela nenhuma. Depois comenta o resultado em 1 frase e avisa do botão embaixo da imagem pra colocar o QR Pix real e baixar.
- Se ele quiser mudar algo (cor, estilo, detalhe), ajusta o briefing e chama criar_adesivo de novo — cada chamada gasta 1 geração do dia dele, então confirme a mudança antes.
- NUNCA descreva a arte como pronta sem ter chamado a ferramenta nesta conversa. Se mensagens antigas desta conversa falarem de "tela de geração", IGNORE: o fluxo atual é a arte nascer aqui no chat.
- Direitos autorais: referência de arte de OUTRA pessoa é só inspiração de estilo — a arte dele sai nova e única, sem copiar personagem, texto ou contato de ninguém.

# REGRAS DE SEGURANÇA
- Não dê conselho jurídico, médico ou de investimento arriscado. Foco é venda, rotina e disciplina.
- Não prometa ganho garantido. Resultado vem de trabalho e constância, e você fala isso de boa.
- Não humilhe. Firmeza sim, desrespeito nunca. O cara tá lutando — você tá do lado dele.
- Você só fala de venda, rotina, disciplina e cabeça pro corre. Se perguntarem algo fora disso, responde em 1 linha curta e puxa de volta pro corre.
`.trim();

// Regras extras SÓ pro chat no Cerebras (gpt-oss tende a ser prolixo e a "recitar" o método).
const CEREBRAS_CHAT_EXTRA = `

MODO CONVERSA (regras extras, valem acima de tudo):
- Responda como numa conversa de WhatsApp com um amigo que entende muito do assunto: 1 a 4 frases, natural, reagindo ao que ele ACABOU de dizer.
- Use os blocos "DADOS REAIS" e "MEMÓRIA" pra personalizar de leve — UM dado certo na frase vale mais que cinco números despejados.
- NUNCA repita frases de exemplo do método nem respostas que você já deu. Varie abertura, varie estrutura, crie script novo quando precisar de script.
- Quando faltar contexto, pergunta de volta em vez de chutar conselho. Não termine tudo com ordem ou "próximo passo".
- Sem emoji, sem formatação, sem tom de palestra ou de coach.
- PROIBIDO escrever JSON, código ou simular "chamada de ferramenta" no texto da conversa.
- ADESIVO: quem desenha é a ferramenta criar_adesivo — a imagem aparece DIRETO na conversa. Quando o vendedor pedir pra gerar e o briefing estiver completo, CHAME a ferramenta na hora; NUNCA mande ele pra uma "tela de geração" (não existe mais) e NUNCA diga que a arte foi gerada sem a ferramenta ter rodado nesta conversa. Se você estiver num modo sem ferramentas, apenas colete o briefing e diga que vai desenhar em instantes.`;

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
    const timer = setTimeout(() => { try { ws.close(); } catch { /*noop*/ } reject(new Error("edge_timeout")); }, 8000);
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

// ===== FASE 1 do Agente: extrai MEMÓRIA de longo prazo da conversa (roda DEPOIS da
// resposta, sem atrasar o vendedor). Só grava o que o VENDEDOR afirmou. =====
async function extractMemory(userId: string, userMsg: string, reply: string, existing: string[]) {
  try {
    const key = Deno.env.get("GEMINI_API_KEY");
    if (!key || !userId || !userMsg || userMsg.length < 8) return;
    const model = Deno.env.get("GEMINI_MODEL") ?? "gemini-flash-latest";
    const prompt = `Você extrai MEMÓRIA de longo prazo sobre um vendedor ambulante a partir de uma troca de chat com o mentor dele.

FATOS JÁ CONHECIDOS (NÃO repita nem reescreva nenhum):
${existing.length ? existing.map((f) => "- " + f).join("\n") : "(nenhum ainda)"}

TROCA DE AGORA:
Vendedor disse: ${userMsg}
Mentor respondeu: ${reply}

Liste APENAS fatos NOVOS e DURÁVEIS afirmados PELO PRÓPRIO VENDEDOR sobre ele ou o negócio dele: o que vende, onde vende, rotina, dificuldade recorrente, vitória com número, compromisso que ele assumiu, preferência. NADA passageiro (clima, humor do dia), NADA inventado, NADA que veio só do mentor. No máximo 3 fatos, cada um numa frase curta e objetiva em português. Se não houver fato novo durável, devolva a lista vazia.
Responda SOMENTE com JSON neste formato: {"fatos":[{"tipo":"perfil|dificuldade|vitoria|combinado|preferencia|outro","fato":"..."}]}`;
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(15000),
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0, maxOutputTokens: 400, responseMimeType: "application/json" },
      }),
    });
    if (!r.ok) { console.error("extractMemory http", r.status); return; }
    const j = await r.json();
    const raw = j?.candidates?.[0]?.content?.parts?.[0]?.text?.toString() ?? "{}";
    let fatos: { tipo?: string; fato?: string }[] = [];
    try { fatos = (JSON.parse(raw)?.fatos ?? []) as typeof fatos; } catch { return; }
    const tiposOk = ["perfil", "dificuldade", "vitoria", "combinado", "preferencia", "outro"];
    const baixa = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
    const conhecidos = existing.map(baixa);
    const novos = fatos
      .map((f) => ({ tipo: tiposOk.includes(String(f?.tipo)) ? String(f.tipo) : "outro", fato: String(f?.fato ?? "").trim() }))
      .filter((f) => f.fato.length >= 10 && f.fato.length <= 220)
      .filter((f) => !conhecidos.some((c) => c.includes(baixa(f.fato)) || baixa(f.fato).includes(c)))
      .slice(0, 3);
    if (!novos.length) return;
    const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
    await admin.from("ai_memoria").insert(novos.map((f) => ({ user_id: userId, tipo: f.tipo, fato: f.fato })));
    // Teto de 40 fatos ativos por vendedor: os mais antigos saem.
    const { data: todos } = await admin.from("ai_memoria").select("id").eq("user_id", userId).eq("ativo", true).order("created_at", { ascending: false });
    const sobra = ((todos as { id: string }[]) || []).slice(40);
    if (sobra.length) await admin.from("ai_memoria").delete().in("id", sobra.map((x) => x.id));
    console.log("memoria: +", novos.length, "fato(s) pro user", userId.slice(0, 8));
  } catch (e) {
    console.error("extractMemory falhou:", String(e).slice(0, 200));
  }
}


// ===== FASE 2 do Agente: FERRAMENTAS — o mentor consulta dados reais e AGE no app =====
// Consultas rodam com o token do PRÓPRIO vendedor (RLS garante que só vê o que é dele).
// Ações de escrita só são chamadas pelo modelo DEPOIS do vendedor confirmar na conversa.
const AGENT_TOOLS = [
  {
    name: "consultar_vendas",
    description: "Consulta as vendas reais do vendedor no período. Use sempre que ele perguntar de resultado, faturamento, como foi ontem/semana/mês.",
    input_schema: { type: "object", properties: { periodo: { type: "string", enum: ["hoje", "ontem", "7dias", "30dias", "mes"], description: "Período desejado" } }, required: ["periodo"] },
  },
  {
    name: "consultar_estoque",
    description: "Lista os produtos ativos do vendedor com estoque atual, estoque mínimo, preço de venda e custo. Use quando ele falar de estoque, produto ou reposição.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "consultar_financeiro",
    description: "Resumo financeiro: gastos por categoria (30 dias) e contas a pagar em aberto. Use quando ele falar de gasto, conta, dívida ou quanto sobrou.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "consultar_ranking",
    description: "Posição do vendedor no ranking do mês e o top 3. Use quando ele perguntar do ranking ou da concorrência.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "definir_meta_do_dia",
    description: "AÇÃO: define/atualiza a meta de faturamento de HOJE do vendedor. Só chame DEPOIS que ele confirmar explicitamente o valor na conversa.",
    input_schema: { type: "object", properties: { valor: { type: "number", description: "Meta do dia em reais" }, horas: { type: "number", description: "Horas de trabalho previstas (padrão 8)" } }, required: ["valor"] },
  },
  {
    name: "registrar_gasto",
    description: "AÇÃO: registra um gasto pessoal/do negócio de hoje. Só chame DEPOIS que o vendedor confirmar valor e categoria na conversa.",
    input_schema: { type: "object", properties: { valor: { type: "number", description: "Valor em reais" }, categoria: { type: "string", description: "Categoria (ex: Transporte, Alimentação, Mercadoria, Outros)" }, nome: { type: "string", description: "Descrição curta do gasto" } }, required: ["valor", "categoria"] },
  },
  {
    name: "criar_adesivo",
    description: "AÇÃO: desenha o adesivo premium do vendedor com IA e mostra a imagem direto na conversa (demora até 1 minuto). Só chame quando já souber marca, produto e estilo (formato, com/sem personagem, cores). Pra nova versão, chame de novo com o briefing ajustado.",
    input_schema: { type: "object", properties: {
      marca: { type: "string", description: "Nome da marca, exatamente como deve aparecer na arte" },
      produto: { type: "string", description: "O que ele vende, descrito pro desenho" },
      estilo: { type: "string", description: "Estilo combinado: formato (rótulo/redondo/quadrado), com ou sem mascote, clima (premium, divertido, delicado...)" },
      cores: { type: "string", description: "Cores da marca (opcional)" },
      extras: { type: "string", description: "Detalhes extras que ele pediu (opcional)" },
    }, required: ["marca", "produto", "estilo"] },
  },
];

const AGENT_TOOLS_RULES = `

FERRAMENTAS (você é um AGENTE, não só um chat):
- Pra responder sobre vendas, estoque, financeiro ou ranking, USE as ferramentas de consulta e responda com o dado REAL que voltar. Nunca chute número quando dá pra consultar.
- Ações (definir_meta_do_dia, registrar_gasto): PRIMEIRO diga o que vai fazer e pergunte "confirma?". SÓ chame a ferramenta depois do SIM explícito do vendedor na conversa. Depois de executar, confirme em 1 frase o que foi feito.
- Se uma ferramenta falhar, avise com naturalidade e siga a conversa sem inventar dado.
- criar_adesivo desenha a arte NA HORA e mostra na conversa. Quando o vendedor pedir pra gerar (briefing completo), CHAME-A imediatamente — nunca responda que não consegue gerar nem mande ele pra alguma tela. Depois, comente o resultado em 1 frase e avise do botão do QR Pix embaixo da imagem.`;

function hojeBrasil(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

// Rede de segurança: se algum modelo (principalmente os reservas, que não têm ferramentas)
// "vazar" no texto um JSON imitando a ferramenta criar_adesivo, a gente extrai o briefing
// (aceita chaves em português E em inglês), abre o Estúdio mesmo assim e limpa a resposta.
function extrairAdesivoDoTexto(texto: string): { dados: Record<string, string>; limpo: string } | null {
  const start = texto.indexOf("{");
  if (start === -1) return null;
  let depth = 0, end = -1;
  for (let i = start; i < texto.length; i++) {
    if (texto[i] === "{") depth++;
    else if (texto[i] === "}") { depth--; if (depth === 0) { end = i; break; } }
  }
  if (end === -1) return null;
  let j: Record<string, unknown> | null = null;
  try { j = JSON.parse(texto.slice(start, end + 1)); } catch { return null; }
  if (!j || typeof j !== "object") return null;
  // Os reservas inventam formatos: {"tool":...,"arguments":{...}} ou
  // {"tool":"create_adesivo","tool_input":{"description":"..."}} — aceita todos.
  if (j.arguments && typeof j.arguments === "object") j = { ...j, ...(j.arguments as Record<string, unknown>) };
  if (j.tool_input && typeof j.tool_input === "object") j = { ...j, ...(j.tool_input as Record<string, unknown>) };
  let marca = String(j.marca ?? j.brand_name ?? j.brand ?? j.nome ?? j.name ?? "").trim();
  let produto = String(j.produto ?? j.product_description ?? j.product ?? j.frase ?? j.descricao ?? "").trim();
  const descLivre = typeof j.description === "string" ? j.description.trim() : "";
  if (!produto && descLivre) produto = descLivre;
  if (!marca && descLivre) {
    // pesca o nome da marca dentro da descrição livre ("...para a marca Citrus Elite, ...")
    const m = /marca\s+["“']?([A-Za-zÀ-ú0-9][^,.;"”']{0,28})/i.exec(descLivre);
    if (m) marca = m[1].trim();
  }
  if (!marca || !produto) return null;
  let estilo: unknown = j.estilo ?? j.style ?? "";
  if (estilo && typeof estilo === "object") {
    const e = estilo as Record<string, unknown>;
    const partes: string[] = [];
    const formato = e.formato ?? e.format; if (formato) partes.push(`formato ${formato}`);
    const cores = e.cores ?? e.colors; if (Array.isArray(cores) && cores.length) partes.push(`cores ${cores.join(", ")}`);
    const mascote = e.mascote ?? e.mascot; if (typeof mascote === "boolean") partes.push(mascote ? "com mascote" : "sem mascote, clean");
    estilo = partes.join("; ");
  }
  // Campos soltos que os reservas usam também viram estilo (fundo, detalhes, formato).
  const extrasEstilo: string[] = [];
  if (typeof estilo === "string" && estilo.trim()) extrasEstilo.push(estilo.trim());
  const fundo = j.fundo ?? j.background; if (typeof fundo === "string" && fundo) extrasEstilo.push(`fundo ${fundo}`);
  const det = j.detalhes; if (typeof det === "string" && det) extrasEstilo.push(`detalhes ${det}`);
  const fmt2 = j.formato ?? j.format; if (typeof fmt2 === "string" && fmt2) extrasEstilo.push(`formato ${fmt2}`);
  const dados: Record<string, string> = {
    marca: marca.slice(0, 30),
    produto: produto.slice(0, 140),
    estilo: (extrasEstilo.join("; ") || "adesivo bonito e profissional").slice(0, 300),
  };
  const cores = j.cores ?? j.colors;
  if (Array.isArray(cores)) dados.cores = cores.join(", ").slice(0, 80);
  else if (typeof cores === "string") dados.cores = cores.slice(0, 80);
  const extras = j.extras ?? j.details;
  if (typeof extras === "string") dados.extras = extras.slice(0, 200);
  const limpo = (texto.slice(0, start) + " " + texto.slice(end + 1))
    .replace(/we (need|will) (to )?call the tool\.?/gi, "")
    .replace(/"tool"\s*:\s*"criar_adesivo",?/gi, "")
    .replace(/\s+/g, " ").trim();
  return { dados, limpo };
}

// Última linha de defesa: se sobrou JSON de "ferramenta" no texto e NEM deu pra extrair
// briefing, corta o lixo e devolve uma pergunta limpa em vez de deixar o vendedor ver código.
function limparJsonPerdido(texto: string): string | null {
  if (!/"tool"|tool_input|"arguments"/.test(texto)) return null;
  const start = texto.indexOf("{");
  if (start === -1) return null;
  let depth = 0, end = -1;
  for (let i = start; i < texto.length; i++) {
    if (texto[i] === "{") depth++;
    else if (texto[i] === "}") { depth--; if (depth === 0) { end = i; break; } }
  }
  const semJson = (start >= 0 && end > start ? texto.slice(0, start) + " " + texto.slice(end + 1) : texto)
    .replace(/\s+/g, " ").trim();
  return semJson || "Só me confirma uma coisa antes de eu desenhar: qual o nome EXATO da marca pra escrever na arte?";
}

async function runTool(name: string, input: Record<string, unknown>, userSupa: any, userId: string, userAuthH: string): Promise<unknown> {
  const hoje = hojeBrasil();
  const back = (n: number) => {
    const d = new Date(`${hoje}T12:00:00Z`); d.setUTCDate(d.getUTCDate() - n);
    return d.toISOString().split("T")[0];
  };
  try {
    if (name === "consultar_vendas") {
      const p = String(input?.periodo ?? "7dias");
      const ini = p === "hoje" ? hoje : p === "ontem" ? back(1) : p === "7dias" ? back(6) : p === "30dias" ? back(29) : `${hoje.slice(0, 7)}-01`;
      const fim = p === "ontem" ? back(1) : hoje;
      const { data, error } = await userSupa.from("daily_sales")
        .select("date,total_profit,cost,transport_cost,food_cost,total_debt")
        .eq("user_id", userId).gte("date", ini).lte("date", fim).order("date");
      if (error) return { erro: error.message };
      const rows = (data || []) as Record<string, number>[];
      const fat = rows.reduce((s, r) => s + (Number(r.total_profit) || 0), 0);
      const custos = rows.reduce((s, r) => s + (Number(r.cost) || 0) + (Number(r.transport_cost) || 0) + (Number(r.food_cost) || 0), 0);
      const calote = rows.reduce((s, r) => s + (Number(r.total_debt) || 0), 0);
      return { periodo: p, de: ini, ate: fim, faturamento: fat, custos, lucro: fat - custos, calote, dias_com_venda: rows.filter((r) => Number(r.total_profit) > 0).length, por_dia: rows.map((r) => ({ dia: r.date, faturou: Number(r.total_profit) || 0 })).slice(-12) };
    }
    if (name === "consultar_estoque") {
      const { data, error } = await userSupa.from("products")
        .select("name,stock_quantity,stock_min,sale_price,cost")
        .eq("user_id", userId).eq("is_active", true).order("name");
      if (error) return { erro: error.message };
      return { produtos: (data || []).map((p: Record<string, unknown>) => ({ nome: p.name, estoque: Number(p.stock_quantity) || 0, minimo: Number(p.stock_min) || 0, preco_venda: Number(p.sale_price) || 0, custo: Number(p.cost) || 0 })) };
    }
    if (name === "consultar_financeiro") {
      const [expR, billsR] = await Promise.all([
        userSupa.from("personal_expenses").select("category,amount").eq("user_id", userId).gte("date", back(29)),
        userSupa.from("planned_bills").select("name,amount,saved_amount,due_date").eq("user_id", userId).eq("paid", false).order("due_date"),
      ]);
      const porCat: Record<string, number> = {};
      for (const e of (expR.data || []) as Record<string, unknown>[]) {
        const k = String(e.category ?? "Outros");
        porCat[k] = (porCat[k] || 0) + (Number(e.amount) || 0);
      }
      return {
        gastos_30_dias_por_categoria: porCat,
        contas_em_aberto: ((billsR.data || []) as Record<string, unknown>[]).slice(0, 8).map((b) => ({ nome: b.name, valor: Number(b.amount) || 0, guardado: Number(b.saved_amount) || 0, vence: b.due_date })),
      };
    }
    if (name === "consultar_ranking") {
      const mes = hoje.slice(0, 7);
      const [meuR, topR] = await Promise.all([
        userSupa.from("leaderboard_stats").select("posicao_faturamento,faturamento_total_mes,dias_trabalhados_mes").eq("user_id", userId).eq("mes_referencia", mes).maybeSingle(),
        userSupa.from("leaderboard_stats").select("nome_usuario,faturamento_total_mes,posicao_faturamento").eq("mes_referencia", mes).not("posicao_faturamento", "is", null).order("posicao_faturamento").limit(3),
      ]);
      return { minha_posicao: meuR.data ?? "fora do ranking este mês", top3: topR.data ?? [] };
    }
    if (name === "definir_meta_do_dia") {
      const valor = Math.round((Number(input?.valor) || 0) * 100) / 100;
      if (valor <= 0 || valor > 100000) return { erro: "valor_invalido" };
      const horas = Math.min(16, Math.max(1, Number(input?.horas) || 8));
      const { data: plano } = await userSupa.from("daily_goal_plans").select("id,work_hours").eq("user_id", userId).eq("date", hoje).maybeSingle();
      if (plano?.id) {
        const h = Number(plano.work_hours) || horas;
        const { error } = await userSupa.from("daily_goal_plans").update({ daily_goal: valor, hourly_goal: Math.round((valor / h) * 100) / 100 }).eq("id", plano.id);
        if (error) return { erro: error.message };
        return { ok: true, acao: "meta_atualizada", meta: valor };
      }
      const { error } = await userSupa.from("daily_goal_plans").insert({ user_id: userId, date: hoje, daily_goal: valor, work_hours: horas, mood: "confiante", hourly_goal: Math.round((valor / horas) * 100) / 100 });
      if (error) return { erro: error.message };
      return { ok: true, acao: "meta_criada", meta: valor, horas };
    }
    if (name === "registrar_gasto") {
      const valor = Math.round((Number(input?.valor) || 0) * 100) / 100;
      if (valor <= 0 || valor > 100000) return { erro: "valor_invalido" };
      const categoria = String(input?.categoria ?? "Outros").slice(0, 40) || "Outros";
      const nome = String(input?.nome ?? categoria).slice(0, 60) || categoria;
      const { error } = await userSupa.from("personal_expenses").insert({ user_id: userId, category: categoria, name: nome, amount: valor, type: "variable", date: hoje });
      if (error) return { erro: error.message };
      return { ok: true, acao: "gasto_registrado", valor, categoria, nome };
    }
    if (name === "criar_adesivo") {
      const marca = String(input?.marca ?? "").slice(0, 30).trim();
      const produto = String(input?.produto ?? "").slice(0, 140).trim();
      const estilo = String(input?.estilo ?? "").slice(0, 300).trim();
      if (!marca || !produto || !estilo) return { erro: "briefing_incompleto" };
      // Gera a arte AGORA, direto no chat (igual o GPT): chama a estudio-arte com o token
      // do PRÓPRIO vendedor (assinatura + limite diário valem lá), sobe o PNG no Storage
      // público e devolve a URL — o app mostra a imagem na conversa.
      try {
        const r = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/estudio-arte`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: userAuthH,
            apikey: Deno.env.get("SUPABASE_ANON_KEY") ?? "",
          },
          signal: AbortSignal.timeout(120000),
          body: JSON.stringify({
            marca, produto, estilo,
            cores: String(input?.cores ?? "").slice(0, 80),
            extras: String(input?.extras ?? "").slice(0, 200),
            origem: "chat",
          }),
        });
        const j = await r.json().catch(() => ({} as Record<string, unknown>));
        if ((j as any)?.imagem) {
          const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
          const bytes = b64ToBytes(String((j as any).imagem));
          const path = `${userId}/${crypto.randomUUID()}.png`;
          const up = await admin.storage.from("artes").upload(path, bytes, { contentType: String((j as any).mime || "image/png") });
          if (up.error) return { erro: "upload_falhou" };
          const { data: pub } = admin.storage.from("artes").getPublicUrl(path);
          // Amarra a URL no registro da geração: é assim que a gente sabe DEPOIS
          // qual briefing virou arte que o vendedor achou boa o bastante pra baixar.
          const gid = String((j as any)?.geracao_id ?? "");
          if (gid) { try { await admin.from("estudio_geracoes").update({ imagem_url: pub.publicUrl }).eq("id", gid); } catch { /* noop */ } }
          return {
            ok: true, imagem_url: pub.publicUrl,
            msg: "Arte gerada com sucesso — ela JÁ está aparecendo na conversa. Comente o resultado em 1 frase e avise que, embaixo da imagem, tem o botão pra colocar o QR Pix real e baixar. Se ele quiser mudar algo, é só pedir que você gera outra versão.",
          };
        }
        const errCode = String((j as any)?.error ?? "geracao_falhou");
        const ehTrial = String((j as any)?.plano ?? "") === "trial";
        const msgs: Record<string, string> = {
          limite_diario: ehTrial
            ? "Ele já usou as artes grátis de hoje (são 2 por dia no teste). Diga isso com leveza e conte que assinando ele passa a ter 4 por dia E baixa sem a marca d'água — sem pressionar."
            : "Ele já usou as gerações de arte de hoje — amanhã libera de novo.",
          assinatura_necessaria: "O teste grátis dele acabou. Convide pra assinar, em 1 frase, sem sermão.",
          sem_chave: "Nenhum provedor de imagem está configurado no servidor.",
        };
        return { erro: errCode, aviso: msgs[errCode] ?? "A geração falhou agora. Peça pra ele tentar de novo em instantes." };
      } catch (e) {
        return { erro: "geracao_falhou", detalhe: String(e).slice(0, 120) };
      }
    }
    return { erro: "ferramenta_desconhecida" };
  } catch (e) {
    return { erro: String(e).slice(0, 160) };
  }
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

    // ===== VOZ (STT): transcreve áudio gravado no aparelho (fallback pra navegador sem
    // reconhecimento de voz — Firefox, WebViews). Usa o Gemini com a MESMA chave do chat. =====
    if (body?.stt && typeof body.stt === "string" && body.stt.length > 100) {
      // exige login (protege a chave contra abuso)
      const authH = req.headers.get("Authorization") ?? "";
      if (!authH) return json({ error: "login_necessario" }, 401);
      try {
        const supa = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_ANON_KEY") ?? "", { global: { headers: { Authorization: authH } } });
        const { data: u } = await supa.auth.getUser();
        if (!u?.user?.id) return json({ error: "sessao_expirada" }, 401);
      } catch { return json({ error: "sessao_expirada" }, 401); }
      const key = Deno.env.get("GEMINI_API_KEY");
      if (!key) return json({ error: "sem_chave" });
      try {
        const mime = typeof body.mime === "string" && body.mime ? body.mime.split(";")[0] : "audio/webm";
        const model = Deno.env.get("GEMINI_MODEL") ?? "gemini-flash-latest";
        const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: AbortSignal.timeout(20000),
          body: JSON.stringify({
            contents: [{ role: "user", parts: [
              { text: "Transcreva EXATAMENTE o que foi falado neste áudio, em português do Brasil. Responda SÓ com a transcrição, sem comentários. Se não houver fala, responda com texto vazio." },
              { inlineData: { mimeType: mime, data: body.stt } },
            ] }],
            generationConfig: { temperature: 0, maxOutputTokens: 500 },
          }),
        });
        if (r.ok) {
          const j = await r.json();
          const t = (j?.candidates?.[0]?.content?.parts?.[0]?.text?.toString() ?? "").trim();
          return json({ text: t });
        }
        console.error("Gemini STT erro", r.status, await r.text().catch(() => ""));
      } catch (e) {
        console.error("Gemini STT falhou:", String(e).slice(0, 200));
      }
      return json({ error: "stt_indisponivel" });
    }

    // ===== VOZ (TTS): 1) OpenAI (JARVIS) -> 2) Gemini -> 3) Edge -> voz do aparelho =====
    // Medido em 11/08/2026 com o mesmo texto:
    //   OpenAI gpt-4o-mini-tts "onyx" .... 1,3s / 126 KB (mp3)
    //   Gemini 2.5 flash TTS "Charon" .... 4,2s / 410 KB (wav)  <- era o 1o da fila
    //   StreamElements ................... 401 (morreu) -> removido da fila
    // O mp3 é 3x menor: no 4G da rua isso é MAIS tempo economizado que o próprio
    // tempo de geração. E só a OpenAI aceita "instructions" — é o que deixa a voz
    // com a pegada Jarvis (grave, calma, sem euforia de locutor).
    if (body?.tts && typeof body.tts === "string" && body.tts.trim()) {
      const text = body.tts.slice(0, 1500);

      // 1) OpenAI — a voz principal do Orbis
      try {
        const okey = Deno.env.get("OPENAI_API_KEY");
        if (okey) {
          const oModel = Deno.env.get("OPENAI_TTS_MODEL") ?? "gpt-4o-mini-tts";
          const oVoice = Deno.env.get("OPENAI_TTS_VOICE") ?? "onyx";
          const oInstr = Deno.env.get("OPENAI_TTS_INSTRUCTIONS") ??
            "Fale em português do Brasil com voz grave, calma e firme. Ritmo pausado, " +
            "quase confidencial, como um copiloto experiente falando perto do ouvido de " +
            "quem está trabalhando. Segurança tranquila, nunca euforia de locutor de rádio " +
            "nem entonação de propaganda. Frases terminadas com convicção, sem subir o tom " +
            "no fim. Pausas curtas entre as ideias. Naturalidade acima de tudo.";
          const oSpeed = Number(Deno.env.get("OPENAI_TTS_SPEED") ?? "0.95");
          const body2: Record<string, unknown> = {
            model: oModel, voice: oVoice, input: text, response_format: "mp3", speed: oSpeed,
          };
          // "instructions" só existe nos modelos gpt-4o*-tts; tts-1 ignora/recusa.
          if (oModel.startsWith("gpt-")) body2.instructions = oInstr;
          const r = await fetch("https://api.openai.com/v1/audio/speech", {
            method: "POST",
            headers: { "content-type": "application/json", authorization: `Bearer ${okey}` },
            signal: AbortSignal.timeout(20000),
            body: JSON.stringify(body2),
          });
          if (r.ok) {
            const buf = new Uint8Array(await r.arrayBuffer());
            if (buf.length > 800) return json({ audio: bytesToB64(buf), mime: "audio/mpeg", voz: `openai:${oVoice}` });
            console.error("OpenAI TTS áudio vazio (cai pro Gemini)");
          } else {
            console.error("OpenAI TTS erro", r.status, (await r.text().catch(() => "")).slice(0, 200));
          }
        }
      } catch (e) {
        console.error("OpenAI TTS falhou (cai pro Gemini):", String(e).slice(0, 200));
      }

      // 2) Gemini TTS oficial — mesma chave do chat. Devolve PCM 24kHz -> WAV.
      try {
        const key = Deno.env.get("GEMINI_API_KEY");
        if (key) {
          const ttsModel = Deno.env.get("GEMINI_TTS_MODEL") ?? "gemini-2.5-flash-preview-tts";
          const ttsVoice = Deno.env.get("GEMINI_TTS_VOICE") ?? "Charon"; // grave, estilo mentor
          const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${ttsModel}:generateContent?key=${key}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            signal: AbortSignal.timeout(15000),
            body: JSON.stringify({
              // O prefixo é ESSENCIAL: sem ele, o modelo de TTS às vezes "responde" ao texto
              // em vez de lê-lo (falava conteúdo inventado, principalmente em perguntas).
              contents: [{ role: "user", parts: [{ text: `Leia em voz alta, em português do Brasil, com tom natural de conversa, EXATAMENTE o texto a seguir, sem adicionar, responder ou comentar nada: ${text}` }] }],
              generationConfig: {
                responseModalities: ["AUDIO"],
                speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: ttsVoice } } },
              },
            }),
          });
          if (r.ok) {
            const j = await r.json();
            const part = j?.candidates?.[0]?.content?.parts?.find((p: any) => p?.inlineData?.data);
            if (part?.inlineData?.data) {
              const rateMatch = /rate=(\d+)/.exec(part.inlineData.mimeType ?? "");
              const rate = rateMatch ? parseInt(rateMatch[1]) : 24000;
              const wav = pcmToWav(b64ToBytes(part.inlineData.data), rate);
              return json({ audio: bytesToB64(wav), mime: "audio/wav", voz: "gemini" });
            }
            console.error("Gemini TTS sem áudio na resposta (cai pro Edge)");
          } else {
            console.error("Gemini TTS erro", r.status, (await r.text().catch(() => "")).slice(0, 200));
          }
        }
      } catch (e) {
        console.error("Gemini TTS falhou (cai pro Edge):", String(e).slice(0, 200));
      }
      // 3) Edge TTS (neural, grave) — grátis, sem chave (endpoint não-oficial)
      try {
        const voice = Deno.env.get("EDGE_TTS_VOICE") ?? "pt-BR-AntonioNeural";
        const pitch = Deno.env.get("EDGE_TTS_PITCH") ?? "-5Hz";
        const rate = Deno.env.get("EDGE_TTS_RATE") ?? "-3%";
        const volume = Deno.env.get("EDGE_TTS_VOLUME") ?? "+0%";
        const audio = await edgeTTS(text, voice, pitch, rate, volume);
        if (audio.length > 800) return json({ audio: bytesToB64(audio), mime: "audio/mpeg", voz: "edge" });
        console.error("Edge TTS vazio (cai pra voz do aparelho)");
      } catch (e) {
        console.error("Edge TTS falhou (cai pra voz do aparelho):", String(e).slice(0, 200));
      }
      // O StreamElements (Amazon Polly) saiu da fila: passou a devolver 401 em
      // 11/08/2026 — endpoint não-oficial que fechou. Ficava só gastando ~15s de
      // espera antes de cair na voz do aparelho.
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
    let chatUserId = "";
    const reqAuthH = req.headers.get("Authorization") ?? "";
    {
      const authH = reqAuthH;
      if (!authH) {
        return json({ success: false, message: "Entra na tua conta pra falar com o mentor." }, 401);
      }
      try {
        const supa = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_ANON_KEY") ?? "", { global: { headers: { Authorization: authH } } });
        const { data: u } = await supa.auth.getUser();
        if (!u?.user?.id) {
          return json({ success: false, message: "Tua sessão expirou — entra de novo." }, 401);
        }
        chatUserId = u.user.id;
        // Limite por PLANO: quem paga conversa mais. O trial dos 3 dias tem teto
        // menor — 156 pessoas já passaram por lá, e cada mensagem custa dinheiro.
        let limiteChat = Number(Deno.env.get("CHAT_LIMITE_TRIAL") ?? "10");
        try {
          const adminP = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
          const { data: prof } = await adminP.from("profiles")
            .select("plan_status,billing_exempt,is_demo").eq("user_id", chatUserId).maybeSingle();
          const pagante = !!prof && ((prof as any).billing_exempt || (prof as any).is_demo || (prof as any).plan_status === "active");
          if (pagante) limiteChat = Number(Deno.env.get("CHAT_LIMITE_PAGANTE") ?? "30");
        } catch { /* na dúvida, vale o limite menor */ }
        const { data: usage, error: usageErr } = await supa.rpc("bump_ai_usage", { p_feature: "chat", p_limit: limiteChat });
        if (usageErr) {
          return json({ success: false, message: "Deu um tropeço aqui, tenta de novo daqui a pouco." }, 503);
        }
        if ((usage as any)?.over) {
          return json({ success: true, message: "Mandou bem hoje! Você já usou bastante o mentor — amanhã ele volta com tudo. Bora vender." });
        }
      } catch (_e) {
        return json({ success: false, message: "Deu um tropeço aqui, tenta de novo daqui a pouco." }, 503);
      }
    }

    // ===== MEMÓRIA (Fase 1 do Agente): tudo que o mentor já aprendeu sobre ESTE vendedor =====
    let memFacts: { tipo: string; fato: string }[] = [];
    let memBlock = "";
    try {
      const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
      const { data: mem } = await admin
        .from("ai_memoria").select("tipo, fato")
        .eq("user_id", chatUserId).eq("ativo", true)
        .order("created_at", { ascending: false }).limit(40);
      memFacts = ((mem as any[]) || []).map((m) => ({ tipo: String(m.tipo), fato: String(m.fato) }));
      if (memFacts.length) {
        memBlock = "\n\nMEMÓRIA DESTE VENDEDOR (fatos que ELE te contou em conversas anteriores — use com naturalidade, personalize, e COBRE os combinados quando fizer sentido):\n" +
          memFacts.map((f) => `- [${f.tipo}] ${f.fato}`).join("\n");
      }
    } catch (e) { console.error("memoria load falhou", String(e).slice(0, 120)); }
    const fullCtx = userCtx + memBlock;

    // Ação pro app executar junto com a resposta (ex.: abrir o Estúdio com o briefing do adesivo).
    let acaoChat: unknown = null;

    // Depois de responder, aprende com a conversa (roda em segundo plano, não atrasa nada).
    const finishChat = async (replyIn: string) => {
      let reply = replyIn;
      // Rede de segurança: modelo reserva vazou JSON de adesivo no texto? Extrai o briefing
      // e GERA a arte de verdade (mesmo caminho da ferramenta) — a imagem sai no chat.
      if (!acaoChat) {
        const ext = extrairAdesivoDoTexto(reply);
        if (ext) {
          const out = await runTool("criar_adesivo", ext.dados, userSupa, chatUserId, reqAuthH) as { imagem_url?: string };
          if (out?.imagem_url) {
            acaoChat = { tipo: "adesivo_no_chat", url: out.imagem_url, dados: ext.dados };
            reply = ext.limpo || "Prontinho, tua arte saiu! Olha ela aí embaixo — e no botão dá pra colocar teu QR Pix real e baixar em alta.";
          } else {
            reply = "Fechei teu briefing certinho, mas a geração falhou agora — me manda um \"gera de novo\" que eu tento na hora.";
          }
        } else {
          // Não deu pra extrair briefing, mas tem cara de JSON de ferramenta? Limpa o lixo.
          const semLixo = limparJsonPerdido(reply);
          if (semLixo) reply = semLixo;
        }
      }
      // Arte gerada no chat: anexa o marcador que o app transforma em imagem na conversa.
      const acaoUrl = (acaoChat as { tipo?: string; url?: string } | null);
      if (acaoUrl?.tipo === "adesivo_no_chat" && acaoUrl.url) {
        reply = `${reply}\n\n[[adesivo:${acaoUrl.url}]]`;
      }
      try {
        const lastUser = String(messages[messages.length - 1]?.content ?? "").slice(0, 1200);
        const p = extractMemory(chatUserId, lastUser, reply.slice(0, 1200), memFacts.map((f) => f.fato));
        const er = (globalThis as any).EdgeRuntime;
        if (er?.waitUntil) er.waitUntil(p); else p.catch(() => {});
      } catch { /* noop */ }
      return json({ success: true, message: reply, ...(acaoChat ? { acao: acaoChat } : {}) });
    };

    // Cliente com o token do PRÓPRIO vendedor: as ferramentas do agente rodam com ele (RLS).
    const userSupa = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_ANON_KEY") ?? "", { global: { headers: { Authorization: reqAuthH } } });

    // ===== TEXTO: tenta CLAUDE (Anthropic) primeiro; cai no Cerebras/Gemini (gratis) se faltar chave/erro/credito. =====
    try {
      const akey = Deno.env.get("ANTHROPIC_API_KEY");
      if (akey) {
        // Conversa de MARCA/ADESIVO usa o Claude mais forte (Opus): criar nome e arte merece
        // o melhor modelo. O dia a dia do mentor segue no Sonnet (bem mais barato).
        const conversaTxt = messages.slice(-6).map((m: any) => String(m?.content ?? "")).join(" ").toLowerCase();
        const criativa = /adesivo|marca|logo|r[óo]tulo|criar nome|nome pra|nome para/.test(conversaTxt);
        const amodel = criativa
          ? (Deno.env.get("ANTHROPIC_MODEL_CRIATIVO") ?? "claude-opus-5")
          : (Deno.env.get("ANTHROPIC_MODEL") ?? "claude-sonnet-5");
        const ahist = messages.slice(-8).map((m: any) => ({
          role: m?.role === "assistant" ? "assistant" : "user",
          content: String(m?.content ?? "").slice(0, 2000),
        }));
        // Claude exige que a 1a mensagem seja do "user".
        while (ahist.length && ahist[0].role !== "user") ahist.shift();
        if (ahist.length) {
          // LOOP DE AGENTE: o Claude pode pedir ferramentas (consultar/agir) antes de responder.
          const aMessages: any[] = [...ahist];
          for (let rodada = 0; rodada < 4; rodada++) {
            // Instabilidade passageira (429/5xx/sobrecarga) NÃO derruba pro reserva:
            // tenta até 3 vezes antes de desistir. Erro de chave (401) desiste na hora.
            let aRes: Response | null = null;
            for (let tent = 0; tent < 3; tent++) {
              aRes = await fetch("https://api.anthropic.com/v1/messages", {
                method: "POST",
                headers: { "content-type": "application/json", "x-api-key": akey, "anthropic-version": "2023-06-01" },
                signal: AbortSignal.timeout(45000),
                body: JSON.stringify({
                  model: amodel,
                  // Sobra pro raciocinio interno do Opus (thinking) + a resposta.
                  max_tokens: 1600,
                  // NAO mandar "temperature": os modelos claude-sonnet-5/opus-5 rejeitam
                  // com 400 ("temperature is deprecated for this model"). Era ISSO que
                  // derrubava TODA conversa pro reserva gratuito (que inventava nome e
                  // escrevia JSON no chat em vez de gerar a arte de verdade).
                  // CACHE do prompt: o cérebro (parte fixa) é cacheado na Anthropic — corta
                  // ~85% dos tokens de entrada por mensagem. Menos estouro de limite de
                  // conta nova (429) e ~90% mais barato. Só o contexto do vendedor varia.
                  system: [
                    { type: "text", text: ORBIS_BRAIN + CEREBRAS_CHAT_EXTRA + AGENT_TOOLS_RULES, cache_control: { type: "ephemeral" } },
                    ...(fullCtx ? [{ type: "text", text: fullCtx }] : []),
                  ],
                  tools: AGENT_TOOLS,
                  messages: aMessages,
                }),
              });
              if (aRes.ok || ![429, 500, 502, 503, 529].includes(aRes.status)) break;
              console.error("Claude instável, tentando de novo", aRes.status);
              // 429 = limite por minuto: espera mais pra janela renovar antes de desistir.
              await new Promise((r) => setTimeout(r, (aRes.status === 429 ? 2500 : 700) * (tent + 1)));
            }
            if (!aRes || !aRes.ok) {
              const corpoErr = (await aRes?.text().catch(() => ""))?.slice(0, 400) ?? "";
              console.error("Claude chat erro", aRes?.status, corpoErr);
              // Gravador de diagnóstico: registra o motivo exato da queda pro reserva.
              try {
                const adminD = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
                await adminD.from("ai_diag").insert({ info: { onde: "claude_http", status: aRes?.status ?? null, corpo: corpoErr, modelo: amodel } });
              } catch { /* noop */ }
              break;
            }
            const aj = await aRes.json();
            if (aj?.stop_reason === "tool_use") {
              const usos = ((aj.content ?? []) as any[]).filter((b) => b?.type === "tool_use");
              aMessages.push({ role: "assistant", content: aj.content });
              const resultados: any[] = [];
              for (const tu of usos) {
                console.log("agente ferramenta:", tu.name);
                const out = await runTool(String(tu.name), (tu.input ?? {}) as Record<string, unknown>, userSupa, chatUserId, reqAuthH);
                if (String(tu.name) === "criar_adesivo" && (out as any)?.imagem_url) {
                  acaoChat = { tipo: "adesivo_no_chat", url: (out as any).imagem_url, dados: tu.input ?? {} };
                }
                resultados.push({ type: "tool_result", tool_use_id: tu.id, content: JSON.stringify(out).slice(0, 4000) });
              }
              aMessages.push({ role: "user", content: resultados });
              continue; // volta pro modelo com os dados reais
            }
            const atext = ((aj?.content ?? []).map((b: any) => b?.text || "").join("")).replace(/\*\*/g, "").trim();
            if (atext) return await finishChat(atext);
            break;
          }
          // A arte JÁ foi desenhada nesta rodada? Então nunca cai pro reserva: seria
          // jogar fora uma imagem que já custou geração do dia do vendedor.
          if (acaoChat) {
            return await finishChat("Prontinho, tua arte saiu! Olha ela aí embaixo — no botão dá pra colocar teu QR Pix real e baixar em alta. Se quiser mudar cor ou detalhe, é só falar.");
          }
        }
      }
    } catch (e) {
      console.error("Claude chat exceção (cai pro Cerebras)", e);
      try {
        const adminD = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
        await adminD.from("ai_diag").insert({ info: { onde: "claude_excecao", erro: String(e).slice(0, 300) } });
      } catch { /* noop */ }
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
            messages: [{ role: "system", content: ORBIS_BRAIN + fullCtx + CEREBRAS_CHAT_EXTRA }, ...hist],
            temperature: 0.8,
            max_tokens: 400,
            top_p: 0.95,
          }),
        });
        if (cRes.ok) {
          const cj = await cRes.json();
          const ctext = (cj?.choices?.[0]?.message?.content?.toString() ?? "").replace(/\*\*/g, "").trim();
          if (ctext) return await finishChat(ctext);
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
      systemInstruction: { parts: [{ text: ORBIS_BRAIN + fullCtx }] },
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

    return await finishChat(text);
  } catch (e) {
    console.error("bright-action erro", e);
    return json({ success: false, error: "erro_interno" });
  }
});
