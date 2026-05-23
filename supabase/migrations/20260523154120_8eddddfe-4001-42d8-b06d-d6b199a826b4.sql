CREATE TABLE public.spot_feedback (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  place_id TEXT NOT NULL,
  place_name TEXT NOT NULL,
  city TEXT,
  state TEXT,
  rating TEXT NOT NULL CHECK (rating IN ('bom','medio','ruim')),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, place_id)
);

CREATE INDEX idx_spot_feedback_place ON public.spot_feedback(place_id);
CREATE INDEX idx_spot_feedback_city ON public.spot_feedback(lower(city), lower(state));

ALTER TABLE public.spot_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view feedback"
ON public.spot_feedback FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Users insert own feedback"
ON public.spot_feedback FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own feedback"
ON public.spot_feedback FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users delete own feedback"
ON public.spot_feedback FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

CREATE TRIGGER spot_feedback_updated_at
BEFORE UPDATE ON public.spot_feedback
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();