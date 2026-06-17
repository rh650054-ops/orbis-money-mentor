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

    const { messages, context } = await req.json();

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

    const systemPrompt = brain + (
      userContext.trim().length > 0
        ? `\n\n# CONTEXTO AO VIVO DESTE VENDEDOR\nUse pra personalizar. Converta dinheiro em número de vendas sempre que der.\n${userContext.trim()}`
        : `\n\n# CONTEXTO\nSem dados recentes agora. Dê conselho prático de rua e puxe ele pra ação.`
    );

    // ---------------- Claude (Anthropic) ----------------
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) {
      throw new Error("ANTHROPIC_API_KEY não está configurada no backend. Adicione a variável no painel do Supabase.");
    }

    const model = Deno.env.get("ORBIS_CHAT_MODEL") ?? "claude-sonnet-4-6";

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
        system: systemPrompt,
        messages: sanitizedMessages.filter((m: { role: string }) => m.role !== "system"),
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
    const assistantMessage = aiJson.content?.[0]?.text;
    if (!assistantMessage || typeof assistantMessage !== "string") {
      console.error("Resposta inesperada da Anthropic API:", JSON.stringify(aiJson).substring(0, 200));
      throw new Error("A IA retornou uma resposta inválida");
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
