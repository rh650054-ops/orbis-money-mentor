// Orbis — defcon-coach
// Reescreve a mensagem do coach de conversão com "voz da rua" usando Gemini Flash.
// Recebe a mensagem-template (que já traz os números) e devolve uma versão mais
// natural e motivadora MANTENDO os números. Se faltar chave/cota ou der qualquer
// erro, devolve o próprio template — nunca quebra e nunca deixa o vendedor sem mensagem.

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") ?? "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  let template = "";
  try {
    const body = await req.json();
    template = (body?.template ?? "").toString();
    const situation = (body?.situation ?? "").toString();      // ex: "dia_ruim" | "dia_bom" | "seca" | "marco"
    const dayApproaches = Number(body?.dayApproaches ?? 0);
    const daySales = Number(body?.daySales ?? 0);
    const avgApproachesPerSale = Number(body?.avgApproachesPerSale ?? 0);

    if (!template.trim()) {
      return new Response(JSON.stringify({ message: "" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const model = Deno.env.get("GEMINI_MODEL") ?? "gemini-flash-latest";
    const prompt =
      `Você é o "mentor de rua" do app Orbis, falando com um vendedor ambulante brasileiro DURANTE o corre de vendas.\n` +
      `Reescreva a mensagem abaixo em no máximo 2 frases bem curtas, em voz da rua: direta, de parceiro, motivadora, sem ser fofa nem corporativa.\n` +
      `REGRAS: mantenha EXATAMENTE os mesmos números da mensagem; não invente dados; não use aspas; no máximo 1 emoji; foque em ação.\n` +
      (situation ? `Situação: ${situation}. ` : "") +
      (avgApproachesPerSale ? `Média dele: 1 venda a cada ${avgApproachesPerSale} abordagens. ` : "") +
      `Hoje: ${dayApproaches} abordagens, ${daySales} vendas.\n\n` +
      `Mensagem original:\n${template}\n\nReescreva:`;

    // 1) Cerebras (texto, grátis 1M tokens/dia) — tenta primeiro
    try {
      const ckey = Deno.env.get("CEREBRAS_API_KEY");
      if (ckey) {
        const cmodel = Deno.env.get("CEREBRAS_MODEL") ?? "llama-3.3-70b";
        const cRes = await fetch("https://api.cerebras.ai/v1/chat/completions", {
          method: "POST",
          headers: { "content-type": "application/json", "authorization": `Bearer ${ckey}` },
          signal: AbortSignal.timeout(7000),
          body: JSON.stringify({
            model: cmodel,
            messages: [{ role: "user", content: prompt }],
            temperature: 0.95,
            max_tokens: 90,
          }),
        });
        if (cRes.ok) {
          const cj = await cRes.json();
          const ct = cj?.choices?.[0]?.message?.content?.toString().trim();
          if (ct && ct.length > 0) {
            return new Response(JSON.stringify({ message: ct.replace(/^["']|["']$/g, ""), source: "cerebras" }), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
        }
      }
    } catch (_e) { /* cai pro Gemini */ }

    // 2) Gemini (reserva) — se não tiver chave, usa o template
    const key = Deno.env.get("GEMINI_API_KEY");
    if (!key) {
      return new Response(JSON.stringify({ message: template, source: "template" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ctrl = AbortSignal.timeout(7000);
    const gRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: ctrl,
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.95, maxOutputTokens: 90, topP: 0.95 },
        }),
      },
    );

    if (!gRes.ok) {
      return new Response(JSON.stringify({ message: template, source: "template_fallback" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await gRes.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.toString().trim();
    const message = text && text.length > 0 ? text.replace(/^["']|["']$/g, "") : template;

    return new Response(JSON.stringify({ message, source: text ? "ai" : "template" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (_e) {
    // Qualquer erro -> devolve o template recebido (nunca quebra o DEFCON)
    return new Response(JSON.stringify({ message: template, source: "error_fallback" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
