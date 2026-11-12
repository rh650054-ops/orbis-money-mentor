// Vant — pluggy-webhook: a Pluggy avisa quando o banco do vendedor atualizou.
// A gente re-consulta as contas e as transacoes NA PLUGGY (nunca confia no corpo
// da notificacao) e guarda so as ENTRADAS (CREDIT) como vendas a conferir.
// Tambem concede o selo: banco conectado e atualizado = verificado.
//
// SEGURANCA: fail-closed. O segredo vem de public.pluggy_config (gerado pela
// funcao pluggy-setup, que tambem cadastra o endereco na Pluggy — ninguem digita
// nada dos dois lados). PLUGGY_WEBHOOK_SECRET ainda funciona como alternativa.
//
// 10/09/2026 — AUTO-CURA. O primeiro banco real (C6 via MeuPluggy) mostrou:
// o webhook item/created chega ANTES do app chamar pluggy-item, e era ignorado
// ("item sem conexao"). Pior: no celular (PWA + OAuth em outra aba) o app pode
// nunca receber o onSuccess do widget — e ai a conexao nunca nascia.
// Agora, se o item nao existe na Vant mas o clientUserId (carimbado por nos no
// connect_token) e de um vendedor Pro, o webhook cria a conexao sozinho.
// O item e conferido NA PLUGGY antes: o clientUserId tem que bater.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { apagarTransacoes, diasDoPrimeiroImporte, importarEntradas } from "../_shared/pluggy-entradas.ts";
import { apagarItemNaPluggy, vagaParaBanco } from "../_shared/pluggy-vaga.ts";
import { importarPiloto } from "../_shared/pluggy-piloto.ts";
import { buscarItem, importarComCarimbo } from "../_shared/pluggy-cobertura.ts";
import { autoCura } from "./auto-cura.ts";
import { resumoDoEstado } from "../_shared/pluggy-estado.ts";
import { confirmarViva, manterEstadoSeViva, type PortasDaConexao, tratoDoEvento } from "./conexao.ts";
import {
  abrirRegistro, eventoParaOLog, fecharRegistro, horaDeLimpar, limparVencidos, resultadoDe,
  type NotaDoEvento, type PortasDosEventos,
} from "./eventos.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-secret",
};

// sempre 200 depois da porta: a Pluggy reenvia sem parar se receber erro
const responder = (body: Record<string, unknown> = {}) =>
  new Response(JSON.stringify({ received: true, ...body }), {
    headers: { ...cors, "Content-Type": "application/json" },
  });

// A-PR2: when this instance last looked for expired vendor-less events (at most once an hour)
let ultimaLimpezaDosEventos = 0;

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

