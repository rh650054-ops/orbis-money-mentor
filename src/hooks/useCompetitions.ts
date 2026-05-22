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
}

export interface CompetitionParticipant {
  id: string;
  competition_id: string;
  user_id: string;
  joined_at: string;
  paid: boolean;
  score: number;
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
  const [myWins, setMyWins] = useState<CompetitionWinner[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: comps } = await supabase
      .from("competitions" as any)
      .select("*")
      .in("status", ["active", "finished"])
      .order("ends_at", { ascending: true });
    setCompetitions((comps as any) || []);

    if (userId) {
      const { data: parts } = await supabase
        .from("competition_participants" as any)
        .select("*")
        .eq("user_id", userId);
      setMyParticipations((parts as any) || []);

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

  return { competitions, myParticipations, myWins, loading, load, join, leave, acknowledgeWin };
}
