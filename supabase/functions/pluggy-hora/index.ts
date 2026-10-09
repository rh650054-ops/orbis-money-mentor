// Vant — pluggy-hora: the robot that reads vendors' banks (Pluggy / Open Finance).
// Runs every 5 min from pg_cron, but since 08/10/2026 it only READS a bank when
// the agenda says so (_shared/pluggy-agenda.ts): every 40 min during Modo Foco,
// right after the Foco, once after midnight, and a calm read every ~4h during the
// day only while the bank's monthly budget has room to spare.
//
// Each read: imports what Pluggy already has (since the day before the last
// read, so a gap never loses entries) and, when the bank's MONTHLY BUDGET allows
// (Open Finance caps 240 fresh pulls/month per CPF + bank), asks Pluggy for a
// fresh pull from the bank (PATCH). The fresh data arrives via pluggy-webhook.
// The Raio-X (Piloto Automático) is refreshed only on morning, after-Foco and
// closing reads — not every Foco hour.
//
// SECURITY: only runs with the x-orbis-cron header, whose value lives in
// painel_tokens (nome='cron'), same as mp-sync. Without it: 401.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { pluggyKey, importarEntradas, pedirAtualizacao } from "../_shared/pluggy-entradas.ts";
import { importarPiloto } from "../_shared/pluggy-piloto.ts";
import {
  precisaDoVendedor, motivoDeLeitura, contarLeitura, leiturasDeHoje, relogioBRT, orcamentoDaConexao, contarPedido,
  podePedir, diasParaImportar, MAX_POR_RODADA, PEDIDO_MIN_PADRAO_MIN, PRIORIDADE, type Motivo,
} from "../_shared/pluggy-agenda.ts";

/** Minutes between two fresh pulls of one bank. Pluggy's API cap is 1/h on new
 *  accounts; when their support lifts it, set PLUGGY_PEDIDO_MIN_MIN (e.g. 15). */
const PEDIDO_MIN_MIN = Number(Deno.env.get("PLUGGY_PEDIDO_MIN_MIN") ?? PEDIDO_MIN_PADRAO_MIN) || PEDIDO_MIN_PADRAO_MIN;

/** A Foco session counts as "on" only while the app keeps touching it. */
const FOCO_VIVO_MS = 30 * 60_000;

