-- ============================================================================
-- Reset de senha pelo admin SEM edge function (via RPC SQL)
-- ----------------------------------------------------------------------------
-- O botão "Senha temporária" chamava a edge function admin-reset-password,
-- que vivia falhando no deploy ("Entrypoint path does not exist"). Aqui a
-- mesma lógica vira uma função SQL (SECURITY DEFINER) que o admin chama por
-- RPC — sem deploy de edge function. Gera uma senha temporária OrbisXXXXXX!,
-- grava direto no auth.users (bcrypt, compatível com o login do Supabase) e
-- marca must_change_password pra forçar a troca no próximo login.
-- ============================================================================

-- Garante a coluna usada pelo fluxo de troca obrigatória
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS must_change_password boolean DEFAULT false;

-- pgcrypto fornece crypt()/gen_salt() (bcrypt). Idempotente.
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.admin_reset_user_password(p_user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_catalog
AS $$
DECLARE
  v_temp text;
BEGIN
  -- Só admin do Orbis pode redefinir senha de outra pessoa.
  IF NOT public.is_orbis_admin() THEN
    RAISE EXCEPTION 'Apenas admin pode redefinir senha.';
  END IF;

  -- O admin não reseta a própria senha por aqui (usa o fluxo normal).
  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Use o fluxo normal para alterar sua própria senha.';
  END IF;

  -- Senha temporária no formato OrbisXXXXXX!
  v_temp := 'Orbis' || lpad((floor(random() * 1000000))::int::text, 6, '0') || '!';

  -- Grava a nova senha (bcrypt) direto no auth.users.
  UPDATE auth.users
  SET encrypted_password = crypt(v_temp, gen_salt('bf', 10)),
      updated_at = now()
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Usuário não encontrado.';
  END IF;

  -- Força a troca de senha no próximo login.
  UPDATE public.profiles
  SET must_change_password = true
  WHERE user_id = p_user_id;

  RETURN v_temp;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_reset_user_password(uuid) TO authenticated;
