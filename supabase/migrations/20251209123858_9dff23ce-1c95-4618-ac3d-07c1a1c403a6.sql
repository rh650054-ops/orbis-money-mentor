-- Create leaderboard_stats table for ranking system
CREATE TABLE public.leaderboard_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  nome_usuario text,
  avatar_url text,
  mes_referencia text NOT NULL, -- Format: YYYY-MM
  faturamento_total_mes numeric NOT NULL DEFAULT 0,
  dias_trabalhados_mes integer NOT NULL DEFAULT 0,
  constancia_maior_streak integer NOT NULL DEFAULT 0,
  constancia_streak_atual integer NOT NULL DEFAULT 0,
  posicao_faturamento integer,
  posicao_constancia integer,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, mes_referencia)
);

-- Enable RLS
ALTER TABLE public.leaderboard_stats ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view all leaderboard stats (for ranking display)
CREATE POLICY "Anyone can view leaderboard stats"
ON public.leaderboard_stats
FOR SELECT
USING (true);

-- Policy: Users can insert their own stats
CREATE POLICY "Users can insert their own stats"
ON public.leaderboard_stats
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own stats
CREATE POLICY "Users can update their own stats"
ON public.leaderboard_stats
FOR UPDATE
USING (auth.uid() = user_id);

-- Add trigger for updated_at
CREATE TRIGGER update_leaderboard_stats_updated_at
BEFORE UPDATE ON public.leaderboard_stats
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Function to recalculate all positions for a given month
CREATE OR REPLACE FUNCTION public.recalculate_ranking_positions(target_month text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Update faturamento positions
  WITH ranked_faturamento AS (
    SELECT id, ROW_NUMBER() OVER (ORDER BY faturamento_total_mes DESC) as pos
    FROM public.leaderboard_stats
    WHERE mes_referencia = target_month AND dias_trabalhados_mes > 0
  )
  UPDATE public.leaderboard_stats ls
  SET posicao_faturamento = rf.pos
  FROM ranked_faturamento rf
  WHERE ls.id = rf.id;

  -- Update constancia positions (by dias_trabalhados_mes)
  WITH ranked_constancia AS (
    SELECT id, ROW_NUMBER() OVER (ORDER BY dias_trabalhados_mes DESC, constancia_streak_atual DESC) as pos
    FROM public.leaderboard_stats
    WHERE mes_referencia = target_month AND dias_trabalhados_mes > 0
  )
  UPDATE public.leaderboard_stats ls
  SET posicao_constancia = rc.pos
  FROM ranked_constancia rc
  WHERE ls.id = rc.id;
END;
$$;