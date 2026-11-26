-- Renewal path (26/11/2026). The checkout is only offered when Hotmart would accept a NEW
-- subscription; otherwise the person is sent to the existing charge. Fictional data.
create temp table f (k text primary key, id uuid);
create or replace function pg_temp.id(p text) returns uuid language sql as $$ select id from f where k = p $$;
create or replace function pg_temp.ev(u uuid, sub text, status text, oferta text, tipo text, dias_atras int default 0) returns void language sql as $$
  insert into public.hotmart_eventos (event_type, subscription_id, user_id, recebido_em, payload)
  values (tipo, sub, u, now() - make_interval(days => dias_atras), jsonb_build_object('data', jsonb_build_object(
    'subscription', jsonb_build_object('status', status, 'plan', jsonb_build_object('name', 'VANT')),
    'purchase', jsonb_build_object('offer', jsonb_build_object('code', oferta), 'price', jsonb_build_object('value', 29.9),
      'date_next_charge', (extract(epoch from now() + interval '20 days') * 1000)::bigint::text))))
$$;
create or replace function pg_temp.acao(u text) returns text language sql as $$ select public.assinatura_caminho_de(pg_temp.id(u))->>'acao' $$;
do $$
begin
  insert into f select k, t.vendedor(k) from unnest(array['ativo','atrasado','cancelado','pago_bloqueado','novo','pendente','so_banco','renovou']) k;
  update public.profiles set plan_status = 'active' where user_id in (pg_temp.id('ativo'), pg_temp.id('renovou'));
  update public.profiles set plan_status = 'expired' where user_id in (pg_temp.id('atrasado'), pg_temp.id('cancelado'), pg_temp.id('pago_bloqueado'), pg_temp.id('pendente'), pg_temp.id('so_banco'));
  perform pg_temp.ev(pg_temp.id('ativo'), 'S-ATIVO', 'ACTIVE', '8qbxvm9p', 'PURCHASE_APPROVED');
  perform pg_temp.ev(pg_temp.id('atrasado'), 'S-ATR', 'ACTIVE', '8qbxvm9p', 'PURCHASE_APPROVED', 40);
  perform pg_temp.ev(pg_temp.id('atrasado'), 'S-ATR', 'PAST_DUE', '8qbxvm9p', 'PURCHASE_DELAYED', 5);
  perform pg_temp.ev(pg_temp.id('cancelado'), 'S-CAN', 'CANCELLED_BY_CUSTOMER', '8qbxvm9p', 'SUBSCRIPTION_CANCELLATION');
  perform pg_temp.ev(pg_temp.id('pago_bloqueado'), 'S-PB', 'ACTIVE', '5y86n311', 'PURCHASE_APPROVED');
  perform pg_temp.ev(pg_temp.id('pendente'), 'S-PEN', 'STARTED', '8qbxvm9p', 'PURCHASE_BILLET_PRINTED');
  -- only the extra-bank add-on is overdue: never a reason to block a plan checkout
  perform pg_temp.ev(pg_temp.id('so_banco'), 'S-BX', 'PAST_DUE', '3nnrr1xn', 'PURCHASE_DELAYED');
  -- old subscription cancelled, new one active: the active one decides
  perform pg_temp.ev(pg_temp.id('renovou'), 'S-OLD', 'CANCELED', '8qbxvm9p', 'SUBSCRIPTION_CANCELLATION', 60);
  perform pg_temp.ev(pg_temp.id('renovou'), 'S-NEW', 'ACTIVE', '8qbxvm9p', 'PURCHASE_APPROVED', 2);
end $$;

select t.verdade('C1 active subscriber: em_dia — no new subscription is offered', pg_temp.acao('ativo') = 'em_dia');
select t.verdade('C2 overdue (PAST_DUE): regularizar the existing charge, never a new checkout', pg_temp.acao('atrasado') = 'regularizar'
  and public.assinatura_caminho_de(pg_temp.id('atrasado'))->>'assinatura' = 'S-ATR');
select t.verdade('C3 cancelled on Hotmart: a new subscription is valid (nova)', pg_temp.acao('cancelado') = 'nova');
select t.verdade('C4 ACTIVE on Hotmart but blocked here: conciliar (check and release)', pg_temp.acao('pago_bloqueado') = 'conciliar'
  and public.assinatura_caminho_de(pg_temp.id('pago_bloqueado'))->>'oferta' = '5y86n311');
select t.verdade('C5 never subscribed: normal checkout (nova)', pg_temp.acao('novo') = 'nova');
select t.verdade('C6 first payment still open (STARTED): pendente', pg_temp.acao('pendente') = 'pendente');
select t.verdade('C7 only the extra-bank add-on is overdue: the plan checkout stays open (nova)', pg_temp.acao('so_banco') = 'nova');
select t.verdade('C8 a cancelled old subscription never hides the active new one', pg_temp.acao('renovou') = 'em_dia');

-- the app reads only its own path; the token page reads it by a 30-minute token
select t.logar(pg_temp.id('atrasado'));
select t.verdade('C9 assinatura_caminho() is the logged-in person''s own', public.assinatura_caminho()->>'acao' = 'regularizar');
insert into public.assinar_tokens (token, user_id) values ('tok-ok', pg_temp.id('atrasado')), ('tok-velho', pg_temp.id('atrasado'));
update public.assinar_tokens set criado_em = now() - interval '2 hours' where token = 'tok-velho';
select t.verdade('C10 token page: valid token gives the path, an expired token gives only nova (nothing leaks)',
  public.assinar_token_caminho('tok-ok')->>'acao' = 'regularizar' and public.assinar_token_caminho('tok-velho') = '{"acao": "nova"}'::jsonb
  and public.assinar_token_caminho('nao-existe') = '{"acao": "nova"}'::jsonb);
select t.verdade('C11 the per-user reader is not callable by the app; the own-path and token ones are',
  not has_function_privilege('authenticated', 'public.assinatura_caminho_de(uuid)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.assinatura_caminho()', 'EXECUTE')
  and has_function_privilege('anon', 'public.assinar_token_caminho(text)', 'EXECUTE'));
-- several subscriptions on the same account: the one in good standing decides
do $$ begin
  insert into f values ('varias', t.vendedor('varias'));
  update public.profiles set plan_status = 'active' where user_id = pg_temp.id('varias');
  perform pg_temp.ev(pg_temp.id('varias'), 'S-V1', 'PAST_DUE', '8qbxvm9p', 'PURCHASE_DELAYED', 1);
  perform pg_temp.ev(pg_temp.id('varias'), 'S-V2', 'ACTIVE', '5y86n311', 'PURCHASE_APPROVED', 3);
end $$;
select t.verdade('C12 several subscriptions (one overdue, one active): the active one decides, nothing to buy again',
  pg_temp.acao('varias') = 'em_dia' and public.assinatura_caminho_de(pg_temp.id('varias'))->>'assinatura' = 'S-V2');
