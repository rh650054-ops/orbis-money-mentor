// Vant — defcon-coach
// Reescreve a mensagem do coach de conversão com "voz da rua".
// 26/11/2026 (Rick): só dois provedores — Anthropic primeiro, OpenAI de reserva. Gemini e Cerebras
// saíram (Cerebras sem cota, Gemini no plano gratuito: o coach caía sempre no template sem ninguém ver).
// Recebe a mensagem-template (que já traz os números) e devolve uma versão mais
// natural e motivadora MANTENDO os números. Se faltar chave/cota ou der qualquer
// erro, devolve o próprio template — nunca quebra e nunca deixa o vendedor sem mensagem.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.0";
import { permissaoIaNoServidor } from "../_shared/consentimento-ia.ts";
import { pedirClaude } from "../_shared/ia-claude.ts";
import { pedirOpenAi } from "../_shared/ia-openai.ts";

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

    // Segurança (21/10/2026): só vendedor logado e com limite por dia — antes qualquer um
    // na internet podia usar a IA de graça. Sem login ou acima do limite: devolve o próprio
    // template (o vendedor continua vendo a mensagem, só que sem a reescrita).
    const semIA = () => new Response(JSON.stringify({ message: template, source: "template" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return semIA();
    const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await supa.auth.getUser();
    if (!user) return semIA();
    // no AI permission → the plain template, never sent to the AI (_shared/consentimento-ia.ts)
    const permissao = await permissaoIaNoServidor(authHeader);
    if (!permissao.permitida) return semIA();
    const { data: uso, error: usoErr } = await supa.rpc("bump_ai_usage", { p_feature: "defcon_coach", p_limit: 60 });
    if (usoErr || (uso as { over?: boolean } | null)?.over) return semIA();
    if (template.length > 600) template = template.slice(0, 600);

    const prompt =
      `Você é o "mentor de rua" do app Vant, falando com um vendedor ambulante brasileiro DURANTE o corre de vendas.\n` +
      `Reescreva a mensagem abaixo em no máximo 2 frases bem curtas, em voz da rua: direta, de parceiro, motivadora, sem ser fofa nem corporativa.\n` +
      `REGRAS: mantenha EXATAMENTE os mesmos números da mensagem; não invente dados; não use aspas; no máximo 1 emoji; foque em ação.\n` +
      (situation ? `Situação: ${situation}. ` : "") +
      (avgApproachesPerSale ? `Média dele: 1 venda a cada ${avgApproachesPerSale} abordagens. ` : "") +
      `Hoje: ${dayApproaches} abordagens, ${daySales} vendas.\n\n` +
      `Mensagem original:\n${template}\n\nReescreva:`;

    // 1) Anthropic (Claude) — tenta primeiro; falha é registrada no log só com o código HTTP
    const doClaude = await pedirClaude({ quem: "defcon-coach", user: prompt, maxTokens: 120, timeoutMs: 7000, temperature: 0.95 });
    if (doClaude) {
      return new Response(JSON.stringify({ message: doClaude.replace(/^["']|["']$/g, ""), source: "claude" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2) OpenAI (reserva) — só pra quem autorizou o texto que cita a OpenAI como reserva
    if (permissao.textoAtual) {
      const doOpenAi = await pedirOpenAi({ quem: "defcon-coach", user: prompt, maxTokens: 120, timeoutMs: 7000, temperature: 0.95 });
      if (doOpenAi) {
        return new Response(JSON.stringify({ message: doOpenAi.replace(/^["']|["']$/g, ""), source: "openai" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // 3) nenhuma IA respondeu: a mensagem pronta (o coach nunca quebra o DEFCON)
    return new Response(JSON.stringify({ message: template, source: "template_fallback" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (_e) {
    // Qualquer erro -> devolve o template recebido (nunca quebra o DEFCON)
    return new Response(JSON.stringify({ message: template, source: "error_fallback" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
