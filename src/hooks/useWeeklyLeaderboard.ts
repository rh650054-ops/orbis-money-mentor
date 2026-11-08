import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getBrazilDate } from "@/shared/lib/date-utils";
import { extratoValendo } from "@/shared/lib/ranking-config";
import { LeaderboardEntry } from "@/hooks/useLeaderboard";

// A 1ª temporada começa no dia 1 (julho começou quebrado, numa quarta). Depois disso
// a semana é sempre DOMINGO → SÁBADO: durante a semana o ranking roda AO VIVO pelo
// DEFCON, e no DOMINGO todo mundo manda o extrato da semana anterior — a RPC troca
// dia a dia pelo valor verificado (sem extrato até o domingo seguinte, o dia zera).
// Temporada oficial (semana domingo→sábado) abre dia 05/07 (domingo).
const TEMPORADA_INICIO = "2026-07-05";
// REGRA OFICIAL (Rick, 08/11/2026): a partir de 02/11 a semana de competição é
// SEGUNDA 00:00 → DOMINGO 23:59:59 (Brasília), apurada na segunda seguinte às 06:00.
// Calendário de novembro: 02–08, 09–15, 16–22, 23–29 (30/11 é "Semana 5", apurada 07/12).
export const SEMANA_SEG_DOM_DESDE = "2026-11-02";
// Aquecimento (Fase 1): a janela do ranking começa FIXA no dia 01/07. Assim ele
// arranca limpo no dia 1 — SEM contar o dia anterior (30/06) — e a temporada
// oficial (segunda→domingo) assume no dia 06/07.
const PRE_SEASON_START = "2026-07-01";

const maisDias = (iso: string, n: number) => {
  const d = new Date(`${iso}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10);
};
/** Monday of the week that holds `iso` (Mon→Sun weeks). */
export function segundaDaSemana(iso: string): string {
  const dow = new Date(`${iso}T12:00:00Z`).getUTCDay(); // 0 = domingo
  return maisDias(iso, dow === 0 ? -6 : 1 - dow);
}
/** The last closed week (Mon→Sun) before `todayISO`: what the result card shows. */
export function semanaAnterior(todayISO: string = getBrazilDate()): { inicio: string; fim: string } {
  const inicio = maisDias(segundaDaSemana(todayISO), -7);
  return { inicio, fim: maisDias(inicio, 6) };
}

// Início da janela do ranking (fuso BR).
// - Fase 1 (01–04/07): janela começa FIXA em 01/07 (não conta o dia 30/06).
// - A PARTIR DE 05/07 (domingo): semana DOMINGO→SÁBADO.
export function currentWeekStart(todayISO: string = getBrazilDate()): string {
  if (todayISO >= SEMANA_SEG_DOM_DESDE) return segundaDaSemana(todayISO);
  if (todayISO < TEMPORADA_INICIO) {
    // Trava o começo no dia 01/07 (se por acaso for antes disso, usa o próprio dia).
    return todayISO < PRE_SEASON_START ? todayISO : PRE_SEASON_START;
  }
  const d = new Date(`${todayISO}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - d.getUTCDay()); // volta pro domingo (getUTCDay: 0 = domingo)
  const sunday = d.toISOString().slice(0, 10);
  if (sunday < TEMPORADA_INICIO) return TEMPORADA_INICIO;
  return sunday;
}

