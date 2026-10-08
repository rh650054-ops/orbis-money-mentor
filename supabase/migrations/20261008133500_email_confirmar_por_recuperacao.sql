-- BUG-004 (2026-10-08, decisao Rick): quem pede o link de recuperacao com o CPF e
-- consegue abrir o link na caixa cadastrada PROVOU que o e-mail e dele. Esta funcao
-- marca o e-mail como confirmado no fim do reset. So o proprio usuario (auth.uid()),
-- sem parametros, so escreve o carimbo — nao le nem altera mais nada.
CREATE OR REPLACE FUNCTION public.email_confirmar_por_recuperacao()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  UPDATE public.profiles
     SET email_verificado_em = COALESCE(email_verificado_em, now())
   WHERE user_id = auth.uid()
     AND email IS NOT NULL;
$$;

REVOKE ALL ON FUNCTION public.email_confirmar_por_recuperacao() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.email_confirmar_por_recuperacao() TO authenticated;
