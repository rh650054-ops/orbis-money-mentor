-- Fix rate_limits RLS policy bypass vulnerability
-- Remove the overly permissive policy that allows any authenticated user to manage rate limits
DROP POLICY IF EXISTS "Service can manage rate limits" ON public.rate_limits;

-- Create a restrictive policy that only allows service role to manage rate limits
-- Regular users cannot modify their own rate limit records
CREATE POLICY "Service role can manage rate limits" 
ON public.rate_limits 
FOR ALL 
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');