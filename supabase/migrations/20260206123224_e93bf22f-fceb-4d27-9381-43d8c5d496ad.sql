
-- Challenge Sessions table for DEFCON 4 mode
CREATE TABLE public.challenge_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'active',
  daily_goal NUMERIC NOT NULL,
  total_blocks INTEGER NOT NULL DEFAULT 0,
  current_block_index INTEGER NOT NULL DEFAULT 0,
  total_sold NUMERIC NOT NULL DEFAULT 0,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ended_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, date)
);

ALTER TABLE public.challenge_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own challenge sessions"
  ON public.challenge_sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own challenge sessions"
  ON public.challenge_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own challenge sessions"
  ON public.challenge_sessions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own challenge sessions"
  ON public.challenge_sessions FOR DELETE
  USING (auth.uid() = user_id);

-- Challenge Blocks table
CREATE TABLE public.challenge_blocks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.challenge_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  block_index INTEGER NOT NULL,
  sold_amount NUMERIC NOT NULL DEFAULT 0,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ended_at TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.challenge_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own challenge blocks"
  ON public.challenge_blocks FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own challenge blocks"
  ON public.challenge_blocks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own challenge blocks"
  ON public.challenge_blocks FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own challenge blocks"
  ON public.challenge_blocks FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_challenge_sessions_updated_at
  BEFORE UPDATE ON public.challenge_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_challenge_blocks_updated_at
  BEFORE UPDATE ON public.challenge_blocks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
