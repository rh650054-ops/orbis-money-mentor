-- 26/11/2026: the free test (3 days) and the overdue grace (3 days) — two independent rules.
-- Functions and triggers copied from the production catalog on 26/11 (no real data).
-- auth.role(): same contract as Supabase (the request's role). No request = the backend.
create or replace function auth.role() returns text language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), 'service_role')
$$;
alter table public.profiles add column if not exists plan_type text, add column if not exists verificado_em timestamptz,
  add column if not exists verificado_por uuid, add column if not exists origem_ref text, add column if not exists origem_fixada_em timestamptz,
  add column if not exists vision_points integer default 0, add column if not exists streak_days integer default 0;

-- sign-up: the test dates are always written by the server (production, unchanged)
create or replace function public.profiles_protege_criacao() returns trigger language plpgsql set search_path to 'public' as $function$
begin
  if coalesce(auth.role(), '') not in ('authenticated', 'anon') or public.is_orbis_admin() then
    return new;
  end if;
  new.plan_status      := 'trial';
  new.plan_type        := 'trial';
  new.is_trial_active  := true;
  new.trial_start      := (now() at time zone 'America/Sao_Paulo')::date;
  new.trial_end        := (now() at time zone 'America/Sao_Paulo')::date + 3;
  new.billing_exempt   := false;
  new.is_demo          := false;
  new.subscription_id  := null;
  new.verificado       := false;
  new.verificado_em    := null;
  new.verificado_por   := null;
  new.ranking_hidden   := false;
  new.vision_points    := 0;
  new.streak_days      := 0;
  if coalesce(current_setting('vant.fixar_origem', true), '') <> '1' then
    new.origem_ref := null;
    new.origem_fixada_em := null;
  end if;
  return new;
end $function$;
create trigger a_profiles_protege_criacao before insert on public.profiles for each row execute function public.profiles_protege_criacao();

-- profile lock as it is in production until 26/11 (with the store-courtesy exception);
-- 20261126130000_fim_cortesia_teste_loja replaces it without the exception
create or replace function public.protect_profile_billing_columns() returns trigger language plpgsql set search_path to 'public' as $function$
DECLARE
  cortesia boolean := coalesce(current_setting('vant.cortesia_loja', true), '') = '1';
BEGIN
  IF auth.role() = 'service_role' THEN RETURN NEW; END IF;
  IF public.is_orbis_admin() THEN RETURN NEW; END IF;
  IF OLD.cpf IS NOT NULL AND btrim(OLD.cpf) <> '' THEN NEW.cpf := OLD.cpf; END IF;
  NEW.is_demo         := OLD.is_demo;
  NEW.billing_exempt  := OLD.billing_exempt;
  NEW.plan_type       := OLD.plan_type;
  NEW.subscription_id := OLD.subscription_id;
  NEW.trial_start     := OLD.trial_start;
  IF NOT (cortesia AND NEW.trial_end > coalesce(OLD.trial_end, '-infinity'::date)) THEN NEW.trial_end := OLD.trial_end; END IF;
  IF NEW.plan_status IS DISTINCT FROM OLD.plan_status AND NEW.plan_status <> 'expired'
     AND NOT (cortesia AND NEW.plan_status = 'trial') THEN NEW.plan_status := OLD.plan_status; END IF;
  IF COALESCE(NEW.is_trial_active, false) AND NOT COALESCE(OLD.is_trial_active, false) AND NOT cortesia THEN NEW.is_trial_active := OLD.is_trial_active; END IF;
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
create trigger protect_profile_billing before update on public.profiles for each row execute function public.protect_profile_billing_columns();

-- end of the test (production, unchanged): expires when trial_end < today in Brasília
create or replace function public.check_trial_expired(user_uuid uuid) returns boolean language plpgsql set search_path to 'public' as $function$
declare
  pr record;
  hoje_br date;
begin
  if auth.uid() is null or auth.uid() <> user_uuid then
    return false;
  end if;
  hoje_br := (now() at time zone 'America/Sao_Paulo')::date;
  select trial_end, plan_status, is_demo, billing_exempt into pr from public.profiles where user_id = user_uuid;
  if coalesce(pr.is_demo, false) and coalesce(pr.billing_exempt, false) then
    return false;
  end if;
  if pr.plan_status = 'active' then
    return false;
  end if;
  if pr.plan_status is distinct from 'expired'
     and (pr.trial_end is null or pr.trial_end < hoje_br) then
    update public.profiles set is_trial_active = false, plan_status = 'expired' where user_id = user_uuid;
    return true;
  end if;
  return false;
end;
$function$;

-- end of the overdue grace (production, unchanged): blocks when grace_until has passed
create or replace function public.expire_overdue_subscriptions() returns integer language plpgsql security definer set search_path to 'public' as $function$
declare
  n int := 0;
begin
  with vencidas as (
    select s.user_id
    from public.subscriptions s
    join public.profiles p on p.user_id = s.user_id
    where s.status in ('active', 'past_due')
      and coalesce(s.grace_until, s.current_period_end, s.last_event_at + interval '33 days') < now()
      and coalesce(p.is_demo, false) = false
      and coalesce(p.billing_exempt, false) = false
  ),
  upd_sub as (
    update public.subscriptions s
    set status = 'expired', updated_at = now()
    where s.user_id in (select user_id from vencidas)
    returning s.user_id
  )
  update public.profiles p
  set plan_status = 'expired', is_trial_active = false
  from upd_sub u
  where p.user_id = u.user_id;
  get diagnostics n = row_count;
  return n;
end $function$;
