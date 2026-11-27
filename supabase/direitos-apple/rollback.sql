-- Rollback of 20261127120000_direitos_multi_provedor_apple. One transaction: all or nothing.
--   1. Refuses to run while a PRODUCTION Apple subscription is stored. From the first real Apple
--      sale on, going back would take the plan or the Pro away from a paying customer, so that
--      decision is Rick's, account by account, and is not made by a script.
--   2. Puts the six changed functions back EXACTLY as they were in production on 27/11/2026
--      (bodies copied by script and checked by fingerprint against the production catalog).
--   3. Closes the extra-bank slots written by Apple ('apple:...' keys) and removes the Apple objects.
-- Hotmart data is not touched by the migration nor by this rollback.
-- casos/43_direitos_rollback.sql runs this file and then the same assertions as casos/40.
begin;

do $$
begin
  if to_regclass('public.apple_assinaturas') is not null
     and exists (select 1 from public.apple_assinaturas where ambiente = 'Production') then
    raise exception 'rollback recusado: existem assinaturas Apple de producao. Decida conta a conta antes de remover o espelho.';
  end if;
end $$;

-- ---------------------------------------------------------------------------------- the six functions
create or replace function public.hotmart_acesso_aplicar(
  p_user uuid, p_acao text, p_sub text, p_purchase text, p_fim timestamptz default null, p_complete boolean default false
) returns text
language plpgsql security definer set search_path = public as $$
declare
  s public.subscriptions;
  v_sub text := nullif(btrim(coalesce(p_sub, '')), '');
  v_outra text; v_outra_fim timestamptz;
  v_dono boolean;
begin
  if auth.jwt() ->> 'role' is distinct from 'service_role' then raise exception 'so o servidor'; end if;
  select * into s from public.subscriptions where user_id = p_user for update;
  v_dono := s.id is null or v_sub is null or nullif(s.hotmart_subscription_id, '') is null
            or s.hotmart_subscription_id = v_sub;

  if p_acao = 'ativar' then
    if p_fim is null then raise exception 'fim obrigatorio'; end if;
    -- 05/11: COMPLETE never changes an existing access row (it only confirms)
    if p_complete and s.id is not null then return 'complete_ignorado'; end if;
    if not v_dono and s.status in ('active', 'past_due') and s.current_period_end > p_fim then
      return 'outra_assinatura_paga_mais_longe';
    end if;
    insert into public.subscriptions as x (user_id, provider, status, current_period_end, grace_until,
                                           hotmart_purchase_id, hotmart_subscription_id, last_event_at)
    values (p_user, 'hotmart', 'active', p_fim, p_fim + interval '3 days', p_purchase, v_sub, now())
    on conflict (user_id) do update set
      provider = 'hotmart', status = 'active', current_period_end = excluded.current_period_end,
      grace_until = excluded.grace_until, hotmart_purchase_id = coalesce(excluded.hotmart_purchase_id, x.hotmart_purchase_id),
      hotmart_subscription_id = coalesce(excluded.hotmart_subscription_id, x.hotmart_subscription_id),
      last_event_at = now(), updated_at = now();
    update public.profiles set plan_status = 'active', is_trial_active = false where user_id = p_user;
    return 'ativada';

  elsif p_acao = 'atrasar' then
    if s.id is null or not v_dono then return 'outra_assinatura'; end if;
    update public.subscriptions
       set status = 'past_due', last_event_at = now(), updated_at = now(),
           hotmart_purchase_id = coalesce(nullif(p_purchase, ''), hotmart_purchase_id)
     where id = s.id;
    return 'atrasada';

  elsif p_acao = 'cancelar' then
    if not v_dono then return 'outra_assinatura'; end if;
    select a.subscription_id, a.proxima_cobranca into v_outra, v_outra_fim
      from public.orbis_hotmart_assinatura a
     where a.user_id = p_user and a.status_hotmart = 'ACTIVE'
       and a.subscription_id <> coalesce(v_sub, '') and a.subscription_id <> ''
       and a.proxima_cobranca > now()
       and not exists (select 1 from public.bancos_extra_compras b where b.chave = a.subscription_id)
     order by a.proxima_cobranca desc limit 1;
    if v_outra is not null then
      insert into public.subscriptions as x (user_id, provider, status, current_period_end, grace_until,
                                             hotmart_subscription_id, last_event_at)
      values (p_user, 'hotmart', 'active', v_outra_fim, v_outra_fim + interval '3 days', v_outra, now())
      on conflict (user_id) do update set
        status = 'active', current_period_end = excluded.current_period_end, grace_until = excluded.grace_until,
        hotmart_subscription_id = excluded.hotmart_subscription_id, last_event_at = now(), updated_at = now();
      update public.profiles set plan_status = 'active' where user_id = p_user;
      return 'trocou_para_outra';
    end if;
    insert into public.subscriptions as x (user_id, provider, status, grace_until, hotmart_purchase_id,
                                           hotmart_subscription_id, last_event_at)
    values (p_user, 'hotmart', 'canceled', now(), p_purchase, v_sub, now())
    on conflict (user_id) do update set
      status = 'canceled', grace_until = now(),
      hotmart_purchase_id = coalesce(excluded.hotmart_purchase_id, x.hotmart_purchase_id),
      hotmart_subscription_id = coalesce(excluded.hotmart_subscription_id, x.hotmart_subscription_id),
      last_event_at = now(), updated_at = now();
    update public.profiles set plan_status = 'expired' where user_id = p_user;
    return 'cancelada';
  end if;
  raise exception 'acao invalida';
