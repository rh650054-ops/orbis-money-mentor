-- ============================================================================
-- SEGURANCA CRITICA (idempotente) — fecha 2 buracos de tomada de conta:
--   1. Virar admin ASSUMINDO um CPF da whitelist (profiles.cpf e' editavel na
--      1a vez e o INSERT do cadastro nao era coberto). Alvo classico: o CPF de
--      admin '87739860038', que nao esta em nenhum perfil -> era assumivel.
--   2. admin_reset_user_password gerava senha temporaria fraca (random() nao
--      criptografico, so 1 milhao de combinacoes) e a devolvia.
--
-- Estrategia SEM travar o dono/admin de fora:
--   (A) Liga cada admin ao user_id real (backfill do CPF atual — snapshot unico
--       e confiavel, protegido pelo indice unico de CPF).
--   (B) is_orbis_admin/super passam a reconhecer TAMBEM por user_id (caminho
--       seguro), mantendo o CPF como reconhecimento adicional (agora blindado).
--   (C) Trava anti-sequestro: ninguem (fora service_role) pode setar/trocar o
--       proprio profiles.cpf para um CPF que ja esta na whitelist de admin,
--       a nao ser que aquela linha de admin_access ja seja dele.
-- ============================================================================

-- (A) user_id em admin_access + backfill a partir do CPF atual ----------------
ALTER TABLE public.admin_access
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

UPDATE public.admin_access a
SET user_id = p.user_id
FROM public.profiles p
WHERE a.user_id IS NULL
  AND regexp_replace(COALESCE(p.cpf, ''), '[^0-9]', '', 'g')
    = regexp_replace(COALESCE(a.cpf, ''), '[^0-9]', '', 'g')
  AND regexp_replace(COALESCE(a.cpf, ''), '[^0-9]', '', 'g') <> '';

-- (B) Reconhecimento de admin por user_id (seguro) + CPF (agora blindado) ------
CREATE OR REPLACE FUNCTION public.is_orbis_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    -- Caminho seguro: admin ligado ao user_id (nao spoofavel).
    EXISTS (
      SELECT 1 FROM public.admin_access a
      WHERE a.user_id = auth.uid() AND a.enabled = true
    )
    -- Reconhecimento por CPF (mantido p/ compatibilidade). Agora e' seguro
    -- porque a trava anti-sequestro (C) impede assumir um CPF de admin.
    OR EXISTS (
      SELECT 1
      FROM public.admin_access a
      JOIN public.profiles p
        ON regexp_replace(COALESCE(p.cpf, ''), '[^0-9]', '', 'g')
         = regexp_replace(COALESCE(a.cpf, ''), '[^0-9]', '', 'g')
      WHERE p.user_id = auth.uid()
        AND a.enabled = true
        AND regexp_replace(COALESCE(p.cpf, ''), '[^0-9]', '', 'g') <> ''
    )
    OR public.has_role(auth.uid(), 'admin'::public.app_role);
$$;
GRANT EXECUTE ON FUNCTION public.is_orbis_admin() TO authenticated;

CREATE OR REPLACE FUNCTION public.is_orbis_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    EXISTS (
      SELECT 1 FROM public.admin_access a
      WHERE a.user_id = auth.uid() AND a.enabled = true AND a.is_super_admin = true
    )
    OR EXISTS (
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

-- (C) Trava anti-sequestro de CPF de admin -----------------------------------
-- Impede um usuario comum de setar/trocar o proprio profiles.cpf para um CPF
-- que esteja na whitelist de admin (a menos que aquela linha ja seja dele).
-- Cobre INSERT (cadastro) e UPDATE. service_role passa livre.
CREATE OR REPLACE FUNCTION public.block_admin_cpf_hijack()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_cpf text := regexp_replace(COALESCE(NEW.cpf, ''), '[^0-9]', '', 'g');
  v_old_cpf text := regexp_replace(COALESCE(OLD.cpf, ''), '[^0-9]', '', 'g');
BEGIN
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- So checa quando ha um CPF novo E ele mudou (ou e' um INSERT).
  IF v_new_cpf <> '' AND (TG_OP = 'INSERT' OR v_new_cpf IS DISTINCT FROM v_old_cpf) THEN
    IF EXISTS (
      SELECT 1 FROM public.admin_access a
      WHERE regexp_replace(COALESCE(a.cpf, ''), '[^0-9]', '', 'g') = v_new_cpf
        AND (a.user_id IS NULL OR a.user_id IS DISTINCT FROM NEW.user_id)
    ) THEN
      RAISE EXCEPTION 'CPF reservado: nao e permitido assumir este CPF.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_block_admin_cpf_hijack ON public.profiles;
CREATE TRIGGER trg_block_admin_cpf_hijack
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.block_admin_cpf_hijack();

-- (2) Senha temporaria FORTE no reset de senha do admin -----------------------
-- Troca random()*1000000 (1M combinacoes, previsivel) por gen_random_bytes
-- (pgcrypto, criptografico) -> ~14 chars alfanumericos + garantia de digito e
-- caractere especial. Mantem o resto da funcao (auth check, bcrypt, must_change).
CREATE OR REPLACE FUNCTION public.admin_reset_user_password(p_user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_catalog
AS $$
DECLARE
  v_temp text;
BEGIN
  IF NOT public.is_orbis_admin() THEN
    RAISE EXCEPTION 'Apenas admin pode redefinir senha.';
  END IF;

  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Use o fluxo normal para alterar sua propria senha.';
  END IF;

  -- Senha temporaria forte: 14 chars alfanumericos de origem criptografica,
  -- prefixo "Orbis" e sufixo "9!" garantindo digito + especial (complexidade).
  v_temp := 'Orbis'
         || substr(regexp_replace(encode(gen_random_bytes(18), 'base64'), '[^A-Za-z0-9]', '', 'g'), 1, 14)
         || '9!';

  UPDATE auth.users
  SET encrypted_password = crypt(v_temp, gen_salt('bf', 10)),
      updated_at = now()
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Usuario nao encontrado.';
  END IF;

  UPDATE public.profiles
  SET must_change_password = true
  WHERE user_id = p_user_id;

  RETURN v_temp;
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_reset_user_password(uuid) TO authenticated;
