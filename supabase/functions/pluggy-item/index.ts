// Vant — pluggy-item: o widget terminou e devolveu um itemId. Aqui a gente
// CONFERE esse item na Pluggy (nunca confia no que veio da tela), guarda a
// conexao, CONCEDE O SELO DE VERIFICADO e puxa a primeira leva de entradas.
//
// Por que o selo sai aqui e nao na carteira: o selo da Vant significa
// "a conta bancaria desse vendedor foi conferida". Carteira (Mercado Pago,
// PagBank) e gratis e serve pra conciliar e cobrar — mas quem verifica e o banco.
//
// 10/09/2026: agora importa as entradas dos ultimos 7 dias NA HORA. Antes
// esperava o proximo webhook da Pluggy, que pode nunca vir (o item ja nasce
// UPDATED e a Pluggy nao manda item/updated de novo). O vendedor ligava o
// banco e via a tela vazia — parecia quebrado.
//
// 12/11/2026 (A2): the checks and the order of the registration live in ./registro.ts, which
// is tested without Deno. This file only connects it to Pluggy and to the database.
//
// Entrada: { item_id }
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { importarPiloto } from "../_shared/pluggy-piloto.ts";
import { diasDoPrimeiroImporte, importarEntradas } from "../_shared/pluggy-entradas.ts";
import { buscarItem, importarComCarimbo } from "../_shared/pluggy-cobertura.ts";
import { apagarItemNaPluggy, umPorBanco, vagaParaBanco } from "../_shared/pluggy-vaga.ts";
import { type Portas, registrarItem } from "./registro.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function pluggyKey() {
  const clientId = Deno.env.get("PLUGGY_CLIENT_ID");
  const clientSecret = Deno.env.get("PLUGGY_CLIENT_SECRET");
  if (!clientId || !clientSecret) return null;
  const r = await fetch("https://api.pluggy.ai/auth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ clientId, clientSecret }),
    signal: AbortSignal.timeout(20000),
  });
  if (!r.ok) return null;
  const { apiKey } = await r.json();
  return apiKey as string;
}

// 11/10/2026: a leitura das entradas é a mesma dos outros (../_shared/pluggy-entradas.ts):
// guarda Pix, hora exata, pagador e dono da conta.

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

    // deno-lint-ignore no-explicit-any
    const body = await req.json().catch(() => ({} as any));

    const admin = createClient(URL_SUPA, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
    let apiKey = ""; // filled by buscarItem, the first step that talks to Pluggy

    const portas: Portas = {
      ehPro: async (id) => (await supa.rpc("orbis_pro_ativo", { p_user: id })).data === true,

      // ---- confere o item NA PLUGGY (o front pode mentir; a Pluggy nao)
      buscarItem: async (itemId) => {
        const chave = await pluggyKey();
        if (!chave) return "sem_chave";
        apiKey = chave;
        const itRes = await fetch(`https://api.pluggy.ai/items/${encodeURIComponent(itemId)}`, {
          headers: { "X-API-KEY": apiKey },
          signal: AbortSignal.timeout(20000),
        });
        if (!itRes.ok) {
          console.error("pluggy item nao encontrado", itRes.status);
          return null;
        }
        const corpo = await itRes.json().catch(() => null);
        return corpo && typeof corpo === "object" ? corpo : null;
      },

      linhaDoItem: async (itemId) => {
        const { data, error } = await admin.from("bank_connections")
          .select("id, user_id, status, leitura_ok_em").eq("item_id", itemId).maybeSingle();
        if (error) throw new Error(`bank_connections: ${error.message}`);
        // deno-lint-ignore no-explicit-any
        const l = data as any;
        return l ? { id: String(l.id), user_id: String(l.user_id), status: l.status ?? null, leitura_ok_em: l.leitura_ok_em ?? null } : null;
      },

      vaga: (id, banco, itemId) => vagaParaBanco(admin, id, banco, itemId),
      apagarNaPluggy: async (itemId) => { await apagarItemNaPluggy(apiKey, itemId); },

      gravar: async (linha) => {
        const { data, error } = await admin.from("bank_connections")
          .upsert(linha, { onConflict: "item_id" }).select("id, leitura_ok_em").maybeSingle();
        if (error) console.error("pluggy-item: gravar", error.message);
        // deno-lint-ignore no-explicit-any
        const c = data as any;
        return c?.id ? { id: String(c.id), leitura_ok_em: c.leitura_ok_em ?? null } : null;
      },

      umPorBanco: async (id) => { await umPorBanco(admin, apiKey, id); },

      concederSelo: async (id) => {
        const { error: eSelo } = await admin.rpc("banco_conceder_selo", { p_user: id });
        if (eSelo) console.error("selo nao concedido", eSelo.message);
        return !eSelo;
      },

      lerEntradas: async ({ conId, uid: dono, itemId, item, leituraOk }) => {
        // 05/11 (audit #2): only a complete read proves "no Pix that day"
        // F-02: up to Pluggy's sync time for this item (same before and after the read), not our clock
        const { r, carimbo } = await importarComCarimbo({
          buscar: () => buscarItem(apiKey, itemId),
          importar: () => importarEntradas(admin, apiKey, itemId, dono, conId, diasDoPrimeiroImporte()),
          // deno-lint-ignore no-explicit-any
          atual: leituraOk, antes: item as any, rotulo: conId,
        });
        console.log(`pluggy-item: ${r.contas} contas, ${r.gravadas} entradas para ${dono}`);
        return { gravadas: r.gravadas, carimbo };
      },

      // A2: "last read" is written here, after the read, and no longer when the connection is saved
      marcarLeitura: async (conId, { lidoEm, carimbo }) => {
        const { error } = await admin.from("bank_connections")
          .update({ last_synced_at: lidoEm, ...(carimbo ? { leitura_ok_em: carimbo } : {}) }).eq("id", conId);
        if (error) console.error("pluggy-item: marcar leitura", error.message);
      },

      // 04/10 (Mohamed): o saldo e os gastos também entram NA HORA (Piloto Automático).
      // Antes só vinham na rodada do cron (8h → 0h02): banco ligado de madrugada ficava
      // vazio nas Finanças e no Raio-X até de manhã.
      lerPiloto: async ({ conId, uid: dono, itemId, banco }) => {
        const p = await importarPiloto(admin, apiKey, itemId, dono, conId, banco ?? null);
        console.log(`pluggy-item: piloto ${p.saldos} saldos, ${p.gravadas} lançamentos`);
        if (p.gravadas > 0) await admin.rpc("extrato_analisar_padroes", { p_uid: dono });
      },

      agora: () => new Date(),
      avisar: (msg, detalhe) => console.error(msg, detalhe ?? ""),
    };

    const resposta = await registrarItem(portas, uid, body?.item_id);
    return json(resposta.corpo, resposta.http);
  } catch (e) {
    console.error("pluggy-item", e);
    return json({ error: "erro_interno" }, 500);
  }
});
