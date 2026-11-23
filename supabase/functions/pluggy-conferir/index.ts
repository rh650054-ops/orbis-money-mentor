// Vant — pluggy-conferir: READ-ONLY check of stored bank entries against Pluggy.
// For one connection and up to 7 days it answers, pair by pair, with the evidence needed before a
// stored copy may be taken out (see _shared/pluggy-conferencia.ts and supabase/reconciliacao/README.md).
//
// It writes NOTHING: the database is only read (select) and Pluggy is only read (GET, plus the
// usual POST /auth that returns the API key). It asks Pluggy for no refresh and touches no Item.
// Logs carry counts only — no id, amount, name, document or reference.
//
// SECURITY: only runs with the x-orbis-cron header, whose value lives in painel_tokens
// (nome='cron'), same as pluggy-hora. Without it: 401. Deploy with verify_jwt = false.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { existeNaPluggy, pluggyKey, urlTransacoes } from "../_shared/pluggy-entradas.ts";
import { quandoFoi } from "../_shared/pluggy-entradas.ts";
import { conferirConexao, type DoExtrato, type Guardada, linhaDoExtrato, type Movimento, type Portas } from "../_shared/pluggy-conferencia.ts";

const MAX_PAGINAS = 20;
const CAMPOS = "transaction_id, amount, description, transaction_date, transacted_at, is_pix, pagador_nome, pagador_doc, status, daily_sale_id, created_at";

Deno.serve(async (req) => {
  const json = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "Content-Type": "application/json" } });
  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
    const enviado = req.headers.get("x-orbis-cron") ?? "";
    const { data: tk } = await admin.from("painel_tokens").select("token").eq("nome", "cron").maybeSingle();
    const esperado = String(tk?.token ?? "");
    if (!esperado || enviado !== esperado) return json({ error: "nao_autorizado" }, 401);

    const pedido = await req.json().catch(() => ({}));
    const apiKey = await pluggyKey();
    if (!apiKey) return json({ error: "pluggy_indisponivel" }, 503);

    const portas: Portas = {
      async conexao(id) {
        const { data } = await admin.from("bank_connections").select("id, item_id, institution_name").eq("id", id).maybeSingle();
        return data ? { id: String(data.id), item_id: String(data.item_id), institution_name: data.institution_name ?? null } : null;
      },
      async contas(itemId) {
        const r = await fetch(`https://api.pluggy.ai/accounts?itemId=${encodeURIComponent(itemId)}`, { headers: { "X-API-KEY": apiKey }, signal: AbortSignal.timeout(25000) });
        if (!r.ok) return null;
        // deno-lint-ignore no-explicit-any
        const contas: any[] = (await r.json().catch(() => ({})))?.results ?? [];
        return contas.filter((c) => String(c?.type ?? "").toUpperCase() === "BANK").map((c) => String(c.id));
      },
      async extrato(conta, de, ate, horasAtraso) {
        const txs: DoExtrato[] = [];
        const movimentos: Movimento[] = []; // credits AND debits, for the balance chain
        let cursor: string | null = null;
        for (let pagina = 0; pagina < MAX_PAGINAS; pagina++) {
          const u = cursor ? urlTransacoes(conta, de, cursor) : `${urlTransacoes(conta, de, null)}&dateTo=${ate}`;
          const r = await fetch(u, { headers: { "X-API-KEY": apiKey }, signal: AbortSignal.timeout(25000) });
          if (!r.ok) return { txs, completo: false, movimentos };
          // deno-lint-ignore no-explicit-any
          const corpo: any = await r.json().catch(() => ({}));
          for (const t of corpo?.results ?? []) {
            const valor = Math.abs(Number(t?.amount));
            if (!t?.id || !(valor > 0)) continue;
            movimentos.push({ dia: quandoFoi(t, horasAtraso).dia, valor: t?.type === "DEBIT" ? -valor : valor, saldo: typeof t?.balance === "number" ? t.balance : null });
            if (t?.type === "CREDIT") txs.push(linhaDoExtrato(t, conta, horasAtraso));
          }
          cursor = corpo?.next ? String(corpo.next) : null;
          if (!cursor) return { txs, completo: true, movimentos };
        }
        return { txs, completo: false, movimentos };
      },
      async guardadas(conexaoId, de, ate) {
        // conta_id / provedor_ref exist only after the identity migration; without them the check still works
        const ler = async (campos: string): Promise<{ data: unknown[] | null; error: unknown }> =>
          await admin.from("auto_detected_sales").select(campos).eq("bank_connection_id", conexaoId).gte("transaction_date", de).lte("transaction_date", ate).limit(5000);
        let r = await ler(`${CAMPOS}, conta_id, provedor_ref`);
        if (r.error) r = await ler(CAMPOS);
        return r.error ? null : ((r.data ?? []) as Guardada[]).map((g) => ({ ...g, amount: Number(g.amount), is_pix: !!g.is_pix }));
      },
      async comRevisao(ids) {
        const com = new Set<string>();
        for (let i = 0; i < ids.length; i += 100) {
          const { data, error } = await admin.from("banco_entradas_revisao").select("transaction_id").in("transaction_id", ids.slice(i, i + 100));
          if (error) return null;
          for (const d of data ?? []) com.add(String(d.transaction_id));
        }
        return com;
      },
      existe: (id) => existeNaPluggy(apiKey, id),
    };

    const r = await conferirConexao(portas, pedido);
    if ("erro" in r) return json(r, r.erro === "pedido_invalido" ? 400 : r.erro === "conexao_nao_encontrada" ? 404 : 502);
    console.log("pluggy conferir", JSON.stringify({
      conexao: r.conexao, dias: r.dias.length, extrato_completo: r.extrato_completo, saldo: r.saldo.estado, quebras: r.saldo.quebras, perguntadas: r.perguntadas_por_id,
      por_id: r.dias.reduce((s, d) => s + d.comprovadas_por_id, 0), por_contagem: r.dias.reduce((s, d) => s + d.comprovadas_por_contagem, 0),
      ambiguas: r.dias.reduce((s, d) => s + d.ambiguas, 0), faltando: r.dias.reduce((s, d) => s + d.faltando, 0),
    }));
    return json(r);
  } catch (e) {
    console.error("pluggy-conferir", (e as Error)?.message);
    return json({ error: "falhou" }, 500);
  }
});
