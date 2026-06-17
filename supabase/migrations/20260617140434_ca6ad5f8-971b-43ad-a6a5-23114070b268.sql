-- 1) Profiles: remove broad table-level read access and rely on public_profiles for public fields
DROP POLICY IF EXISTS "Authenticated can view public profile fields" ON public.profiles;

-- Ensure the public profile view remains limited to non-sensitive fields and runs with caller permissions
CREATE OR REPLACE VIEW public.public_profiles
WITH (security_invoker = true) AS
SELECT
  user_id,
  nickname,
  avatar_url,
  bio,
  what_i_sell,
  where_i_sell,
  CASE WHEN show_city THEN city ELSE NULL::text END AS city,
  CASE WHEN show_city THEN state ELSE NULL::text END AS state,
  CASE WHEN show_instagram THEN instagram ELSE NULL::text END AS instagram,
  CASE WHEN show_whatsapp THEN whatsapp_public ELSE NULL::text END AS whatsapp_public,
  show_instagram,
  show_whatsapp,
  show_city
FROM public.profiles;

GRANT SELECT ON public.public_profiles TO authenticated;
GRANT SELECT ON public.public_profiles TO service_role;

-- 2) Competition participants: hide paid/admin-sensitive fields from global authenticated reads
DROP POLICY IF EXISTS "Authenticated view participants" ON public.competition_participants;
CREATE POLICY "Users view own or unpaid competition participants"
ON public.competition_participants
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
  OR paid = false
);

-- 3) Storage: keep direct public object access but prevent broad bucket listing
DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Product photos are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "community media public read" ON storage.objects;

CREATE POLICY "Public can read avatar objects by path"
ON storage.objects
FOR SELECT
TO public
USING (
  bucket_id = 'avatars'
  AND coalesce((storage.foldername(name))[1], '') <> ''
  AND array_length(storage.foldername(name), 1) >= 2
);

CREATE POLICY "Public can read product photo objects by path"
ON storage.objects
FOR SELECT
TO public
USING (
  bucket_id = 'product-photos'
  AND coalesce((storage.foldername(name))[1], '') <> ''
  AND array_length(storage.foldername(name), 1) >= 2
);

CREATE POLICY "Public can read community media objects by path"
ON storage.objects
FOR SELECT
TO public
USING (
  bucket_id = 'community-media'
  AND coalesce((storage.foldername(name))[1], '') <> ''
  AND array_length(storage.foldername(name), 1) >= 2
);

-- 4) SECURITY DEFINER functions: revoke default public execute and allow only intentional callers
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM anon;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM authenticated;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_trial_expired(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.recalculate_ranking_positions(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.recalculate_competition_scores(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.filter_profanity(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.chat_messages_apply_filter() TO service_role;
GRANT EXECUTE ON FUNCTION public.community_filter_profanity() TO service_role;
GRANT EXECUTE ON FUNCTION public.update_updated_at_column() TO service_role;
GRANT EXECUTE ON FUNCTION public.bump_ai_conversation_timestamp() TO service_role;
GRANT EXECUTE ON FUNCTION public.check_competition_eligibility() TO service_role;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_old_rate_limits() TO service_role;

-- 5) Realtime publication: remove private tables from unscoped postgres_changes feeds
ALTER PUBLICATION supabase_realtime DROP TABLE public.ai_messages, public.hourly_goal_blocks;