-- 04/11/2026 (Rick): when someone loses access (cancelled or didn't pay), the bank stops being read right
-- away, and if he doesn't come back within 7 days the Pluggy connection is removed. Before, nothing
-- happened: the bank kept being read (Pluggy budget) for someone who no longer had the app.
--   bank_connections.pausado_em  = when reading stopped (null = reading normally)
--   banco_pausar_sem_acesso()    = hourly: pauses who lost access, un-pauses who came back
--   pluggy-hora                  = removes on Pluggy the connections paused for 7+ days (edge code)
alter table public.bank_connections add column if not exists pausado_em timestamptz;

-- who may have the bank read: same gate as connecting (Pro / add-on), plus testers and exempt accounts
create or replace function public.banco_pode_ler(p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.orbis_pro_ativo(p_user) or public.open_finance_teste(p_user)
      or exists (select 1 from public.profiles p where p.user_id = p_user and coalesce(p.billing_exempt, false));
$$;
revoke all on function public.banco_pode_ler(uuid) from public, anon;
grant execute on function public.banco_pode_ler(uuid) to authenticated, service_role;

create or replace function public.banco_pausar_sem_acesso()
returns jsonb language plpgsql security definer set search_path = public as $$
declare pausou int; voltou int;
begin
  update public.bank_connections set pausado_em = now()
   where coalesce(status, '') <> 'deleted' and pausado_em is null and not public.banco_pode_ler(user_id);
  get diagnostics pausou = row_count;
  update public.bank_connections set pausado_em = null
   where coalesce(status, '') <> 'deleted' and pausado_em is not null and public.banco_pode_ler(user_id);
  get diagnostics voltou = row_count;
  return jsonb_build_object('pausou', pausou, 'voltou', voltou);
end $$;
revoke all on function public.banco_pausar_sem_acesso() from public, anon, authenticated;
grant execute on function public.banco_pausar_sem_acesso() to service_role;

select cron.unschedule(jobid) from cron.job where jobname = 'banco-pausar';
select cron.schedule('banco-pausar', '50 * * * *', $c$ select public.banco_pausar_sem_acesso(); $c$);

select public.banco_pausar_sem_acesso();