// Fim da janela do ranking (fuso BR).
// - Fase 1 (01–04/07): termina HOJE (janela = 01/07 → hoje).
// - A PARTIR DE 05/07: sábado da semana (domingo + 6).
export function currentWeekEnd(todayISO: string = getBrazilDate()): string {
  if (todayISO >= SEMANA_SEG_DOM_DESDE) return maisDias(segundaDaSemana(todayISO), 6); // domingo
  if (todayISO < TEMPORADA_INICIO) return todayISO;
  const d = new Date(`${todayISO}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - d.getUTCDay() + 6); // domingo + 6 = sábado
  return d.toISOString().slice(0, 10);
}

// Lê o ranking da semana via RPC get_weekly_ranking e devolve no mesmo formato do
// ranking mensal (pra reaproveitar os componentes de pódio/lista).
export function useWeeklyLeaderboard(userId: string | undefined, enabled: boolean) {
  const [ranking, setRanking] = useState<LeaderboardEntry[]>([]);
  const [currentUserStats, setCurrentUserStats] = useState<LeaderboardEntry | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasParticipated, setHasParticipated] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const weekStart = currentWeekStart();
      const weekEnd = currentWeekEnd();
      // Extrato passa a valer na data de EXTRATO_VALENDO (desacoplado da janela da
      // temporada). Antes: DEFCON ao vivo. A partir dela: só conta com extrato enviado.
      const usarExtrato = extratoValendo(getBrazilDate());
      const { data, error } = await supabase.rpc("get_weekly_ranking_verified", { p_week_start: weekStart, p_week_end: weekEnd, p_usar_extrato: usarExtrato });
      if (error) {
        console.error("Ranking semanal erro:", error.message);
        setRanking([]);
        setCurrentUserStats(null);
        setHasParticipated(false);
        return;
      }
      const rows = (data as Record<string, unknown>[]) || [];
      const mapped: LeaderboardEntry[] = rows.map((r, i) => ({
        id: String(r.user_id),
        user_id: String(r.user_id),
        nome_usuario: (r.nome_usuario as string) || null,
        avatar_url: (r.avatar_url as string) || null,
        mes_referencia: weekStart,
        faturamento_total_mes: Number(r.faturamento_semana) || 0,
        dias_trabalhados_mes: Number(r.dias_semana) || 0,
        constancia_maior_streak: 0,
        constancia_streak_atual: 0,
        posicao_faturamento: i + 1,
        posicao_constancia: null,
      }));
      // Presença (bolinha online) + selo de verificado — igual o Mensal (30/10: o semanal
      // não lia o verificado, então ninguém aparecia com selo na aba Semanal).
      const ids = mapped.map((e) => e.user_id);
      if (ids.length > 0) {
        const [{ data: presence }, { data: profs }] = await Promise.all([
          supabase.from("user_presence").select("user_id, last_active_at").in("user_id", ids),
          supabase.from("public_profiles").select("user_id, verificado").in("user_id", ids),
        ]);
        const presMap = new Map(
          ((presence as { user_id: string; last_active_at: string }[]) || []).map((p) => [p.user_id, p.last_active_at]),
        );
        const verMap = new Map(((profs as { user_id: string; verificado: boolean | null }[]) || []).map((p) => [p.user_id, !!p.verificado]));
        for (const e of mapped) { e.last_active_at = presMap.get(e.user_id) ?? null; e.verificado = verMap.get(e.user_id) ?? false; }
      }
      setRanking(mapped);
      if (userId) {
        const me = mapped.find((e) => e.user_id === userId) || null;
        setCurrentUserStats(me);
        setHasParticipated(!!me);
      }
    } catch (e) {
      console.error("Ranking semanal exceção:", e);
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, [userId]);

  // Carrega ao abrir a aba Semanal. Enquanto aberta, atualiza SOZINHO a cada 30s
  // (e ao voltar o foco). 5s era pesado demais: RPC completa + presenca por usuario
  // com a tela aberta = centenas de queries/minuto no banco a toa.
  useEffect(() => {
    if (!enabled) return;
    load();
    // 2 min (era 30 s até 08/10/2026 — ranking é das vendas do DEFCON, não precisa de segundo a segundo)
    const id = setInterval(() => load(true), 120_000);
    const onFocus = () => load(true);
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(id);
      window.removeEventListener("focus", onFocus);
    };
  }, [enabled, load]);

  return { ranking, currentUserStats, isLoading, hasParticipated, reload: load };
}
