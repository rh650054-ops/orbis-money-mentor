// Orbis — verificar-extrato
// A IA le um EXTRATO (print ou PDF) e separa as VENDAS (dinheiro que ENTROU/foi recebido)
// das DESPESAS e dos itens SUSPEITOS DE FRAUDE (auto-transferencia, duplicata).
// PRIMARIO: Claude (visao). FALLBACK: Gemini.
// Recebe { file: base64, mime, salvar?, dia?, tipo?, modo? }.
// modo "dia" (padrao): audita SO o dia informado.
// modo "mes": le o extrato do MES e PREENCHE os dias esquecidos — so dias do mes
//   atual, ate hoje, em que o vendedor INICIOU O DEFCON, e que ainda nao tem extrato.
// Devolve (dia): { ok, motor, salvo, dia, tipo, vendas[], suspeitas[], total_vendas, total_ignorado, qtd_vendas }.
// Devolve (mes): { ok, motor, modo, dias_salvos[], dias_pulados[], total_salvo }.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Monta o prompt com o nome do vendedor (pra IA pegar auto-transferencia) e o DIA auditado.
function buildPrompt(nome: string, tipo: string, dia: string): string {
  const hint = nome ? `\nDica: o vendedor (titular) provavelmente se chama "${nome}".` : "";
  const esperado = tipo === "cartao"
    ? "COMPROVANTE DAS VENDAS NO CARTAO — pode ser o relatorio/print da MAQUININHA (Stone, PagSeguro, Mercado Pago, Cielo, Ton, SumUp, InfinitePay, etc.) OU QUALQUER extrato/print onde aparecam os recebimentos do cartao (inclusive um extrato de banco). Liste as ENTRADAS de venda no cartao."
    : "EXTRATO DO BANCO / APP DE CONTA (onde caem os Pix recebidos) — mostra Pix recebidos, saldo e transacoes da conta.";
  return `Voce e um auditor financeiro do app Orbis (vendedores de rua). Recebe a imagem ou PDF de um documento brasileiro.

CLASSIFICACAO (faca isto ANTES de tudo): o usuario esta enviando isto como o ${esperado}
Classifique o documento no campo "documento":
- "banco" = extrato/app de BANCO ou conta de pagamento (Pix recebidos, saldo, transacoes da conta).
- "cartao" = extrato/relatorio de MAQUININHA/adquirente (vendas no cartao, taxas, previsao de recebiveis).
- "outro" = qualquer outra coisa (foto aleatoria, UM comprovante unico, print sem lista de transacoes, algo que NAO e um extrato).
Seja honesto na classificacao: se nao for claramente um extrato do tipo certo, marque o que realmente e.

DIA AUDITADO: ${dia}
O extrato pode cobrir UM dia, VARIOS dias ou o MES INTEIRO (alguns bancos nao deixam
pedir extrato de um dia so). Voce esta auditando SOMENTE o dia ${dia}:
- Liste APENAS transacoes cuja data de LANCAMENTO seja EXATAMENTE ${dia}.
- IGNORE COMPLETAMENTE as transacoes dos outros dias (nao entram em vendas, nem em
  suspeitas, nem em nenhum total). Faca de conta que nao existem.
- "periodo_inicio" e "periodo_fim" = primeira e ultima data de transacao visiveis no
  extrato (YYYY-MM-DD), pra sabermos qual intervalo o arquivo cobre.
- "cobre_dia" = true se o dia ${dia} estiver DENTRO do periodo do extrato (mesmo que
  nao tenha nenhuma venda nesse dia); false se o extrato nao alcancar esse dia.

Tarefa: listar APENAS as VENDAS do dia ${dia} = dinheiro que ENTROU (foi RECEBIDO pelo vendedor). IGNORE despesas/saidas E itens suspeitos de fraude.

CONTA como venda (dinheiro que ENTROU):
- "Pix recebido", "Entrada PIX", "Credito", "Recebimento"
- Venda no cartao recebida (credito/debito) que CAIU pra ele
- Qualquer valor de ENTRADA (positivo, recebido)

NAO CONTA (despesa/saida do vendedor):
- "Debito de Cartao" (compras em lojas, ex: ATACADAO, MERCADO), "Saida PIX", "Pix enviado", "Pagamento", "Transferencia enviada"
- Qualquer valor NEGATIVO ou de saida

ANTIFRAUDE — SO estas 3 coisas NAO contam. Coloque em "suspeitas" com um "motivo" CURTO e EXATO (dizendo o valor e por que nao passou):
- AUTO-TRANSFERENCIA: Pix recebido cujo REMETENTE e o PROPRIO titular (mesmo nome ou muito parecido${nome ? `, inclusive parecido com "${nome}"` : ""}) — o vendedor mandou pra si mesmo. motivo: "voce mandou pra voce mesmo".
- PIX DE R$100 OU MAIS: qualquer Pix de valor >= R$100 NAO conta (venda de rua e de ticket baixo). motivo: "Pix de R$X: valores de R$100 ou mais nao contam".
- VARIOS PIX REPETIDOS DA MESMA PESSOA: se o MESMO remetente aparecer com 3 OU MAIS Pix repetidos (valores iguais/colados), conte SO O PRIMEIRO; os repetidos vao pra suspeitas. motivo: "Pix repetido de [nome]: so o 1o conta". OBS: 1 ou 2 Pix da mesma pessoa PODE ser cliente de verdade — so marque a partir do 3o.
REGRA DE OURO: fora dessas 3 coisas, TUDO que ENTROU conta como venda. Vendedor de rua recebe MUITOS Pix pequenos de gente diferente — isso e NORMAL e TEM que contar. Nao invente outros motivos pra recusar.
${hint}

total_vendas = soma SO das vendas legitimas do dia ${dia} (sem despesa e sem suspeita).
total_ignorado = soma de despesas + suspeitas do dia ${dia}.

data_dia = "${dia}" se cobre_dia for true; senao "". Use a data de LANCAMENTO/transacao, NAO a data contabil.

Responda SOMENTE um JSON valido (sem texto fora, sem markdown):
{"documento":"banco","cobre_dia":true,"periodo_inicio":"2026-07-01","periodo_fim":"2026-07-31","vendas":[{"descricao":"de quem/origem","valor":35.0}],"suspeitas":[{"descricao":"origem","valor":50.0,"motivo":"auto-transferencia"}],"total_vendas":387.0,"total_ignorado":244.45,"qtd_vendas":18,"data_dia":"${dia}"}`;
}