Deno.serve(async (req) => {
  const json = (o: unknown, s = 200) =>
    new Response(JSON.stringify(o), { status: s, headers: { "Content-Type": "application/json" } });

  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
    const enviado = req.headers.get("x-orbis-cron") ?? "";
    const { data: tk } = await admin.from("painel_tokens").select("token").eq("nome", "cron").maybeSingle();
    const esperado = String(tk?.token ?? "");
    if (!esperado || enviado !== esperado) return json({ error: "nao_autorizado" }, 401);

    const agora = new Date();
    const { dia: hoje } = relogioBRT(agora);

    const { data: cons } = await admin.from("bank_connections")
      .select("id, item_id, user_id, status, last_synced_at, institution_name, pluggy_pedido_em, leituras_dia, leituras_qtd, pedidos_mes, pedidos_mes_qtd, pedidos_dia, pedidos_dia_qtd")
      .neq("status", "deleted");
    // deno-lint-ignore no-explicit-any
    const conexoes: any[] = cons ?? [];
    if (conexoes.length === 0) return json({ ok: true, conexoes: 0, lidas: 0 });

    const globais = conexoes.reduce((s, c) => s + leiturasDeHoje(c.leituras_dia, c.leituras_qtd, hoje), 0);

    // today's Foco sessions of these vendors (Brasília date)
    const donos = [...new Set(conexoes.map((c) => c.user_id))];
    const { data: sess } = await admin.from("challenge_sessions")
      .select("user_id, status, updated_at, ended_at")
      .eq("date", hoje).in("user_id", donos);
    const focoAtivo = new Set<string>();
    const focoFim = new Map<string, Date>();
    for (const s of sess ?? []) {
      const vivo = s.status === "active" && s.updated_at && agora.getTime() - Date.parse(s.updated_at) < FOCO_VIVO_MS;
      if (vivo) focoAtivo.add(s.user_id);
      if (s.ended_at) {
        const fim = new Date(s.ended_at);
        const antes = focoFim.get(s.user_id);
        if (!antes || fim > antes) focoFim.set(s.user_id, fim);
      }
    }

    // who is due now, most urgent first, capped per run (spreads the peaks)
    type Orc = ReturnType<typeof orcamentoDaConexao>;
    const devidas: { c: (typeof conexoes)[number]; motivo: Motivo; orc: Orc }[] = [];
    for (const c of conexoes) {
      if (precisaDoVendedor(c.status)) continue; // espera o vendedor autorizar de novo
      const orc = orcamentoDaConexao(c, agora);
      const motivo = motivoDeLeitura({
        agora,
        userId: c.user_id,
        ultimaLeitura: c.last_synced_at ? new Date(c.last_synced_at) : null,
        ultimoPedido: c.pluggy_pedido_em ? new Date(c.pluggy_pedido_em) : null,
        disponivelHoje: orc.disponivelHoje,
        cotaDoDia: orc.cotaDoDia,
        pedidoMinMin: PEDIDO_MIN_MIN,
        focoAtivo: focoAtivo.has(c.user_id),
        focoFimEm: focoFim.get(c.user_id) ?? null,
        leiturasHoje: leiturasDeHoje(c.leituras_dia, c.leituras_qtd, hoje),
        leiturasGlobaisHoje: globais,
      });
      if (motivo) devidas.push({ c, motivo, orc });
    }
    devidas.sort((a, b) =>
      PRIORIDADE[a.motivo] - PRIORIDADE[b.motivo] ||
      Date.parse(a.c.last_synced_at ?? "1970-01-01") - Date.parse(b.c.last_synced_at ?? "1970-01-01"));
    const rodada = devidas.slice(0, MAX_POR_RODADA);
    if (rodada.length === 0) return json({ ok: true, conexoes: conexoes.length, devidas: 0, globais });

    const apiKey = await pluggyKey();
    if (!apiKey) return json({ error: "pluggy_nao_configurado" });

    let lidas = 0, pix = 0, pedidos = 0, falhas = 0, piloto = 0;
    const porMotivo: Record<string, number> = {};
    const comNovidade = new Set<string>();
    for (const { c, motivo, orc } of rodada) {
      porMotivo[motivo] = (porMotivo[motivo] ?? 0) + 1;
      const ultimaLeitura = c.last_synced_at ? new Date(c.last_synced_at) : null;
      try {
        const dias = diasParaImportar(ultimaLeitura, new Date(), motivo === "fechamento" ? 2 : 1);
        const r = await importarEntradas(admin, apiKey, c.item_id, c.user_id, c.id, dias);
        lidas += r.gravadas;
        pix += r.pix;
      } catch (e) {
        falhas++;
        console.error("pluggy-hora: importar", c.id, (e as Error)?.message);
      }
      if (motivo !== "foco") {
        try {
          const p = await importarPiloto(admin, apiKey, c.item_id, c.user_id, c.id, c.institution_name ?? null);
          piloto += p.gravadas;
          if (p.gravadas > 0 || ((p as { corrigidas?: number }).corrigidas ?? 0) > 0) comNovidade.add(c.user_id);
        } catch (e) {
          console.error("pluggy-hora: piloto", c.id, (e as Error)?.message);
        }
      }
      const agoraIso = new Date().toISOString();
      // deno-lint-ignore no-explicit-any
      const mudar: Record<string, any> = {
        last_synced_at: agoraIso,
        updated_at: agoraIso,
        leituras_dia: hoje,
        leituras_qtd: contarLeitura(c.leituras_dia, c.leituras_qtd, hoje),
      };
      const ultimoPedido = c.pluggy_pedido_em ? new Date(c.pluggy_pedido_em) : null;
      if (podePedir(ultimoPedido, orc.disponivelHoje, new Date(), PEDIDO_MIN_MIN, { motivo, restanteMes: orc.restanteMes }) && await pedirAtualizacao(apiKey, c.item_id)) {
        pedidos++;
        mudar.pluggy_pedido_em = agoraIso;
        Object.assign(mudar, contarPedido(orc));
      }
      await admin.from("bank_connections").update(mudar).eq("id", c.id);
    }
    for (const uid of comNovidade) {
      const { error } = await admin.rpc("extrato_analisar_padroes", { p_uid: uid });
      if (error) console.error("pluggy-hora: analisar_padroes", error.message);
    }
    const resumo = {
      conexoes: conexoes.length, devidas: devidas.length, lidas_agora: rodada.length,
      porMotivo, entradas: lidas, pix, pedidos, falhas, piloto, globais: globais + rodada.length,
    };
    console.log("pluggy-hora", resumo);
    return json({ ok: true, ...resumo });
  } catch (e) {
    console.error("pluggy-hora", e);
    return json({ error: "erro_interno" }, 500);
  }
});
