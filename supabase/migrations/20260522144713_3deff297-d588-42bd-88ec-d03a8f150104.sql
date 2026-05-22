
-- Add PIX revenue column to leaderboard
ALTER TABLE public.leaderboard_stats
  ADD COLUMN IF NOT EXISTS faturamento_pix_mes numeric NOT NULL DEFAULT 0;

-- COMPETITIONS
CREATE TABLE public.competitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  prize_label text NOT NULL,
  prize_value numeric NOT NULL DEFAULT 0,
  period_type text NOT NULL DEFAULT 'weekly', -- weekly | monthly | custom
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz NOT NULL,
  metric text NOT NULL DEFAULT 'pix_revenue', -- pix_revenue | pix_sales_count | streak
  entry_rule text NOT NULL DEFAULT 'free', -- free | paid | invite
  entry_fee numeric,
  entry_instructions text,
  status text NOT NULL DEFAULT 'active', -- draft | active | finished
  cover_url text,
  winner_user_id uuid,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.competitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated view competitions"
  ON public.competitions FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins manage competitions insert"
  ON public.competitions FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage competitions update"
  ON public.competitions FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage competitions delete"
  ON public.competitions FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_competitions_updated_at
  BEFORE UPDATE ON public.competitions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- PARTICIPANTS
CREATE TABLE public.competition_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id uuid NOT NULL REFERENCES public.competitions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  joined_at timestamptz NOT NULL DEFAULT now(),
  paid boolean NOT NULL DEFAULT false,
  score numeric NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(competition_id, user_id)
);

ALTER TABLE public.competition_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated view participants"
  ON public.competition_participants FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users join self"
  ON public.competition_participants FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users leave self"
  ON public.competition_participants FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update participants"
  ON public.competition_participants FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR auth.uid() = user_id)
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR auth.uid() = user_id);

CREATE TRIGGER update_competition_participants_updated_at
  BEFORE UPDATE ON public.competition_participants
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- WINNERS
CREATE TABLE public.competition_winners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id uuid NOT NULL REFERENCES public.competitions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  prize_label text NOT NULL,
  prize_value numeric NOT NULL DEFAULT 0,
  awarded_at timestamptz NOT NULL DEFAULT now(),
  claimed boolean NOT NULL DEFAULT false,
  claim_acknowledged_at timestamptz,
  notes text
);

ALTER TABLE public.competition_winners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Winners view own"
  ON public.competition_winners FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins insert winners"
  ON public.competition_winners FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins or owner update winners"
  ON public.competition_winners FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR auth.uid() = user_id)
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR auth.uid() = user_id);

CREATE POLICY "Admins delete winners"
  ON public.competition_winners FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
