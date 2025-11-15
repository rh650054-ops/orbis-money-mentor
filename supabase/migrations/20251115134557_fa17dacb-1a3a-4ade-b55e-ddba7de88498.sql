-- Tabela para planos diários de meta
CREATE TABLE public.daily_goal_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  daily_goal NUMERIC NOT NULL,
  work_hours INTEGER NOT NULL,
  mood TEXT NOT NULL,
  hourly_goal NUMERIC NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, date)
);

-- Tabela para blocos de meta por hora
CREATE TABLE public.hourly_goal_blocks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_id UUID NOT NULL REFERENCES public.daily_goal_plans(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  hour_index INTEGER NOT NULL,
  hour_label TEXT NOT NULL,
  target_amount NUMERIC NOT NULL,
  achieved_amount NUMERIC NOT NULL DEFAULT 0,
  is_completed BOOLEAN NOT NULL DEFAULT false,
  manual_adjustment NUMERIC DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(plan_id, hour_index)
);

-- Enable RLS
ALTER TABLE public.daily_goal_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hourly_goal_blocks ENABLE ROW LEVEL SECURITY;

-- RLS Policies para daily_goal_plans
CREATE POLICY "Users can view their own goal plans"
ON public.daily_goal_plans FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own goal plans"
ON public.daily_goal_plans FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own goal plans"
ON public.daily_goal_plans FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own goal plans"
ON public.daily_goal_plans FOR DELETE
USING (auth.uid() = user_id);

-- RLS Policies para hourly_goal_blocks
CREATE POLICY "Users can view their own goal blocks"
ON public.hourly_goal_blocks FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own goal blocks"
ON public.hourly_goal_blocks FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own goal blocks"
ON public.hourly_goal_blocks FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own goal blocks"
ON public.hourly_goal_blocks FOR DELETE
USING (auth.uid() = user_id);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.hourly_goal_blocks;