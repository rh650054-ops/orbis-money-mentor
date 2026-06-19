-- Cadastro: 1 conta por pessoa — CPF, telefone e e-mail únicos.
--
-- 1) Função de pré-checagem usada no signup (Auth.tsx) ANTES de criar a conta.
--    SECURITY DEFINER pra ignorar RLS, mas só retorna QUAL campo está em uso
--    ('phone' | 'email' | NULL) — nunca expõe dados de outra conta.
CREATE OR REPLACE FUNCTION public.check_signup_available(p_phone text, p_email text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_phone text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  v_email text := lower(trim(coalesce(p_email, '')));
BEGIN
  IF v_phone <> '' AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE regexp_replace(coalesce(phone, ''), '\D', '', 'g') = v_phone
  ) THEN
    RETURN 'phone';
  END IF;

  IF v_email <> '' AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE lower(trim(coalesce(email, ''))) = v_email
  ) THEN
    RETURN 'email';
  END IF;

  RETURN NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_signup_available(text, text) TO anon, authenticated;

-- 2) Garantia no banco (à prova de corrida): índices únicos.
--    Ignoram nulos/vazios (contas demo sem telefone/e-mail não conflitam).
--    OBS: se já existirem DUPLICADOS no banco, a criação do índice falha —
--    nesse caso, limpe os duplicados antes (ver consultas no fim).
CREATE UNIQUE INDEX IF NOT EXISTS profiles_cpf_unique
  ON public.profiles (cpf)
  WHERE cpf IS NOT NULL AND cpf <> '';

CREATE UNIQUE INDEX IF NOT EXISTS profiles_phone_unique
  ON public.profiles (phone)
  WHERE phone IS NOT NULL AND phone <> '';

CREATE UNIQUE INDEX IF NOT EXISTS profiles_email_unique
  ON public.profiles (lower(email))
  WHERE email IS NOT NULL AND email <> '';

-- --- Diagnóstico (opcional) — rode ANTES se a criação do índice acusar duplicado:
-- SELECT phone, count(*) FROM public.profiles
--   WHERE phone IS NOT NULL AND phone <> '' GROUP BY phone HAVING count(*) > 1;
-- SELECT lower(email), count(*) FROM public.profiles
--   WHERE email IS NOT NULL AND email <> '' GROUP BY lower(email) HAVING count(*) > 1;
