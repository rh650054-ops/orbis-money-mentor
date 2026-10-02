/* ============================================================
   ALERTAS DE RANKING (Rick, 07/09): "fulano te ultrapassou" (vermelho) e
   "você passou fulano". Os eventos nascem no banco, dentro do recálculo de
   posições (ranking_eventos). Aqui a gente:
     1) carrega os não vistos das últimas 48h ao abrir o app;
     2) escuta em tempo real os novos (Supabase Realtime);
     3) se o app está em segundo plano, manda pro service worker mostrar
        a notificação no celular (toque abre o ranking).

   UM CARD POR DIREÇÃO (Rick, 02/10): se três pessoas te passam em sequência
   (#2 → #3 → #5), o usuário vê UM banner: "Gabriel, Ana e +1 te passaram ·
   você caiu de #2 pra #5" — nunca uma pilha de cards. O mesmo vale pra
   "você passou". Dispensar o card marca todos os eventos do grupo como vistos.
   Todo hook acima do primeiro return.
   ============================================================ */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { avisar } from "@/shared/lib/avisar";

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

/** Vários eventos da mesma direção, resumidos num card só. */
export interface GrupoAlerta {
  tipo: RankingAlerta["tipo"];
  /** id do evento mais recente — serve de chave estável pro card */
  id: string;
  ids: string[];
  nomes: string[];
  /** quem te passou por último / quem você passou por último (pro X1 e pro avatar) */
  outro_user_id: string | null;
  outro_avatar: string | null;
  /** onde você estava antes do primeiro evento e onde ficou depois do último */
  posicao_antes: number | null;
  posicao_depois: number | null;
}

const primeiroNome = (n: string | null | undefined) => (n || "alguém").trim().split(/\s+/)[0] || "alguém";

/** "Ana", "Ana e João", "Ana, João e +2" */
function listaNomes(nomes: string[]): string {
  if (nomes.length <= 1) return nomes[0] ?? "alguém";
  if (nomes.length === 2) return `${nomes[0]} e ${nomes[1]}`;
  return `${nomes[0]}, ${nomes[1]} e +${nomes.length - 2}`;
}

export function agruparAlertas(lista: RankingAlerta[]): GrupoAlerta[] {
  const grupos: GrupoAlerta[] = [];
  for (const tipo of ["foi_ultrapassado", "ultrapassou"] as const) {
    // lista já vem do mais novo pro mais antigo
    const doTipo = lista.filter((a) => a.tipo === tipo);
    if (!doTipo.length) continue;
    const novo = doTipo[0], velho = doTipo[doTipo.length - 1];
    const nomes = [...new Set(doTipo.map((a) => primeiroNome(a.outro_nome)))];
    grupos.push({
      tipo, id: novo.id, ids: doTipo.map((a) => a.id), nomes,
      outro_user_id: novo.outro_user_id, outro_avatar: novo.outro_avatar,
      posicao_antes: velho.posicao_antes, posicao_depois: novo.posicao_depois,
    });
  }
  return grupos;
}

export function textoGrupo(g: GrupoAlerta): { titulo: string; corpo: string } {
  const quem = listaNomes(g.nomes);
  const varios = g.nomes.length > 1;
  const temPos = g.posicao_antes != null && g.posicao_depois != null && g.posicao_antes !== g.posicao_depois;
  if (g.tipo === "foi_ultrapassado") {
    const corpo = temPos ? `Você caiu de #${g.posicao_antes} pra #${g.posicao_depois}. Uma venda a mais e você volta.`
      : g.posicao_depois ? `Você caiu pra #${g.posicao_depois}. Uma venda a mais e você volta.` : "Você perdeu posição no ranking.";
    return { titulo: varios ? `${quem} te passaram` : `${quem} te ultrapassou`, corpo };
  }
  const corpo = temPos ? `De #${g.posicao_antes} pra #${g.posicao_depois} do mês.` : g.posicao_depois ? `Agora você é o #${g.posicao_depois} do mês.` : "Você subiu no ranking.";
  return { titulo: `Você passou ${quem}`, corpo };
}

