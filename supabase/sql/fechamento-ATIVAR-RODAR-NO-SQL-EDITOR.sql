-- Fechamento oficial: ativa os crons. RODAR SÓ COM AUTORIZAÇÃO DO RICK, depois da migration
-- 20261108120000_fechamento_segunda_06h.sql. Desligue a tradução do navegador antes.
--
-- O que liga (horários em UTC; Brasília = UTC-3, sem horário de verão):
--   premio-fechamento-06h  09:00 UTC todo dia = 06:00 BRT. A função só age na segunda (semana
--                          seg→dom anterior) e no dia 1 (mês anterior); nos outros dias não faz nada.
--   premio-reavaliar       minuto 35 de toda hora: refaz os períodos PROVISÓRIOS até homologar
--                          (ou até 7 dias; depois espera premio_homologar_manual).
--   pluggy-dia-segunda     08:15 UTC = 05:15 BRT toda segunda: uma leitura bancária extra antes do
--                          fechamento (1 pedido a mais por conexão por semana, dentro dos 240/mês).
--
-- O cron antigo (id 23, premio-fechamento, 23:30 BRT) fica DESLIGADO e é removido aqui, porque a
-- função que ele chamava (premio_congelar_agora) agora é a nova: deixá-lo ativo faria dois
-- fechamentos. Nada mais muda: ranking ao vivo, leituras bancárias, assinaturas seguem iguais.
--
-- Rollback: select cron.unschedule('premio-fechamento-06h'); select cron.unschedule('premio-reavaliar');
--           select cron.unschedule('pluggy-dia-segunda');  (o fechamento para; nada é apagado)

select cron.unschedule(23);  -- premio-fechamento antigo (23:30 BRT), já pausado em 08/11

select cron.schedule('premio-fechamento-06h', '0 9 * * *', $$ select public.premio_congelar_agora(); $$);
select cron.schedule('premio-reavaliar', '35 * * * *', $$ select public.premio_reavaliar(); $$);
select cron.schedule('pluggy-dia-segunda', '15 8 * * 1', $$
  select net.http_post(
    url := 'https://qbcsjsdwjjpybvzbxszi.supabase.co/functions/v1/pluggy-dia',
    body := '{}'::jsonb,
    headers := jsonb_build_object('Content-Type','application/json','x-orbis-cron',(select token from public.painel_tokens where nome = 'cron')),
    timeout_milliseconds := 120000);
$$);

select jobid, jobname, schedule, active from cron.job where jobname like 'premio%' or jobname like 'pluggy-dia%' order by jobname;
