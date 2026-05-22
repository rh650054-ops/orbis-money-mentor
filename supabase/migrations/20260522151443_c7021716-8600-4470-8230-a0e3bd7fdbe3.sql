
-- Add audience fields
ALTER TABLE public.competitions
  ADD COLUMN IF NOT EXISTS audience_type text NOT NULL DEFAULT 'open',
  ADD COLUMN IF NOT EXISTS audience_cities text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS invited_user_ids uuid[] NOT NULL DEFAULT '{}';

-- Ensure profiles has city
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS city text;

-- Eligibility trigger
CREATE OR REPLACE FUNCTION public.check_competition_eligibility()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  comp RECORD;
  user_city text;
BEGIN
  SELECT * INTO comp FROM public.competitions WHERE id = NEW.competition_id;
  IF comp IS NULL THEN
    RAISE EXCEPTION 'Competition not found';
  END IF;

  -- Admin can add anyone
  IF public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN NEW;
  END IF;

  IF comp.status <> 'active' THEN
    RAISE EXCEPTION 'Competição não está ativa';
  END IF;

  IF comp.audience_type = 'invite' THEN
    IF NOT (NEW.user_id = ANY(comp.invited_user_ids)) THEN
      RAISE EXCEPTION 'Esta competição é apenas para convidados';
    END IF;
  ELSIF comp.audience_type = 'city' THEN
    SELECT city INTO user_city FROM public.profiles WHERE user_id = NEW.user_id;
    IF user_city IS NULL OR NOT (lower(user_city) = ANY(SELECT lower(c) FROM unnest(comp.audience_cities) c)) THEN
      RAISE EXCEPTION 'Esta competição é restrita a outras cidades';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_competition_eligibility ON public.competition_participants;
CREATE TRIGGER trg_check_competition_eligibility
  BEFORE INSERT ON public.competition_participants
  FOR EACH ROW EXECUTE FUNCTION public.check_competition_eligibility();

-- Score recalc function
CREATE OR REPLACE FUNCTION public.recalculate_competition_scores(_competition_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  comp RECORD;
BEGIN
  SELECT * INTO comp FROM public.competitions WHERE id = _competition_id;
  IF comp IS NULL THEN RETURN; END IF;

  IF comp.metric = 'pix_revenue' THEN
    UPDATE public.competition_participants cp
    SET score = COALESCE(sub.total, 0), updated_at = now()
    FROM (
      SELECT user_id, SUM(COALESCE(valor_pix, 0)) AS total
      FROM public.hourly_goal_blocks
      WHERE created_at >= comp.starts_at AND created_at <= comp.ends_at
      GROUP BY user_id
    ) sub
    WHERE cp.competition_id = _competition_id AND cp.user_id = sub.user_id;

    UPDATE public.competition_participants
    SET score = 0
    WHERE competition_id = _competition_id
      AND user_id NOT IN (
        SELECT user_id FROM public.hourly_goal_blocks
        WHERE created_at >= comp.starts_at AND created_at <= comp.ends_at
      );

  ELSIF comp.metric = 'pix_sales_count' THEN
    UPDATE public.competition_participants cp
    SET score = COALESCE(sub.cnt, 0), updated_at = now()
    FROM (
      SELECT user_id, COUNT(*)::numeric AS cnt
      FROM public.hourly_goal_blocks
      WHERE created_at >= comp.starts_at AND created_at <= comp.ends_at
        AND COALESCE(valor_pix, 0) > 0
      GROUP BY user_id
    ) sub
    WHERE cp.competition_id = _competition_id AND cp.user_id = sub.user_id;

  ELSIF comp.metric = 'streak' THEN
    UPDATE public.competition_participants cp
    SET score = COALESCE(ls.constancia_streak_atual, 0), updated_at = now()
    FROM public.leaderboard_stats ls
    WHERE cp.competition_id = _competition_id AND ls.user_id = cp.user_id;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.recalculate_competition_scores(uuid) TO authenticated;
