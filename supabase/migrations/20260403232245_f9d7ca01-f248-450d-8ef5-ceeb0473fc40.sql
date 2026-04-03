-- Restrict leaderboard to authenticated users only (was public with "true" USING)
DROP POLICY IF EXISTS "Anyone can view leaderboard stats" ON public.leaderboard_stats;
CREATE POLICY "Authenticated users can view leaderboard stats"
  ON public.leaderboard_stats
  FOR SELECT
  TO authenticated
  USING (true);