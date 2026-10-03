// Vant — pluggy-hora: leitura do Pix de quem tem banco ligado.
// Roda pelo cron a cada 5 min (8h → 23h55 em Brasília), + 0h02 pra fechar o dia.
// O PEDIDO de atualização à Pluggy é no máximo 1 por hora por banco (limite
// da Pluggy: o cron das :07 batia em 59min59s e metade voltava 409). A leitura
// do que a Pluggy já tem roda em todas as rodadas.
// O vendedor pode fechar o app às 19h: o Pix das 21h ainda entra no ranking,
// porque quem lê o banco é o servidor, não o celular dele.
//
// Pra cada conexão: importa o que a Pluggy já tem (hoje e ontem, com is_pix,
// hora real e transferência entre contas próprias) e pede uma atualização nova
// (PATCH no item). A resposta da atualização chega pelo pluggy-webhook; o que
// ela trouxer é enriquecido na leitura da hora seguinte.
//
// SEGURANÇA: só roda com o cabeçalho x-orbis-cron, cujo valor mora em
// painel_tokens (nome='cron'), o mesmo do mp-sync. Sem ele: 401.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { pluggyKey, importarEntradas, pedirAtualizacao } from "../_shared/pluggy-entradas.ts";
import { importarPiloto } from "../_shared/pluggy-piloto.ts";

const MAX_POR_RODADA = 40;
const PEDIDO_MIN = 61 * 60_000; // 1 pedido por hora (limite da Pluggy, contado do lado dela com alguns segundos a mais)

Deno.serve(async (req) => {
  const json = (o: unknown, s = 200) =>
    new Response(JSON.stringify(o), { status: s, headers: { "Content-Type": "application/json" } });

  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
    const enviado = req.headers.get("x-orbis-cron") ?? "";
    const { data: tk } = await admin.from("painel_tokens").select("token").eq("nome", "cron").maybeSingle();
    const esperado = String(tk?.token ?? "");
    if (!esperado || enviado !== esperado) return json({ error: "nao_autorizado" }, 401);

    const apiKey = await pluggyKey();
    if (!apiKey) return json({ error: "pluggy_nao_configurado" });

    // quem está há mais tempo sem leitura vai primeiro
    const { data: cons } = await admin.from("bank_connections")
      .select("id, item_id, user_id, status, last_synced_at, institution_name, pluggy_pedido_em")
      .neq("status", "deleted")
      .order("last_synced_at", { ascending: true, nullsFirst: true })
      .limit(MAX_POR_RODADA);
    // deno-lint-ignore no-explicit-any
    const lista: any[] = cons ?? [];

    let lidas = 0, pix = 0, pedidos = 0, falhas = 0, saldos = 0, piloto = 0;
    const comNovidade = new Set<string>();
    for (const c of lista) {
      try {
        const r = await importarEntradas(admin, apiKey, c.item_id, c.user_id, c.id, 1);
        lidas += r.gravadas;
        pix += r.pix;
      } catch (e) {
        falhas++;
        console.error("pluggy-hora: importar", c.id, (e as Error)?.message);
      }
      // Piloto Automático (etapa 3): saldo + cada movimentação no Raio-X, já categorizada
      try {
        const p = await importarPiloto(admin, apiKey, c.item_id, c.user_id, c.id, c.institution_name ?? null);
        saldos += p.saldos;
        piloto += p.gravadas;
        if (p.gravadas > 0 || ((p as { corrigidas?: number }).corrigidas ?? 0) > 0) comNovidade.add(c.user_id);
      } catch (e) {
        console.error("pluggy-hora: piloto", c.id, (e as Error)?.message);
      }
      const agora = new Date().toISOString();
      // deno-lint-ignore no-explicit-any
      const mudar: Record<string, any> = { last_synced_at: agora, updated_at: agora };
      const ultimo = c.pluggy_pedido_em ? Date.parse(c.pluggy_pedido_em) : 0;
      if (Date.now() - ultimo >= PEDIDO_MIN && await pedirAtualizacao(apiKey, c.item_id)) {
        pedidos++;
        mudar.pluggy_pedido_em = agora;
      }
      await admin.from("bank_connections").update(mudar).eq("id", c.id);
    }
    // a inteligência do Raio-X (entre contas, regras do vendedor, recorrência, perguntas)
    for (const uid of comNovidade) {
      const { error } = await admin.rpc("extrato_analisar_padroes", { p_uid: uid });
      if (error) console.error("pluggy-hora: analisar_padroes", error.message);
    }
    console.log("pluggy-hora", { conexoes: lista.length, lidas, pix, pedidos, falhas, saldos, piloto });
    return json({ ok: true, conexoes: lista.length, lidas, pix, pedidos, falhas, saldos, piloto });
  } catch (e) {
    console.error("pluggy-hora", e);
    return json({ error: "erro_interno" }, 500);
  }
});
