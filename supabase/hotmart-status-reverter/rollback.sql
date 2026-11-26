-- Rollback of the 26/11 status sync (hotmart-conciliar, so_status). The sync only INSERTS audit
-- events ('api:<code>:<status>:<minute>') into hotmart_eventos; orbis_hotmart_assinatura reads the
-- latest event, so deleting those rows brings every record back to what it was. Access, terms,
-- charges and subscriptions are never touched by the sync, so nothing else needs reverting.
-- Fill in the run's start time before executing.
delete from public.hotmart_eventos
 where event_id like 'api:%' and payload->>'conferido_api' = 'true'
   and recebido_em >= timestamptz '2026-11-26 00:00:00-03'   -- replace with the run's start time
returning event_id, subscription_id, event_type;