// Prompt do modo MES: a IA separa as vendas POR DIA, dentro da janela pedida.
function buildPromptMes(nome: string, tipo: string, iniJanela: string, fimJanela: string): string {
  const hint = nome ? `\nDica: o vendedor (titular) provavelmente se chama "${nome}".` : "";
  const esperado = tipo === "cartao"
    ? "COMPROVANTE DAS VENDAS NO CARTAO — relatorio/print da maquininha OU qualquer extrato/print onde aparecam os recebimentos do cartao (inclusive extrato de banco)"
    : "EXTRATO DO BANCO / APP DE CONTA (onde caem os Pix recebidos)";
  return `Voce e um auditor financeiro do app Orbis (vendedores de rua). Recebe a imagem ou PDF de um documento brasileiro.

CLASSIFICACAO (faca isto ANTES de tudo): o usuario esta enviando isto como o ${esperado}.
Classifique no campo "documento": "banco", "cartao" ou "outro" (mesmos criterios de um extrato real; foto aleatoria/comprovante unico = "outro"). Seja honesto.

MODO MES: este extrato cobre VARIOS dias. Separe as VENDAS POR DIA.
- Considere SOMENTE dias entre ${iniJanela} e ${fimJanela} (inclusive). Ignore transacoes fora dessa janela.
- Para CADA dia dessa janela que aparecer no extrato COM entrada de dinheiro, crie um item em "dias".
- Use a data de LANCAMENTO/transacao, NAO a data contabil.

VENDA (conta) = dinheiro que ENTROU: "Pix recebido", "Entrada PIX", "Credito", "Recebimento", venda no cartao que caiu pra ele.
NAO CONTA = saida/despesa: "Debito de Cartao", "Saida PIX", "Pix enviado", "Pagamento", "Transferencia enviada", valores negativos.

ANTIFRAUDE — SO estas 3 coisas vao em "suspeitas" do dia (com "motivo" curto e EXATO) e NAO somam:
- AUTO-TRANSFERENCIA: Pix recebido cujo remetente e o PROPRIO titular (mesmo nome ou muito parecido${nome ? `, inclusive parecido com "${nome}"` : ""}). motivo: "voce mandou pra voce mesmo".
- PIX DE R$100 OU MAIS: Pix de valor >= R$100 NAO conta. motivo: "Pix de R$X: valores de R$100 ou mais nao contam".
- VARIOS PIX REPETIDOS DA MESMA PESSOA: mesmo remetente com 3+ Pix repetidos -> conta SO O PRIMEIRO. motivo: "Pix repetido de [nome]: so o 1o conta". (1 ou 2 da mesma pessoa PODE ser cliente real — so a partir do 3o.)
REGRA DE OURO: fora dessas 3, TUDO que entrou conta. Muitos Pix pequenos de gente diferente e NORMAL e TEM que contar.
${hint}

"periodo_inicio"/"periodo_fim" = primeira e ultima data de transacao visiveis no extrato (YYYY-MM-DD).

Responda SOMENTE um JSON valido (sem texto fora, sem markdown):
{"documento":"banco","periodo_inicio":"2026-07-01","periodo_fim":"2026-07-31","dias":[{"data":"2026-07-03","vendas":[{"descricao":"de quem/origem","valor":35.0}],"suspeitas":[{"descricao":"origem","valor":50.0,"motivo":"auto-transferencia"}]}]}`;
}

