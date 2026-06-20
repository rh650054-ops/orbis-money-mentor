-- ============================================================================
-- SUPER ADMIN SUPREMO (inviolável)
-- ----------------------------------------------------------------------------
-- Dono do Orbis: CPF 55203137846 / rh650054@gmail.com
--
-- Objetivo:
--  1. Marcar o dono como SUPER ADMIN num campo próprio (is_super_admin).
--  2. Ninguém (nem outro admin, nem o cliente) consegue desativar, rebaixar
--     ou apagar um super admin. Só via SQL direto (service_role / dashboard),
--     ou seja, só quem tem a chave do banco — o próprio dono.
--  3. O perfil do super admin não pode ser alterado por outros admins
--     (nome, ranking, plano) — só por ele mesmo.
--  4. O super admin pode conceder/retirar admin de qualquer pessoa pelo painel.
-- ============================================================================

-- 1) Campo que marca o super admin
ALTER TABLE public.admin_access
  ADD COLUMN IF NOT EXISTS is_super_admin boolean NOT NULL DEFAULT false;

-- 2) Crava o dono como super admin (idempotente — o CPF já existe na tabela)
INSERT INTO public.admin_access (cpf, role, enabled, is_super_admin, notes)
VALUES ('55203137846', 'admin', true, true, 'SUPER ADMIN supremo - dono do Orbis (rh650054@gmail.com) - inviolavel')
ON CONFLICT (cpf) DO UPDATE
  SET role = 'admin',
      enabled = true,
      is_super_admin = true,
      notes = 'SUPER ADMIN supremo - dono do Orbis (rh650054@gmail.com) - inviolavel';

-- 3) Helper: o usuário atual é SUPER admin?
CREATE OR REPLACE FUNCTION public.is_orbis_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.admin_access a
    JOIN public.profiles p
      ON regexp_replace(COALESCE(p.cpf, ''), '[^0-9]', '', 'g')
       = regexp_replace(COALESCE(a.cpf, ''), '[^0-9]', '', 'g')
    WHERE p.user_id = auth.uid()
      AND a.enabled = true
      AND a.is_super_admin = true
      AND regexp_replace(COALESCE(p.cpf, ''), '[^0-9]', '', 'g') <> ''
  );
$$;
GRANT EXECUTE ON FUNCTION public.is_orbis_super_admin() TO authenticated;

-- 4) Blindagem da própria linha do super admin em admin_access.
--    Bloqueia desativar / rebaixar / apagar um super admin, e impede que
--    qualquer cliente CRIE um super admin (só via SQL/service_role).
CREATE OR REPLACE FUNCTION public.protect_super_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- service_role (SQL direto / dashboard) tem poder total.
  IF auth.role() = 'service_role' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_OP = 'DELETE' THEN
    IF OLD.is_super_admin THEN
      RAISE EXCEPTION 'Nao e permitido remover um super admin.';
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD.is_super_admin AND (NEW.enabled = false OR NEW.is_super_admin = false) THEN
      RAISE EXCEPTION 'Nao e permitido desativar ou rebaixar um super admin.';
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.is_super_admin THEN
      RAISE EXCEPTION 'Super admin so pode ser criado via SQL (service_role).';
    END IF;
    RETURN NEW;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_super_admin ON public.admin_access;
CREATE TRIGGER trg_protect_super_admin
BEFORE INSERT OR UPDATE OR DELETE ON public.admin_access
FOR EACH ROW EXECUTE FUNCTION public.protect_super_admin();

-- 5) Blindagem do PERFIL do super admin: outros admins nao podem mexer.
--    (so o proprio super admin ou o service_role alteram o perfil dele.)
CREATE OR REPLACE FUNCTION public.protect_super_admin_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_super boolean;
BEGIN
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;
  -- o proprio dono pode editar o proprio perfil
  IF auth.uid() = OLD.user_id THEN
    RETURN NEW;
  END IF;
  -- o perfil pertence a um super admin?
  SELECT EXISTS (
    SELECT 1
    FROM public.admin_access a
    WHERE regexp_replace(COALESCE(a.cpf, ''), '[^0-9]', '', 'g')
        = regexp_replace(COALESCE(OLD.cpf, ''), '[^0-9]', '', 'g')
      AND a.is_super_admin = true
      AND a.enabled = true
      AND regexp_replace(COALESCE(OLD.cpf, ''), '[^0-9]', '', 'g') <> ''
  ) INTO v_super;

  IF v_super THEN
    RAISE EXCEPTION 'Perfil de super admin protegido: somente o proprio pode altera-lo.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_super_admin_profile ON public.profiles;
CREATE TRIGGER trg_protect_super_admin_profile
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.protect_super_admin_profile();

-- 6) Permite ao SUPER admin gerenciar admin_access pelo painel
--    (conceder/retirar admin de qualquer pessoa). O trigger acima continua
--    impedindo criar/remover super admin pelo cliente.
DROP POLICY IF EXISTS "Super admin manages admin_access" ON public.admin_access;
CREATE POLICY "Super admin manages admin_access"
ON public.admin_access
FOR ALL
TO authenticated
USING (public.is_orbis_super_admin())
WITH CHECK (public.is_orbis_super_admin());
