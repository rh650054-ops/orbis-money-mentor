DROP POLICY IF EXISTS "Only admins can manage roles" ON public.user_roles;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.check_trial_expired(user_uuid uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $function$
DECLARE
  profile_record RECORD;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> user_uuid THEN
    RETURN false;
  END IF;

  SELECT trial_end, is_trial_active, plan_status
  INTO profile_record
  FROM public.profiles
  WHERE user_id = user_uuid;
  
  IF profile_record.trial_end IS NOT NULL 
     AND profile_record.trial_end < CURRENT_DATE 
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

REVOKE EXECUTE ON FUNCTION public.recalculate_ranking_positions(text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.recalculate_competition_scores(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_trial_expired(uuid) TO authenticated;