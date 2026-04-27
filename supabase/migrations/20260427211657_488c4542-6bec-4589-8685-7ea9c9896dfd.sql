
-- Adiciona campos de perfil público controlados pelo usuário
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS instagram TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp_public TEXT,
  ADD COLUMN IF NOT EXISTS show_instagram BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS show_whatsapp BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS show_city BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS what_i_sell TEXT,
  ADD COLUMN IF NOT EXISTS where_i_sell TEXT,
  ADD COLUMN IF NOT EXISTS bio TEXT;

-- View segura para perfis públicos (apenas usuários autenticados podem consultar)
-- Expõe apenas campos não sensíveis que o usuário escolheu mostrar
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
  CASE WHEN show_city THEN city ELSE NULL END AS city,
  CASE WHEN show_city THEN state ELSE NULL END AS state,
  CASE WHEN show_instagram THEN instagram ELSE NULL END AS instagram,
  CASE WHEN show_whatsapp THEN whatsapp_public ELSE NULL END AS whatsapp_public,
  show_instagram,
  show_whatsapp,
  show_city
FROM public.profiles;

-- Permite usuários autenticados lerem perfis públicos via a view
-- Como security_invoker=true, precisamos permitir SELECT direto na profiles para campos públicos
-- Estratégia: policy adicional permitindo authenticated SELECT em qualquer linha (a view filtra os campos)
DROP POLICY IF EXISTS "Authenticated can view public profile fields" ON public.profiles;
CREATE POLICY "Authenticated can view public profile fields"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);

GRANT SELECT ON public.public_profiles TO authenticated;
