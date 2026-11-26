// Vant — hotmart-sandbox-teste (Rick, 26/11/2026). TEMPORARY, stage 0 of "Gerar Pix".
// Talks ONLY to the Hotmart sandbox (fictitious data, no real charge) with the sandbox
// credentials (HOTMART_SANDBOX_*). It never reads the production Hotmart credentials and
// never calls developers.hotmart.com. It writes nothing to the database.
// Door: header x-orbis-cron (painel_tokens nome='cron'). Tokens and secrets are never returned or logged.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SANDBOX = "https://sandbox.hotmart.com"; // the only API host this function calls
const TOKEN_URL = "https://api-sec-vlc.hotmart.com/security/oauth/token"; // OAuth only (no financial endpoint)

const json = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "Content-Type": "application/json" } });

async function token(): Promise<{ token: string | null; info: Record<string, unknown> }> {
  const id = Deno.env.get("HOTMART_SANDBOX_CLIENT_ID"), segredo = Deno.env.get("HOTMART_SANDBOX_CLIENT_SECRET"), basic = Deno.env.get("HOTMART_SANDBOX_BASIC");
  if (!id || !segredo || !basic) return { token: null, info: { erro: "faltam_secrets_sandbox", tem_id: !!id, tem_segredo: !!segredo, tem_basic: !!basic } };
  const qs = new URLSearchParams({ grant_type: "client_credentials", client_id: id, client_secret: segredo });
  const r = await fetch(`${TOKEN_URL}?${qs}`, { method: "POST", headers: { Authorization: basic.startsWith("Basic ") ? basic : `Basic ${basic}` } });
  const b = await r.json().catch(() => ({})) as Record<string, unknown>;
  return { token: typeof b.access_token === "string" ? b.access_token : null,
    info: { http: r.status, token_type: b.token_type ?? null, expires_in: b.expires_in ?? null, scope: b.scope ?? null, erro: b.error ?? null } };
}

async function api(tk: string, caminho: string, init: RequestInit = {}) {
  const r = await fetch(`${SANDBOX}${caminho}`, { ...init, headers: { Authorization: `Bearer ${tk}`, "Content-Type": "application/json", ...(init.headers ?? {}) }, signal: AbortSignal.timeout(20000) });
  const texto = await r.text();
  let corpo: unknown = texto.slice(0, 600);
  try { corpo = JSON.parse(texto); } catch { /* keep text */ }
  return { http: r.status, corpo };
}