/** Mantido pra quem só tem um evento na mão (service worker, testes). */
export function textoAlerta(a: RankingAlerta): { titulo: string; corpo: string } {
  return textoGrupo(agruparAlertas([a])[0]);
}

export function useRankingAlertas(userId: string | undefined) {
  const [alertas, setAlertas] = useState<RankingAlerta[]>([]);

  // 1) não vistos das últimas 48h (até 30: o agrupamento resume, e "dispensar" limpa tudo)
  useEffect(() => {
    if (!userId) { setAlertas([]); return; }
    let vivo = true;
    (async () => {
      const desde = new Date(Date.now() - 48 * 3600 * 1000).toISOString();
      const { data } = await supabase
        .from("ranking_eventos" as any)
        .select("id, tipo, outro_user_id, outro_nome, outro_avatar, posicao_antes, posicao_depois, created_at")
        .eq("user_id", userId).is("visto_em", null).gte("created_at", desde)
        .order("created_at", { ascending: false }).limit(30);
      if (vivo) setAlertas(((data as any[]) || []) as RankingAlerta[]);
    })().catch(() => { /* offline: sem alerta, sem erro */ });
    return () => { vivo = false; };
  }, [userId]);

  // 2) tempo real. A notificação do sistema (app em segundo plano) é UMA só:
  //    espera 2s de silêncio e manda o resumo do grupo, não um aviso por evento.
  const pendentesSW = useRef<RankingAlerta[]>([]);
  const timerSW = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!userId) return;
    const ch = supabase
      .channel(`ranking-alertas-${userId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "ranking_eventos", filter: `user_id=eq.${userId}` }, (payload) => {
        const a = payload.new as RankingAlerta;
        setAlertas((lista) => [a, ...lista.filter((x) => x.id !== a.id)].slice(0, 30));
        try {
          if (typeof document !== "undefined" && document.hidden && "serviceWorker" in navigator) {
            pendentesSW.current = [a, ...pendentesSW.current.filter((x) => x.id !== a.id)];
            if (timerSW.current) clearTimeout(timerSW.current);
            timerSW.current = setTimeout(() => {
              const grupos = agruparAlertas(pendentesSW.current); pendentesSW.current = [];
              // um evento de cada direção no máximo; o de "te passaram" vai primeiro
              for (const g of grupos) {
                const { titulo, corpo } = textoGrupo(g);
                navigator.serviceWorker.ready
                  .then((reg) => reg.active?.postMessage({ type: "orbis-ranking-alert", data: { title: g.tipo === "foi_ultrapassado" ? `🔻 ${titulo}` : `🔺 ${titulo}`, body: corpo, tag: `ranking-${g.tipo}` } }))
                  .catch(() => { /* nada */ });
              }
            }, 2000);
          }
        } catch (e) { avisar.silencioso("useRankingAlertas: notificar service worker", e); }
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); if (timerSW.current) clearTimeout(timerSW.current); };
  }, [userId]);

  const grupos = useMemo(() => agruparAlertas(alertas), [alertas]);

  const marcarVistos = useCallback(async (ids: string[]) => {
    if (!ids.length) return;
    setAlertas((lista) => lista.filter((a) => !ids.includes(a.id)));
    try {
      const { error } = await supabase.from("ranking_eventos" as any).update({ visto_em: new Date().toISOString() }).in("id", ids);
      if (error) avisar.erro("useRankingAlertas: marcar alertas como vistos", error);
    } catch (e) { avisar.erro("useRankingAlertas: marcar alertas como vistos", e); }
  }, []);

  const dispensar = useCallback((id: string) => marcarVistos([id]), [marcarVistos]);
  const dispensarGrupo = useCallback((g: GrupoAlerta) => marcarVistos(g.ids), [marcarVistos]);
  const dispensarTodos = useCallback(() => marcarVistos(alertas.map((a) => a.id)), [alertas, marcarVistos]);

  return { alertas, grupos, dispensar, dispensarGrupo, dispensarTodos };
}
