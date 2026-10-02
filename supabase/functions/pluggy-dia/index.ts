// Vant — pluggy-dia: leitura de madrugada de cartão, parcelas, empréstimos,
// investimentos e cheque especial de quem tem banco ligado (etapa 4).
// Roda pelo cron às 3h20 de Brasília. Mesma porta do pluggy-hora e do mp-sync:
// cabeçalho x-orbis-cron com o token de painel_tokens (nome='cron'). Sem ele: 401.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { pluggyKey } from "../_shared/pluggy-entradas.ts";
import { importarDia } from "../_shared/pluggy-dia.ts";

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

    const { data: cons } = await admin.from("bank_connections")
      .select("id, item_id, user_id, institution_name").neq("status", "deleted").limit(60);
    // deno-lint-ignore no-explicit-any
    const lista: any[] = cons ?? [];
    const total = { conexoes: lista.length, cartoes: 0, parcelas: 0, emprestimos: 0, investimentos: 0, cheque: 0, falhas: 0 };
    // deno-lint-ignore no-explicit-any
    const campos: any[] = [];
    for (const c of lista) {
      try {
        const r = await importarDia(admin, apiKey, c.item_id, c.user_id, c.id, c.institution_name ?? null);
        total.cartoes += r.cartoes; total.parcelas += r.parcelas; total.emprestimos += r.emprestimos;
        total.investimentos += r.investimentos; total.cheque += r.cheque;
        campos.push({ banco: c.institution_name, ...r.campos });
      } catch (e) {
        total.falhas++;
        console.error("pluggy-dia", c.id, (e as Error)?.message);
      }
    }
    console.log("pluggy-dia", total);
    return json({ ok: true, ...total, campos });
  } catch (e) {
    console.error("pluggy-dia", e);
    return json({ error: "erro_interno" }, 500);
  }
});
