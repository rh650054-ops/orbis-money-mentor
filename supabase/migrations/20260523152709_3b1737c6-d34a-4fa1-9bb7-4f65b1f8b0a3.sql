CREATE TABLE IF NOT EXISTS public.spot_finder_cache (
  id uuid primary key default gen_random_uuid(),
  cache_key text not null unique,
  result jsonb not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours')
);

CREATE INDEX IF NOT EXISTS idx_spot_finder_cache_expires ON public.spot_finder_cache(expires_at);

ALTER TABLE public.spot_finder_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read cache"
ON public.spot_finder_cache FOR SELECT
TO authenticated
USING (true);