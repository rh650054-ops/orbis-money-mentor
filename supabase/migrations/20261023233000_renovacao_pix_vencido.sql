-- ============================================================
-- Pix de renovação VENCIDO sem pagamento (Rick, 23/10/2026)
-- Quando o Pix da renovação vence, a Hotmart demora pra mandar outro e o cliente
-- fica sem código no app (caso Aleff: venceu 22/10, acesso até 31/10). Esta função
-- devolve o último Pix vencido e não pago, só quando NÃO existe Pix aberto, a
-- assinatura não foi paga depois nem cancelada. O app mostra "Gerar novo Pix", que
-- abre a área do cliente da Hotmart. Só leitura; nada é apagado.
-- ============================================================

create or replace function public.renovacao_pix_vencido_de(p_user uuid)
returns table(subscription_id text, plano text, valor numeric, venceu_em timestamptz)
language sql stable security definer set search_path to 'public' as $$
  with sub as (
    select s.hotmart_subscription_id as sid from public.subscriptions s
     where s.user_id = p_user and s.hotmart_subscription_id is not null
    union
    select o.assinante_codigo from public.orbis_pro o
     where o.user_id = p_user and o.assinante_codigo is not null
  ), pix as (
    select e.subscription_id, e.purchase_id, e.valor, e.recebido_em as gerado_em,
           coalesce(e.payload->'data'->'subscription'->'plan'->>'name', e.payload->'data'->'product'->>'name') as plano,
           to_timestamp((e.payload->'data'->'purchase'->'payment'->>'pix_expiration_date')::bigint / 1000) as vence_em
      from public.hotmart_eventos e join sub on sub.sid = e.subscription_id
     where e.event_type = 'PURCHASE_BILLET_PRINTED'
       and e.payload->'data'->'purchase'->'payment'->>'pix_code' is not null
       and e.recebido_em > now() - interval '45 days'
  ), ultimo as (
    select * from pix order by gerado_em desc limit 1
  )
  select u.subscription_id, u.plano, u.valor, u.vence_em
    from ultimo u
   where u.vence_em <= now()
     -- essa cobrança não foi paga nem encerrada
     and not exists (select 1 from public.hotmart_eventos x where x.purchase_id = u.purchase_id
                      and x.event_type in ('PURCHASE_APPROVED','PURCHASE_COMPLETE','PURCHASE_CANCELED','PURCHASE_REFUNDED','PURCHASE_CHARGEBACK'))
     -- a assinatura não foi paga depois (outra cobrança) nem cancelada
     and not exists (select 1 from public.hotmart_eventos y where y.subscription_id = u.subscription_id
                      and y.recebido_em > u.gerado_em
                      and y.event_type in ('PURCHASE_APPROVED','PURCHASE_COMPLETE','SUBSCRIPTION_CANCELLATION'))
     -- só renovação ATRASADA (Hotmart: past_due). Assinatura já encerrada não renova:
     -- essa pessoa vê os planos normais.
     and exists (select 1 from public.subscriptions s where s.user_id = p_user
                  and s.hotmart_subscription_id = u.subscription_id and s.status = 'past_due')
     -- nenhum Pix aberto (se houver, o app já mostra o "Copiar Pix")
     and not exists (select 1 from public.renovacao_pix_de(p_user));
$$;
revoke all on function public.renovacao_pix_vencido_de(uuid) from public, anon, authenticated;
grant execute on function public.renovacao_pix_vencido_de(uuid) to service_role;

create or replace function public.renovacao_pix_vencido()
returns table(subscription_id text, plano text, valor numeric, venceu_em timestamptz)
language sql stable security definer set search_path to 'public' as $$
  select * from public.renovacao_pix_vencido_de(auth.uid());
$$;
revoke all on function public.renovacao_pix_vencido() from public, anon;
grant execute on function public.renovacao_pix_vencido() to authenticated, service_role;
