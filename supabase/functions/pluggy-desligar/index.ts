// Vant — pluggy-desligar: o vendedor desconecta um banco pela tela Vant Pro (03/10/2026).
//
// 1) Confere que a conexão é DELE (pelo login, nunca pelo corpo do pedido).
// 2) Apaga o item na Pluggy: a Vant para de ter acesso ao banco na hora.
//    Se a Pluggy já não conhece o item (404), segue: o objetivo já está cumprido.
// 3) Marca a conexão como 'deleted'. Nada é apagado do Vant: o Pix já lido fica
//    no histórico, mas banco desconectado não conta mais (banco_pix_por_dia),
//    sai da home de Finanças e do selo (usuario_verificado).
// Não mexe em pluggy-item nem pluggy-webhook.
// A8 (12/11/2026): the steps and what happens when one of them is not answered live in ./desligar.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { pluggyKey } from "../_shared/pluggy-entradas.ts";
import { desligar, type ItemApagado, type PortasDoDesligar } from "./desligar.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function apagarItem(itemId: string): Promise<ItemApagado> {
  let apiKey: string | null;
  try { apiKey = await pluggyKey(); } catch { return "sem_resposta"; }
  if (!apiKey) return "sem_chave";
  let r: Response;
  try {
    r = await fetch(`https://api.pluggy.ai/items/${encodeURIComponent(itemId)}`, {
      method: "DELETE", headers: { "X-API-KEY": apiKey }, signal: AbortSignal.timeout(20000),
    });
  } catch { return "sem_resposta"; }
  if (r.ok) return "apagado";
  if (r.status === 404) return "ja_nao_existia";
  console.error("pluggy-desligar: pluggy", r.status, (await r.text().catch(() => "")).slice(0, 160));
  return "recusou";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const json = (o: unknown, s = 200) =>
    new Response(JSON.stringify(o), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

  try {
    const URL_SUPA = Deno.env.get("SUPABASE_URL") ?? "";
    const auth = req.headers.get("Authorization") ?? "";
    if (!auth) return json({ error: "sem_login" }, 401);
    const supa = createClient(URL_SUPA, Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
      global: { headers: { Authorization: auth } },
    });
    const { data: u } = await supa.auth.getUser();
    const uid = u?.user?.id;
    if (!uid) return json({ error: "sem_login" }, 401);

    const corpo = await req.json().catch(() => ({}));
    const admin = createClient(URL_SUPA, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");

    const portas: PortasDoDesligar = {
      conexao: async (id, dono) => {
        const { data, error } = await admin.from("bank_connections")
          .select("id, item_id, status, institution_name")
          .eq("id", id).eq("user_id", dono).maybeSingle();
        if (error) { console.error("pluggy-desligar: consulta", error.message); return { ok: false }; }
        return { ok: true, con: data ?? null };
      },
      apagarItem,
      marcarRemovida: async (id, dono, agora) => {
        const { data, error } = await admin.from("bank_connections")
          .update({ status: "deleted", updated_at: agora }).eq("id", id).eq("user_id", dono).select("id");
        if (error) console.error("pluggy-desligar: update", error.message);
        return !error && Array.isArray(data) && data.length > 0;
      },
      espera: (ms) => new Promise((ok) => setTimeout(ok, ms)),
      registrar: (nivel, texto, dados) => (nivel === "erro" ? console.error : console.log)(texto, JSON.stringify(dados)),
    };

    const r = await desligar(portas, { uid, conexaoId: String(corpo?.conexao_id ?? ""), agora: new Date() });
    return json(r.corpo, r.http);
  } catch (e) {
    console.error("pluggy-desligar", e);
    return json({ error: "erro_interno" }, 500);
  }
});
