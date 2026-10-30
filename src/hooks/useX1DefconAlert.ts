import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { apostaVisivel } from "@/shared/lib/x1-loja";
import { getBrazilDate } from "@/shared/lib/date-utils";

// Vigia o X1 do dia ENQUANTO a pessoa está no DEFCON. A cada 60s puxa o placar
// (x1_placar) e:
//  1) NOTIFICAÇÃO (fora do app) quando a liderança VIRA:
//     - oponente passou  -> "⚔️ X1 — seu oponente passou!"
//     - você retomou     -> "🔥 X1 — você retomou a liderança!"
//     Cooldown de 90s pra não spammar em empate técnico (flip-flop).
//  2) ESTADO AO VIVO pro widget DENTRO da tela do DEFCON (DefconX1Live):
//     placar meu/dele, quem lidera e o "evento" da virada (banner + vibração).
//  3) GRUPO (Rick, 30/10: "X1 com o Zeck e o Wesley ao mesmo tempo"): junta TODOS os
//     X1 ativos do dia + as salas em que a pessoa está. Com 2+ rivais o widget vira
//     um placar com todo mundo, e marca quem está subindo de posição.
export interface X1LiveEvent {
  type: "overtaken" | "regained";
  at: number;
  /** who passed you / who you passed back (group mode) */
  quem?: string;
}
export interface X1Lutador {
  id: string; nome: string; avatar: string | null; total: number; eu: boolean; pos: number;
  /** gained a position in the last minutes */
  subindo: boolean;
}
export interface X1LiveState {
  /** true quando existe duelo ATIVO hoje (mostra o widget) */
  hasDuel: boolean;
  oppName: string;
  oppAvatar: string | null;
  myAvatar: string | null;
  myName: string;
  my: number;
  opp: number;
  stakes: number;
  lead: "me" | "opp" | "tie" | null;
  /** 2+ rivals today (duels + rooms): everyone, ranked. null in a plain 1v1. */
  grupo: X1Lutador[] | null;
  /** virada recente — o widget mostra o banner e depois chama dismissEvent() */
  event: X1LiveEvent | null;
  dismissEvent: () => void;
}

const EMPTY: X1LiveState = {
  hasDuel: false, oppName: "", oppAvatar: null, myAvatar: null, myName: "", my: 0, opp: 0, stakes: 0,
  lead: null, grupo: null, event: null, dismissEvent: () => {},
};

interface Duelo { id: string; iAmCh: boolean; oppId: string; stakes: number }
type Perfil = { nome: string; avatar: string | null };
const SUBINDO_MS = 3 * 60_000;

