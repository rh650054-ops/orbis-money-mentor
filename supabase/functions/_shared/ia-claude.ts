// VANT — one request to Anthropic (Claude) for text back (optionally reading an image or a PDF).
// Anthropic is the first provider of every text feature of the VANT; OpenAI is the reserve
// (_shared/ia-openai.ts). Gemini and Cerebras are gone (Rick, 26/11/2026).
// Rules for the caller:
//   - it has already passed the consent gate (_shared/consentimento-ia.ts);
//   - its feature names Anthropic in the disclosure (texto-ia.tsx and Privacidade.tsx).
// A failure is logged with the caller's name and the HTTP status only: never the prompt, never the
// answer, never the key. No Deno import: the app's vitest suite tests it with a fake fetch.

export interface PedidoClaude {
  /** function name, for the log line */
  quem: string;
  system?: string;
  user: string;
  maxTokens: number;
  timeoutMs: number;
  temperature?: number;
  /** overrides the default model (secret ANTHROPIC_MODEL, else Haiku) */
  modelo?: string;
  /** an image or a PDF the model has to read */
  arquivo?: { b64: string; mime: string };
}
export interface DepsClaude { chave?: string; modeloPadrao?: string; fetchFn?: typeof fetch; aviso?: (m: string) => void }

export const MODELO_CLAUDE_PADRAO = "claude-haiku-4-5-20251001";
/** The models of the 5 line refuse "temperature" with a 400: only sent to the older ones. */
export const aceitaTemperatura = (modelo: string): boolean => /haiku-4|sonnet-4|opus-4/.test(modelo);

const env = (k: string): string | undefined =>
  (globalThis as { Deno?: { env: { get(k: string): string | undefined } } }).Deno?.env.get(k);

function parteDoArquivo(a: { b64: string; mime: string }): Record<string, unknown> {
  if (a.mime.includes("pdf")) return { type: "document", source: { type: "base64", media_type: "application/pdf", data: a.b64 } };
  const mime = ["image/jpeg", "image/png", "image/gif", "image/webp"].includes(a.mime) ? a.mime : "image/jpeg";
  return { type: "image", source: { type: "base64", media_type: mime, data: a.b64 } };
}

export function corpoClaude(p: PedidoClaude, modelo: string): Record<string, unknown> {
  return {
    model: modelo,
    max_tokens: p.maxTokens,
    ...(p.temperature !== undefined && aceitaTemperatura(modelo) ? { temperature: p.temperature } : {}),
    ...(p.system ? { system: p.system } : {}),
    messages: [{ role: "user", content: p.arquivo ? [{ type: "text", text: p.user }, parteDoArquivo(p.arquivo)] : p.user }],
  };
}

/** The text Claude answered, or null (no key, HTTP error, timeout, empty answer). Never throws. */
export async function pedirClaude(p: PedidoClaude, deps: DepsClaude = {}): Promise<string | null> {
  const aviso = deps.aviso ?? ((m: string) => console.warn(m));
  const chave = deps.chave ?? env("ANTHROPIC_API_KEY") ?? "";
  if (!chave) { aviso(`${p.quem}: claude sem chave`); return null; }
  const modelo = p.modelo || deps.modeloPadrao || env("ANTHROPIC_MODEL") || MODELO_CLAUDE_PADRAO;
  try {
    const res = await (deps.fetchFn ?? fetch)("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": chave, "anthropic-version": "2023-06-01" },
      signal: AbortSignal.timeout(p.timeoutMs),
      body: JSON.stringify(corpoClaude(p, modelo)),
    });
    if (!res.ok) { aviso(`${p.quem}: claude ${res.status}`); return null; }
    const j = await res.json() as { content?: { text?: string }[] };
    const texto = (j?.content ?? []).map((b) => b?.text || "").join("").trim();
    if (!texto) { aviso(`${p.quem}: claude vazio`); return null; }
    return texto;
  } catch (e) {
    aviso(`${p.quem}: claude sem resposta (${(e as Error)?.name ?? "erro"})`);
    return null;
  }
}
