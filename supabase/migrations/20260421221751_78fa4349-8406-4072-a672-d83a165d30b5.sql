-- Add percentage field to financial_goals
ALTER TABLE public.financial_goals
ADD COLUMN IF NOT EXISTS percentual_distribuicao numeric NOT NULL DEFAULT 0;

-- Track daily distributions to avoid duplication
CREATE TABLE IF NOT EXISTS public.daily_distributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  goal_id uuid NOT NULL REFERENCES public.financial_goals(id) ON DELETE CASCADE,
  goal_name text NOT NULL,
  percentual numeric NOT NULL,
  liquido_base numeric NOT NULL,
  amount numeric NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, date, goal_id)
);

ALTER TABLE public.daily_distributions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own distributions"
ON public.daily_distributions FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users create own distributions"
ON public.daily_distributions FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own distributions"
ON public.daily_distributions FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users delete own distributions"
ON public.daily_distributions FOR DELETE
USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_daily_distributions_user_date
ON public.daily_distributions(user_id, date);