end $$;

CREATE OR REPLACE FUNCTION public.expire_overdue_subscriptions()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  n int := 0;
begin
  with vencidas as (
    select s.user_id
    from public.subscriptions s
    join public.profiles p on p.user_id = s.user_id
    where s.status in ('active', 'past_due')
      and coalesce(s.grace_until, s.current_period_end, s.last_event_at + interval '33 days') < now()
      and coalesce(p.is_demo, false) = false          -- poupa contas demo
      and coalesce(p.billing_exempt, false) = false   -- poupa cortesias/isentos
  ),
  upd_sub as (
    update public.subscriptions s
    set status = 'expired', updated_at = now()
    where s.user_id in (select user_id from vencidas)
    returning s.user_id
  )
  update public.profiles p
  set plan_status = 'expired', is_trial_active = false
  from upd_sub u
  where p.user_id = u.user_id;

  get diagnostics n = row_count;
  return n;
end $function$;

create or replace function public.vant_pro_pleno(p_user uuid default null)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists (
    select 1 from public.orbis_pro
    where user_id = coalesce(p_user, auth.uid())
      and ativo and cancelado_em is null
      and (expira_em is null or expira_em > now())
  ) or public.cortesia_com_banco_pago(coalesce(p_user, auth.uid()));
$$;

create or replace function public.pro_anual(p_user uuid)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists (
    select 1 from public.orbis_pro
     where user_id = p_user and ativo and cancelado_em is null
       and (expira_em is null or expira_em > now())
       and (produto_id in ('ew11enu0', '6vkxbh8c', 't9xt3k4z')
            or (expira_em is not null and expira_em > now() + interval '180 days'))
  );
$$;

