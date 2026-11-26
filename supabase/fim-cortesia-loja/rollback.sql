-- Rollback of 20261126130000_fim_cortesia_teste_loja: brings back the 30-day store grant and the
-- profile-lock exception that served it (only on a new product decision). The two functions
-- below are the ones of 20261028190000_cortesia_teste_loja.sql, as they were in production until
-- 26/11. No data to restore: the migration writes nothing (the 7 old courtesies were never touched).
create or replace function public.protect_profile_billing_columns()
 returns trigger
 language plpgsql
 set search_path to 'public'
as $function$
DECLARE
  cortesia boolean := coalesce(current_setting('vant.cortesia_loja', true), '') = '1';
BEGIN
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF public.is_orbis_admin() THEN
    RETURN NEW;
  END IF;

  IF OLD.cpf IS NOT NULL AND btrim(OLD.cpf) <> '' THEN
    NEW.cpf := OLD.cpf;
  END IF;

  NEW.is_demo         := OLD.is_demo;
  NEW.billing_exempt  := OLD.billing_exempt;
  NEW.plan_type       := OLD.plan_type;
  NEW.subscription_id := OLD.subscription_id;
  NEW.trial_start     := OLD.trial_start;

  IF NOT (cortesia AND NEW.trial_end > coalesce(OLD.trial_end, '-infinity'::date)) THEN
    NEW.trial_end := OLD.trial_end;
  END IF;

  IF NEW.plan_status IS DISTINCT FROM OLD.plan_status AND NEW.plan_status <> 'expired'
     AND NOT (cortesia AND NEW.plan_status = 'trial') THEN
    NEW.plan_status := OLD.plan_status;
  END IF;

  IF COALESCE(NEW.is_trial_active, false) AND NOT COALESCE(OLD.is_trial_active, false) AND NOT cortesia THEN
    NEW.is_trial_active := OLD.is_trial_active;
  END IF;

  NEW.verificado     := OLD.verificado;
  NEW.verificado_em  := OLD.verificado_em;
  NEW.verificado_por := OLD.verificado_por;

  NEW.ranking_hidden := OLD.ranking_hidden;

  IF NOT (coalesce(current_setting('vant.fixar_origem', true), '') = '1' AND OLD.origem_ref IS NULL) THEN
    NEW.origem_ref       := OLD.origem_ref;
    NEW.origem_fixada_em := OLD.origem_fixada_em;
  END IF;

  NEW.vision_points := OLD.vision_points;
  NEW.streak_days   := OLD.streak_days;

  RETURN NEW;
END;
$function$;

create or replace function public.cortesia_teste_loja_pedir()
 returns text
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  p record;
  v_fim date;
begin
  if v_uid is null then return 'fora'; end if;
  if v_hoje > date '2026-12-15' then return 'fora'; end if;
  if exists (select 1 from cortesia_teste_loja where user_id = v_uid) then return 'ja_tinha'; end if;

  select created_at, trial_start, trial_end, plan_status, subscription_id, is_demo, billing_exempt
    into p from profiles where user_id = v_uid;
  if not found then return 'fora'; end if;
  if p.created_at < now() - interval '7 days' then return 'fora'; end if;
  if coalesce(p.is_demo, false) or coalesce(p.billing_exempt, false) then return 'fora'; end if;
  if p.plan_status not in ('trial', 'expired') or coalesce(p.subscription_id, '') <> '' then return 'fora'; end if;
  if exists (select 1 from subscriptions where user_id = v_uid) then return 'fora'; end if;

  v_fim := coalesce(p.trial_start, (p.created_at at time zone 'America/Sao_Paulo')::date) + 30;
  perform set_config('vant.cortesia_loja', '1', true);
  update profiles
     set trial_end = greatest(v_fim, coalesce(trial_end, v_fim)),
         is_trial_active = true,
         plan_status = 'trial'
   where user_id = v_uid;
  perform set_config('vant.cortesia_loja', '', true);

  insert into cortesia_teste_loja (user_id, trial_end_antes) values (v_uid, p.trial_end);
  return 'aplicada';
end;
$function$;
revoke all on function public.cortesia_teste_loja_pedir() from public, anon;
grant execute on function public.cortesia_teste_loja_pedir() to authenticated;