export function useX1DefconAlert(userId: string | undefined, active: boolean): X1LiveState {
  const lastPos = useRef<number | null>(null);
  const lastLead = useRef<"me" | "opp" | "tie" | null>(null);
  const lastAlertAt = useRef(0);
  const posAntes = useRef<Map<string, number>>(new Map());
  const subiuEm = useRef<Map<string, number>>(new Map());
  // PROVOCAÇÃO (Lote 5): a última frase do rival já avisada (não repete)
  const lastProvId = useRef<number | null>(null);
  const [state, setState] = useState<X1LiveState>(EMPTY);

  const dismissEvent = useCallback(() => {
    setState((s) => (s.event ? { ...s, event: null } : s));
  }, []);

  useEffect(() => {
    if (!active || !userId) {
      lastLead.current = null; lastPos.current = null; posAntes.current = new Map(); subiuEm.current = new Map();
      setState(EMPTY);
      return;
    }
    let alive = true;
    let duelos: Duelo[] = [];
    let salas: string[] = [];
    let perfis = new Map<string, Perfil>();
    let achou = false;

    const notify = (title: string, body: string) => {
      if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
      navigator.serviceWorker.ready
        .then((reg) => reg.active?.postMessage({ type: "orbis-x1-alert", data: { title, body } }))
        .catch(() => {});
    };

    const descobrir = async () => {
      const today = getBrazilDate();
      const [{ data: ds }, { data: ss }] = await Promise.all([
        supabase.from("x1_challenges" as any).select("id, challenger_id, opponent_id, stakes_amount")
          .or(`challenger_id.eq.${userId},opponent_id.eq.${userId}`).eq("status", "active").eq("scheduled_date", today),
        supabase.from("x1_sala_participantes" as any).select("sala_id, x1_salas!inner(scheduled_date, status)")
          .eq("user_id", userId).eq("status", "dentro").eq("x1_salas.scheduled_date", today).eq("x1_salas.status", "open"),
      ]);
      duelos = ((ds as any[]) || []).map((c) => ({
        id: c.id, iAmCh: c.challenger_id === userId, oppId: c.challenger_id === userId ? c.opponent_id : c.challenger_id, stakes: apostaVisivel(c.stakes_amount),
      }));
      salas = ((ss as any[]) || []).map((r) => r.sala_id as string);
      const ids = [userId, ...duelos.map((d) => d.oppId)];
      const { data: pp } = await supabase.from("public_profiles").select("user_id, nickname, avatar_url").in("user_id", ids);
      perfis = new Map(((pp as any[]) || []).map((x) => [x.user_id as string, { nome: (x.nickname as string) || "Vendedor", avatar: (x.avatar_url as string) || null }]));
      achou = true;
    };

    const poll = async () => {
      if (!achou) await descobrir();
      if (!alive) return;
      if (duelos.length === 0 && salas.length === 0) {
        setState((s) => (s.hasDuel ? EMPTY : s));
        return;
      }

      // provocação nova de qualquer rival → notificação com a frase
      for (const d of duelos) {
        try {
          const { data: pv } = await (supabase as any).rpc("x1_provocacoes_da_luta", { p_id: d.id });
          const dele = ((pv as Array<{ id: number; frase: string; minha: boolean }>) || []).find((p) => !p.minha);
          if (dele) {
            if (lastProvId.current !== null && dele.id > lastProvId.current) notify(`😏 ${perfis.get(d.oppId)?.nome ?? "Seu rival"} te provocou`, `"${dele.frase}" — responde vendendo.`);
            lastProvId.current = Math.max(lastProvId.current ?? 0, dele.id);
          }
        } catch { /* provocação é enfeite: nunca derruba o placar */ }
      }
      if (lastProvId.current === null) lastProvId.current = 0;
      if (!alive) return;

      // placar: todos os duelos + todas as salas, juntos por pessoa
      const totais = new Map<string, number>();
      const pega = (id: string, v: unknown) => totais.set(id, Math.max(totais.get(id) ?? 0, Number(v) || 0));
      await Promise.all([
        ...duelos.map(async (d) => {
          const { data } = await (supabase as any).rpc("x1_placar", { p_id: d.id });
          const row = ((data as any[]) || [])[0];
          if (!row) return;
          pega(userId, d.iAmCh ? row.challenger_total : row.opponent_total);
          pega(d.oppId, d.iAmCh ? row.opponent_total : row.challenger_total);
        }),
        ...salas.map(async (id) => {
          const { data } = await (supabase as any).rpc("x1_sala", { p_id: id });
          for (const r of (data as any[]) || []) {
            if (r.p_status !== "dentro") continue;
            pega(r.user_id, r.p_total);
            if (!perfis.has(r.user_id)) perfis.set(r.user_id, { nome: r.p_nome || "Vendedor", avatar: r.p_avatar || null });
          }
        }),
      ]);
      if (!alive) return;
      if (!totais.has(userId)) totais.set(userId, 0);

      const agora = Date.now();
      const ordem = [...totais.entries()].sort((a, b) => b[1] - a[1]);
      let pos = 0, ultimo = Number.NaN;
      const grupo: X1Lutador[] = ordem.map(([id, total], i) => {
        if (total !== ultimo) { pos = i + 1; ultimo = total; }
        const antes = posAntes.current.get(id);
        if (antes !== undefined && pos < antes) subiuEm.current.set(id, agora);
        const p = perfis.get(id);
        return { id, nome: id === userId ? "Você" : p?.nome ?? "Vendedor", avatar: p?.avatar ?? null, total, eu: id === userId, pos,
          subindo: agora - (subiuEm.current.get(id) ?? 0) < SUBINDO_MS };
      });
      posAntes.current = new Map(grupo.map((g) => [g.id, g.pos]));

      const eu = grupo.find((g) => g.eu)!;
      const rivais = grupo.filter((g) => !g.eu);
      const top = rivais[0]!;
      const my = eu.total;
      const lider = rivais.reduce((a, b) => (b.total > a.total ? b : a), top);
      const opp = lider.total;
      const lead: "me" | "opp" | "tie" = my > opp ? "me" : opp > my ? "opp" : "tie";
      const prevPos = lastPos.current;
      lastPos.current = eu.pos;
      lastLead.current = lead;

      // Evento: alguém te passou (você caiu de posição) / você voltou pro 1º — com cooldown.
      let event: X1LiveEvent | null = null;
      if (prevPos !== null && agora - lastAlertAt.current >= 90_000) {
        if (eu.pos > prevPos) {
          const quem = grupo.find((g) => !g.eu && g.pos === eu.pos - 1) ?? lider;
          lastAlertAt.current = agora;
          event = { type: "overtaken", at: agora, quem: quem.nome };
          notify("⚔️ X1 — te passaram!", `${quem.nome} tá na sua frente. Bora reagir! 🔥`);
        } else if (prevPos > 1 && eu.pos === 1 && my > lider.total) {
          lastAlertAt.current = agora;
          event = { type: "regained", at: agora, quem: lider.nome };
          notify("🔥 X1 — você retomou a liderança!", `Você voltou pro 1º. Mantém o ritmo!`);
        }
      }

      const meuPerfil = perfis.get(userId);
      // no grupo, o "oponente" do aviso é quem te passou (ou o líder)
      const oponente = (event?.quem && rivais.find((g) => g.nome === event!.quem)) || (rivais.length === 1 ? top : lider);
      setState((s) => ({
        hasDuel: true,
        oppName: oponente.nome,
        oppAvatar: oponente.avatar,
        myAvatar: meuPerfil?.avatar ?? null,
        myName: meuPerfil?.nome ?? "Você",
        my,
        opp: oponente.total,
        stakes: duelos[0]?.stakes ?? 0,
        lead: rivais.length === 1 ? (my > top.total ? "me" : top.total > my ? "opp" : "tie") : lead,
        grupo: rivais.length >= 2 ? grupo : null,
        // não apaga um evento ainda em exibição se este poll não gerou outro
        event: event ?? s.event,
        dismissEvent,
      }));
    };

    poll();
    // 60s (era 15s até 08/10/2026: ~10 mil consultas/dia só disso). O placar
    // vem das vendas lançadas no DEFCON; o banco só entra no fechamento.
    const t = setInterval(poll, 60_000);
    // novo X1/sala aceito durante o Foco entra na próxima descoberta (a cada 5 min)
    const r = setInterval(() => { achou = false; }, 5 * 60_000);
    return () => {
      alive = false;
      clearInterval(t);
      clearInterval(r);
    };
  }, [userId, active, dismissEvent]);

  return state;
}
