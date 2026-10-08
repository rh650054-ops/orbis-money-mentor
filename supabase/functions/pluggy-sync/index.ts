// Vant — pluggy-sync: "puxa agora" o extrato do banco do vendedor logado.
// Chamado pelo fechamento do dia: antes de mostrar "caiu X no Pix", a Vant
// pede pra Pluggy atualizar o item (PATCH) e importa o que ja existe la.
// A atualizacao de verdade chega depois pelo pluggy-webhook (item/updated);
// aqui e o melhor que da pra ter NA HORA, sem o vendedor esperar.
//
// Freio: a Pluggy aceita 1 pedido de atualizacao por hora por banco (03/10).
// TRAVAS (08/10/2026): this read counts in the same daily budget as the robot
// (_shared/pluggy-agenda.ts): at most 1 read every 10 min per bank and
// LIMITE_DIA reads per day. Past that it answers {travado:true} without
// touching Pluggy — the app keeps showing the last value it has.
// The fresh pull from the bank (PATCH) comes out of the bank's MONTHLY budget
// (Open Finance: 240/month per CPF + bank); without budget it only imports
// what Pluggy already has.
// 02/10/2026: o importador mora em _shared/pluggy-entradas.ts (o mesmo do
// pluggy-hora) e agora grava is_pix, transacted_at e own_transfer.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { pluggyKey, importarEntradas, pedirAtualizacao } from "../_shared/pluggy-entradas.ts";
import { importarPiloto } from "../_shared/pluggy-piloto.ts";
import {
  podePuxarAgora, contarLeitura, leiturasDeHoje, relogioBRT, orcamentoDaConexao, contarPedido, podePedir,
  diasParaImportar, PEDIDO_MIN_PADRAO_MIN,
} from "../_shared/pluggy-agenda.ts";

const PEDIDO_MIN_MIN = Number(Deno.env.get("PLUGGY_PEDIDO_MIN_MIN") ?? PEDIDO_MIN_PADRAO_MIN) || PEDIDO_MIN_PADRAO_MIN;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

    const admin = createClient(URL_SUPA, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
    const { data: cons } = await admin.from("bank_connections")
      .select("id, item_id, status, last_synced_at, pluggy_pedido_em, institution_name, leituras_dia, leituras_qtd, pedidos_mes, pedidos_mes_qtd, pedidos_dia, pedidos_dia_qtd").eq("user_id", uid).neq("status", "deleted");
    const { dia: hoje } = relogioBRT(new Date());
    // deno-lint-ignore no-explicit-any
    const todas: any[] = cons ?? [];
    if (todas.length === 0) return json({ ok: true, conexoes: 0, entradas: 0 });
    const lista = todas.filter((c) =>
      podePuxarAgora(c.last_synced_at ? new Date(c.last_synced_at) : null, leiturasDeHoje(c.leituras_dia, c.leituras_qtd, hoje), new Date()));
    if (lista.length === 0) return json({ ok: true, conexoes: todas.length, entradas: 0, travado: true });

    const apiKey = await pluggyKey();
    if (!apiKey) return json({ error: "pluggy_nao_configurado" });

    let entradas = 0;
    let pediu = 0;
    let piloto = 0;
    for (const c of lista) {
      // fresh pull only within Pluggy's hourly cap AND the bank's monthly Open Finance budget
      const orc = orcamentoDaConexao(c, new Date());
      const ultimoPedido = c.pluggy_pedido_em ? new Date(c.pluggy_pedido_em) : null;
      let pediuEste = false;
      // called at the end of the Foco / day closing → spends the reserve, like the after-Foco read
      if (podePedir(ultimoPedido, orc.disponivelHoje, new Date(), PEDIDO_MIN_MIN, { motivo: "pos_foco", restanteMes: orc.restanteMes }) && await pedirAtualizacao(apiKey, c.item_id)) { pediu++; pediuEste = true; }
      try {
        const dias = diasParaImportar(c.last_synced_at ? new Date(c.last_synced_at) : null, new Date(), 2);
        const r = await importarEntradas(admin, apiKey, c.item_id, uid, c.id, dias);
        entradas += r.gravadas;
      } catch (e) { console.error("pluggy-sync: importar", (e as Error)?.message); }
      // 04/10: saldo + gastos (Raio-X) também na leitura pedida pelo app, não só no cron
      try {
        const p = await importarPiloto(admin, apiKey, c.item_id, uid, c.id, c.institution_name ?? null);
        piloto += p.gravadas;
      } catch (e) { console.error("pluggy-sync: piloto", (e as Error)?.message); }
      const agora = new Date().toISOString();
      const leitura = { last_synced_at: agora, updated_at: agora, leituras_dia: hoje, leituras_qtd: contarLeitura(c.leituras_dia, c.leituras_qtd, hoje) };
      await admin.from("bank_connections")
        .update(pediuEste ? { ...leitura, pluggy_pedido_em: agora, ...contarPedido(orc) } : leitura)
        .eq("id", c.id);
    }
    if (piloto > 0) {
      const { error } = await admin.rpc("extrato_analisar_padroes", { p_uid: uid });
      if (error) console.error("pluggy-sync: analisar_padroes", error.message);
    }
    return json({ ok: true, conexoes: lista.length, entradas, piloto, pediu_atualizacao: pediu });
  } catch (e) {
    console.error("pluggy-sync", e);
    return json({ error: "erro_interno" }, 500);
  }
});
