-- 26/11/2026: billing tables for the Hotmart renewal path and the store-test courtesy. Columns and
-- the orbis_hotmart_assinatura view copied from the production catalog on 26/11 (only what the
-- functions under test read). No real data.
alter table auth.users add column if not exists email text;
alter table public.profiles add column if not exists email text, add column if not exists phone text,
  add column if not exists plan_status text default 'trial', add column if not exists billing_exempt boolean default false,
  add column if not exists is_demo boolean default false, add column if not exists trial_start date, add column if not exists trial_end date,
  add column if not exists is_trial_active boolean default true, add column if not exists subscription_id text,
  add column if not exists created_at timestamptz not null default now();
create table if not exists public.subscriptions (id uuid not null default gen_random_uuid() primary key, user_id uuid not null unique, provider text not null default 'hotmart', status text not null default 'inactive',
  current_period_end timestamptz, grace_until timestamptz, hotmart_subscription_id text, hotmart_purchase_id text, last_event_at timestamptz default now(),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table if not exists public.orbis_pro (user_id uuid not null, assinante_codigo text, ativo boolean not null default true);
create table if not exists public.bancos_extra_compras (chave text not null primary key, user_id uuid not null, ativo boolean not null default true, ate timestamptz not null, atualizado_em timestamptz not null default now());
create table if not exists public.hotmart_eventos (id uuid not null default gen_random_uuid() primary key, event_id text, event_type text, purchase_id text, subscription_id text,
  buyer_email text, buyer_cpf text, buyer_nome text, valor numeric, moeda text, user_id uuid, recebido_em timestamptz not null default now(), payload jsonb);
create table if not exists public.assinar_tokens (token text primary key, user_id uuid not null, criado_em timestamptz not null default now(), usado_em timestamptz);
create table if not exists public.cortesia_teste_loja (user_id uuid primary key, em timestamptz not null default now(), trial_end_antes date);

create or replace view public.orbis_hotmart_assinatura as
with ev as (
  select he.subscription_id, he.recebido_em, he.event_type, he.user_id,
         nullif(he.payload #>> '{data,purchase,offer,code}', '') as oferta_codigo,
         nullif(he.payload #>> '{data,subscription,status}', '') as status_hotmart,
         nullif(he.payload #>> '{data,subscription,plan,name}', '') as plano,
         (he.payload #>> '{data,purchase,price,value}')::numeric as preco,
         case when (he.payload #>> '{data,purchase,date_next_charge}') ~ '^\d+$'
              then to_timestamp(((he.payload #>> '{data,purchase,date_next_charge}')::bigint / 1000)::double precision) end as proxima_cobranca,
         case when (he.payload #>> '{data,purchase,approved_date}') ~ '^\d+$'
              then to_timestamp(((he.payload #>> '{data,purchase,approved_date}')::bigint / 1000)::double precision) end as aprovado_em
    from public.hotmart_eventos he where he.payload is not null and he.subscription_id is not null),
ult as (select distinct on (subscription_id) * from ev order by subscription_id, recebido_em desc)
select subscription_id, user_id, oferta_codigo, status_hotmart, plano, preco as valor, proxima_cobranca, aprovado_em,
       recebido_em as ultimo_evento_em, event_type as ultimo_evento from ult;

-- production renovacao_pix_de (20261023190000), unchanged
create or replace function public.renovacao_pix_de(p_user uuid)
returns table (subscription_id text, purchase_id text, plano text, valor numeric, pix_code text, pix_qrcode text, vence_em timestamptz, gerado_em timestamptz, atrasada boolean)
language sql stable security definer set search_path to 'public' as $$
  with sub as (select s.hotmart_subscription_id as sid from public.subscriptions s where s.user_id = p_user and s.hotmart_subscription_id is not null
               union select o.assinante_codigo from public.orbis_pro o where o.user_id = p_user and o.assinante_codigo is not null),
  pix as (select e.subscription_id, e.purchase_id, e.payload->'data'->'subscription'->'plan'->>'name' as plano, e.valor,
                 e.payload->'data'->'purchase'->'payment'->>'pix_code' as pix_code, null::text as pix_qrcode,
                 to_timestamp((e.payload->'data'->'purchase'->'payment'->>'pix_expiration_date')::bigint / 1000) as vence_em, e.recebido_em as gerado_em
            from public.hotmart_eventos e join sub on sub.sid = e.subscription_id
           where e.event_type = 'PURCHASE_BILLET_PRINTED' and e.payload->'data'->'purchase'->'payment'->>'pix_code' is not null)
  select p.*, false from pix p where p.vence_em > now()
     and not exists (select 1 from public.hotmart_eventos x where x.purchase_id = p.purchase_id and x.event_type in ('PURCHASE_APPROVED','PURCHASE_COMPLETE'))
   order by p.gerado_em desc limit 1;
$$;
