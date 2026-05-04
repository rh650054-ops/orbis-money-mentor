-- Fix: RLS excessivamente permissiva em profiles
-- A política anterior USING (true) permitia qualquer usuário autenticado
-- ler CPF, email, telefone e dados financeiros de todos os outros usuários.

-- 1. Remove política permissiva
DROP POLICY IF EXISTS "Authenticated can view public profile fields" ON public.profiles;

-- 2. Política: cada usuário lê/atualiza apenas o próprio perfil
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- 3. View segura para dados públicos (usada por PublicProfileModal e Ranking)
--    Expõe apenas campos que o usuário escolheu tornar públicos.
CREATE OR REPLACE VIEW public.public_profiles
  WITH (security_invoker = true)
AS
  SELECT
    user_id,
    nickname,
    avatar_url,
    bio,
    what_i_sell,
    where_i_sell,
    city,
    state,
    instagram,
    whatsapp_public,
    show_instagram,
    show_whatsapp,
    show_city,
    streak_days,
    vision_points
  FROM public.profiles;

GRANT SELECT ON public.public_profiles TO authenticated;