create or replace function public.open_finance_limite(p_user uuid default null)
returns jsonb language sql stable security definer set search_path to 'public' as $function$
  with u as (select coalesce(p_user, auth.uid()) as id),
  x as (select * from public.bancos_extra where user_id = (select id from u)),
  pro as (select produto_id from public.orbis_pro where user_id = (select id from u) and ativo and cancelado_em is null and (expira_em is null or expira_em > now())),
  pagos as (select count(*)::int n from public.bancos_extra_compras where user_id = (select id from u) and ativo and ate > now()),
  anual as (select public.pro_anual((select id from u)) as sim),
  base as (select case when (select sim from anual) then 2 when exists (select 1 from pro) then 1 else 0 end as n),
  ext as (select coalesce((select extras from x), 0) + (select n from pagos) as n),
  usados as (select count(*)::int n from public.bank_connections where user_id = (select id from u) and coalesce(status, '') <> 'deleted')
  select jsonb_build_object(
    'usados', (select n from usados),
    'isento', coalesce((select isento from x), false),
    'incluidos', (select n from base),
    'extras', (select n from ext),
    'limite', case when coalesce((select isento from x), false) then null else (select n from base) + (select n from ext) end,
    'pode_conectar', coalesce((select isento from x), false) or (select n from usados) < (select n from base) + (select n from ext),
    'liberado', public.orbis_pro_ativo((select id from u)),
    'plano', case when (select sim from anual) then 'pro_anual'
                  when public.vant_pro_pleno((select id from u)) then 'pro'
                  when (select n from pagos) > 0 then 'essencial_banco'
                  else 'essencial' end
  )
  where (select id from u) is not null and (p_user is null or p_user = auth.uid() or auth.role() = 'service_role');
$function$;

create or replace function public.orbis_pro_status()
returns table(pro boolean, origem text, desde timestamptz, ate timestamptz, bancos integer, verificado boolean)
language sql stable security definer set search_path to 'public' as $$
  select
    public.vant_pro_pleno(auth.uid()),
    case when public.cortesia_com_banco_pago(auth.uid())
           and not exists (select 1 from public.orbis_pro where user_id = auth.uid() and ativo and cancelado_em is null and (expira_em is null or expira_em > now()))
         then 'cortesia_banco'
         when not public.vant_pro_pleno(auth.uid()) and public.orbis_pro_ativo(auth.uid())
         then 'banco_avulso'
         when not public.vant_pro_pleno(auth.uid())
           and coalesce((select billing_exempt from public.profiles where user_id = auth.uid()), false)
           and not coalesce((select is_demo from public.profiles where user_id = auth.uid()), false)
         then 'cortesia'
         else (select origem from public.orbis_pro where user_id = auth.uid()) end,
    (select iniciado_em from public.orbis_pro where user_id = auth.uid()),
    coalesce((select expira_em from public.orbis_pro where user_id = auth.uid()),
             (select max(ate) from public.bancos_extra_compras where user_id = auth.uid() and ativo)),
    (select count(*)::int from public.bank_connections where user_id = auth.uid() and coalesce(status,'') <> 'deleted'),
    coalesce((select verificado from public.profiles where user_id = auth.uid()), false);
$$;

-- ---------------------------------------------------------------------------------- the Apple objects
do $$
begin
  if to_regclass('public.apple_assinaturas') is not null then
    update public.bancos_extra_compras set ativo = false, ate = now(), atualizado_em = now() where chave like 'apple:%' and ativo;
  end if;
end $$;
drop function if exists public.vant_direitos(uuid);
drop function if exists public.apple_evento_registrar(text, text, text, text, text, uuid, timestamptz, jsonb);
drop function if exists public.apple_expirar_vencidas();
drop function if exists public.apple_assinatura_gravar(uuid, text, text, text, timestamptz, timestamptz, text, timestamptz, boolean, timestamptz, text);
drop function if exists public.apple_acesso_recalcular(uuid);
drop function if exists public.vant_plano_pago_por_outro(uuid, text);
drop function if exists public.hotmart_plano_valido(uuid);
drop function if exists public.apple_pro_anual_valido(uuid);
drop function if exists public.apple_pro_valido(uuid);
drop function if exists public.apple_plano_valido(uuid);
drop function if exists public.apple_vale(public.apple_assinaturas);
drop function if exists public.apple_produto(text);
drop table if exists public.apple_acesso;
drop table if exists public.apple_contas_de_teste;
drop table if exists public.apple_eventos;
drop table if exists public.apple_assinaturas;

commit;
