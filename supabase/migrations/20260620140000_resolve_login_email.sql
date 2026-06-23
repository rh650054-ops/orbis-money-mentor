-- ============================================================================
-- Login por E-MAIL pessoal (alem do CPF)
-- ----------------------------------------------------------------------------
-- A conta no Auth e identificada por CPF: o e-mail de login real e
-- "<CPF>@orbis.internal". Quem tenta entrar com o e-mail PESSOAL nao acha a
-- conta -> "senha incorreta" mesmo com a senha certa.
--
-- Esta funcao recebe o e-mail pessoal + a senha, CONFERE a senha no auth.users
-- (bcrypt) e, SO se estiver correta, devolve o e-mail interno (<CPF>@orbis.internal)
-- pra o app fazer o signInWithPassword. Como exige a senha certa, nao da pra
-- enumerar e-mails nem descobrir CPF de terceiros (e-mail/senha errados -> null).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.resolve_login_email(p_email text, p_password text)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions, pg_catalog
AS $$
DECLARE
  v_internal text;
  v_uid uuid;
  v_hash text;
BEGIN
  IF p_email IS NULL OR btrim(p_email) = '' OR p_password IS NULL OR p_password = '' THEN
    RETURN NULL;
  END IF;

  -- Acha o perfil pelo e-mail pessoal e monta o e-mail interno a partir do CPF.
  SELECT (regexp_replace(COALESCE(p.cpf, ''), '[^0-9]', '', 'g') || '@orbis.internal'),
         p.user_id
    INTO v_internal, v_uid
  FROM public.profiles p
  WHERE lower(p.email) = lower(btrim(p_email))
    AND regexp_replace(COALESCE(p.cpf, ''), '[^0-9]', '', 'g') <> ''
  LIMIT 1;

  IF v_uid IS NULL THEN
    RETURN NULL;  -- nenhuma conta com esse e-mail; nao revela nada
  END IF;

  -- Confere a senha (bcrypt) direto no auth.users.
  SELECT u.encrypted_password INTO v_hash FROM auth.users u WHERE u.id = v_uid;
  IF v_hash IS NULL THEN
    RETURN NULL;
  END IF;

  IF v_hash = crypt(p_password, v_hash) THEN
    RETURN v_internal;  -- senha certa -> devolve o e-mail de login interno
  END IF;

  RETURN NULL;  -- senha errada -> nao revela nada
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_login_email(text, text) TO anon, authenticated;