// Teto: Pix de R$100 ou mais NAO conta (venda de rua e de ticket baixo).
const TETO_PIX = 100;

// Backstop no servidor (alem da IA): mesmo remetente + mesmo valor repetido 3x ou mais
// = alguem inflando. Conta SO O PRIMEIRO; os repetidos viram suspeita com motivo exato.
function separaRepetidos(vendas: any[]): { limpas: any[]; repetidas: any[] } {
  const norm = (v: any) =>
    String(v?.descricao ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().slice(0, 24) +
    "|" + Math.round((Number(v?.valor) || 0) * 100);
  const counts = new Map<string, number>();
  for (const v of vendas) { const k = norm(v); counts.set(k, (counts.get(k) || 0) + 1); }
  const seen = new Map<string, number>();
  const limpas: any[] = [];
  const repetidas: any[] = [];
  for (const v of vendas) {
    const k = norm(v);
    if ((counts.get(k) || 0) >= 3) {
      const n = (seen.get(k) || 0) + 1; seen.set(k, n);
      if (n === 1) { limpas.push(v); continue; }
      const quem = String(v?.descricao ?? "mesma pessoa").slice(0, 30);
      repetidas.push({ ...v, motivo: `Pix repetido de ${quem}: so o 1o conta (${n}o de varios iguais)` });
    } else {
      limpas.push(v);
    }
  }
  return { limpas, repetidas };
}

// ---- Claude (primario): le imagem ou PDF e devolve o texto (JSON) ----
async function callClaude(key: string, model: string, prompt: string, fileB64: string, mime: string, maxTokens = 1800): Promise<string> {
  const isPdf = mime.includes("pdf");
  const mediaType = isPdf
    ? "application/pdf"
    : (["image/jpeg", "image/png", "image/gif", "image/webp"].includes(mime) ? mime : "image/jpeg");
  const filePart = isPdf
    ? { type: "document", source: { type: "base64", media_type: mediaType, data: fileB64 } }
    : { type: "image", source: { type: "base64", media_type: mediaType, data: fileB64 } };

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    // Extrato do mes inteiro pode ser um PDF grande — folga maior de tempo.
    signal: AbortSignal.timeout(60000),
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      messages: [{ role: "user", content: [{ type: "text", text: prompt }, filePart] }],
    }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    console.error("Claude extrato erro", res.status, t.slice(0, 200));
    throw new Error(`claude_${res.status}`);
  }
  const data = await res.json();
  return (data?.content ?? []).map((b: any) => b?.text || "").join("").trim();
}

