-- 26/11/2026 (Rick, product decision): the VANT test is 3 days on every platform — site, PWA,
-- Android, iOS, closed testers, influencer sign-ups. The 30-day store courtesy is OVER.
-- cortesia_teste_loja_pedir() was granting 30 days to any new account that called it (the store
-- app calls it on every login; nothing proved the person was a tester). Installed apps keep
-- calling it, so it stays, with the same signature and answers, but it NEVER grants anything and
-- never writes: 'ja_tinha' for the 7 accounts that already got it (kept as they are: dates and
-- records untouched), 'fora' for everyone else. Installed apps only react to 'aplicada'
-- (the "Você ganhou 30 dias" notice), which is never returned again.
-- Rollback: supabase/fim-cortesia-loja/rollback.sql
create or replace function public.cortesia_teste_loja_pedir()
 returns text language sql stable security definer set search_path to 'public'
as $function$
  -- 26/11: no new courtesy, ever. Same answers as before, nothing written.
  select case when auth.uid() is not null and exists (select 1 from public.cortesia_teste_loja c where c.user_id = auth.uid())
              then 'ja_tinha' else 'fora' end;
$function$;
revoke all on function public.cortesia_teste_loja_pedir() from public, anon;
grant execute on function public.cortesia_teste_loja_pedir() to authenticated;

-- The profile lock had one exception, opened on 28/10 only for that courtesy (transaction flag
-- vant.cortesia_loja): with it, a normal session could raise its own trial_end / go back to
-- 'trial'. Nothing sets the flag any more, so the exception goes away: the function below is the
-- production one without it (every other line unchanged). The test dates are written only by the
-- sign-up trigger (sign-up day + 3), the backend (service_role) and the admins.
create or replace function public.protect_profile_billing_columns()
 returns trigger
 language plpgsql
 set search_path to 'public'
as $function$
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

  NEW.trial_end       := OLD.trial_end;

  IF NEW.plan_status IS DISTINCT FROM OLD.plan_status AND NEW.plan_status <> 'expired' THEN
    NEW.plan_status := OLD.plan_status;
  END IF;

  IF COALESCE(NEW.is_trial_active, false) AND NOT COALESCE(OLD.is_trial_active, false) THEN
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
