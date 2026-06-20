-- ============================================================================
-- Admin moderation RLS
-- ----------------------------------------------------------------------------
-- Problema: o painel admin (AdminSubscriptions) escreve DIRETO em profiles /
-- leaderboard_stats / daily_sales pelo cliente para moderar usuários
-- (trocar nome, tirar do ranking, corrigir/apagar resultado). Mas as policies
-- dessas tabelas só permitiam que cada usuário editasse os PRÓPRIOS dados.
-- O admin (reconhecido por admin_access via CPF) escrevia no perfil de OUTRO
-- usuário e o RLS bloqueava em silêncio (0 linhas alteradas, sem erro) -> a
-- mudança "não acontecia" (ex.: trocar um nome impróprio que aparece no ranking).
--
-- Solução: um helper is_orbis_admin() que reconhece o admin pelos DOIS
-- mecanismos do projeto (admin_access por CPF + user_roles antigo) e policies
-- que dão ao admin permissão de ler/editar/moderar essas tabelas.
-- ============================================================================

-- 1) Helper: o usuário atual é admin do Orbis?
--    SECURITY DEFINER para ler admin_access/profiles sem recursão de RLS.
CREATE OR REPLACE FUNCTION public.is_orbis_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    -- Mecanismo atual: admin_access (whitelist por CPF). Compara só os dígitos.
    EXISTS (
      SELECT 1
      FROM public.admin_access a
      JOIN public.profiles p
        ON regexp_replace(COALESCE(p.cpf, ''), '[^0-9]', '', 'g')
         = regexp_replace(COALESCE(a.cpf, ''), '[^0-9]', '', 'g')
      WHERE p.user_id = auth.uid()
        AND a.enabled = true
        AND regexp_replace(COALESCE(p.cpf, ''), '[^0-9]', '', 'g') <> ''
    )
    -- Mecanismo antigo: user_roles.
    OR public.has_role(auth.uid(), 'admin'::public.app_role);
$$;

GRANT EXECUTE ON FUNCTION public.is_orbis_admin() TO authenticated;

-- 2) profiles: admin pode VER e EDITAR qualquer perfil
--    (trocar nome/telefone/cidade, ativar assinatura, tirar do ranking).
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (public.is_orbis_admin());

DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
CREATE POLICY "Admins can update all profiles"
ON public.profiles
FOR UPDATE
TO authenticated
USING (public.is_orbis_admin())
WITH CHECK (public.is_orbis_admin());

-- 3) leaderboard_stats: admin pode moderar o ranking
--    (atualizar o nome em cache, apagar a entrada pra remover do ranking).
DROP POLICY IF EXISTS "Admins manage leaderboard_stats" ON public.leaderboard_stats;
CREATE POLICY "Admins manage leaderboard_stats"
ON public.leaderboard_stats
FOR ALL
TO authenticated
USING (public.is_orbis_admin())
WITH CHECK (public.is_orbis_admin());

-- 4) daily_sales: admin pode corrigir o valor de um dia ou apagar um dia
--    (resultado falso/inflado) -> o ranking recalcula a partir daqui.
DROP POLICY IF EXISTS "Admins manage daily_sales" ON public.daily_sales;
CREATE POLICY "Admins manage daily_sales"
ON public.daily_sales
FOR ALL
TO authenticated
USING (public.is_orbis_admin())
WITH CHECK (public.is_orbis_admin());
