// Vant — pluggy-hora: leitura de hora em hora do Pix de quem tem banco ligado.
// Roda pelo cron (8h → 23h em Brasília, + 0h05 pra fechar o dia anterior).
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

const MAX_POR_RODADA = 40;

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
      .select("id, item_id, user_id, status, last_synced_at")
      .neq("status", "deleted")
      .order("last_synced_at", { ascending: true, nullsFirst: true })
      .limit(MAX_POR_RODADA);
    // deno-lint-ignore no-explicit-any
    const lista: any[] = cons ?? [];

    let lidas = 0, pix = 0, pedidos = 0, falhas = 0;
    for (const c of lista) {
      try {
        const r = await importarEntradas(admin, apiKey, c.item_id, c.user_id, c.id, 1);
        lidas += r.gravadas;
        pix += r.pix;
      } catch (e) {
        falhas++;
        console.error("pluggy-hora: importar", c.id, (e as Error)?.message);
      }
      if (await pedirAtualizacao(apiKey, c.item_id)) pedidos++;
      await admin.from("bank_connections")
        .update({ last_synced_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("id", c.id);
    }
    console.log("pluggy-hora", { conexoes: lista.length, lidas, pix, pedidos, falhas });
    return json({ ok: true, conexoes: lista.length, lidas, pix, pedidos, falhas });
  } catch (e) {
    console.error("pluggy-hora", e);
    return json({ error: "erro_interno" }, 500);
  }
});
