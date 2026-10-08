/* Contexto do vendedor pra tela de Clima (saiu da página, que passou do limite):
   meta de hoje, vendido, contas vencendo, horas em que ELE mais vende (blocos do
   DEFCON dos últimos 90 dias) e o que a Vant já aprendeu do clima dele. */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getBrazilDate } from "@/shared/lib/date-utils";
import type { ContextoClima } from "@/hooks/useClima";
import { horasFortes, type PerfilHora } from "../picos";
import type { AprendizadoVendas } from "./insights";

// Tabelas que os tipos gerados (velhos) não conhecem: consulta genérica, sem `any`.
interface Q { select: (s: string) => Q; eq: (k: string, v: unknown) => Q; not: (k: string, op: string, v: unknown) => Q; lte: (k: string, v: unknown) => Q; gte: (k: string, v: unknown) => Q; order: (k: string) => Q; limit: (n: number) => Promise<{ data: Record<string, unknown>[] | null }>; maybeSingle: () => Promise<{ data: Record<string, unknown> | null }> }
const db = supabase as unknown as { from: (t: string) => Q };
const rpc = supabase as unknown as { rpc: (nome: string, args?: Record<string, unknown>) => Promise<{ data: unknown }> };

export function useContextoClima(userId: string | undefined) {
  const [contexto, setContexto] = useState<ContextoClima | null>(null);
  const [perfilHoras, setPerfilHoras] = useState<PerfilHora[]>([]);
  const [aprendizado, setAprendizado] = useState<AprendizadoVendas | null>(null);

  useEffect(() => {
    if (!userId) return;
    let vivo = true;
    (async () => {
      const hoje = getBrazilDate();
      const em7 = new Date(`${hoje}T12:00:00`); em7.setDate(em7.getDate() + 7);
      const ate = `${em7.getFullYear()}-${String(em7.getMonth() + 1).padStart(2, "0")}-${String(em7.getDate()).padStart(2, "0")}`;
      const desde = new Date(Date.now() - 90 * 86400000).toISOString();
      const [plano, perfil, vendas, contas, ficha, blocos, apr] = await Promise.all([
        db.from("daily_goal_plans").select("daily_goal").eq("user_id", userId).eq("date", hoje).maybeSingle(),
        db.from("profiles").select("monthly_goal").eq("user_id", userId).maybeSingle(),
        db.from("daily_sales").select("total_profit").eq("user_id", userId).eq("date", hoje).limit(50),
        db.from("planned_bills").select("name, amount, due_date").eq("user_id", userId).eq("paid", false).not("due_date", "is", null).lte("due_date", ate).order("due_date").limit(4),
        db.from("orbis_ficha").select("melhor_hora").eq("user_id", userId).maybeSingle(),
        db.from("challenge_blocks").select("started_at, sales_count").eq("user_id", userId).gte("started_at", desde).limit(1000),
        rpc.rpc("clima_meu_aprendizado"),
      ]);
      if (!vivo) return;
      const metaPlano = Number(plano.data?.daily_goal ?? 0);
      const mensal = Number(perfil.data?.monthly_goal ?? 0);
      const meta = metaPlano > 0 ? metaPlano : mensal > 0 ? Math.round(mensal / 26) : 0;
      const vendidoHoje = (vendas.data ?? []).reduce((s, r) => s + (Number(r.total_profit) || 0), 0);
      const mapa = new Map<number, { vendas: number; blocos: number }>();
      for (const b of blocos.data ?? []) {
        if (!b.started_at) continue;
        const h = Number(new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", hour12: false }).format(new Date(String(b.started_at))));
        const at = mapa.get(h) ?? { vendas: 0, blocos: 0 };
        at.vendas += Number(b.sales_count) || 0; at.blocos += 1;
        mapa.set(h, at);
      }
      const horasDele = [...mapa.entries()].map(([hora, v]) => ({ hora, ...v }));
      const a = (apr.data ?? null) as AprendizadoVendas | null;
      const dias = (iso: string) => Math.round((new Date(`${iso}T12:00:00`).getTime() - new Date(`${hoje}T12:00:00`).getTime()) / 86400000);
      const melhor = ficha.data?.melhor_hora;
      setPerfilHoras(horasDele);
      setAprendizado(a);
      setContexto({
        meta, vendidoHoje,
        melhorHora: melhor != null ? Number(melhor) : null,
        melhoresHoras: horasFortes(horasDele).topo,
        quedaChuvaPct: a?.queda_chuva_pct ?? null,
        contas: (contas.data ?? []).map((b) => ({ nome: String(b.name), dias: dias(String(b.due_date)), valor: Number(b.amount) || 0 })),
      });
    })().catch(() => { if (vivo) setContexto({}); });
    return () => { vivo = false; };
  }, [userId]);

  return { contexto, perfilHoras, aprendizado };
}
