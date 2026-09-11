// CLIMA DO VENDEDOR — Rick, 11/09/2026.
// Junta 6 modelos de previsão (Open-Meteo, grátis e sem chave), calcula por hora
// quantos apostam em chuva ("consenso"), classifica o estado da cena (sol, calor,
// nublado, chuva, tempestade, frio, noite) e pede pra IA a opinião do dia com os
// números do vendedor (meta, contas, melhor hora). O tempo é cacheado por célula
// de ~5 km durante 3 h — cem vendedores da mesma cidade custam UMA consulta.
//
// Chamada (POST, com JWT do usuário):
//   { lat, lon, contexto?: { meta, vendidoHoje, melhorHora, melhoresHoras, contas: [{nome, dias, valor}], quedaChuvaPct }, semIA?: boolean }
// Efeito colateral: grava o tempo do dia do vendedor em clima_dia (o cérebro aprende).
// Resposta: { tempo: {...}, opiniao: {...} | null, atualizadoEm }
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") ?? "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

// ---------------------------------------------------------------- IA (mesma fila do generate-insights)
async function callClaude(system: string, user: string): Promise<string> {
  const key = Deno.env.get("ANTHROPIC_API_KEY");
  if (!key) throw new Error("sem_anthropic_key");
  const model = Deno.env.get("ANTHROPIC_MODEL") ?? "claude-haiku-4-5-20251001";
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
    signal: AbortSignal.timeout(30000),
    body: JSON.stringify({ model, max_tokens: 1200, temperature: 0.7, system, messages: [{ role: "user", content: user }] }),
  });
  if (!res.ok) throw new Error(`claude_${res.status}`);
  const j = await res.json();
  const content = ((j?.content ?? []).map((b: { text?: string }) => b?.text || "").join("")).trim();
  if (!content) throw new Error("claude_vazio");
  return content;
}
async function callCerebras(system: string, user: string): Promise<string> {
  const key = Deno.env.get("CEREBRAS_API_KEY");
  if (!key) throw new Error("sem_cerebras_key");
  const model = Deno.env.get("CEREBRAS_MODEL") ?? "gpt-oss-120b";
  const res = await fetch("https://api.cerebras.ai/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", "authorization": `Bearer ${key}` },
    signal: AbortSignal.timeout(20000),
    body: JSON.stringify({ model, messages: [{ role: "system", content: system }, { role: "user", content: user }], temperature: 0.7, max_tokens: 1200 }),
  });
  if (!res.ok) throw new Error(`cerebras_${res.status}`);
  const j = await res.json();
  const content = j?.choices?.[0]?.message?.content?.toString().trim();
  if (!content) throw new Error("cerebras_vazio");
  return content;
}
async function callGemini(system: string, user: string): Promise<string> {
  const key = Deno.env.get("GEMINI_API_KEY");
  if (!key) throw new Error("sem_gemini_key");
  const model = Deno.env.get("GEMINI_MODEL") ?? "gemini-flash-latest";
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    signal: AbortSignal.timeout(25000),
    body: JSON.stringify({ systemInstruction: { parts: [{ text: system }] }, contents: [{ role: "user", parts: [{ text: user }] }], generationConfig: { temperature: 0.7, maxOutputTokens: 1200 } }),
  });
  if (!res.ok) throw new Error(`gemini_${res.status}`);
  const j = await res.json();
  const content = j?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!content) throw new Error("gemini_vazio");
  return content;
}
async function callAI(system: string, user: string): Promise<string> {
  try { return await callClaude(system, user); } catch (e) {
    console.error("CLAUDE_FALHOU:", String(e));
    try { return await callCerebras(system, user); } catch (e2) {
      console.error("CEREBRAS_FALHOU:", String(e2));
      return await callGemini(system, user);
    }
  }
}

// ---------------------------------------------------------------- tempo
const MODELOS = ["ecmwf_ifs025", "gfs_seamless", "icon_seamless", "meteofrance_seamless", "gem_seamless", "jma_seamless"] as const;
const NOMES: Record<string, string> = { ecmwf_ifs025: "ECMWF · Europa", gfs_seamless: "GFS · EUA", icon_seamless: "ICON · Alemanha", meteofrance_seamless: "Météo-France", gem_seamless: "GEM · Canadá", jma_seamless: "JMA · Japão" };

