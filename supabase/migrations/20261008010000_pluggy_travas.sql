-- Pluggy travas (08/10/2026): daily read counter per bank + robot schedule.
-- The agenda that decides WHEN to read lives in supabase/functions/_shared/pluggy-agenda.ts.

alter table public.bank_connections
  add column if not exists leituras_dia date,
  add column if not exists leituras_qtd integer not null default 0;

comment on column public.bank_connections.leituras_dia is
  'Brasília day of leituras_qtd. A different day means the counter restarts at 0.';
comment on column public.bank_connections.leituras_qtd is
  'Bank reads made on leituras_dia (robot + "puxar agora"). Capped by LIMITE_DIA in pluggy-agenda.ts.';

-- The robot (job 16) now runs every 5 min all day: most runs read nothing and
-- return after one query. Running at night is what lets the closing read
-- (00:05–04:00 Brasília) be spread across vendors instead of one 00:02 spike,
-- so the old fixed 00:02 job (17) is turned off.
do $$
begin
  if exists (select 1 from cron.job where jobid = 16) then
    perform cron.alter_job(16, schedule := '*/5 * * * *');
  end if;
  if exists (select 1 from cron.job where jobid = 17) then
    perform cron.alter_job(17, active := false);
  end if;
end $$;

-- nomear-sinais (job 3) names traffic lights in the background from OSM. It ran
-- every minute (1.440 calls/day) even when there was nothing left to name.
-- Every 10 min still drains the backlog (40 lights per run) at 1/10 of the calls.
do $$
begin
  if exists (select 1 from cron.job where jobid = 3) then
    perform cron.alter_job(3, schedule := '*/10 * * * *');
  end if;
end $$;
