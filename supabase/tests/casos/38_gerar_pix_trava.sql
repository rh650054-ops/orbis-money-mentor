-- 26/11/2026: "Gerar Pix" — the record of negotiations and its lock (one open negotiation per
-- subscription, a valid Pix is reused, a lost answer is never repeated blindly).
create temp table f (k text primary key, id uuid);
create or replace function pg_temp.id(p text) returns uuid language sql as $$ select id from f where k = p $$;
insert into f select k, t.vendedor(k) from unnest(array['ana','beto']) k;
select set_config('request.jwt.claims', '{"role":"service_role"}', false);
create or replace function pg_temp.reservar(p_user text, p_sub text, p_rec int) returns jsonb language sql as $$
  select public.hotmart_negociacao_reservar(pg_temp.id(p_user), p_sub, 5011, p_rec, 29.90, now() + interval '20 days', 'teste') $$;

select pg_temp.reservar('ana', 'SUBA', 3) as r1 \gset
select pg_temp.reservar('ana', 'SUBA', 3) as r2 \gset
select t.verdade('P1 first request reserves; a second one at the same time does not (em_andamento)',
  :'r1'::jsonb ->> 'acao' = 'reservado' and :'r2'::jsonb ->> 'acao' = 'em_andamento'
  and (select count(*) from public.hotmart_negociacoes where assinatura = 'SUBA') = 1);

select public.hotmart_negociacao_gravar((:'r1'::jsonb ->> 'id')::uuid, 'gerado', 'HPNEG1', '000201PIXDETESTE6304ABCD', 'https://exemplo/qr', now() + interval '2 days') as g1 \gset
select pg_temp.reservar('ana', 'SUBA', 3) as r3 \gset
select t.verdade('P2 Pix generated and still valid: the same Pix is handed back, nothing new is asked',
  :'g1' = 'gerado' and :'r3'::jsonb ->> 'acao' = 'reutilizar' and :'r3'::jsonb ->> 'transacao' = 'HPNEG1'
  and :'r3'::jsonb ->> 'pix_code' = '000201PIXDETESTE6304ABCD' and (select count(*) from public.hotmart_negociacoes where assinatura = 'SUBA') = 1);

select t.verdade('P3 the same subscription cannot be reserved by another account',
  t.erro($$select public.hotmart_negociacao_reservar(pg_temp.id('beto'), 'SUBA', 5011, 3, 29.90, now(), 'teste')$$) like '%assinatura de outra conta%');

update public.hotmart_negociacoes set vence_em = now() - interval '1 minute' where transacao = 'HPNEG1';
select pg_temp.reservar('ana', 'SUBA', 3) as r4 \gset
select t.verdade('P4 the Pix expired: a new request is allowed and the old one is marked vencido',
  :'r4'::jsonb ->> 'acao' = 'reservado' and (select status from public.hotmart_negociacoes where transacao = 'HPNEG1') = 'vencido');

select public.hotmart_negociacao_gravar((:'r4'::jsonb ->> 'id')::uuid, 'falhou', null, null, null, null, 'http 400 invalid_parameter') as g4 \gset
select pg_temp.reservar('ana', 'SUBA', 3) as r5 \gset
select t.verdade('P5 Hotmart refused (no charge exists): asking again is allowed',
  :'g4' = 'falhou' and :'r5'::jsonb ->> 'acao' = 'reservado');

select public.hotmart_negociacao_gravar((:'r5'::jsonb ->> 'id')::uuid, 'incerto', null, null, null, null, 'sem resposta da Hotmart') as g5 \gset
select pg_temp.reservar('ana', 'SUBA', 3) as r6 \gset
select t.verdade('P6 no answer from Hotmart (a charge may exist): new requests are held, never repeated blindly',
  :'g5' = 'incerto' and :'r6'::jsonb ->> 'acao' = 'incerto' and (select count(*) from public.hotmart_negociacoes where assinatura = 'SUBA' and status in ('pedindo','gerado','incerto')) = 1);

