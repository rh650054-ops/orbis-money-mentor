-- Corte de assinatura vencida: de 1x por dia (06:00) pra 1x por hora (Rick, 24/10/2026).
-- A regra é a mesma (expire_overdue_subscriptions): passou os 3 dias de carência depois do
-- mês pago, sem pagar, sem cortesia/demo → plano 'expired' e a tela de bloqueio aparece.
-- Antes a pessoa ainda usava até as 06:00 do dia seguinte; agora no máximo 1 hora.
select cron.alter_job(
  job_id := (select jobid from cron.job where jobname = 'expira-assinaturas-6h'),
  schedule := '13 * * * *');
