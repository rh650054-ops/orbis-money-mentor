/* ============================================================
   ALERTAS DE RANKING (Rick, 07/09): "fulano te ultrapassou" (vermelho) e
   "você passou fulano". Os eventos nascem no banco, dentro do recálculo de
   posições (ranking_eventos). Aqui a gente:
     1) carrega os não vistos das últimas 48h ao abrir o app;
     2) escuta em tempo real os novos (Supabase Realtime);
     3) se o app está em segundo plano, manda pro service worker mostrar
        a notificação no celular (toque abre o ranking).
   Todo hook acima do primeiro return.
   ============================================================ */
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface RankingAlerta {
  id: string;
  tipo: "ultrapassou" | "foi_ultrapassado";
  outro_user_id: string | null;
  outro_nome: string | null;
  outro_avatar: string | null;
  posicao_antes: number | null;
  posicao_depois: number | null;
  created_at: string;
}

const primeiroNome = (n: string | null | undefined) => (n || "alguém").trim().split(/\s+/)[0] || "alguém";

export function textoAlerta(a: RankingAlerta): { titulo: string; corpo: string } {
  const nome = primeiroNome(a.outro_nome);
  if (a.tipo === "foi_ultrapassado") {
    return { titulo: `${nome} te ultrapassou`, corpo: a.posicao_depois ? `Você caiu pra #${a.posicao_depois}. Uma venda a mais e você volta.` : "Você perdeu uma posição no ranking." };
  }
  return { titulo: `Você passou ${nome}`, corpo: a.posicao_depois ? `Agora você é o #${a.posicao_depois} do mês.` : "Você subiu no ranking." };
}

export function useRankingAlertas(userId: string | undefined) {
  const [alertas, setAlertas] = useState<RankingAlerta[]>([]);

  // 1) não vistos das últimas 48h
  useEffect(() => {
    if (!userId) { setAlertas([]); return; }
    let vivo = true;
    (async () => {
      const desde = new Date(Date.now() - 48 * 3600 * 1000).toISOString();
      const { data } = await supabase
        .from("ranking_eventos" as any)
        .select("id, tipo, outro_user_id, outro_nome, outro_avatar, posicao_antes, posicao_depois, created_at")
        .eq("user_id", userId).is("visto_em", null).gte("created_at", desde)
        .order("created_at", { ascending: false }).limit(3);
      if (vivo) setAlertas(((data as any[]) || []) as RankingAlerta[]);
    })().catch(() => { /* offline: sem alerta, sem erro */ });
    return () => { vivo = false; };
  }, [userId]);

  // 2) tempo real
  useEffect(() => {
    if (!userId) return;
    const ch = supabase
      .channel(`ranking-alertas-${userId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "ranking_eventos", filter: `user_id=eq.${userId}` }, (payload) => {
        const a = payload.new as RankingAlerta;
        setAlertas((lista) => [a, ...lista.filter((x) => x.id !== a.id)].slice(0, 3));
        // 3) app em segundo plano → notificação do sistema
        try {
          if (typeof document !== "undefined" && document.hidden && "serviceWorker" in navigator) {
            const { titulo, corpo } = textoAlerta(a);
            navigator.serviceWorker.ready
              .then((reg) => reg.active?.postMessage({ type: "orbis-ranking-alert", data: { title: a.tipo === "foi_ultrapassado" ? `🔻 ${titulo}` : `🔺 ${titulo}`, body: corpo } }))
              .catch(() => { /* nada */ });
          }
        } catch { /* nada */ }
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [userId]);

  const dispensar = useCallback(async (id: string) => {
    setAlertas((lista) => lista.filter((a) => a.id !== id));
    try { await supabase.from("ranking_eventos" as any).update({ visto_em: new Date().toISOString() }).eq("id", id); } catch { /* nada */ }
  }, []);

  const dispensarTodos = useCallback(async () => {
    const ids = alertas.map((a) => a.id);
    setAlertas([]);
    if (!ids.length) return;
    try { await supabase.from("ranking_eventos" as any).update({ visto_em: new Date().toISOString() }).in("id", ids); } catch { /* nada */ }
  }, [alertas]);

  return { alertas, dispensar, dispensarTodos };
}
