// Orbis — verificar-deposito (Carteira X1)
// O usuario faz o Pix pra conta do Orbis e sobe o COMPROVANTE. A IA le e valida:
//   - e um comprovante de Pix de verdade, pro destino certo
//   - extrai valor, data/hora, remetente e o ID unico da transacao (E2E)
// Travas anti-burla (no servidor):
//   - E2E unico: o MESMO comprovante nunca credita 2x (indice unico no banco)
//   - destino tem que ser a chave do Orbis; Pix com mais de 48h nao credita sozinho
//   - teto de credito automatico (DEPOSITO_AUTO_MAX, padrao R$100) — acima disso vai
//     pra fila de revisao do admin; teto de envios/dia (bump_ai_usage)
//   - tudo que a IA nao tiver certeza vai pra revisao, nunca credita no escuro
// O credito automatico e PROVISORIO ate a conferencia diaria com o extrato do banco
// (admin pode estornar via x1_admin_estornar_deposit).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function buildPrompt(chaveOrbis: string): string {
  return `Voce e um auditor do app Orbis. Recebe a imagem ou PDF de um COMPROVANTE DE PIX brasileiro (recibo de transferencia enviada).

VALIDE E EXTRAIA (seja rigoroso — na duvida, marque false/vazio):
- "e_comprovante": true SO se for claramente um comprovante/recibo de Pix ENVIADO (nao extrato, nao print de conversa, nao foto aleatoria).
- "valor": o valor transferido em reais (numero).
- "data_hora": data e hora da transacao no formato ISO "YYYY-MM-DDTHH:MM:SS" (fuso do comprovante). Se nao der pra ler, "".
- "e2e": o ID da transacao / ID E2E — codigo que comeca com a letra E seguida de ~31 letras/numeros (ex: E12345678202607030001234567890AB). Procure por "ID da transacao", "E2E", "Identificador". Se nao aparecer, "".
- "remetente": nome de quem ENVIOU o Pix.
- "destinatario": nome de quem RECEBEU.
- "chave_destino": a chave Pix de destino mostrada (se aparecer; pode vir mascarada).
- "destino_confere": true SO se a chave de destino (ou o CNPJ/nome do recebedor) bater com esta chave do Orbis: "${chaveOrbis}". Mascaras parciais que sejam compativeis contam como true; destino claramente diferente = false.

ATENCAO ANTI-FRAUDE: se houver QUALQUER sinal de edicao/montagem (fontes desalinhadas, valores borrados, layout estranho pro banco em questao), marque "suspeito": true e explique em "motivo_suspeita".

Responda SOMENTE um JSON valido:
{"e_comprovante":true,"valor":10.0,"data_hora":"2026-07-03T00:17:00","e2e":"E...","remetente":"Nome","destinatario":"Nome","chave_destino":"...","destino_confere":true,"suspeito":false,"motivo_suspeita":""}`;
}

