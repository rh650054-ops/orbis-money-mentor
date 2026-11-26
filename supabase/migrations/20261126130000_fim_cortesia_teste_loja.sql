-- 26/11/2026 (Rick, product decision): the VANT test is 3 days on every platform — site, PWA,
-- Android, iOS, closed testers, influencer sign-ups. The 30-day store courtesy is OVER.
-- cortesia_teste_loja_pedir() was granting 30 days to any new account that called it (the store
-- app calls it on every login; nothing proved the person was a tester). Installed apps keep
-- calling it, so it stays, with the same signature and answers, but it NEVER grants anything and
-- never writes: 'ja_tinha' for the 7 accounts that already got it (kept as they are: dates and
-- records untouched), 'fora' for everyone else.
--   cortesia_teste_loja_minha(): the person's own old courtesy end date (null = none), so those 7
--   keep seeing their real date.
-- The profile trigger's courtesy path (vant.cortesia_loja) becomes unreachable: no function sets it.
-- Rollback: supabase/cortesia-testadores/rollback.sql
create or replace function public.cortesia_teste_loja_pedir()
 returns text language sql stable security definer set search_path to 'public'
as $function$
  -- 26/11: no new courtesy, ever. Same answers as before, nothing written.
  select case when auth.uid() is not null and exists (select 1 from public.cortesia_teste_loja c where c.user_id = auth.uid())
              then 'ja_tinha' else 'fora' end;
$function$;
revoke all on function public.cortesia_teste_loja_pedir() from public, anon;
grant execute on function public.cortesia_teste_loja_pedir() to authenticated;

create or replace function public.cortesia_teste_loja_minha()
returns date language sql stable security definer set search_path to 'public' as $$
  select p.trial_end from public.cortesia_teste_loja c join public.profiles p on p.user_id = c.user_id
   where c.user_id = auth.uid();
$$;
revoke all on function public.cortesia_teste_loja_minha() from public, anon;
grant execute on function public.cortesia_teste_loja_minha() to authenticated;