// 08/10/2026: entries are imported by the SHARED importer (_shared/pluggy-entradas.ts):
// one batched upsert per page instead of one request per transaction (was
// ~17k writes/day), plus is_pix / real time / own-transfer like the robot.
// A brand-new bank pulls 7 days; a refresh pulls 2 (yesterday + today).

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  // A-PR2: set once the event is accepted; closes its record whatever the exit
  let fecharEvento: ((resposta: Record<string, unknown>, dito?: string) => Promise<void>) | null = null;
  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // ---- porta: segredo do banco (preferido) ou do env (alternativa)
    const { data: cfg } = await admin.from("pluggy_config").select("webhook_secret").eq("id", "orbis").maybeSingle();
    // deno-lint-ignore no-explicit-any
    const doBanco = String((cfg as any)?.webhook_secret ?? "");
    const doEnv = Deno.env.get("PLUGGY_WEBHOOK_SECRET") ?? "";
    const veio = req.headers.get("x-webhook-secret") ??
      new URL(req.url).searchParams.get("secret") ?? "";

    const passa = (!!doBanco && veio === doBanco) || (!!doEnv && veio === doEnv);
    if (!passa) {
      console.error("pluggy-webhook: segredo invalido ou ausente — rejeitado");
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // deno-lint-ignore no-explicit-any
    const payload = await req.json().catch(() => ({} as any));

    // ---- A-PR2 (shadow): the chosen fields of the event are stored before anything is done with it.
    // Nothing reads of_eventos; a failure here is logged and changes nothing below.
    const portasDosEventos: PortasDosEventos = {
      inserir: async (linha) => {
        const { data, error } = await admin.from("of_eventos").insert(linha).select("id")
          .abortSignal(AbortSignal.timeout(3000)).maybeSingle();
        if (error) {
          if (error.code === "23505") return "repetido";
          console.error("pluggy-webhook: of_eventos insert", error.code ?? "sem_codigo"); // the code only
          return null;
        }
        // deno-lint-ignore no-explicit-any
        const id = Number((data as any)?.id);
        return Number.isFinite(id) ? id : null;
      },
      fechar: async (id, campos) => {
        const { data, error } = await admin.from("of_eventos").update(campos).eq("id", id).select("id")
          .abortSignal(AbortSignal.timeout(3000));
        if (error) console.error("pluggy-webhook: of_eventos update", error.code ?? "sem_codigo");
        return !error && Array.isArray(data) && data.length > 0;
      },
      limparSemVendedor: async (antesDe) => {
        const { data, error } = await admin.from("of_eventos").delete()
          .is("user_id", null).lt("chegou_em", antesDe).select("id").abortSignal(AbortSignal.timeout(3000));
        if (error) throw new Error(error.code ?? "sem_codigo");
        return Array.isArray(data) ? data.length : 0;
      },
      registrar: (nivel, texto, dados) =>
        (nivel === "erro" ? console.error : console.log)(texto, dados ? JSON.stringify(dados) : ""),
    };
    const registro = await abrirRegistro(portasDosEventos, payload);
    // A-PR2: the payload itself is no longer printed (it carried the vendor's and the bank's ids).
    // Only technical facts: the event type and whether it came with an id and an Item.
    console.log("pluggy-webhook evento", JSON.stringify(eventoParaOLog(registro.linha)));
    const nota: NotaDoEvento = {};
    fecharEvento = (resposta, dito) => fecharRegistro(portasDosEventos, registro, nota, resultadoDe(resposta, dito));
    // every exit below answers Pluggy exactly as before; `dito` only names the exit in the record
    const respond = async (body: Record<string, unknown> = {}, dito?: string) => {
      await fecharEvento?.(body, dito);
      return responder(body);
    };
    if (horaDeLimpar(Date.now(), ultimaLimpezaDosEventos)) {
      ultimaLimpezaDosEventos = Date.now();
      await limparVencidos(portasDosEventos, new Date());
    }

    const evento = String(payload?.event ?? "");
    const itemId = String(payload?.itemId ?? payload?.item?.id ?? "");
    const clientUserId = String(payload?.clientUserId ?? "");
    if (!evento || !itemId) return respond({}, "sem_evento_ou_item");

    const eDeItem = evento.startsWith("item/");
    const eDeTransacao = evento.toLowerCase().startsWith("transactions");
    if (!eDeItem && !eDeTransacao) return respond({ ignorado: evento });

    // deno-lint-ignore no-explicit-any
    let con: any = null;
    let consultou = false;
    // A7: a lookup that fails is not "no connection" — it is asked once more, then the event is left alone
    for (let tentativa = 0; tentativa < 2 && !consultou; tentativa++) {
      if (tentativa > 0) await new Promise((ok) => setTimeout(ok, 300));
      const { data, error } = await admin.from("bank_connections")
        .select("id, user_id, institution_name, pausado_em, leitura_ok_em, status").eq("item_id", itemId).maybeSingle();
      if (!error) { con = data; consultou = true; }
      else console.error("pluggy-webhook: consulta da conexao falhou", error.message);
    }
    nota.userId = con?.user_id ?? null; // A-PR2: the record belongs to the connection's vendor
    const trato = tratoDoEvento({ consultou, con });
    if (trato === "nao_consultada") {
      console.error("pluggy-webhook: conexao nao pode ser consultada, aviso nao tratado", evento);
      return respond({ adiado: "conexao_nao_consultada" });
    }

    const apiKey = await pluggyKey();
    if (!apiKey) {
      console.error("pluggy-webhook: auth falhou");
      return respond({}, "pluggy_sem_chave");
    }

    // ---- o item, direto da Pluggy (status, banco, dono)
    nota.item = null; // A-PR2: from here on the consultation was attempted; a failure stays recorded as such
    const itRes = await fetch(`https://api.pluggy.ai/items/${encodeURIComponent(itemId)}`, {
      headers: { "X-API-KEY": apiKey }, signal: AbortSignal.timeout(20000),
    });
    // deno-lint-ignore no-explicit-any
    const item: any = itRes.ok ? await itRes.json().catch(() => null) : null;
    nota.item = item; // A-PR2: the state consulted goes into the record (null + the HTTP status when there is none)
    nota.httpDaConsulta = itRes.status;
    const status = String(item?.status ?? "");
    const dono = String(item?.clientUserId ?? clientUserId);
    // A3: what Pluggy says about the connection and the consent, and what we make of it (no personal data)
    if (item) console.log("pluggy estado", JSON.stringify({ conexao: con?.id ?? null, evento, ...resumoDoEstado(item) }));

    // A7 (race): writes to an existing connection carry "and status <> 'deleted'" in the database
    const portasDaConexao: PortasDaConexao = {
      gravarSeViva: async (id, campos) => {
        const { data, error } = await admin.from("bank_connections").update(campos)
          .eq("id", id).neq("status", "deleted").select("id");
        if (error) console.error("pluggy-webhook: estado nao gravado", error.message);
        return !error && Array.isArray(data) && data.length > 0;
      },
      aindaViva: async (id) => {
        const { data, error } = await admin.from("bank_connections").select("id")
          .eq("id", id).neq("status", "deleted").maybeSingle();
        if (error) console.error("pluggy-webhook: conexao nao confirmada", error.message);
        return !error && !!data;
      },
    };
    const encerrarRemovida = (etapa: string) => {
      console.log("pluggy-webhook: conexao removida (ou nao confirmada) durante o processamento, nada foi reativado",
        JSON.stringify({ conexao: con?.id ?? null, evento, etapa }));
      return respond({ removida: true });
    };

    // ---- AUTO-CURA: item sem conexao na Vant, mas com dono conhecido e Pro
    // A7: a removed connection never comes back on its own. Nothing is written, no badge, no import.
    // The Item is NOT deleted on Pluggy here: that it still exists is only reported.
    if (trato === "removida") {
      console.log("pluggy-webhook: evento para conexao removida, nada foi alterado",
        JSON.stringify({ conexao: con.id, evento, item_existe_na_pluggy: !!item }));
      return respond({ removida: true });
    }

    if (!con) {
      const cura = await autoCura({
        ehPro: async (id) => (await admin.rpc("orbis_pro_ativo", { p_user: id })).data === true,
        vaga: (id, banco, it) => vagaParaBanco(admin, id, banco, it),
        apagarNaPluggy: async (it) => { await apagarItemNaPluggy(apiKey, it); },
        gravar: async (linha) => {
          const { data: nova, error } = await admin.from("bank_connections")
            .upsert(linha, { onConflict: "item_id" }).select("id, user_id, institution_name").maybeSingle();
          if (error) console.error("pluggy-webhook: auto-cura nao gravou", error.message);
          return nova ?? null;
        },
        agora: () => new Date(),
        registrar: (msg, ...detalhes) => console.log(msg, ...detalhes),
      }, { itemId, item, dono });
      if ("recusa" in cura) {
        return respond(cura.recusa === "limite_indisponivel" ? { adiado: cura.recusa } : {}, `recusa:${cura.recusa}`);
      }
      con = cura.con;
      nota.userId = con?.user_id ?? null; // A-PR2
    } else {
      // conexao existe: so mantem o status honesto (LOGIN_ERROR, OUTDATED, UPDATED...)
      // A3: when Pluggy's reason depends on the seller (USER_INPUT_TIMEOUT, revoked consent...), that
      // reason is stored instead of "OUTDATED": the app offers "Autorizar" and the robot stops pulling
      // A7 (race): the write itself refuses a connection removed since the lookup
      if (await manterEstadoSeViva(portasDaConexao, { conId: con.id, item, agora: new Date() }) === "removida") {
        return encerrarRemovida("estado");
      }
    }

    // eventos de "esperando o usuario" / erro nao trazem extrato novo
    const temExtrato = eDeTransacao || evento === "item/updated" || evento === "item/created" ||
      evento === "item/login_succeeded";
    if (!temExtrato || (status && status !== "UPDATED")) {
      return respond({ status, sem_extrato: true });
    }

    // 04/11: lost access → the bank is paused (removed after 7 days): nothing is imported
    if (con?.pausado_em) return respond({ status, pausado: true });

    // A7 (race): the connection must still be valid right before the badge and the import
    if (await confirmarViva(portasDaConexao, con.id) === "removida") return encerrarRemovida("antes_do_selo");

    // banco atualizou de verdade → o vendedor vira VERIFICADO
    const { error: eSelo } = await admin.rpc("banco_conceder_selo", { p_user: con.user_id });
    if (eSelo) console.error("pluggy-webhook: selo", eSelo.message);

    // 04/11 (audit OF1): a deletion re-reads 7 days first, so a re-issued twin is in before anything goes
    const apagou = evento.toLowerCase() === "transactions/deleted";
    // F-02: the item fetched above is the "before"; it is looked at again after the read
    const { r, carimbo } = await importarComCarimbo({
      buscar: () => buscarItem(apiKey, itemId),
      importar: () => importarEntradas(admin, apiKey, itemId, con.user_id, con.id,
        evento === "item/created" ? diasDoPrimeiroImporte() : apagou ? 7 : 2),
      atual: con.leitura_ok_em, antes: item, rotulo: con.id,
    });

    // 21/10/2026: Pluggy removed these transactions (Mercado Pago re-issues Pix with new ids).
    // 04/11: only the ones with a twin already stored go (apagarTransacoes).
    if (apagou) {
      const n = await apagarTransacoes(admin, con.id, payload?.transactionIds ?? payload?.data?.transactionIds);
      console.log("pluggy-webhook: transacoes apagadas", n);
    }

    // 15/10/2026: balances, card and investments too. The robot and pluggy-sync read
    // them right when they ask the bank to refresh, so they got the OLD numbers; the
    // fresh ones only arrive with this event. Re-queried on Pluggy (no new refresh,
    // no Open Finance budget spent).
    if (eDeItem) {
      try {
        const p = await importarPiloto(admin, apiKey, itemId, con.user_id, con.id, con.institution_name ?? null);
        // 02/11: new statement rows need the analysis (own transfers → "entre contas", learned
        // rules, card bill). Without it a Pix between his own accounts counted as spent AND received.
        if (p.gravadas > 0) {
          const { error } = await admin.rpc("extrato_analisar_padroes", { p_uid: con.user_id });
          if (error) console.error("pluggy-webhook: analisar_padroes", error.message);
        }
      } catch (e) {
        console.error("pluggy-webhook: piloto", (e as Error)?.message);
      }
    }

    const agoraLeitura = new Date().toISOString();
    // 05/11 (audit #2): only a complete read proves "no Pix that day"
    // F-02: stamped with Pluggy's own sync time for this item, not with our clock
    await admin.from("bank_connections").update({
      last_synced_at: agoraLeitura,
      updated_at: agoraLeitura,
      ...(carimbo ? { leitura_ok_em: carimbo } : {}),
    }).eq("id", con.id).neq("status", "deleted"); // A7: never over a removal

    // Pix novo pode ter caído num dia já fechado: refaz Pix/cartão/calote desses dias.
    // F-02: also when the bank is now known to cover a closed day (even with no new entry)
    if (r.gravadas > 0 || carimbo) {
      const { error: eRec } = await admin.rpc("banco_reconciliar", { p_user: con.user_id });
      if (eRec) console.error("pluggy-webhook: reconciliar", eRec.message);
    }

    console.log(`pluggy-webhook: ${r.gravadas} entradas (conexao ${con.id})`); // A-PR2: no longer the vendor's id
    return respond({ gravadas: r.gravadas });
  } catch (e) {
    console.error("pluggy-webhook", e);
    await fecharEvento?.({}, "erro"); // A-PR2: never throws
    return responder();
  }
});