/** CRC16-CCITT (0x1021, init 0xFFFF) of the Pix EMV payload, as BR Code requires. */
function crc16(s: string): string {
  let crc = 0xffff;
  for (const ch of new TextEncoder().encode(s)) {
    crc ^= ch << 8;
    for (let i = 0; i < 8; i++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}
function tlv(s: string): Record<string, string> {
  const o: Record<string, string> = {};
  for (let i = 0; i + 4 <= s.length;) { const id = s.slice(i, i + 2), n = Number(s.slice(i + 2, i + 4)); if (!Number.isFinite(n)) break; o[id] = s.slice(i + 4, i + 4 + n); i += 4 + n; }
  return o;
}
/** Checks a Pix copia e cola without returning it whole. */
function validarPix(code: unknown) {
  if (typeof code !== "string" || !code) return { presente: false };
  const t = tlv(code);
  const crcOk = code.length > 8 && code.slice(-8, -4) === "6304" && crc16(code.slice(0, -4)) === code.slice(-4).toUpperCase();
  const conta = tlv(t["26"] ?? "");
  return { presente: true, tamanho: code.length, inicio: code.slice(0, 14), formato_emv: t["00"] === "01", crc_ok: crcOk,
    gui: conta["00"] ?? null, tem_url_ou_chave: !!(conta["01"] || conta["25"]), valor_no_pix: t["54"] ?? null, moeda: t["53"] ?? null, pais: t["58"] ?? null };
}
const dataMs = (v: unknown) => (typeof v === "number" ? new Date(v).toISOString() : v ?? null);
function resumoNegociacao(r: { http: number; corpo: unknown }) {
  const c = (r.corpo ?? {}) as { subscription_id?: unknown; transaction?: unknown; payment?: { type?: unknown; expiration_date?: unknown; pix_code?: unknown; pix_qrcode?: unknown } };
  let link: string | null = null;
  try { link = c.payment?.pix_qrcode ? new URL(String(c.payment.pix_qrcode)).host : null; } catch { link = String(c.payment?.pix_qrcode ?? "").slice(0, 40); }
  const bruto = JSON.stringify(r.corpo).slice(0, 700); // sandbox only: fictitious data
  return r.http >= 400 || !c.payment ? { http: r.http, erro: r.corpo, bruto }
    : { http: r.http, subscription_id: c.subscription_id ?? null, transaction: c.transaction ?? null, tipo: c.payment.type ?? null,
        vence_em: dataMs(c.payment.expiration_date), qrcode_host: link, qrcode_e_url: !!link && !String(c.payment.pix_qrcode).startsWith("data:"), pix: validarPix(c.payment.pix_code), bruto };
}

Deno.serve(async (req) => {
  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
    const cron = req.headers.get("x-orbis-cron") ?? "";
    const { data: tk } = await admin.from("painel_tokens").select("token").eq("nome", "cron").maybeSingle();
    if (!cron || !tk?.token || cron !== String(tk.token)) return json({ error: "nao_autorizado" }, 401);
    const p = await req.json().catch(() => ({})) as { acao?: string; codigo?: string; subscription_id?: number; recorrencias?: number[]; vezes?: number; status?: string; tipo?: string };

    const { token: t, info } = await token();
    if (p.acao === "auth" || !t) return json({ etapa: "auth", ok: !!t, ...info });

    if (p.acao === "assinaturas") {
      const qs = new URLSearchParams({ max_results: "20", ...(p.status ? { status: p.status } : {}) });
      const r = await api(t, `/payments/api/v1/subscriptions?${qs}`);
      const itens = ((r.corpo as { items?: Record<string, unknown>[] })?.items ?? []).map((i) => ({
        subscription_id: i.subscription_id, subscriber_code: i.subscriber_code, status: i.status,
        plano: (i.plan as { name?: unknown } | undefined)?.name ?? null, recorrencia_paga: (i.plan as { recurrency_period?: unknown } | undefined)?.recurrency_period ?? null,
        proxima_cobranca: dataMs(i.date_next_charge), adesao: dataMs(i.accession_date), produto: (i.product as { id?: unknown } | undefined)?.id ?? null,
      }));
      return json({ etapa: "assinaturas", http: r.http, total: (r.corpo as { page_info?: { total_results?: unknown } })?.page_info?.total_results ?? itens.length, itens, erro: r.http >= 400 ? r.corpo : undefined });
    }

    if (p.acao === "compras" && p.codigo) {
      const r = await api(t, `/payments/api/v1/subscriptions/${encodeURIComponent(p.codigo)}/purchases`);
      const lista = Array.isArray(r.corpo) ? r.corpo as Record<string, unknown>[] : ((r.corpo as { items?: Record<string, unknown>[] })?.items ?? []);
      return json({ etapa: "compras", http: r.http, compras: lista.map((c) => ({ transaction: c.transaction, status: c.status, recorrencia: c.recurrency_number, tipo: c.payment_type,
        valor: (c.price as { value?: unknown } | undefined)?.value ?? null, aprovado: dataMs(c.approved_date), criado: dataMs(c.order_date) })), erro: r.http >= 400 ? r.corpo : undefined, bruto: JSON.stringify(r.corpo).slice(0, 500) });
    }

    if (p.acao === "negociar" && p.subscription_id && p.recorrencias?.length) {
      const vezes = Math.min(Math.max(p.vezes ?? 1, 1), 3);
      const tentativas = [];
      for (let i = 0; i < vezes; i++) {
        const r = await api(t, "/payments/api/v1/installments/negotiate", { method: "POST",
          body: JSON.stringify({ subscription_id: p.subscription_id, recurrences: p.recorrencias, payment_type: p.tipo === "SEM_TIPO" ? undefined : "PIX" }) });
        tentativas.push(resumoNegociacao(r));
      }
      const tx = tentativas.map((x) => (x as { transaction?: unknown }).transaction).filter(Boolean);
      return json({ etapa: "negociar", tentativas, transacoes_distintas: new Set(tx).size });
    }
    return json({ error: "acao_invalida", acoes: ["auth", "assinaturas", "compras", "negociar"] }, 400);
  } catch (e) {
    return json({ error: "erro_interno", detalhe: e instanceof Error ? e.message.slice(0, 200) : "?" }, 500);
  }
});
