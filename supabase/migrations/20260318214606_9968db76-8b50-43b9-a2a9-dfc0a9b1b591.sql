
-- Add approaches_count to challenge_blocks
ALTER TABLE public.challenge_blocks ADD COLUMN IF NOT EXISTS approaches_count integer NOT NULL DEFAULT 0;

-- Create defcon_occurrences table
CREATE TABLE public.defcon_occurrences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  session_id uuid REFERENCES public.challenge_sessions(id) ON DELETE CASCADE NOT NULL,
  block_index integer NOT NULL,
  description text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.defcon_occurrences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can create their own occurrences"
  ON public.defcon_occurrences FOR INSERT TO public
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own occurrences"
  ON public.defcon_occurrences FOR SELECT TO public
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own occurrences"
  ON public.defcon_occurrences FOR DELETE TO public
  USING (auth.uid() = user_id);

-- Add approaches_count to hourly_goal_blocks too (for consistency with the block system)
ALTER TABLE public.hourly_goal_blocks ADD COLUMN IF NOT EXISTS approaches_count integer NOT NULL DEFAULT 0;
