-- ============================================================
-- CRON da leitura diária (etapa 4) — 02/10/2026
--   pluggy-dia: cartão, parcelas, empréstimos, investimentos e cheque especial,
--   uma vez por dia às 3h20 de Brasília (06:20 UTC). Mesmo cabeçalho do pluggy-hora.
--   Idempotente: só cria o job se ele ainda não existir.
-- ============================================================
do $$ begin
  if not exists (select 1 from cron.job where jobname = 'pluggy-dia') then
    perform cron.schedule('pluggy-dia', '20 6 * * *', $job$
      select net.http_post(
        url := 'https://qbcsjsdwjjpybvzbxszi.supabase.co/functions/v1/pluggy-dia',
        body := '{}'::jsonb,
        headers := jsonb_build_object('Content-Type','application/json','x-orbis-cron',(select token from public.painel_tokens where nome='cron')),
        timeout_milliseconds := 150000
      );
    $job$);
  end if;
end $$;
