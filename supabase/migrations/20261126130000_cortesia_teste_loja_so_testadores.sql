-- 26/11/2026 (Rick): the 30-day store-test courtesy was granted to ANY new account that called
-- cortesia_teste_loja_pedir() (the app calls it for every store-app login; nothing on the server
-- proved the person was a closed-test tester). Now the server only grants it to an e-mail on the
-- testers list kept by the admin. A flag sent by the app is never proof.
--
--   testadores_loja (email): the closed-test testers, loaded by the admin (Play Console list).
--   testadores_loja_adicionar(emails[]): admin only; returns how many were added.
--   cortesia_teste_loja_pedir(): same rules as before (until 15/12, account up to 7 days old,
--     never paid, once per account) + the login e-mail OR the profile e-mail is on the list.
--   cortesia_teste_loja_minha(): the person's own courtesy (date it ends) for the app's message.
-- Courtesies already granted are kept as they are: no date is changed, nobody is revoked.
-- Rollback: supabase/cortesia-testadores/rollback.sql
create table if not exists public.testadores_loja (
  email text primary key check (email = lower(btrim(email)) and position('@' in email) > 1),
  adicionado_em timestamptz not null default now(),
  adicionado_por uuid
);
alter table public.testadores_loja enable row level security;
revoke all on public.testadores_loja from anon, authenticated;

create or replace function public.testadores_loja_adicionar(p_emails text[])
returns integer language plpgsql security definer set search_path to 'public' as $$
declare n integer;
begin
  if not public.is_orbis_admin() then raise exception 'so o admin'; end if;
  insert into public.testadores_loja (email, adicionado_por)
  select distinct lower(btrim(e)), auth.uid() from unnest(coalesce(p_emails, '{}')) e
   where position('@' in coalesce(e, '')) > 1
  on conflict (email) do nothing;
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.testadores_loja_adicionar(text[]) from public, anon;
grant execute on function public.testadores_loja_adicionar(text[]) to authenticated;

-- 'aplicada' | 'ja_tinha' | 'fora'
create or replace function public.cortesia_teste_loja_pedir()
 returns text language plpgsql security definer set search_path to 'public'
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

  select created_at, trial_start, trial_end, plan_status, subscription_id, is_demo, billing_exempt, email
    into p from profiles where user_id = v_uid;
  if not found then return 'fora'; end if;
  -- 26/11: only a tester on the admin's list (login e-mail or profile e-mail)
  if not exists (select 1 from testadores_loja t
                  where t.email = lower(btrim(coalesce((select u.email from auth.users u where u.id = v_uid), '')))
                     or t.email = lower(btrim(coalesce(p.email, '')))) then
    return 'fora';
  end if;
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

-- the person's own courtesy: when it ends (null = no courtesy)
create or replace function public.cortesia_teste_loja_minha()
returns date language sql stable security definer set search_path to 'public' as $$
  select p.trial_end from public.cortesia_teste_loja c join public.profiles p on p.user_id = c.user_id
   where c.user_id = auth.uid();
$$;
revoke all on function public.cortesia_teste_loja_minha() from public, anon;
grant execute on function public.cortesia_teste_loja_minha() to authenticated;
