-- ============================================================================
-- Item 6 — Trial expirando cedo demais (fuso UTC x Brasil)
-- ----------------------------------------------------------------------------
-- A RPC check_trial_expired comparava `trial_end < CURRENT_DATE` (data UTC),
-- enquanto o app considera o teste valido ate o fim do dia em horario do Brasil
-- (trial_end 23:59:59 -03:00). Perto da meia-noite UTC (21h no Brasil) do ultimo
-- dia, o servidor ja marcava 'expired' e o usuario era empurrado pra pagar ~1 dia
-- antes — bem na hora critica de conversao.
--
-- Aqui a comparacao passa a usar a DATA DO BRASIL, batendo com o app.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.check_trial_expired(user_uuid uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $function$
DECLARE
  profile_record RECORD;
  hoje_br date;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> user_uuid THEN
    RETURN false;
  END IF;

  -- Data de hoje no fuso de Brasilia (mesma regra do app).
  hoje_br := (now() AT TIME ZONE 'America/Sao_Paulo')::date;

  SELECT trial_end, is_trial_active, plan_status
  INTO profile_record
  FROM public.profiles
  WHERE user_id = user_uuid;

  -- So expira quando o trial_end JA PASSOU pela data do Brasil.
  IF profile_record.trial_end IS NOT NULL
     AND profile_record.trial_end < hoje_br
     AND profile_record.is_trial_active = true THEN

    UPDATE public.profiles
    SET is_trial_active = false,
        plan_status = 'expired'
    WHERE user_id = user_uuid;

    RETURN true;
  END IF;

  RETURN false;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.check_trial_expired(uuid) TO authenticated;