export type Estado = "sol" | "calor" | "nublado" | "chuva" | "tempestade" | "frio" | "noite";

interface Hora { hora: number; iso: string; fontes: number; total: number; mm: number; temp: number | null; prob: number | null; codigo: number | null }
interface Tempo {
  estado: Estado;
  temp: number; sensacao: number; max: number | null; min: number | null; vento: number; rajada: number | null;
  condicao: string; codigo: number; ehDia: boolean;
  horas: Hora[]; fontesTotal: number; fontesOk: string[]; concordancia: number;
  alerta: { titulo: string; texto: string } | null;
  chuva: { proxima: number | null; ate: number | null; fontes: number } | null;
  cidade: string; uf: string;
}

const celula = (lat: number, lon: number) => `${(Math.round(lat / 0.05) * 0.05).toFixed(2)},${(Math.round(lon / 0.05) * 0.05).toFixed(2)}`;

function descreveCodigo(c: number, dia: boolean): string {
  if (c === 0) return dia ? "Ensolarado" : "Céu limpo";
  if (c <= 2) return dia ? "Sol entre nuvens" : "Poucas nuvens";
  if (c === 3) return "Nublado";
  if (c === 45 || c === 48) return "Neblina";
  if (c >= 51 && c <= 57) return "Chuvisco";
  if (c >= 61 && c <= 67) return c >= 65 ? "Chuva forte" : "Chuva";
  if (c >= 71 && c <= 77) return "Neve";
  if (c >= 80 && c <= 82) return c === 82 ? "Pancadas fortes" : "Pancadas de chuva";
  if (c >= 95) return "Tempestade";
  return "Tempo instável";
}

