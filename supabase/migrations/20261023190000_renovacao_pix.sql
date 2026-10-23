-- 23/10/2026 (Rick): renewals must not leak into "subscribe again". Hotmart sends the renewal
-- Pix (copia-e-cola, QR, expiry) in PURCHASE_BILLET_PRINTED; the app now shows it: a warning
-- in Foco before it expires, "Renovar" on the block screen and on /assinar. The latest open
-- Pix of the person's subscription, only while it is still payable.

create or replace function public.renovacao_pix_de(p_user uuid)
returns table (subscription_id text, purchase_id text, plano text, valor numeric, pix_code text, pix_qrcode text,
               vence_em timestamptz, gerado_em timestamptz, atrasada boolean)
language sql stable security definer set search_path = public as $$
  with sub as (
    select s.hotmart_subscription_id as sid, s.status
      from public.subscriptions s where s.user_id = p_user and s.hotmart_subscription_id is not null
    union
    select o.assinante_codigo, case when o.ativo then 'active' else 'expired' end
      from public.orbis_pro o where o.user_id = p_user and o.assinante_codigo is not null
  ),
  pix as (
    select e.subscription_id, e.purchase_id,
           coalesce(e.payload->'data'->'subscription'->'plan'->>'name', e.payload->'data'->'product'->>'name') as plano,
           e.valor,
           e.payload->'data'->'purchase'->'payment'->>'pix_code' as pix_code,
           replace(e.payload->'data'->'purchase'->'payment'->>'pix_qrcode', '&amp;', '&') as pix_qrcode,
           to_timestamp((e.payload->'data'->'purchase'->'payment'->>'pix_expiration_date')::bigint / 1000) as vence_em,
           e.recebido_em as gerado_em
      from public.hotmart_eventos e
      join sub on sub.sid = e.subscription_id
     where e.event_type = 'PURCHASE_BILLET_PRINTED'
       and e.payload->'data'->'purchase'->'payment'->>'pix_code' is not null
       and e.recebido_em > now() - interval '45 days'
  )
  select p.subscription_id, p.purchase_id, p.plano, p.valor, p.pix_code, p.pix_qrcode, p.vence_em, p.gerado_em,
         exists (select 1 from public.hotmart_eventos d where d.purchase_id = p.purchase_id and d.event_type = 'PURCHASE_DELAYED') as atrasada
    from pix p
   where p.vence_em > now()
     -- not paid, not cancelled/refunded
     and not exists (select 1 from public.hotmart_eventos x where x.purchase_id = p.purchase_id
                       and x.event_type in ('PURCHASE_APPROVED','PURCHASE_COMPLETE','PURCHASE_CANCELED','PURCHASE_REFUNDED','PURCHASE_CHARGEBACK'))
     -- the subscription itself is still alive (a new subscription replaces the old one)
     and not exists (select 1 from public.hotmart_eventos c where c.subscription_id = p.subscription_id
                       and c.event_type = 'SUBSCRIPTION_CANCELLATION' and c.recebido_em > p.gerado_em)
   order by p.gerado_em desc
   limit 1;
$$;
revoke execute on function public.renovacao_pix_de(uuid) from public, anon, authenticated;

-- the logged-in person (app)
create or replace function public.renovacao_pix_pendente()
returns table (subscription_id text, purchase_id text, plano text, valor numeric, pix_code text, pix_qrcode text,
               vence_em timestamptz, gerado_em timestamptz, atrasada boolean)
language sql stable security definer set search_path = public as $$
  select * from public.renovacao_pix_de(auth.uid());
$$;
revoke execute on function public.renovacao_pix_pendente() from public, anon;
grant execute on function public.renovacao_pix_pendente() to authenticated;

-- /assinar?t=… (no session): same, through the one-time token
create or replace function public.assinar_token_pix(p_token text)
returns table (subscription_id text, purchase_id text, plano text, valor numeric, pix_code text, pix_qrcode text,
               vence_em timestamptz, gerado_em timestamptz, atrasada boolean)
language sql stable security definer set search_path = public as $$
  select r.* from public.assinar_tokens t, lateral public.renovacao_pix_de(t.user_id) r
   where t.token = p_token and t.criado_em > now() - interval '30 minutes';
$$;
revoke execute on function public.assinar_token_pix(text) from public;
grant execute on function public.assinar_token_pix(text) to anon, authenticated;
