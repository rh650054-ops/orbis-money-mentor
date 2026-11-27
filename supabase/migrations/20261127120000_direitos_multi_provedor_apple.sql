-- 27/11/2026 (Rick): native Apple subscriptions on the iPhone, next to Hotmart (site and Android).
-- DRAFT of Etapa 2. NOT applied to production: it is applied only with Rick's authorisation, after
-- the cases in supabase/tests/casos/4x_direitos_*.sql are green. Rollback: supabase/direitos-apple/rollback.sql.
--
-- THE RULE: an account's access is the sum of what each origin guarantees right now (hotmart, apple,
-- cortesia). An event of one provider updates only that provider's own record; it can take the
-- account's access away only when no other paying provider still holds a valid right.
--
-- What changes for the accounts that exist today (all of them Hotmart, courtesy or free test):
-- NOTHING. Every guard added below asks "does Apple hold a valid plan for this account?", and the
-- answer is "no" while the Apple mirror is empty. casos/41 runs the same assertions as casos/40
-- (production as it is) on top of this migration and must give the same result.
--
-- New (all closed to the app: RLS on, no policy, no grant to anon/authenticated):
--   apple_assinaturas      mirror, one row per Apple original transaction (the subscription's identity)
--   apple_eventos          every App Store Server Notification, once (notificationUUID)
--   apple_contas_de_teste  the only accounts for which a Sandbox purchase gives access
--   apple_acesso           what Apple currently holds per account, so Apple only undoes what Apple did
-- Changed (one guard or one "or" each; bodies otherwise identical to production on 27/11/2026):
--   hotmart_acesso_aplicar, expire_overdue_subscriptions   the two places that block an account
--   vant_pro_pleno, pro_anual, open_finance_limite, orbis_pro_status   the readers of the Pro
-- NOT changed, on purpose: pro_revogar and pro_conceder. Pro bought through Apple never enters
-- orbis_pro, so a Hotmart revocation cannot reach it.
-- Extra bank through Apple: one slot per Apple subscription, written to bancos_extra_compras under
-- the key 'apple:<original transaction>', next to the Hotmart slots, which are never touched.

-- ---------------------------------------------------------------------------------- tables
create table if not exists public.apple_assinaturas (
  original_transaction_id text primary key check (original_transaction_id ~ '^[0-9A-Za-z._-]{1,64}$'),
  user_id uuid not null references auth.users (id) on delete cascade,
  produto text not null,
  direito text not null check (direito in ('plano', 'banco')),
  nivel text check (nivel in ('essencial', 'pro')),
  anual boolean not null default false,
  ambiente text not null check (ambiente in ('Production', 'Sandbox')),
  status text not null,
  expira_em timestamptz not null,
  tolerancia_ate timestamptz,
  renova boolean,
  revogada_em timestamptz,
  assinado_em timestamptz not null,
  transaction_id text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint apple_assinaturas_nivel_so_no_plano check ((direito = 'plano') = (nivel is not null))
);
create index if not exists apple_assinaturas_user_idx on public.apple_assinaturas (user_id);

create table if not exists public.apple_eventos (
  notification_uuid text primary key,
  tipo text not null,
  subtipo text,
  ambiente text not null check (ambiente in ('Production', 'Sandbox')),
  original_transaction_id text,
  user_id uuid references auth.users (id) on delete set null,
  assinado_em timestamptz,
  recebido_em timestamptz not null default now(),
  resultado text,
  payload jsonb not null
);
create index if not exists apple_eventos_original_idx on public.apple_eventos (original_transaction_id, recebido_em desc);

create table if not exists public.apple_contas_de_teste (
  user_id uuid primary key references auth.users (id) on delete cascade,
  motivo text not null check (length(btrim(motivo)) >= 5),
  criado_em timestamptz not null default now()
);

create table if not exists public.apple_acesso (
  user_id uuid primary key references auth.users (id) on delete cascade,
  segura_plano boolean not null default false,
  atualizado_em timestamptz not null default now()
);

alter table public.apple_assinaturas enable row level security;
alter table public.apple_eventos enable row level security;
alter table public.apple_contas_de_teste enable row level security;
alter table public.apple_acesso enable row level security;
revoke all on public.apple_assinaturas, public.apple_eventos, public.apple_contas_de_teste, public.apple_acesso from public, anon, authenticated;
grant select, insert, update, delete on public.apple_assinaturas, public.apple_eventos, public.apple_contas_de_teste, public.apple_acesso to service_role;

-- ---------------------------------------------------------------------------------- the catalogue
-- The right a product gives is decided HERE, from the product identifier signed by Apple. Nothing
-- the app sends can choose it.
create or replace function public.apple_produto(p_produto text)
returns table (direito text, nivel text, anual boolean)
language sql immutable set search_path to 'public' as $$
  select c.direito, c.nivel, c.anual
    from (values ('app.vant.vendas.essencial.mensal', 'plano', 'essencial', false),
                 ('app.vant.vendas.pro.mensal',       'plano', 'pro',       false),
                 ('app.vant.vendas.pro.anual',        'plano', 'pro',       true),
                 ('app.vant.vendas.banco.mensal',     'banco', null,        false)) as c (produto, direito, nivel, anual)
   where c.produto = p_produto;
$$;

-- ---------------------------------------------------------------------------------- is a right valid now?
-- A mirror row gives a right while it is not revoked and its period (or Apple's billing grace) has
-- not ended. A Sandbox row gives a right ONLY to an account in apple_contas_de_teste.
create or replace function public.apple_vale(a public.apple_assinaturas)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select a.revogada_em is null
     and greatest(a.expira_em, coalesce(a.tolerancia_ate, a.expira_em)) > now()
     and (a.ambiente = 'Production'
          or exists (select 1 from public.apple_contas_de_teste t where t.user_id = a.user_id));
$$;

create or replace function public.apple_plano_valido(p_user uuid)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists (select 1 from public.apple_assinaturas a where a.user_id = p_user and a.direito = 'plano' and public.apple_vale(a));
$$;

create or replace function public.apple_pro_valido(p_user uuid)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists (select 1 from public.apple_assinaturas a
                  where a.user_id = p_user and a.direito = 'plano' and a.nivel = 'pro' and public.apple_vale(a));
$$;

create or replace function public.apple_pro_anual_valido(p_user uuid)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists (select 1 from public.apple_assinaturas a
                  where a.user_id = p_user and a.direito = 'plano' and a.nivel = 'pro' and a.anual and public.apple_vale(a));
$$;

-- The Hotmart plan as expire_overdue_subscriptions sees it: a paid row that is not overdue yet.
create or replace function public.hotmart_plano_valido(p_user uuid)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists (select 1 from public.subscriptions s
                  where s.user_id = p_user and s.status in ('active', 'past_due')
                    and coalesce(s.grace_until, s.current_period_end, s.last_event_at + interval '33 days') >= now());
$$;

-- THE GUARD both providers ask before blocking an account: does ANOTHER paying provider still hold
-- a valid plan? Courtesy is not a provider here: it never depended on plan_status.
create or replace function public.vant_plano_pago_por_outro(p_user uuid, p_origem text)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select case p_origem
           when 'hotmart' then public.apple_plano_valido(p_user)
           when 'apple'   then public.hotmart_plano_valido(p_user)
           else public.apple_plano_valido(p_user) or public.hotmart_plano_valido(p_user) end;
$$;

-- Every valid right of an account and where it comes from (support, admin, audit).
create or replace function public.vant_direitos(p_user uuid)
returns table (direito text, origem text, valido_ate timestamptz, referencia text, ambiente text)
language sql stable security definer set search_path to 'public' as $$
  with pode as (select auth.role() = 'service_role' or p_user = auth.uid() or public.is_orbis_admin() as sim)
  select x.* from (
    select 'plano'::text, 'hotmart'::text, coalesce(s.grace_until, s.current_period_end), s.hotmart_subscription_id, null::text
      from public.subscriptions s where s.user_id = p_user and public.hotmart_plano_valido(p_user)
    union all
    select 'plano', 'apple', greatest(a.expira_em, coalesce(a.tolerancia_ate, a.expira_em)), a.original_transaction_id, a.ambiente
      from public.apple_assinaturas a where a.user_id = p_user and a.direito = 'plano' and public.apple_vale(a)
    union all
    select 'plano', 'cortesia', null, null, null
      from public.profiles p where p.user_id = p_user and (coalesce(p.billing_exempt, false) or coalesce(p.is_demo, false))
    union all
    select 'pro', o.origem, o.expira_em, o.assinante_codigo, null
      from public.orbis_pro o where o.user_id = p_user and o.ativo and o.cancelado_em is null and (o.expira_em is null or o.expira_em > now())
    union all
    select 'pro', 'apple', greatest(a.expira_em, coalesce(a.tolerancia_ate, a.expira_em)), a.original_transaction_id, a.ambiente
      from public.apple_assinaturas a where a.user_id = p_user and a.direito = 'plano' and a.nivel = 'pro' and public.apple_vale(a)
    union all
    select 'banco', case when b.chave like 'apple:%' then 'apple' else 'hotmart' end, b.ate, b.chave, null
      from public.bancos_extra_compras b where b.user_id = p_user and b.ativo and b.ate > now()
  ) as x (direito, origem, valido_ate, referencia, ambiente)
  where (select sim from pode);
$$;

-- ---------------------------------------------------------------------------------- Apple writes
-- What Apple holds for the account is recomputed from the mirror. Apple turns the plan on when it
-- holds a valid one, and blocks the account only if Apple was the one holding it AND no other paying
-- provider holds a valid plan. It never touches a Hotmart row.
create or replace function public.apple_acesso_recalcular(p_user uuid)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare
  r record;
  v_vale boolean;
  v_segurava boolean;
  v_bancos integer := 0;
begin
  if p_user is null then raise exception 'conta obrigatoria'; end if;

  -- extra bank: one slot per Apple add-on subscription, under its own key
  for r in select a.original_transaction_id, public.apple_vale(a) as vale,
                  greatest(a.expira_em, coalesce(a.tolerancia_ate, a.expira_em)) as fim
             from public.apple_assinaturas a where a.user_id = p_user and a.direito = 'banco'
  loop
    if r.vale then
      insert into public.bancos_extra_compras (chave, user_id, ativo, ate, atualizado_em)
      values ('apple:' || r.original_transaction_id, p_user, true, r.fim, now())
      on conflict (chave) do update set user_id = excluded.user_id, ativo = true, ate = excluded.ate, atualizado_em = now();
      v_bancos := v_bancos + 1;
    else
      update public.bancos_extra_compras set ativo = false, ate = now(), atualizado_em = now()
       where chave = 'apple:' || r.original_transaction_id and ativo;
    end if;
  end loop;

  -- plan
  v_vale := public.apple_plano_valido(p_user);
  select x.segura_plano into v_segurava from public.apple_acesso x where x.user_id = p_user for update;
  if v_vale then
    update public.profiles set plan_status = 'active', is_trial_active = false where user_id = p_user;
  elsif coalesce(v_segurava, false) and not public.vant_plano_pago_por_outro(p_user, 'apple') then
    update public.profiles set plan_status = 'expired' where user_id = p_user;
  end if;
  insert into public.apple_acesso (user_id, segura_plano, atualizado_em) values (p_user, v_vale, now())
  on conflict (user_id) do update set segura_plano = excluded.segura_plano, atualizado_em = now();

  return jsonb_build_object('plano', v_vale, 'pro', public.apple_pro_valido(p_user), 'bancos', v_bancos);
end $$;

-- The only door that writes the mirror. Called by the server after it has verified Apple's signature.
--   gravada                 stored, access recomputed
--   sem_dono                no account known for this subscription yet (kept out; the event is still logged)
--   pertence_a_outra_conta  the subscription already belongs to another VANT account: nothing changes
--   ambiente_diferente      a Sandbox status never overwrites a Production subscription (or the reverse)
--   grupo_diferente         a subscription never moves between the plan group and the bank group
--   antigo_ignorado         Apple signed this status BEFORE the one already stored (out of order)
create or replace function public.apple_assinatura_gravar(
  p_user uuid, p_original text, p_produto text, p_ambiente text, p_expira timestamptz, p_assinado timestamptz,
  p_status text default 'ativa', p_tolerancia timestamptz default null, p_renova boolean default null,
  p_revogada timestamptz default null, p_transacao text default null)
returns text language plpgsql security definer set search_path to 'public' as $$
declare
  a public.apple_assinaturas;
  c record;
  v_user uuid;
begin
  if coalesce(p_original, '') = '' or p_produto is null or p_expira is null or p_assinado is null then
    raise exception 'dados incompletos';
  end if;
  if p_ambiente is null or p_ambiente not in ('Production', 'Sandbox') then raise exception 'ambiente invalido'; end if;
  select * into c from public.apple_produto(p_produto);
  if not found then raise exception 'produto desconhecido: %', p_produto; end if;

  select * into a from public.apple_assinaturas where original_transaction_id = p_original for update;
  if a.original_transaction_id is null then
    if p_user is null then return 'sem_dono'; end if;
    insert into public.apple_assinaturas (original_transaction_id, user_id, produto, direito, nivel, anual, ambiente, status,
                                          expira_em, tolerancia_ate, renova, revogada_em, assinado_em, transaction_id)
    values (p_original, p_user, p_produto, c.direito, c.nivel, c.anual, p_ambiente, coalesce(p_status, 'ativa'),
            p_expira, p_tolerancia, p_renova, p_revogada, p_assinado, p_transacao);
    v_user := p_user;
  else
    if p_user is not null and p_user <> a.user_id then return 'pertence_a_outra_conta'; end if;
    if p_ambiente <> a.ambiente then return 'ambiente_diferente'; end if;
    if c.direito <> a.direito then return 'grupo_diferente'; end if;
    if p_assinado < a.assinado_em then return 'antigo_ignorado'; end if;
    update public.apple_assinaturas
       set produto = p_produto, nivel = c.nivel, anual = c.anual, status = coalesce(p_status, 'ativa'),
           expira_em = p_expira, tolerancia_ate = p_tolerancia, renova = p_renova, revogada_em = p_revogada,
           assinado_em = p_assinado, transaction_id = coalesce(p_transacao, transaction_id), atualizado_em = now()
     where original_transaction_id = p_original;
    v_user := a.user_id;
  end if;

  perform public.apple_acesso_recalcular(v_user);
  return 'gravada';
end $$;

-- Hourly (scheduled only when this goes to production): an Apple plan whose period ended without a
-- notification stops holding the account.
create or replace function public.apple_expirar_vencidas()
returns integer language plpgsql security definer set search_path to 'public' as $$
declare r record; n integer := 0;
begin
  for r in select x.user_id from public.apple_acesso x where x.segura_plano and not public.apple_plano_valido(x.user_id) loop
    perform public.apple_acesso_recalcular(r.user_id);
    n := n + 1;
  end loop;
  return n;
end $$;

-- One notification is processed once. true = first time; false = Apple sent it again.
create or replace function public.apple_evento_registrar(
  p_uuid text, p_tipo text, p_subtipo text, p_ambiente text, p_original text, p_user uuid, p_assinado timestamptz, p_payload jsonb)
returns boolean language plpgsql security definer set search_path to 'public' as $$
declare v_n integer;
begin
  if coalesce(p_uuid, '') = '' or coalesce(p_tipo, '') = '' or p_payload is null then raise exception 'evento incompleto'; end if;
  insert into public.apple_eventos (notification_uuid, tipo, subtipo, ambiente, original_transaction_id, user_id, assinado_em, payload)
  values (p_uuid, p_tipo, p_subtipo, p_ambiente, p_original, p_user, p_assinado, p_payload)
  on conflict (notification_uuid) do nothing;
  get diagnostics v_n = row_count;
  return v_n > 0;
end $$;

revoke all on function public.apple_vale(public.apple_assinaturas), public.apple_plano_valido(uuid), public.apple_pro_valido(uuid),
  public.apple_pro_anual_valido(uuid), public.hotmart_plano_valido(uuid), public.vant_plano_pago_por_outro(uuid, text),
  public.apple_acesso_recalcular(uuid),
  public.apple_assinatura_gravar(uuid, text, text, text, timestamptz, timestamptz, text, timestamptz, boolean, timestamptz, text),
  public.apple_expirar_vencidas(), public.apple_evento_registrar(text, text, text, text, text, uuid, timestamptz, jsonb),
  public.apple_produto(text)
  from public, anon, authenticated;
grant execute on function public.apple_vale(public.apple_assinaturas), public.apple_plano_valido(uuid), public.apple_pro_valido(uuid),
  public.apple_pro_anual_valido(uuid), public.hotmart_plano_valido(uuid), public.vant_plano_pago_por_outro(uuid, text),
  public.apple_acesso_recalcular(uuid),
  public.apple_assinatura_gravar(uuid, text, text, text, timestamptz, timestamptz, text, timestamptz, boolean, timestamptz, text),
  public.apple_expirar_vencidas(), public.apple_evento_registrar(text, text, text, text, text, uuid, timestamptz, jsonb),
  public.apple_produto(text)
  to service_role;
revoke all on function public.vant_direitos(uuid) from public, anon;
grant execute on function public.vant_direitos(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------------- the guards
-- Bodies below are production's of 27/11/2026 with ONE change each, marked "27/11".

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
    -- 27/11: a Hotmart cancellation ends the HOTMART right only. The account keeps its access while
    -- another paying provider still holds a valid plan (public.vant_plano_pago_por_outro).
    update public.profiles set plan_status = 'expired'
     where user_id = p_user and not public.vant_plano_pago_por_outro(p_user, 'hotmart');
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
  where p.user_id = u.user_id
    -- 27/11: the overdue HOTMART row is closed above either way; the account is blocked only when no
    -- other paying provider holds a valid plan
    and not public.vant_plano_pago_por_outro(p.user_id, 'hotmart');

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
  ) or public.cortesia_com_banco_pago(coalesce(p_user, auth.uid()))
    -- 27/11: Pro bought through Apple lives in its own mirror; pro_revogar never reaches it
    or public.apple_pro_valido(coalesce(p_user, auth.uid()));
$$;

create or replace function public.pro_anual(p_user uuid)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists (
    select 1 from public.orbis_pro
     where user_id = p_user and ativo and cancelado_em is null
       and (expira_em is null or expira_em > now())
       and (produto_id in ('ew11enu0', '6vkxbh8c', 't9xt3k4z')
            or (expira_em is not null and expira_em > now() + interval '180 days'))
  ) or public.apple_pro_anual_valido(p_user);  -- 27/11: the annual product bought through Apple
$$;

create or replace function public.open_finance_limite(p_user uuid default null)
returns jsonb language sql stable security definer set search_path to 'public' as $function$
  with u as (select coalesce(p_user, auth.uid()) as id),
  x as (select * from public.bancos_extra where user_id = (select id from u)),
  pro as (select produto_id from public.orbis_pro where user_id = (select id from u) and ativo and cancelado_em is null and (expira_em is null or expira_em > now())),
  pagos as (select count(*)::int n from public.bancos_extra_compras where user_id = (select id from u) and ativo and ate > now()),
  anual as (select public.pro_anual((select id from u)) as sim),
  base as (select case when (select sim from anual) then 2 when exists (select 1 from pro) or public.apple_pro_valido((select id from u)) then 1 else 0 end as n),  -- 27/11: Pro through Apple includes one bank too
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
         -- 27/11: Pro held only by an Apple subscription
         when public.apple_pro_valido(auth.uid())
           and not exists (select 1 from public.orbis_pro where user_id = auth.uid() and ativo and cancelado_em is null and (expira_em is null or expira_em > now()))
         then 'apple'
         else (select origem from public.orbis_pro where user_id = auth.uid()) end,
    coalesce((select iniciado_em from public.orbis_pro where user_id = auth.uid()),
             (select min(criado_em) from public.apple_assinaturas where user_id = auth.uid() and direito = 'plano' and nivel = 'pro')),
    coalesce((select expira_em from public.orbis_pro where user_id = auth.uid()),
             (select max(ate) from public.bancos_extra_compras where user_id = auth.uid() and ativo),
             (select max(expira_em) from public.apple_assinaturas where user_id = auth.uid() and direito = 'plano' and nivel = 'pro')),
    (select count(*)::int from public.bank_connections where user_id = auth.uid() and coalesce(status,'') <> 'deleted'),
    coalesce((select verificado from public.profiles where user_id = auth.uid()), false);
$$;