select pg_temp.reservar('beto', 'SUBB', 2) as b1 \gset
update public.hotmart_negociacoes set pedido_em = now() - interval '5 minutes' where id = (:'b1'::jsonb ->> 'id')::uuid;
select pg_temp.reservar('beto', 'SUBB', 2) as b2 \gset
select t.verdade('P7 a request that never came back (function died): becomes incerto after 2 minutes, not a free retry',
  :'b2'::jsonb ->> 'acao' = 'incerto' and (select status from public.hotmart_negociacoes where id = (:'b1'::jsonb ->> 'id')::uuid) = 'incerto');

update public.hotmart_negociacoes set status = 'pago', pago_em = now() where id = (:'b1'::jsonb ->> 'id')::uuid;
select pg_temp.reservar('beto', 'SUBB', 2) as b3 \gset
select pg_temp.reservar('beto', 'SUBB', 3) as b4 \gset
select t.verdade('P8 a recurrence already paid through a negotiation is never charged again; the next one can be',
  :'b3'::jsonb ->> 'acao' = 'ja_paga' and :'b4'::jsonb ->> 'acao' = 'reservado');

select t.verdade('P9 a Pix without transaction or code is refused (nothing half-recorded)',
  t.erro(format($$select public.hotmart_negociacao_gravar(%L, 'gerado', null, 'x')$$, :'b4'::jsonb ->> 'id')) like '%pix sem transacao ou sem codigo%');

-- access: only the backend; the app reads only its own valid Pix
select t.verdade('P10 the app cannot read or write the table, nor call the backend functions',
  t.linhas_como('authenticated', pg_temp.id('ana'), 'select 1 from public.hotmart_negociacoes') = -1
  and t.erro($$select public.hotmart_negociacao_reservar(gen_random_uuid(), 'X', 1, 1, 1, now(), 'app')$$, 'authenticated', pg_temp.id('ana')) like '42501|%'
  and t.erro($$select public.hotmart_negociacao_gravar(gen_random_uuid(), 'falhou')$$, 'authenticated', pg_temp.id('ana')) like '42501|%');
select set_config('request.jwt.claims', '{"role":"service_role"}', false);
update public.hotmart_negociacoes set status = 'vencido' where assinatura = 'SUBA' and status = 'incerto';
select pg_temp.reservar('ana', 'SUBA', 3) as r7 \gset
select public.hotmart_negociacao_gravar((:'r7'::jsonb ->> 'id')::uuid, 'gerado', 'HPNEG7', '000201PIXDAANA6304ABCD', null, now() + interval '1 day') \gset z_
select t.logar(pg_temp.id('ana'));
select public.hotmart_negociacao_minha() as m_ana \gset
select t.logar(pg_temp.id('beto'));
select coalesce(public.hotmart_negociacao_minha()::text, 'nada') as m_beto \gset
select t.verdade('P11 each person sees only their own valid Pix', :'m_ana'::jsonb ->> 'pix_code' = '000201PIXDAANA6304ABCD' and :'m_beto' = 'nada');

-- the webhook marks the negotiation paid, once
select set_config('request.jwt.claims', '{"role":"service_role"}', false);
select id as neg7 from public.hotmart_negociacoes where transacao = 'HPNEG7' \gset
select public.hotmart_negociacao_paga(:'neg7'::uuid) as pg1 \gset
select public.hotmart_negociacao_paga(:'neg7'::uuid) as pg2 \gset
select t.logar(pg_temp.id('ana'));
select t.verdade('P12 paid once (APPROVED, then COMPLETE changes nothing); a paid Pix is no longer offered; the app cannot mark it paid',
  :'pg1' = 'paga' and :'pg2' = 'ja_paga' and public.hotmart_negociacao_minha() is null
  and t.erro(format($$select public.hotmart_negociacao_paga(%L)$$, :'neg7'), 'authenticated', pg_temp.id('ana')) like '42501|%');