// ---- Gemini (fallback): varios modelos em ordem, desvia do que estiver lotado ----
async function callGemini(key: string, prompt: string, fileB64: string, mime: string): Promise<string> {
  const models = (Deno.env.get("GEMINI_VISION_MODELS") ?? "gemini-2.0-flash,gemini-2.5-flash,gemini-flash-latest,gemini-1.5-flash")
    .split(",").map((s) => s.trim()).filter(Boolean);
  const reqBody = JSON.stringify({
    contents: [{ parts: [{ text: prompt }, { inlineData: { mimeType: mime, data: fileB64 } }] }],
    generationConfig: { temperature: 0, responseMimeType: "application/json" },
  });
  for (const m of models) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${key}`;
    for (let attempt = 1; attempt <= 2; attempt++) {
      let r: Response;
      try {
        r = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: AbortSignal.timeout(35000),
          body: reqBody,
        });
      } catch (e) {
        console.error("Gemini extrato fetch erro", m, String(e).slice(0, 150));
        break;
      }
      if (r.ok) {
        const data = await r.json();
        return data?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text || "").join("") ?? "";
      }
      const errTxt = await r.text().catch(() => "");
      console.error("Gemini extrato erro", m, r.status, errTxt.slice(0, 200));
      if (r.status === 400 || r.status === 404) break;
      if (attempt < 2) await new Promise((res2) => setTimeout(res2, 1500));
    }
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
    const salvar = body?.salvar === true;
    const diaValido = typeof body?.dia === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.dia);
    const dia = diaValido ? body.dia : new Date().toISOString().slice(0, 10);
    const tipo = body?.tipo === "cartao" ? "cartao" : "pix";
    const modo = body?.modo === "mes" ? "mes" : "dia";
    if (!fileB64) return json({ error: "sem_arquivo" }, 400);

    // Auth: pega o usuario + nickname (pra IA detectar auto-transferencia).
    let supa: ReturnType<typeof createClient> | null = null;
    let uid: string | null = null;
    let nome = "";
    const authHeader = req.headers.get("Authorization") ?? "";
    if (authHeader) {
      try {
        supa = createClient(
          Deno.env.get("SUPABASE_URL") ?? "",
          Deno.env.get("SUPABASE_ANON_KEY") ?? "",
          { global: { headers: { Authorization: authHeader } } },
        );
        const { data: u } = await supa.auth.getUser();
        uid = u?.user?.id ?? null;
        if (uid) {
          const { data: prof } = await supa.from("public_profiles").select("nickname").eq("user_id", uid).maybeSingle();
          nome = ((prof as any)?.nickname ?? "").toString().trim();
        }
      } catch { /* best-effort */ }
    }

    // Trava de uso: teto de extratos por dia (protege o gasto da IA).
    if (supa && uid) {
      try {
        const { data: usage } = await supa.rpc("bump_ai_usage", { p_feature: "extrato", p_limit: 6 });
        if ((usage as any)?.over) {
          return json({ error: "limite_diario", dica: "Você já enviou bastante extrato hoje. Volta amanhã." }, 200);
        }
      } catch { /* deixa passar se a trava falhar */ }
    }

    // Janela do modo MES: do dia 1 do mes atual (fuso BR) ate hoje.
    const hojeBR = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
    const iniJanela = `${hojeBR.slice(0, 7)}-01`;

    const prompt = modo === "mes"
      ? buildPromptMes(nome, tipo, iniJanela, hojeBR)
      : buildPrompt(nome, tipo, dia);
    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
    const geminiKey = Deno.env.get("GEMINI_API_KEY");
    const model = Deno.env.get("ANTHROPIC_MODEL") ?? "claude-haiku-4-5-20251001";
    const maxTokens = modo === "mes" ? 8000 : 1800;

    let text = "";
    let motor = "";
    let lastErr = "";

    if (anthropicKey) {
      try {
        text = await callClaude(anthropicKey, model, prompt, fileB64, mime, maxTokens);
        motor = "claude";
      } catch (e) {
        lastErr = String((e as Error)?.message || e);
      }
    }
    if (!text && geminiKey) {
      try {
        text = await callGemini(geminiKey, prompt, fileB64, mime);
        motor = "gemini";
      } catch (e) {
        lastErr = String((e as Error)?.message || e);
      }
    }

    if (!text) {
      if (!anthropicKey && !geminiKey) return json({ error: "sem_chave_ia" }, 500);
      return json({ error: lastErr || "leitura_indisponivel", dica: "tente de novo em instantes" }, 503);
    }

    let parsed: any = null;
    try {
      parsed = JSON.parse(text);
    } catch {
      const m = text.match(/\{[\s\S]*\}/);
      if (m) { try { parsed = JSON.parse(m[0]); } catch { /* noop */ } }
    }
    if (!parsed) return json({ error: "leitura_falhou", raw: text.slice(0, 400) }, 422);

    // ===== MODO MES: preenche os dias esquecidos do mes =====
    // So salva dias que: (1) estao no mes atual ate hoje; (2) o vendedor INICIOU O
    // DEFCON naquele dia; (3) ainda NAO tem extrato enviado (nao sobrescreve).
    if (modo === "mes") {
      const documentoMes = typeof parsed.documento === "string" ? parsed.documento.toLowerCase() : "";
      // Pix precisa ser banco. Cartao aceita de qualquer lugar; so barra foto aleatoria.
      if (documentoMes === "outro" || documentoMes === "") {
        return json({ error: "documento_invalido", dica: "Esse arquivo nao parece um extrato. Manda o extrato certo." }, 200);
      }
      if (tipo === "pix" && documentoMes !== "banco") {
        return json({ error: "documento_invalido", dica: "Esse arquivo nao parece o extrato do banco (onde caem os Pix)." }, 200);
      }
      if (!uid || !supa) return json({ error: "sem_login", dica: "Faca login de novo e tente outra vez." }, 200);

      const isDate = (s: unknown) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
      const diasArr = Array.isArray(parsed.dias) ? parsed.dias : [];
      const candidatos = diasArr
        .filter((d: any) => isDate(d?.data) && d.data >= iniJanela && d.data <= hojeBR)
        .map((d: any) => ({
          data: d.data as string,
          vendas: Array.isArray(d.vendas) ? d.vendas : [],
          suspeitas: Array.isArray(d.suspeitas) ? d.suspeitas : [],
        }));
      if (candidatos.length === 0) {
        return json({ error: "sem_dias", dica: "Nao achei entradas deste mes nesse extrato. Confere se e o extrato do mes atual." }, 200);
      }
      const datas = candidatos.map((c: any) => c.data);

      // Em paralelo: dias com DEFCON iniciado, dias que ja tem extrato, e o outro slot (dedup).
      const [csRes, wsRes, exRes, outroRes] = await Promise.all([
        supa.from("challenge_sessions").select("date").eq("user_id", uid).in("date", datas).not("started_at", "is", null),
        supa.from("work_sessions").select("planning_date").eq("user_id", uid).in("planning_date", datas),
        supa.from("extrato_uploads").select("dia").eq("user_id", uid).eq("tipo", tipo).in("dia", datas),
        supa.from("extrato_uploads").select("dia, vendas").eq("user_id", uid).eq("tipo", tipo === "cartao" ? "pix" : "cartao").in("dia", datas),
      ]);
      const trabalhou = new Set<string>([
        ...(((csRes.data as any[]) ?? []).map((r) => String(r.date).slice(0, 10))),
        ...(((wsRes.data as any[]) ?? []).map((r) => String(r.planning_date).slice(0, 10))),
      ]);
      const jaTem = new Set(((exRes.data as any[]) ?? []).map((r) => String(r.dia).slice(0, 10)));
      const outroPorDia = new Map<string, any[]>();
      for (const r of ((outroRes.data as any[]) ?? [])) {
        outroPorDia.set(String(r.dia).slice(0, 10), Array.isArray(r.vendas) ? r.vendas : []);
      }

      const chaveMes = (v: any) =>
        `${Math.round((Number(v?.valor) || 0) * 100)}|${String(v?.descricao ?? "").toLowerCase().replace(/\s+/g, " ").trim().slice(0, 24)}`;
      const adminMes = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      );

      const diasSalvos: any[] = [];
      const diasPulados: any[] = [];
      for (const c of candidatos) {
        if (!trabalhou.has(c.data)) {
          diasPulados.push({ dia: c.data, motivo: "sem DEFCON iniciado nesse dia" });
          continue;
        }
        if (jaTem.has(c.data)) {
          diasPulados.push({ dia: c.data, motivo: "ja tem extrato enviado" });
          continue;
        }
        // Dedup contra o outro slot (pix x cartao) do MESMO dia.
        const outrasDia = outroPorDia.get(c.data) ?? [];
        const okeys = new Set(outrasDia.map(chaveMes));
        const batemDia = c.vendas.filter((v: any) => okeys.has(chaveMes(v))).length;
        if (c.vendas.length >= 2 && outrasDia.length >= 2 && batemDia / c.vendas.length >= 0.6) {
          diasPulados.push({ dia: c.data, motivo: "parece o mesmo extrato do outro slot" });
          continue;
        }
        // Regras: repetidos da mesma pessoa (3x+) + Pix de R$100+ nao conta.
        const semRepDia = separaRepetidos(c.vendas);
        const limpas: any[] = [];
        const suspDia: any[] = [...c.suspeitas, ...semRepDia.repetidas];
        for (const v of semRepDia.limpas) {
          const val = Number(v?.valor) || 0;
          if (val >= TETO_PIX) {
            suspDia.push({ ...v, motivo: `Pix de R$${val.toFixed(2)}: valores de R$${TETO_PIX} ou mais nao contam` });
            continue;
          }
          limpas.push(v);
        }
        const totDia = limpas.reduce((s: number, v: any) => s + (Number(v?.valor) || 0), 0);
        if (totDia <= 0) {
          diasPulados.push({ dia: c.data, motivo: "sem venda valida nesse dia" });
          continue;
        }
        const ignoradoDia = suspDia.reduce((s: number, v: any) => s + (Number(v?.valor) || 0), 0);
        const { error: upErrMes } = await adminMes.from("extrato_uploads").upsert({
          user_id: uid,
          dia: c.data,
          tipo,
          total_verificado: totDia,
          qtd_vendas: limpas.length,
          total_ignorado: ignoradoDia,
          vendas: limpas,
          motor,
          updated_at: new Date().toISOString(),
        }, { onConflict: "user_id,dia,tipo" });
        if (upErrMes) {
          console.error("extrato mes upsert erro", c.data, upErrMes.message);
          diasPulados.push({ dia: c.data, motivo: "erro ao salvar" });
          continue;
        }
        diasSalvos.push({ dia: c.data, total: totDia, qtd: limpas.length, suspeitas: suspDia.length });
      }

      return json({
        ok: true,
        modo: "mes",
        motor,
        periodo_inicio: isDate(parsed.periodo_inicio) ? parsed.periodo_inicio : "",
        periodo_fim: isDate(parsed.periodo_fim) ? parsed.periodo_fim : "",
        dias_salvos: diasSalvos,
        dias_pulados: diasPulados,
        total_salvo: diasSalvos.reduce((s: number, d: any) => s + d.total, 0),
      });
    }

    const vendas = Array.isArray(parsed.vendas) ? parsed.vendas : [];
    const suspeitas = Array.isArray(parsed.suspeitas) ? parsed.suspeitas : [];
    const totalVendas = Number(parsed.total_vendas) || 0;
    const qtdVendas = Number(parsed.qtd_vendas) || vendas.length;
    const totalIgnorado = Number(parsed.total_ignorado) || 0;

    // VALIDA O TIPO DE DOCUMENTO: slot "pix" -> tem que ser extrato de BANCO;
    // slot "cartao" -> tem que ser extrato de MAQUININHA. Rejeita o arquivo errado.
    const documento = typeof parsed.documento === "string" ? parsed.documento.toLowerCase() : "";
    if (salvar) {
      if (documento === "outro" || documento === "") {
        return json({
          error: "documento_invalido",
          dica: `Esse arquivo nao parece um extrato. Manda o ${tipo === "cartao" ? "extrato/relatorio da maquininha de cartao" : "extrato do banco (onde caem os Pix)"}.`,
        }, 200);
      }
      // Pix -> precisa ser extrato de BANCO (onde caem os Pix). Cartao -> pode vir de
      // QUALQUER lugar (maquininha, banco ou outro relatorio de vendas no cartao); so a
      // foto aleatoria ("outro", ja barrada acima) nao vale.
      if (tipo === "pix" && documento !== "banco") {
        return json({
          error: "documento_tipo_errado",
          dica: "Voce enviou um extrato de maquininha, mas aqui e pro extrato do BANCO (onde caem os Pix). Manda o extrato do banco.",
        }, 200);
      }
    }

    // VALIDA O DIA: o extrato pode cobrir varios dias / o mes inteiro (alguns bancos
    // nao deixam pedir extrato de um dia so). A IA ja filtrou SO as vendas do dia
    // auditado. Aqui validamos se o PERIODO do arquivo alcanca esse dia.
    const dataDia = typeof parsed.data_dia === "string" && /^\d{4}-\d{2}-\d{2}$/.test(parsed.data_dia)
      ? parsed.data_dia : "";
    const cobreDia = parsed.cobre_dia === true || dataDia === dia;
    const fmt = (d: string) => (d && d.length >= 10 ? `${d.slice(8, 10)}/${d.slice(5, 7)}` : d);
    const pIni = typeof parsed.periodo_inicio === "string" && /^\d{4}-\d{2}-\d{2}$/.test(parsed.periodo_inicio) ? parsed.periodo_inicio : "";
    const pFim = typeof parsed.periodo_fim === "string" && /^\d{4}-\d{2}-\d{2}$/.test(parsed.periodo_fim) ? parsed.periodo_fim : "";
    if (salvar && !diaValido) {
      return json({ error: "dia_invalido", dica: "Nao consegui identificar o dia. Tenta de novo." }, 200);
    }
    if (salvar && !cobreDia) {
      const periodo = pIni && pFim ? ` (esse arquivo cobre ${fmt(pIni)} a ${fmt(pFim)})` : "";
      return json({
        error: "extrato_fora_do_periodo",
        periodo_inicio: pIni,
        periodo_fim: pFim,
        esperado: dia,
        dica: `Esse extrato nao inclui o dia ${fmt(dia)}${periodo}. Manda um extrato que cubra o dia ${fmt(dia)} — pode ser o do mes inteiro, eu separo so o dia certo.`,
      }, 200);
    }

    // ===== ANTIFRAUDE EXTRA (no servidor, alem do que a IA ja faz no prompt) =====
    // 1) DEDUP ENTRE SLOTS: pix e cartao sao documentos DIFERENTES. Se a MESMA
    //    transacao (valor + origem) aparece nos DOIS, e o mesmo extrato subido 2x
    //    -> conta UMA vez (a copia vai pra suspeitas). Mata o bug do "soma em dobro".
    // 2) VALOR ALTO: venda individual acima do teto (ticket de rua e pequeno) vira
    //    suspeita e NAO conta. Teto configuravel via SUSPEITA_VALOR_MAX (default 150).
    let outras: any[] = [];
    if (supa && uid) {
      try {
        const outroTipo = tipo === "cartao" ? "pix" : "cartao";
        const { data: o } = await supa
          .from("extrato_uploads")
          .select("vendas")
          .eq("user_id", uid)
          .eq("dia", dia)
          .eq("tipo", outroTipo)
          .maybeSingle();
        outras = Array.isArray((o as any)?.vendas) ? (o as any).vendas : [];
      } catch { /* segue sem dedup se a leitura falhar */ }
    }
    const chave = (v: any) =>
      `${Math.round((Number(v?.valor) || 0) * 100)}|${String(v?.descricao ?? "").toLowerCase().replace(/\s+/g, " ").trim().slice(0, 24)}`;
    // #5 DEDUP POR SLOT (nao venda-a-venda): pix e cartao sao documentos DIFERENTES.
    // Se a maioria das vendas deste slot bate com o outro slot, e o MESMO extrato
    // subido 2x -> recusa o slot inteiro. Evita falso-positivo de fundir vendas
    // legitimas de mesmo valor (ticket de rua e pequeno e repetitivo).
    const outrasKeys = new Set(outras.map(chave));
    const batem = vendas.filter((v: any) => outrasKeys.has(chave(v))).length;
    const overlap = vendas.length > 0 ? batem / vendas.length : 0;
    if (salvar && vendas.length >= 2 && outras.length >= 2 && overlap >= 0.6) {
      return json({
        error: "extrato_duplicado",
        dica: "Esse extrato parece ser o mesmo do outro slot. Pix e cartao sao documentos diferentes - mande o de cada um.",
      }, 200);
    }
    // Regra 1: repetidos da mesma pessoa (3x+) -> so o 1o conta. Regra 2: Pix de R$100+ nao conta.
    const semRep = separaRepetidos(vendas);
    const vendasLimpas: any[] = [];
    const suspeitasFinal: any[] = [...(Array.isArray(suspeitas) ? suspeitas : []), ...semRep.repetidas];
    let addedIgnorado = semRep.repetidas.reduce((s: number, v: any) => s + (Number(v?.valor) || 0), 0);
    for (const v of semRep.limpas) {
      const val = Number(v?.valor) || 0;
      if (val >= TETO_PIX) {
        suspeitasFinal.push({ ...v, motivo: `Pix de R$${val.toFixed(2)}: valores de R$${TETO_PIX} ou mais nao contam` });
        addedIgnorado += val;
        continue;
      }
      vendasLimpas.push(v);
    }
    const totalLimpo = vendasLimpas.reduce((s, v) => s + (Number(v?.valor) || 0), 0);
    const ignoradoFinal = (Number(totalIgnorado) || 0) + addedIgnorado;

    // Total que o vendedor REGISTROU no DEFCON do dia (cartao + pix) — pra comparar.
    let defconTotal = 0;
    if (supa && uid) {
      try {
        const { data: ds } = await supa
          .from("daily_sales")
          .select("card_sales, pix_sales")
          .eq("user_id", uid)
          .eq("date", dia);
        defconTotal = ((ds as any[]) || []).reduce((s, r) => s + Number(r.card_sales || 0) + Number(r.pix_sales || 0), 0);
      } catch { /* opcional */ }
    }

    // Salva so quando salvar:true (a tela de teste admin NAO salva).
    // ANTI-FRAUDE: grava com SERVICE_ROLE (nao com o JWT do usuario). A RLS bloqueia escrita
    // direta do cliente em extrato_uploads, entao a UNICA forma de gravar total_verificado e
    // por aqui, DEPOIS da IA auditar. user_id vem do JWT verificado (uid), nunca do cliente.
    let salvo = false;
    if (salvar && uid) {
      try {
        const admin = createClient(
          Deno.env.get("SUPABASE_URL") ?? "",
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
        );
        const { error: upErr } = await admin.from("extrato_uploads").upsert({
          user_id: uid,
          dia,
          tipo,
          total_verificado: totalLimpo,
          qtd_vendas: vendasLimpas.length,
          total_ignorado: ignoradoFinal,
          vendas: vendasLimpas,
          motor,
          updated_at: new Date().toISOString(),
        }, { onConflict: "user_id,dia,tipo" });
        if (upErr) console.error("extrato upsert erro", upErr.message);
        else salvo = true;
      } catch (e) {
        console.error("extrato salvar excecao", String(e).slice(0, 150));
      }
    }

    return json({
      ok: true,
      motor,
      salvo,
      dia,
      tipo,
      vendas: vendasLimpas,
      suspeitas: suspeitasFinal,
      total_vendas: totalLimpo,
      total_ignorado: ignoradoFinal,
      qtd_vendas: vendasLimpas.length,
      extrato_dia: dataDia,
      defcon_total: defconTotal,
      acima_do_defcon: defconTotal > 0 && totalLimpo > defconTotal * 1.2,
    });
  } catch (e) {
    console.error("verificar-extrato excecao", e);
    return json({ error: "erro_interno" }, 500);
  }
});
