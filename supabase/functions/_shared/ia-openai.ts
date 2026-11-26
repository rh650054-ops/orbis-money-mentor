// VANT — one request to OpenAI for text back (optionally reading an image or a PDF).
// 26/11/2026 (Rick): the AI of the VANT runs on two providers only — Anthropic first, OpenAI as
// the reserve and for what Anthropic does not do (voice, images). Gemini and Cerebras are gone.
// Rules for the caller:
//   - it has already passed the consent gate (_shared/consentimento-ia.ts) AND the vendor's answer
//     is on the text that names OpenAI as the reserve (permissao.textoAtual);
//   - its feature names OpenAI in the disclosure (texto-ia.tsx and Privacidade.tsx).
// A failure is logged with the caller's name and the HTTP status only: never the prompt, the
// file, the answer or the key. No Deno import: the app's vitest suite tests it with a fake fetch.

export interface ArquivoIa { b64: string; mime: string }
export interface PedidoOpenAi {
  /** function name, for the log line */
  quem: string;
  system?: string;
  user: string;
  maxTokens: number;
  timeoutMs: number;
  temperature?: number;
  /** ask for a JSON object back (the prompt itself must mention JSON) */
  json?: boolean;
  /** an image or a PDF the model has to read */
  arquivo?: ArquivoIa;
}
export interface DepsOpenAi { chave?: string; modelos?: string[]; fetchFn?: typeof fetch; aviso?: (m: string) => void }

/** Tried in this order; the next one only when the account refuses the model (400/404).
 *  Secret OPENAI_MODEL_TEXTO puts another model in front without touching the code. */
export const MODELOS_OPENAI_PADRAO: readonly string[] = ["gpt-4.1-mini", "gpt-4o-mini"];
/** Reasoning models (gpt-5*, o*) refuse "temperature" with a 400: only sent to the others. */
export const aceitaTemperaturaOpenAi = (modelo: string): boolean => !/^(gpt-5|o\d)/.test(modelo);

const env = (k: string): string | undefined =>
  (globalThis as { Deno?: { env: { get(k: string): string | undefined } } }).Deno?.env.get(k);

function parteDoArquivo(a: ArquivoIa): Record<string, unknown> {
  if (a.mime.includes("pdf")) {
    return { type: "file", file: { filename: "documento.pdf", file_data: `data:application/pdf;base64,${a.b64}` } };
  }
  const mime = ["image/jpeg", "image/png", "image/gif", "image/webp"].includes(a.mime) ? a.mime : "image/jpeg";
  return { type: "image_url", image_url: { url: `data:${mime};base64,${a.b64}` } };
}

export function corpoOpenAi(p: PedidoOpenAi, modelo: string): Record<string, unknown> {
  return {
    model: modelo,
    max_completion_tokens: p.maxTokens,
    ...(p.temperature !== undefined && aceitaTemperaturaOpenAi(modelo) ? { temperature: p.temperature } : {}),
    ...(p.json ? { response_format: { type: "json_object" } } : {}),
    messages: [
      ...(p.system ? [{ role: "system", content: p.system }] : []),
      { role: "user", content: p.arquivo ? [{ type: "text", text: p.user }, parteDoArquivo(p.arquivo)] : p.user },
    ],
  };
}

/** The text OpenAI answered, or null (no key, HTTP error, timeout, empty answer). Never throws. */
export async function pedirOpenAi(p: PedidoOpenAi, deps: DepsOpenAi = {}): Promise<string | null> {
  const aviso = deps.aviso ?? ((m: string) => console.warn(m));
  const chave = deps.chave ?? env("OPENAI_API_KEY") ?? "";
  if (!chave) { aviso(`${p.quem}: openai sem chave`); return null; }
  const doSegredo = env("OPENAI_MODEL_TEXTO");
  const modelos = [...new Set(deps.modelos ?? [...(doSegredo ? [doSegredo] : []), ...MODELOS_OPENAI_PADRAO])];
  for (const modelo of modelos) {
    try {
      const res = await (deps.fetchFn ?? fetch)("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${chave}` },
        signal: AbortSignal.timeout(p.timeoutMs),
        body: JSON.stringify(corpoOpenAi(p, modelo)),
      });
      if (!res.ok) {
        aviso(`${p.quem}: openai ${res.status}`);
        if (res.status === 400 || res.status === 404) continue; // model not accepted: try the next
        return null;
      }
      const j = await res.json() as { choices?: { message?: { content?: unknown } }[] };
      const c = j?.choices?.[0]?.message?.content;
      const texto = (typeof c === "string" ? c : "").trim();
      if (!texto) { aviso(`${p.quem}: openai vazio`); return null; }
      return texto;
    } catch (e) {
      aviso(`${p.quem}: openai sem resposta (${(e as Error)?.name ?? "erro"})`);
      return null;
    }
  }
  return null;
}

/** Speech to text (the vendor talking to the Mentor). Returns the transcription, "" when there is
 *  no speech, or null when OpenAI could not answer. Never throws. */
export async function transcreverOpenAi(
  p: { quem: string; audio: Uint8Array; mime: string; timeoutMs: number },
  deps: DepsOpenAi = {},
): Promise<string | null> {
  const aviso = deps.aviso ?? ((m: string) => console.warn(m));
  const chave = deps.chave ?? env("OPENAI_API_KEY") ?? "";
  if (!chave) { aviso(`${p.quem}: openai sem chave`); return null; }
  const doSegredo = env("OPENAI_STT_MODEL");
  const modelos = [...new Set(deps.modelos ?? [...(doSegredo ? [doSegredo] : []), "gpt-4o-mini-transcribe", "whisper-1"])];
  const ext = /mp4|m4a|aac/.test(p.mime) ? "m4a" : /ogg/.test(p.mime) ? "ogg" : /wav/.test(p.mime) ? "wav" : /mpeg|mp3/.test(p.mime) ? "mp3" : "webm";
  for (const modelo of modelos) {
    try {
      const fd = new FormData();
      fd.append("model", modelo);
      fd.append("language", "pt");
      fd.append("response_format", "json");
      fd.append("file", new Blob([p.audio as unknown as BlobPart], { type: p.mime }), `fala.${ext}`);
      const res = await (deps.fetchFn ?? fetch)("https://api.openai.com/v1/audio/transcriptions", {
        method: "POST",
        headers: { authorization: `Bearer ${chave}` },
        signal: AbortSignal.timeout(p.timeoutMs),
        body: fd,
      });
      if (!res.ok) {
        aviso(`${p.quem}: openai stt ${res.status}`);
        if (res.status === 400 || res.status === 404) continue;
        return null;
      }
      const j = await res.json() as { text?: unknown };
      return typeof j?.text === "string" ? j.text.trim() : "";
    } catch (e) {
      aviso(`${p.quem}: openai stt sem resposta (${(e as Error)?.name ?? "erro"})`);
      return null;
    }
  }
  return null;
}
