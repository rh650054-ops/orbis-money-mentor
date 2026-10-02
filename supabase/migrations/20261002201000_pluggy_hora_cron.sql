-- ============================================================
-- CRON do Pix travado — 02/10/2026
--   pluggy-hora lê o banco de quem tem conexão:
--     • de hora em hora, das 8h às 23h (Brasília) → minuto 7, 11h–02h UTC
--     • 0h02 (Brasília) → 03:02 UTC, última leitura do dia anterior,
--       3 minutos antes da liquidação do X1 (x1-liquidacao-0h, 03:05 UTC)
--   Mesmo cabeçalho do mp-sync: x-orbis-cron com o token de painel_tokens.
-- ============================================================
select cron.unschedule(jobid) from cron.job where jobname in ('pluggy-hora', 'pluggy-fecha-dia');

select cron.schedule('pluggy-hora', '7 0-2,11-23 * * *', $$
  select net.http_post(
    url := 'https://qbcsjsdwjjpybvzbxszi.supabase.co/functions/v1/pluggy-hora',
    body := '{}'::jsonb,
    headers := jsonb_build_object('Content-Type','application/json','x-orbis-cron',(select token from public.painel_tokens where nome='cron')),
    timeout_milliseconds := 60000
  );
$$);

select cron.schedule('pluggy-fecha-dia', '2 3 * * *', $$
  select net.http_post(
    url := 'https://qbcsjsdwjjpybvzbxszi.supabase.co/functions/v1/pluggy-hora',
    body := '{}'::jsonb,
    headers := jsonb_build_object('Content-Type','application/json','x-orbis-cron',(select token from public.painel_tokens where nome='cron')),
    timeout_milliseconds := 60000
  );
$$);
