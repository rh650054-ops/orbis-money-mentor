// recuperar-senha — "esqueci minha senha" por CÓDIGO, sem login (verify_jwt = false).
//
//   { acao: "pedir",     cpf }                       → { ok: true, desafio }   (sempre igual)
//   { acao: "verificar", desafio, codigo }           → { ok: true, token } | { ok: false, erro }
//   { acao: "trocar",    token, senha, confirmacao } → { ok: true }        | { ok: false, erro }
//
// As regras moram em ../_shared/recuperacao-senha.ts; o banco valida e consome tudo
// de forma atômica (migration 20261011140000). A chave service_role fica só aqui no
// servidor. Nenhuma sessão é criada: depois de trocar a senha a pessoa entra pelo
// login normal (CPF + senha nova) e todas as sessões antigas são derrubadas.
// Logs: só nomes de evento — nunca código, senha, token, CPF ou e-mail.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { enviarEmail, layoutEmail, sha256Hex } from "../_shared/email.ts";
import { type Deps, pedir, trocar, verificar } from "../_shared/recuperacao-senha.ts";

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void } | undefined;

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") ?? "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown) =>
  new Response(JSON.stringify(body), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await admin.rpc(fn, args);
  if (error) throw new Error(`rpc ${fn}`); // sem detalhes: podem ecoar argumentos
  return data as T;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

const deps: Deps = {
  frear: (chave, teto, janela) => rpc<boolean>("cadastro_pode_tentar", { p_chave: chave, p_teto: teto, p_janela_min: janela }),
  criarDesafio: async (id, cpf) => {
    const rows = await rpc<{ email: string; nome: string | null; codigo: string }[]>("senha_desafio_criar", { p_id: id, p_cpf: cpf });
    return rows?.[0] ?? null;
  },
  invalidarDesafio: async (id) => { await rpc("senha_desafio_invalidar", { p_id: id }); },
  verificarDesafio: async (id, codigo) => {
    const rows = await rpc<{ status: string; troca_token: string | null }[]>("senha_desafio_verificar", { p_id: id, p_codigo: codigo });
    return { status: rows?.[0]?.status ?? "invalido", token: rows?.[0]?.troca_token ?? null };
  },
  consumirTroca: async (token) => {
    const rows = await rpc<{ desafio_id: string; user_id: string }[]>("senha_troca_consumir", { p_token: token });
    const r = rows?.[0];
    return r ? { desafioId: r.desafio_id, userId: r.user_id } : null;
  },
  reabrirTroca: async (id) => { await rpc("senha_troca_reabrir", { p_desafio: id }); },
  concluirTroca: async (id) => { await rpc("senha_troca_concluir", { p_desafio: id }); },
  trocarSenha: async (userId, senha) => {
    const { error } = await admin.auth.admin.updateUserById(userId, { password: senha });
    if (!error) return true;
    // 4xx = o Auth recusou a senha (política); 5xx/rede = indisponível
    if (typeof error.status === "number" && error.status >= 400 && error.status < 500) return false;
    throw new Error("auth");
  },
  enviarCodigo: (email, nome, codigo) =>
    enviarEmail({
      to: email,
      subject: "Seu código para trocar a senha da Vant",
      html: layoutEmail(
        `Oi, ${esc(nome ?? "vendedor")}`,
        `<p>Use este código no app pra criar uma senha nova:</p>
         <p style="font-size:32px;letter-spacing:8px;font-weight:700;color:#ffffff;margin:16px 0">${codigo}</p>
         <p>Ele vale por 15 minutos e só funciona uma vez. Se você não pediu, ignore: sua senha continua a mesma.</p>`,
      ),
    }),
  hash: sha256Hex,
  novoId: () => crypto.randomUUID(),
  log: (evento) => console.error(`recuperar-senha: ${evento}`),
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ ok: false, erro: "indisponivel" });

  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const ip = (req.headers.get("x-forwarded-for") ?? "?").split(",")[0]!.trim();

  switch (body?.acao) {
    case "pedir": {
      const { resposta, trabalho } = pedir(body.cpf, ip, deps);
      if (typeof EdgeRuntime !== "undefined") EdgeRuntime.waitUntil(trabalho);
      else await trabalho;
      return json(resposta);
    }
    case "verificar":
      return json(await verificar(body.desafio, body.codigo, ip, deps));
    case "trocar":
      return json(await trocar(body.token, body.senha, body.confirmacao, ip, deps));
    default:
      return json({ ok: false, erro: "indisponivel" });
  }
});