async function buscarTempo(lat: number, lon: number): Promise<Tempo> {
  const base = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&timezone=America%2FSao_Paulo`;
  // 1) consenso: 6 modelos, chuva e temperatura por hora
  const uCons = `${base}&hourly=precipitation,temperature_2m&models=${MODELOS.join(",")}&forecast_days=2`;
  // 2) referência: melhor modelo local pra "agora", código do tempo, vento, probabilidade
  const uRef = `${base}&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,wind_gusts_10m,is_day,precipitation&hourly=weather_code,precipitation_probability,wind_gusts_10m&daily=temperature_2m_max,temperature_2m_min,apparent_temperature_max&forecast_days=2`;
  const [rc, rr] = await Promise.all([
    fetch(uCons, { signal: AbortSignal.timeout(15000) }),
    fetch(uRef, { signal: AbortSignal.timeout(15000) }),
  ]);
  if (!rr.ok) throw new Error(`open_meteo_ref_${rr.status}`);
  const ref = await rr.json();
  const cons = rc.ok ? await rc.json() : null;

  const hh = cons?.hourly ?? {};
  const times: string[] = (hh.time as string[] | undefined) ?? (ref.hourly?.time as string[]) ?? [];
  // quais modelos responderam de verdade (alguns não cobrem toda região)
  const fontesOk = MODELOS.filter((m) => Array.isArray(hh[`precipitation_${m}`]) && (hh[`precipitation_${m}`] as (number | null)[]).some((v) => v != null));
  const total = fontesOk.length;

  const agoraIso: string = ref.current?.time ?? new Date().toISOString().slice(0, 16);
  const idxAgora = Math.max(0, times.findIndex((t) => t >= agoraIso.slice(0, 13)));
  const horas: Hora[] = [];
  let acordo = 0, nAcordo = 0;
  for (let i = idxAgora; i < Math.min(times.length, idxAgora + 24); i++) {
    let chove = 0, mmSoma = 0, tSoma = 0, tN = 0;
    for (const m of fontesOk) {
      const mm = Number((hh[`precipitation_${m}`] as (number | null)[])[i] ?? 0);
      if (mm >= 0.2) chove++;
      mmSoma += mm;
      const t = (hh[`temperature_2m_${m}`] as (number | null)[] | undefined)?.[i];
      if (t != null) { tSoma += Number(t); tN++; }
    }
    if (total > 0) { acordo += Math.max(chove, total - chove) / total; nAcordo++; }
    horas.push({
      hora: Number(times[i]!.slice(11, 13)),
      iso: times[i]!,
      fontes: chove,
      total,
      mm: total > 0 ? mmSoma / total : Number(ref.hourly?.precipitation?.[i] ?? 0),
      temp: tN > 0 ? tSoma / tN : (ref.hourly?.temperature_2m?.[i] ?? null),
      prob: ref.hourly?.precipitation_probability?.[i] ?? null,
      codigo: ref.hourly?.weather_code?.[i] ?? null,
    });
  }
  const concordancia = nAcordo > 0 ? Math.round((acordo / nAcordo) * 100) : 0;

  const cur = ref.current ?? {};
  const codigo = Number(cur.weather_code ?? 0);
  const ehDia = Number(cur.is_day ?? 1) === 1;
  const temp = Number(cur.temperature_2m ?? 0);
  const sensacao = Number(cur.apparent_temperature ?? temp);
  const vento = Number(cur.wind_speed_10m ?? 0);
  const rajada = cur.wind_gusts_10m != null ? Number(cur.wind_gusts_10m) : null;
  const rajadaMax = Math.max(rajada ?? 0, ...((ref.hourly?.wind_gusts_10m as (number | null)[] | undefined) ?? []).slice(idxAgora, idxAgora + 12).map((v) => Number(v ?? 0)));

  // próxima chuva (maioria dos modelos) nas próximas 12 h
  let proxima: number | null = null, ate: number | null = null, fontesChuva = 0;
  for (const h of horas.slice(0, 12)) {
    const maioria = h.total > 0 ? h.fontes / h.total >= 0.5 : (h.prob ?? 0) >= 50;
    if (maioria && proxima == null) { proxima = h.hora; fontesChuva = h.fontes; }
    if (proxima != null && maioria) ate = h.hora;
    if (proxima != null && !maioria && ate != null) break;
  }
  const chuva = proxima != null ? { proxima, ate, fontes: fontesChuva } : null;
  const chovendoAgora = Number(cur.precipitation ?? 0) >= 0.2 || (codigo >= 51 && codigo <= 82);
  const tempestadeAgora = codigo >= 95 || (chovendoAgora && rajadaMax >= 60);
  const tempestadeLogo = horas.slice(0, 6).some((h) => (h.codigo ?? 0) >= 95);

  // Tempestade e chuva mandam mesmo de noite (a cena de chuva já é escura); o resto depende de ser dia.
  let estado: Estado;
  if (tempestadeAgora || tempestadeLogo) estado = "tempestade";
  else if (chovendoAgora || (chuva && chuva.proxima != null && horas.findIndex((h) => h.hora === chuva.proxima) <= 3)) estado = "chuva";
  else if (!ehDia) estado = "noite";
  else if (sensacao <= 14) estado = "frio";
  else if (sensacao >= 32) estado = "calor";
  else if (codigo === 3 || codigo === 45 || codigo === 48) estado = "nublado";
  else estado = "sol";

  let alerta: Tempo["alerta"] = null;
  if (tempestadeAgora || tempestadeLogo) {
    alerta = { titulo: `Tempestade${rajadaMax >= 60 ? ` com rajadas de ${Math.round(rajadaMax)} km/h` : ""}`, texto: "Raio, vento e chuva forte nas próximas horas. Fica em lugar fechado — nada de marquise solta ou embaixo de árvore." };
  } else if (rajadaMax >= 70) {
    alerta = { titulo: `Vento forte · rajadas de ${Math.round(rajadaMax)} km/h`, texto: "Segura a barraca e o guarda-sol. Isopor leve voa." };
  } else if (sensacao >= 38) {
    alerta = { titulo: `Calor extremo · sensação de ${Math.round(sensacao)}°`, texto: "Água toda hora, sombra das 12h às 15h. Gelada vende sozinha, mas cuida de você primeiro." };
  }

  // cidade: geocodificação reversa gratuita (sem chave). Se falhar, segue sem.
  let cidade = "", uf = "";
  try {
    const g = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=pt`, { signal: AbortSignal.timeout(6000) });
    if (g.ok) { const gj = await g.json(); cidade = limpaCidade(gj.city || gj.locality || ""); uf = (gj.principalSubdivisionCode || "").replace("BR-", ""); }
  } catch { /* tenta a outra */ }
  if (!cidade) {
    try {
      const n = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=jsonv2&zoom=10&accept-language=pt-BR`, { headers: { "User-Agent": "OrbisApp/1.0 (clima do vendedor; contato@orbis.app)" }, signal: AbortSignal.timeout(6000) });
      if (n.ok) {
        const nj = await n.json(); const a = nj.address ?? {};
        cidade = limpaCidade(a.city || a.town || a.municipality || a.village || a.county || "");
        uf = (a["ISO3166-2-lvl4"] || "").replace("BR-", "");
      }
    } catch { /* segue sem cidade */ }
  }

  return {
    estado, temp, sensacao,
    max: ref.daily?.temperature_2m_max?.[0] ?? null, min: ref.daily?.temperature_2m_min?.[0] ?? null,
    vento, rajada, condicao: descreveCodigo(codigo, ehDia), codigo, ehDia,
    horas, fontesTotal: total, fontesOk: fontesOk.map((m) => NOMES[m] ?? m), concordancia,
    alerta, chuva, cidade, uf,
  };
}

// ---------------------------------------------------------------- relógio (fuso de Brasília)
function agoraSP() {
  const d = new Date();
  const p = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit", weekday: "long", hour12: false }).formatToParts(d);
  const get = (t: string) => p.find((x) => x.type === t)?.value ?? "";
  const hora = Number(get("hour"));
  const data = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
  const periodo = hora < 5 ? "madrugada" : hora < 12 ? "manhã" : hora < 18 ? "tarde" : "noite";
  return { hora, minuto: get("minute"), diaSemana: get("weekday"), data, periodo };
}
/* "Região Metropolitana de São Paulo" -> "São Paulo": nome que cabe na tela
   e que a IA lê sem tropeçar. */
const PREFIXOS_CIDADE = /^(regi(ã|a)o\s+(metropolitana|geogr(á|a)fica\s+(imediata|intermediária|intermediaria)|administrativa)\s+d[eoa]s?|microrregi(ã|a)o\s+d[eoa]s?|mesorregi(ã|a)o\s+d[eoa]s?|munic(í|i)pio\s+d[eoa]s?|cidade\s+d[eoa]s?|distrito\s+d[eoa]s?)\s+/i;
function limpaCidade(nome: string): string {
  let c = (nome || "").trim(), antes = "";
  while (c !== antes) { antes = c; c = c.replace(PREFIXOS_CIDADE, "").trim(); }
  return c;
}

/* O vendedor é noturno? (melhor hora dele entre 19h e 4h) */
const ehNoturno = (h?: number | null) => h != null && (h >= 19 || h <= 4);

// ---------------------------------------------------------------- opinião (IA)
const MENTOR = `Você é o Orbis, mentor de vendedor de rua/ambulante no Brasil. Fala como parça de corre: direto, linguagem da rua, firme, sem papo corporativo, sem markdown.
Você vai dar a OPINIÃO DO DIA sobre o clima pro vendedor decidir: hora de sair pra rua, hora de descansar, hora de voltar — ou nem sair.
REGRAS:
- O RELÓGIO MANDA EM TUDO. Você recebe a hora de agora. NUNCA mande sair num horário que já passou, e nunca escreva "(agora)" num horário diferente do que te passaram. Toda hora que citar tem que ser daqui pra frente; se for do dia seguinte, escreva "amanhã".
- PICOS: quando o clima permitir, diga a JANELA exata que ele não pode perder e por quê (sem chuva, movimento, é a hora em que ele mais vende). Uma janela curta e específica vale mais que um conselho genérico.
- MADRUGADA (23h às 5h): a resposta padrão é DESCANSAR e preparar o dia seguinte — rua vazia, risco alto e ninguém comprando. Só mande sair nessa faixa se a MELHOR HORA dele for de madrugada (aí ele é vendedor noturno e a regra é o contrário: aproveitar a noite e dormir de dia).
- Sempre específico: cite horas e números que te passarem. Nunca invente chuva que os modelos não apontam.
- Contas vencendo e meta do dia pesam: dia ruim de clima + conta vencendo = "sai cedo e fecha antes"; tempestade = segurança primeiro, meta se recupera amanhã. Mas conta vencendo NUNCA é motivo pra mandar alguém pra rua de madrugada.
- Humildade: o clima pode mudar — mas a fala principal NÃO precisa repetir "não sou Deus", isso já aparece fixo na tela.
- Português do Brasil. Frases curtas. Sem emoji.`;

interface Contexto { meta?: number; vendidoHoje?: number; melhorHora?: number | null; melhoresHoras?: number[]; contas?: { nome: string; dias: number; valor: number }[]; quedaChuvaPct?: number | null }
interface Opiniao { falas: string[]; veredito: { titulo: string; sub: string; nota: number }; sair: { hora: string; txt: string }; pausa: { hora: string; txt: string }; volta: { hora: string; txt: string } }

function opiniaoLocal(t: Tempo, c: Contexto = {}): Opiniao {
  // Reserva sem IA: nunca deixa a tela vazia.
  const ch = t.chuva;
  const ag = agoraSP();
  /* Madrugada manda em tudo, igual na regra da IA: ninguém que trabalha de dia
     deve ser mandado pra rua às 2 da manhã por causa de uma conta vencendo. */
  if ((ag.hora >= 23 || ag.hora < 5) && !ehNoturno(c.melhorHora)) {
    const proxima = t.estado === "tempestade" ? "Só que amanhã tem tempestade — confere a tela de manhã antes de carregar." : t.estado === "chuva" && ch ? `Amanhã a chuva chega por volta das ${ch.proxima}h: sai cedo e fecha antes.` : "Amanhã o clima ajuda: sai cedo que o dia rende.";
    return {
      falas: ["É madrugada, parça. Agora não é hora de rua — é hora de dormir.", proxima, "Descansado você vende mais em meio dia do que quebrado em um dia inteiro."],
      veredito: { titulo: "Hora de descansar", sub: "Rua vazia e risco alto. O corre de verdade começa de manhã.", nota: 3 },
      sair: { hora: "amanhã cedo", txt: "Depois que clarear e o movimento voltar." },
      pausa: { hora: "agora", txt: "Dorme. O corpo é a sua ferramenta." },
      volta: { hora: "—", txt: "Amanhã a gente combina o dia." },
    };
  }
  if (t.estado === "tempestade") return { falas: ["Tempestade chegando. Hoje o corre é ficar vivo — a meta espera até amanhã.", "Se tiver que sair, sai agora e perto de casa.", "Amanhã a gente compensa."], veredito: { titulo: "Hoje não é dia de herói", sub: "Raio e chuva forte nas próximas horas. Se der pra ficar, fica.", nota: 2 }, sair: { hora: "só se precisar", txt: "Perto de casa e antes da chuva." }, pausa: { hora: "—", txt: "Encerra cedo." }, volta: { hora: "antes da chuva", txt: "Em casa quando fechar o tempo." } };
  if (t.estado === "chuva" && ch) return { falas: [`Chuva entre ${ch.proxima}h e ${ch.ate ?? ch.proxima}h — ${ch.fontes} de ${t.fontesTotal} fontes concordam. Bate a meta antes.`, "Na chuva você vende menos: a manhã vale por um dia inteiro.", "Se a meta fechou antes da chuva, vai pra casa tranquilo."], veredito: { titulo: "Dia de RALAR antes da chuva", sub: `Seco até ${ch.proxima}h. Depois, cobertura.`, nota: 6 }, sair: { hora: "agora", txt: `Seco até ${ch.proxima}h.` }, pausa: { hora: `${ch.proxima}h`, txt: "Almoça coberto enquanto chove." }, volta: { hora: `${(ch.ate ?? ch.proxima)! + 1}h ou fica`, txt: "Abre de novo depois da chuva." } };
  if (t.estado === "calor") return { falas: ["Sol muito forte hoje. Gelada é ouro: leva o dobro e cobra o preço cheio.", "Das 12h às 15h nem eu fico na rua. Pausa, hidrata, volta.", "Boné, água e não pula o almoço."], veredito: { titulo: "Dia de RALAR cedo", sub: "Gelada vende sozinha, mas das 12h às 15h o povo some.", nota: 8 }, sair: { hora: "7h30–11h30", txt: "Antes do sol subir." }, pausa: { hora: "12h–15h", txt: "Sombra e água." }, volta: { hora: "17h30", txt: "Fecha quando refresca." } };
  if (t.estado === "frio") return { falas: ["Frio e vento. Café e caldo hoje valem mais que gelada.", "Metade da concorrência não sai no frio. Rua vazia de vendedor é rua cheia de cliente.", "Jaqueta, luva, e volta antes de escurecer."], veredito: { titulo: "Dia de RALAR (com café)", sub: "Frio seco. Quente vende mais que gelada.", nota: 8 }, sair: { hora: "9h–13h", txt: "Espera o sol subir um pouco." }, pausa: { hora: "13h–14h", txt: "Come quente e volta." }, volta: { hora: "17h30", txt: "Depois das 18h a temperatura despenca." } };
  if (t.estado === "noite") return { falas: ["Noite limpa. Quem vende de noite, hoje rende.", "Movimento sobe às 19h e segura até 23h.", "Volta até 23h30 — depois o fluxo some."], veredito: { titulo: "Noite boa pro corre noturno", sub: "Seco e agradável.", nota: 8 }, sair: { hora: "19h–23h", txt: "Bares e eventos cheios." }, pausa: { hora: "21h30", txt: "15 min pra recarregar." }, volta: { hora: "23h30", txt: "Depois o risco sobe." } };
  if (t.estado === "nublado") return { falas: ["Dia cinza é dia de vender: ninguém tá com pressa de fugir do sol.", "Aproveita a manhã inteira.", "Sem sol na cara, dá pra encurtar a pausa."], veredito: { titulo: "Dia bom de rua", sub: "Céu fechado é conforto pra quem tá na rua.", nota: 9 }, sair: { hora: "8h–12h30", txt: "Manhã inteira." }, pausa: { hora: "13h", txt: "Almoço normal." }, volta: { hora: "18h30", txt: "Fim da tarde." } };
  return { falas: ["Dia limpo. Sai cedo que o povo já tá na rua.", "Sua melhor hora tá protegida hoje — não perde ela pra almoçar.", "Dia pra bater a meta e adiantar conta."], veredito: { titulo: "Dia de RALAR o dia todo", sub: "Céu limpo e movimento cheio.", nota: 10 }, sair: { hora: "9h–12h", txt: "Fluxo alto e sol ainda leve." }, pausa: { hora: "13h–14h", txt: "1h de sombra e água." }, volta: { hora: "18h", txt: "Seco até de noite." } };
}

async function opiniaoIA(t: Tempo, c: Contexto): Promise<Opiniao> {
  const ag = agoraSP();
  const noturno = ehNoturno(c.melhorHora);
  // cada hora sai marcada com hoje/amanhã pra IA não mandar ele sair num horário que já passou
  const horasTxt = t.horas.slice(0, 16).map((h) => {
    const amanha = h.iso.slice(0, 10) !== ag.data;
    return `${h.hora}h${amanha ? " (amanhã)" : ""}: chuva ${h.fontes}/${h.total} modelos${h.mm >= 0.2 ? ` (${h.mm.toFixed(1)}mm)` : ""}${h.temp != null ? ` · ${Math.round(h.temp)}°` : ""}`;
  }).join("\n");
  const contas = (c.contas ?? []).slice(0, 4).map((x) => `${x.nome} R$ ${Math.round(x.valor)} (${x.dias <= 0 ? "vence hoje" : `vence em ${x.dias} dias`})`).join("; ") || "nenhuma vencendo";
  const user = `AGORA SÃO ${String(ag.hora).padStart(2, "0")}h${ag.minuto} de ${ag.diaSemana} (horário de Brasília). É ${ag.periodo}.
${ag.hora >= 23 || ag.hora < 5 ? (noturno ? "ATENÇÃO: é madrugada, MAS a melhor hora dele é nessa faixa — ele é vendedor noturno. Fale do corre desta noite." : "ATENÇÃO: é MADRUGADA e ele não é vendedor noturno. A resposta é descansar agora e sair mais tarde, no horário bom de HOJE. Não mande ele pra rua agora.") : ""}
CLIMA AGORA em ${t.cidade || "sua região"}: ${t.condicao}, ${Math.round(t.temp)}° (sensação ${Math.round(t.sensacao)}°), vento ${Math.round(t.vento)} km/h${t.rajada ? `, rajadas ${Math.round(t.rajada)} km/h` : ""}. Máx ${t.max ?? "?"}° · mín ${t.min ?? "?"}°. ${t.ehDia ? "É dia." : "É noite."}
ESTADO DA CENA: ${t.estado}. Concordância entre modelos: ${t.concordancia}%.
${t.alerta ? `ALERTA: ${t.alerta.titulo} — ${t.alerta.texto}\n` : ""}PRÓXIMAS HORAS (quantos dos ${t.fontesTotal} modelos apostam em chuva):
${horasTxt}

VENDEDOR: meta de hoje R$ ${Math.round(c.meta ?? 0)} · já vendeu R$ ${Math.round(c.vendidoHoje ?? 0)} · melhor hora dele: ${c.melhorHora != null ? `${c.melhorHora}h` : "desconhecida"}${(c.melhoresHoras ?? []).length ? ` · as horas em que ele MAIS VENDE, pelo histórico dele: ${(c.melhoresHoras ?? []).map((h) => `${h}h`).join(", ")} (proteja essas horas: se o clima deixar, ele não pode perdê-las)` : ""} · contas: ${contas}${c.quedaChuvaPct != null ? ` · ele vende ${Math.round(c.quedaChuvaPct)}% menos com chuva` : ""}.

CONFIRA ANTES DE RESPONDER: toda hora que você escrever é depois das ${String(ag.hora).padStart(2, "0")}h${ag.minuto}? Se for do dia seguinte, está escrito "amanhã"? Se é madrugada${noturno ? "" : " e ele não é vendedor noturno"}, você mandou ele descansar?

Responda SOMENTE este JSON:
{"falas":["frase 1 (até 140 caracteres, a principal)","frase 2 (até 120)","frase 3 (até 120)"],
 "veredito":{"titulo":"até 34 caracteres, ex: Dia de RALAR de manhã","sub":"1 frase até 110 caracteres","nota":0 a 10},
 "sair":{"hora":"ex: 9h–12h (ou 'amanhã 9h')","txt":"até 70 caracteres"},
 "pausa":{"hora":"ex: 13h–14h","txt":"até 70 caracteres"},
 "volta":{"hora":"ex: 17h30","txt":"até 70 caracteres"}}`;
  const raw = await callAI(MENTOR, user);
  const m = raw.match(/\{[\s\S]*\}/);
  if (!m) throw new Error("ia_sem_json");
  const j = JSON.parse(m[0]);
  const s = (v: unknown, n: number) => String(v ?? "").trim().slice(0, n);
  const falas = Array.isArray(j.falas) ? j.falas.map((f: unknown) => s(f, 160)).filter(Boolean).slice(0, 3) : [];
  if (falas.length === 0) throw new Error("ia_sem_falas");
  return {
    falas,
    veredito: { titulo: s(j.veredito?.titulo, 40) || "Opinião do dia", sub: s(j.veredito?.sub, 120), nota: Math.max(0, Math.min(10, Math.round(Number(j.veredito?.nota ?? 7)))) },
    sair: { hora: s(j.sair?.hora, 18), txt: s(j.sair?.txt, 80) },
    pausa: { hora: s(j.pausa?.hora, 18), txt: s(j.pausa?.txt, 80) },
    volta: { hora: s(j.volta?.hora, 18), txt: s(j.volta?.txt, 80) },
  };
}

// ---------------------------------------------------------------- servidor
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("authorization") ?? "";
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await supabase.auth.getUser();
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const body = await req.json().catch(() => ({}));
    const lat = Number(body?.lat), lon = Number(body?.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return json({ error: "lat_lon_invalidos" }, 400);
    // arredonda pra célula de ~5 km: ninguém precisa da esquina exata pra saber se chove
    const cell = celula(lat, lon);
    const [cLat, cLon] = cell.split(",").map(Number) as [number, number];

    // cache do tempo por célula (3 h)
    let tempo: Tempo | null = null;
    let atualizadoEm = new Date().toISOString();
    const { data: cached } = await admin.from("clima_cache").select("payload, atualizado_em").eq("cell", cell).maybeSingle();
    if (cached && Date.now() - new Date(cached.atualizado_em).getTime() < 3 * 3600 * 1000 && !body?.forcar) {
      tempo = cached.payload as Tempo; atualizadoEm = cached.atualizado_em;
    } else {
      tempo = await buscarTempo(cLat, cLon);
      await admin.from("clima_cache").upsert({ cell, payload: tempo, atualizado_em: atualizadoEm });
    }

    /* O CÉREBRO APRENDE (Rick, 11/09): 1 linha por vendedor por dia com o tempo
       que ele pegou. Cruzando com as vendas do dia dá pra saber em que tempo
       cada um vende mais. Guarda o tempo MAIS SEVERO do dia: se choveu de
       tarde, o dia foi de chuva, mesmo que de manhã tivesse sol. */
    if (user && tempo) {
      const hojeBR = agoraSP().data;
      const severidade: Record<string, number> = { sol: 1, noite: 1, nublado: 2, calor: 3, frio: 3, chuva: 4, tempestade: 5 };
      const chuvaDia = tempo.horas.filter((h) => h.iso.slice(0, 10) === hojeBR).reduce((t, h) => t + (h.mm || 0), 0);
      const { data: jaTem } = await admin.from("clima_dia").select("estado, chuva_mm, alerta").eq("user_id", user.id).eq("data", hojeBR).maybeSingle();
      const anterior = (jaTem?.estado as string | undefined) ?? "";
      const fica = (severidade[anterior] ?? 0) > (severidade[tempo.estado] ?? 0) ? anterior : tempo.estado;
      await admin.from("clima_dia").upsert({
        user_id: user.id, data: hojeBR, estado: fica, temp: tempo.temp,
        chuva_mm: Math.max(Number(jaTem?.chuva_mm ?? 0), Number(chuvaDia.toFixed(2))),
        alerta: !!tempo.alerta || !!jaTem?.alerta, cidade: tempo.cidade || null, uf: tempo.uf || null,
        atualizado_em: new Date().toISOString(),
      }, { onConflict: "user_id,data" });
    }

    // opinião: só pra usuário logado, com trava diária (feature "clima", 6/dia)
    let opiniao: Opiniao | null = null;
    let fonteOpiniao: "ia" | "local" | "nenhuma" = "nenhuma";
    if (user && !body?.semIA) {
      const { data: usage, error: usageErr } = await supabase.rpc("bump_ai_usage", { p_feature: "clima", p_limit: 6 });
      const over = usageErr || (usage as { over?: boolean } | null)?.over;
      if (!over) {
        try { opiniao = await opiniaoIA(tempo, (body?.contexto ?? {}) as Contexto); fonteOpiniao = "ia"; }
        catch (e) { console.error("OPINIAO_IA_FALHOU:", String(e)); }
      }
      if (!opiniao) { opiniao = opiniaoLocal(tempo, (body?.contexto ?? {}) as Contexto); fonteOpiniao = "local"; }
    }
    return json({ tempo, opiniao, fonteOpiniao, atualizadoEm, cell });
  } catch (error) {
    console.error("clima-vendedor:", error);
    return json({ error: error instanceof Error ? error.message : "erro" }, 500);
  }
});
