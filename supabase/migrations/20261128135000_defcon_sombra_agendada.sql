-- Shadow mode of ADR 0001 (§4 step B, §7.5): every night, measure YESTERDAY's DEFCON sessions —
-- what the clients wrote vs what the ledger explains — into defcon_sombra. Read-only for the app's
-- data: it only writes defcon_sombra (closed to clients). Approval: defcon_sombra_aprovacao(desde, ate).
-- 06:13 UTC = 03:13 in Brazil (after midnight sessions and the 02:30 prize closing).
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'defcon-sombra';
    perform cron.schedule('defcon-sombra', '13 6 * * *',
      $c$ select public.defcon_sombra_medir(((now() at time zone 'America/Sao_Paulo')::date) - 1); $c$);
  end if;
end $$;
