-- Add DELETE policy for profiles table to allow users to delete their own profile
CREATE POLICY "Users can delete their own profile"
ON profiles FOR DELETE
USING (auth.uid() = user_id);

-- Create rate_limits table for AI usage tracking
CREATE TABLE IF NOT EXISTS public.rate_limits (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  endpoint text NOT NULL,
  request_count integer NOT NULL DEFAULT 1,
  window_start timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT unique_user_endpoint_window UNIQUE (user_id, endpoint, window_start)
);

-- Enable RLS on rate_limits table
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- Add RLS policies for rate_limits
CREATE POLICY "Users can view their own rate limits"
ON public.rate_limits FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Service can manage rate limits"
ON public.rate_limits FOR ALL
USING (true);

-- Add index for performance
CREATE INDEX idx_rate_limits_user_endpoint ON public.rate_limits(user_id, endpoint, window_start);

-- Function to clean up old rate limit records (older than 1 hour)
CREATE OR REPLACE FUNCTION public.cleanup_old_rate_limits()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.rate_limits 
  WHERE window_start < now() - interval '1 hour';
END;
$$;