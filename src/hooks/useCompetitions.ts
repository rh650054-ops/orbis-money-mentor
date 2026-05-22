import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface Competition {
  id: string;
  name: string;
  description: string | null;
  prize_label: string;
  prize_value: number;
  period_type: "weekly" | "monthly" | "custom";
  starts_at: string;
  ends_at: string;
  metric: "pix_revenue" | "pix_sales_count" | "streak";
  entry_rule: "free" | "paid" | "invite";
  entry_fee: number | null;
  entry_instructions: string | null;
  status: "draft" | "active" | "finished";
  cover_url: string | null;
  winner_user_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  audience_type: "open" | "invite" | "city";
  audience_cities: string[];
  invited_user_ids: string[];
}

export interface CompetitionParticipant {
  id: string;
  competition_id: string;
  user_id: string;
  joined_at: string;
  paid: boolean;
  score: number;
  nickname?: string | null;
  avatar_url?: string | null;
  city?: string | null;
}

export interface CompetitionWinner {
  id: string;
  competition_id: string;
  user_id: string;
  prize_label: string;
  prize_value: number;
  awarded_at: string;
  claimed: boolean;
  notes: string | null;
}

export function useCompetitions(userId: string | undefined) {
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [myParticipations, setMyParticipations] = useState<CompetitionParticipant[]>([]);
  const [participantsByComp, setParticipantsByComp] = useState<Record<string, CompetitionParticipant[]>>({});
  const [myWins, setMyWins] = useState<CompetitionWinner[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: comps } = await supabase
      .from("competitions" as any)
      .select("*")
      .in("status", ["active", "finished"])
      .order("ends_at", { ascending: true });
    const compsList = ((comps as any) || []) as Competition[];
    setCompetitions(compsList);

    // Recalc scores for active competitions (best-effort, server-side)
    const activeIds = compsList.filter((c) => c.status === "active").map((c) => c.id);
    await Promise.all(
      activeIds.map((id) =>
        supabase.rpc("recalculate_competition_scores" as any, { _competition_id: id }),
      ),
    );

    // Load all participants for active+finished competitions
    if (compsList.length) {
      const ids = compsList.map((c) => c.id);
      const { data: allParts } = await supabase
        .from("competition_participants" as any)
        .select("*")
        .in("competition_id", ids);
      const parts = (allParts as any[]) || [];

      // Enrich with profile info
      const uids = Array.from(new Set(parts.map((p) => p.user_id)));
      const profMap: Record<string, { nickname: string | null; avatar_url: string | null; city: string | null }> = {};
      if (uids.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("user_id,nickname,avatar_url,city")
          .in("user_id", uids);
        profs?.forEach((p: any) => {
          profMap[p.user_id] = { nickname: p.nickname, avatar_url: p.avatar_url, city: p.city };
        });
      }

      const grouped: Record<string, CompetitionParticipant[]> = {};
      parts.forEach((p) => {
        const enriched = {
          ...p,
          nickname: profMap[p.user_id]?.nickname,
          avatar_url: profMap[p.user_id]?.avatar_url,
          city: profMap[p.user_id]?.city,
        };
        (grouped[p.competition_id] ||= []).push(enriched);
      });
      // Sort each by score desc
      Object.values(grouped).forEach((arr) => arr.sort((a, b) => Number(b.score) - Number(a.score)));
      setParticipantsByComp(grouped);

      if (userId) {
        setMyParticipations(parts.filter((p) => p.user_id === userId) as any);
      }
    } else {
      setParticipantsByComp({});
      setMyParticipations([]);
    }

    if (userId) {
      const { data: wins } = await supabase
        .from("competition_winners" as any)
        .select("*")
        .eq("user_id", userId)
        .order("awarded_at", { ascending: false });
      setMyWins((wins as any) || []);
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  const join = async (competitionId: string) => {
    if (!userId) return { error: "no user" };
    const { error } = await supabase
      .from("competition_participants" as any)
      .insert({ competition_id: competitionId, user_id: userId });
    if (!error) await load();
    return { error };
  };

  const leave = async (competitionId: string) => {
    if (!userId) return { error: "no user" };
    const { error } = await supabase
      .from("competition_participants" as any)
      .delete()
      .eq("competition_id", competitionId)
      .eq("user_id", userId);
    if (!error) await load();
    return { error };
  };

  const acknowledgeWin = async (winId: string) => {
    const { error } = await supabase
      .from("competition_winners" as any)
      .update({ claim_acknowledged_at: new Date().toISOString() })
      .eq("id", winId);
    if (!error) await load();
    return { error };
  };

  const getMyPosition = (competitionId: string) => {
    const list = participantsByComp[competitionId] || [];
    const idx = list.findIndex((p) => p.user_id === userId);
    return idx >= 0 ? { position: idx + 1, total: list.length, score: Number(list[idx].score) } : null;
  };

  return {
    competitions,
    myParticipations,
    participantsByComp,
    myWins,
    loading,
    load,
    join,
    leave,
    acknowledgeWin,
    getMyPosition,
  };
}
