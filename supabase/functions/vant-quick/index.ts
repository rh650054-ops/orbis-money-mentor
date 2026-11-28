// Vant — vant-quick. Called by the iPhone's VANT Quick (home screen widget / lock screen Live
// Activity) in the background, with NO user session: the proof of who is calling is the device
// credential (Authorization: Bearer vq1_...), checked in the database (vant_quick_executar):
// only its SHA-256 is stored there, it is scoped to "quick sale / approach / today's panel" of its
// own account, expires, and is revoked on sign-out or account switch.
// verify_jwt = false in config.toml (there is no Supabase JWT on this path).
//
// It decides nothing itself: the rules (DEFCON running, block not paused, the account's own quick
// sale value, usage limits, idempotency by the tap's id) live in SQL, so the widget, the app and the
// tests apply the same ones. It never logs the token.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface Banco {
  rpc(nome: string, args?: Record<string, unknown>): PromiseLike<{ data: unknown; error: { message: string } | null }>;
}
export interface Deps { db: Banco }

const ACOES = new Set(["venda", "abordagem", "painel", "status"]);
const ORIGENS = new Set(["widget", "atividade"]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TOKEN = /^vq1_[0-9a-f]{64}$/;

/** HTTP status of each refusal: the iPhone shows the reason and never calls a refusal "confirmed". */
const STATUS: Record<string, number> = {
  credencial_invalida: 401, credencial_expirada: 401,
  desativado: 503,
  rapido_demais: 429, limite_do_dia: 429,
  encerrada: 409,
  sem_defcon: 409, defcon_nao_habilitado: 409, atualize_outro_aparelho: 409, bloco_parado: 409, sem_valor: 409,
  acao_invalida: 400, origem_invalida: 400, id_obrigatorio: 400,
};

const json = (obj: unknown, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });

export async function tratarVantQuick(req: Request, deps: Deps = depsDoServidor()): Promise<Response> {
  if (req.method !== "POST") return json({ ok: false, motivo: "metodo" }, 405);
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!TOKEN.test(token)) return json({ ok: false, motivo: "credencial_invalida" }, 401);
  const corpo = (await req.json().catch(() => null)) as { acao?: unknown; id?: unknown; origem?: unknown } | null;
  const acao = typeof corpo?.acao === "string" ? corpo.acao : "";
  const origem = typeof corpo?.origem === "string" ? corpo.origem : "widget";
  const id = typeof corpo?.id === "string" ? corpo.id.toLowerCase() : null;
  if (!ACOES.has(acao) || !ORIGENS.has(origem)) return json({ ok: false, motivo: "acao_invalida" }, 400);
  if (acao !== "painel" && (!id || !UUID.test(id))) return json({ ok: false, motivo: "id_obrigatorio" }, 400);

  const { data, error } = await deps.db.rpc("vant_quick_executar", { p_token: token, p_acao: acao, p_id: acao === "painel" ? null : id, p_origem: origem });
  if (error) {
    // the database did not answer: the tap's outcome is UNKNOWN; the iPhone resends the same id
    console.error("vant-quick: database error", acao);
    return json({ ok: false, motivo: "inconclusivo" }, 503);
  }
  const r = (data ?? {}) as { ok?: boolean; motivo?: string };
  if (r.ok) return json(r, 200);
  return json(r, STATUS[r.motivo ?? ""] ?? 400);
}

let doServidor: Deps | null = null;
function depsDoServidor(): Deps {
  if (doServidor) return doServidor;
  const env = (k: string) => Deno.env.get(k) ?? "";
  const c = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });
  doServidor = { db: { rpc: (nome, args) => c.rpc(nome, args) } };
  return doServidor;
}

if (typeof Deno !== "undefined" && typeof Deno.serve === "function") Deno.serve((req) => tratarVantQuick(req));