async function callClaude(key: string, model: string, prompt: string, fileB64: string, mime: string): Promise<string> {
  const isPdf = mime.includes("pdf");
  const mediaType = isPdf ? "application/pdf" : (["image/jpeg","image/png","image/gif","image/webp"].includes(mime) ? mime : "image/jpeg");
  const filePart = isPdf
    ? { type: "document", source: { type: "base64", media_type: mediaType, data: fileB64 } }
    : { type: "image", source: { type: "base64", media_type: mediaType, data: fileB64 } };
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    signal: AbortSignal.timeout(40000),
    body: JSON.stringify({ model, max_tokens: 800, messages: [{ role: "user", content: [{ type: "text", text: prompt }, filePart] }] }),
  });
  if (!res.ok) throw new Error(`claude_${res.status}`);
  const data = await res.json();
  return (data?.content ?? []).map((b: any) => b?.text || "").join("").trim();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const json = (obj: unknown, status = 200) =>
    new Response(JSON.stringify(obj), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const body = await req.json().catch(() => ({}));
    const fileB64 = typeof body?.file === "string" ? body.file.replace(/^data:[^;]+;base64,/, "") : "";
    const mime = typeof body?.mime === "string" ? body.mime : "image/jpeg";
    if (!fileB64) return json({ error: "sem_arquivo" }, 400);

    // Usuario logado (obrigatorio)
    const authHeader = req.headers.get("Authorization") ?? "";
    const supa = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_ANON_KEY") ?? "", { global: { headers: { Authorization: authHeader } } });
    const { data: u } = await supa.auth.getUser();
    const uid = u?.user?.id;
    if (!uid) return json({ error: "sem_login", dica: "Faca login de novo." }, 401);

    // Teto de envios por dia (protege gasto de IA e spam de tentativas)
    try {
      const { data: usage } = await supa.rpc("bump_ai_usage", { p_feature: "deposito", p_limit: 5 });
      if ((usage as any)?.over) return json({ error: "limite_diario", dica: "Muitas tentativas hoje. Fala com o admin." }, 200);
    } catch { /* segue */ }

    const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
    const { data: st } = await admin.from("x1_settings").select("pix_account").eq("id", 1).maybeSingle();
    const chaveOrbis = ((st as any)?.pix_account ?? "").toString();
    if (!chaveOrbis) return json({ error: "sem_chave_configurada", dica: "Admin precisa configurar a chave Pix do X1." }, 200);

    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!anthropicKey) return json({ error: "sem_chave_ia" }, 500);
    const model = Deno.env.get("ANTHROPIC_MODEL") ?? "claude-haiku-4-5-20251001";

    let text = "";
    try {
      text = await callClaude(anthropicKey, model, buildPrompt(chaveOrbis), fileB64, mime);
    } catch (e) {
      return json({ error: "leitura_indisponivel", dica: "Tenta de novo em instantes." }, 503);
    }
    let p: any = null;
    try { p = JSON.parse(text); } catch { const m = text.match(/\{[\s\S]*\}/); if (m) { try { p = JSON.parse(m[0]); } catch { /* noop */ } } }
    if (!p) return json({ error: "leitura_falhou", dica: "Manda uma foto mais nitida do comprovante." }, 200);

    if (p.e_comprovante !== true) {
      return json({ error: "nao_e_comprovante", dica: "Isso nao parece um comprovante de Pix. Manda o recibo da transferencia (aquele que o banco mostra depois de enviar)." }, 200);
    }
    const valor = Math.round((Number(p.valor) || 0) * 100) / 100;
    if (valor <= 0) return json({ error: "valor_invalido", dica: "Nao consegui ler o valor. Manda uma foto mais nitida." }, 200);

    const e2e = typeof p.e2e === "string" && /^E[0-9A-Za-z]{25,40}$/.test(p.e2e.trim()) ? p.e2e.trim().toUpperCase() : "";
    const dataHoraOk = typeof p.data_hora === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(p.data_hora);
    const dataPix = dataHoraOk ? new Date(p.data_hora + (p.data_hora.length <= 19 ? "-03:00" : "")) : null;
    const idadeHoras = dataPix ? (Date.now() - dataPix.getTime()) / 3600000 : 999;
    const AUTO_MAX = Number(Deno.env.get("DEPOSITO_AUTO_MAX") ?? "100");

    // Por que NAO creditar sozinho? (vai pra fila do admin em vez de rejeitar)
    const motivos: string[] = [];
    if (!e2e) motivos.push("sem ID E2E legivel");
    if (p.destino_confere !== true) motivos.push("destino nao confere com a chave do Orbis");
    if (p.suspeito === true) motivos.push(`IA suspeitou: ${String(p.motivo_suspeita ?? "").slice(0, 120)}`);
    if (!dataPix) motivos.push("sem data/hora legivel");
    else if (idadeHoras > 48) motivos.push("Pix com mais de 48h");
    else if (idadeHoras < -1) motivos.push("data futura (?)");
    if (valor > AUTO_MAX) motivos.push(`acima do teto automatico (R$${AUTO_MAX})`);

    const autoCredita = motivos.length === 0;

    // Grava o pedido — o indice unico do E2E barra comprovante repetido AQUI.
    const { data: ins, error: insErr } = await admin.from("x1_deposit_requests").insert({
      user_id: uid,
      valor,
      e2e_id: e2e || null,
      data_pix: dataPix ? dataPix.toISOString() : null,
      remetente: String(p.remetente ?? "").slice(0, 80) || null,
      status: autoCredita ? "creditado" : "pendente_revisao",
      motivo: autoCredita ? null : motivos.join("; "),
      motor: "claude",
    }).select("id").single();
    if (insErr) {
      if ((insErr as any).code === "23505") {
        return json({ error: "comprovante_ja_usado", dica: "Esse comprovante ja foi usado pra creditar um deposito. Cada Pix vale uma vez so. 🚨" }, 200);
      }
      console.error("deposit insert erro", insErr.message);
      return json({ error: "erro_interno" }, 500);
    }

    if (autoCredita) {
      const { error: rpcErr } = await admin.rpc("x1_wallet_apply", {
        p_user: uid, p_amount: valor, p_tipo: "deposito", p_x1: null,
        p_notes: `Deposito via comprovante (E2E ${e2e.slice(0, 12)}…)`, p_by: null,
      });
      if (rpcErr) {
        console.error("deposit credit erro", rpcErr.message);
        await admin.from("x1_deposit_requests").update({ status: "pendente_revisao", motivo: "falha ao creditar — revisar" }).eq("id", (ins as any).id);
        return json({ ok: true, status: "pendente_revisao", valor, dica: "Comprovante ok, mas o credito vai passar pelo admin." });
      }
      return json({ ok: true, status: "creditado", valor, dica: `R$ ${valor.toFixed(2)} caiu na sua carteira! ⚔️` });
    }

    return json({ ok: true, status: "pendente_revisao", valor, motivos, dica: "Comprovante recebido! Vai passar pela conferencia do admin antes de creditar (normalmente rapidinho)." });
  } catch (e) {
    console.error("verificar-deposito excecao", e);
    return json({ error: "erro_interno" }, 500);
  }
});
