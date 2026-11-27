-- 27/11/2026 (Rick): the risks recorded in PR #373, fixed. DRAFT of Etapa 2. NOT applied to production:
-- only with Rick's authorisation. Needs 20261127120000_direitos_multi_provedor_apple (applied together).
-- Rollback: supabase/direitos-apple/rollback.sql. Tests: supabase/tests/casos/44..46.
--
--   1. An administrative suspension is a record of its own. No provider (Apple or Hotmart), no
--      renewal, no reconciliation turns a suspended account back on: only an admin lifts it.
--   2. A Pro revocation that comes from Hotmart no longer removes an independent courtesy.
--   3. The extra bank never gives access to the main plan: while the account has no valid main plan
--      (and no Pro), a paid extra bank is kept but gives nothing.
--   4. More than one valid subscription: the benefits are the highest of them, never the sum of the
--      included banks nor of the periods (already true; asserted in casos/46).
--
-- What changes for the accounts that exist today:
--   - nobody is suspended, so rule 1 changes nothing until an admin uses it;
--   - the 4 courtesy Pros are marked as courtesies (same access as today);
--   - 1 account has a paid extra bank and a blocked main plan: its plan name goes from
--     "essencial_banco" to "sem_plano" (it is already behind the paywall in the app).

-- ---------------------------------------------------------------------------------- 1. suspension
create table if not exists public.acesso_suspenso (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  motivo text not null check (length(btrim(motivo)) >= 5),
  suspenso_por uuid,
  suspenso_em timestamptz not null default now(),
  liberado_por uuid,
  liberado_em timestamptz,
  liberado_motivo text
);
-- one suspension in force per account; the lifted ones stay as history
create unique index if not exists acesso_suspenso_vigente on public.acesso_suspenso (user_id) where liberado_em is null;
alter table public.acesso_suspenso enable row level security;
revoke all on public.acesso_suspenso from public, anon, authenticated;
grant select, insert, update, delete on public.acesso_suspenso to service_role;

create or replace function public.conta_suspensa(p_user uuid)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists (select 1 from public.acesso_suspenso s where s.user_id = p_user and s.liberado_em is null);
$$;

-- THE ROOT of rule 1: every writer of the plan passes through this row (Hotmart webhook and
-- reconciliation, Apple, free test, admin tools, anything written later). While the account is
-- suspended the plan cannot be turned on, whoever tries.
create or replace function public.profiles_respeita_suspensao()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  if public.conta_suspensa(new.user_id) then
    new.plan_status := 'expired';
    new.is_trial_active := false;
  end if;
  return new;
end $$;
drop trigger if exists zz_profiles_respeita_suspensao on public.profiles;
-- "zz": after every other BEFORE trigger of the table, so nothing rewrites the plan after it
create trigger zz_profiles_respeita_suspensao
  before insert or update on public.profiles
  for each row when (new.plan_status in ('active', 'trial') or coalesce(new.is_trial_active, false))
  execute function public.profiles_respeita_suspensao();

-- The main plan as the app's gate sees it (courtesy, paid, or free test still running).
create or replace function public.vant_plano_principal_valido(p_user uuid)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select not public.conta_suspensa(p_user) and exists (
    select 1 from public.profiles p
     where p.user_id = p_user
       and (coalesce(p.billing_exempt, false) or coalesce(p.is_demo, false) or p.plan_status = 'active'
            or (coalesce(p.is_trial_active, false) and p.trial_end >= (now() at time zone 'America/Sao_Paulo')::date)));
$$;

-- Puts the plan back from the rights that are valid NOW (used when a suspension is lifted).
create or replace function public.vant_acesso_recalcular(p_user uuid)
returns text language plpgsql security definer set search_path to 'public' as $$
begin
  if public.conta_suspensa(p_user) then return 'suspensa'; end if;
  if public.hotmart_plano_valido(p_user) or public.apple_plano_valido(p_user) then
    update public.profiles set plan_status = 'active', is_trial_active = false where user_id = p_user;
    return 'active';
  end if;
  update public.profiles set plan_status = 'trial', is_trial_active = true
   where user_id = p_user and plan_status is distinct from 'active'
     and trial_end >= (now() at time zone 'America/Sao_Paulo')::date;
  if found then return 'trial'; end if;
  return 'sem_direito';
end $$;

create or replace function public.admin_suspender_acesso(p_user uuid, p_motivo text)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare v_motivo text := btrim(coalesce(p_motivo, '')); v_n integer;
begin
  if not public.is_orbis_admin() then raise exception 'apenas admin'; end if;
  if length(v_motivo) < 5 then raise exception 'Escreva o motivo (pelo menos 5 letras).'; end if;
  if not exists (select 1 from public.profiles where user_id = p_user) then raise exception 'perfil não encontrado'; end if;
  if exists (select 1 from public.profiles where user_id = p_user and (coalesce(billing_exempt, false) or coalesce(is_demo, false))) then
    raise exception 'Conta de cortesia ou de demonstração: retire a cortesia em vez de suspender.';
  end if;
  insert into public.acesso_suspenso (user_id, motivo, suspenso_por) values (p_user, v_motivo, auth.uid())
  on conflict (user_id) where liberado_em is null do nothing;
  get diagnostics v_n = row_count;
  -- the trigger above keeps it expired from now on; this write is what blocks it today
  update public.profiles set plan_status = 'expired', is_trial_active = false where user_id = p_user;
  return jsonb_build_object('ok', true, 'suspensa', true, 'ja_estava', v_n = 0);
end $$;

create or replace function public.admin_liberar_acesso(p_user uuid, p_motivo text)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare v_motivo text := btrim(coalesce(p_motivo, '')); v_n integer;
begin
  if not public.is_orbis_admin() then raise exception 'apenas admin'; end if;
  if length(v_motivo) < 5 then raise exception 'Escreva o motivo (pelo menos 5 letras).'; end if;
  update public.acesso_suspenso set liberado_em = now(), liberado_por = auth.uid(), liberado_motivo = v_motivo
   where user_id = p_user and liberado_em is null;
  get diagnostics v_n = row_count;
  return jsonb_build_object('ok', true, 'estava_suspensa', v_n > 0, 'acesso', public.vant_acesso_recalcular(p_user));
end $$;

revoke all on function public.conta_suspensa(uuid), public.vant_plano_principal_valido(uuid), public.vant_acesso_recalcular(uuid),
  public.profiles_respeita_suspensao() from public, anon, authenticated;
grant execute on function public.conta_suspensa(uuid), public.vant_plano_principal_valido(uuid), public.vant_acesso_recalcular(uuid) to service_role;
revoke all on function public.admin_suspender_acesso(uuid, text), public.admin_liberar_acesso(uuid, text) from public, anon;
grant execute on function public.admin_suspender_acesso(uuid, text), public.admin_liberar_acesso(uuid, text) to authenticated, service_role;

-- The button the admin panel already has. Body = production's of 27/11/2026 plus the two marked
-- blocks: deactivating an account that a provider is paying for now SUSPENDS it (before, the next
-- Hotmart charge or the next Apple event silently undid the deactivation); activating lifts it.
-- An account nobody is paying for behaves exactly as before.
CREATE OR REPLACE FUNCTION public.admin_assinatura_manual(p_user uuid, p_ativar boolean, p_motivo text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_motivo text := btrim(coalesce(p_motivo, '')); v_suspensa boolean := false;
begin
  if not public.is_orbis_admin() then raise exception 'apenas admin'; end if;
  if length(v_motivo) < 5 then raise exception 'Escreva o motivo (pelo menos 5 letras).'; end if;
  if not exists (select 1 from public.profiles where user_id = p_user) then raise exception 'perfil não encontrado'; end if;
  -- 27/11: a deactivation that a provider would undo becomes a suspension
  if not p_ativar and (public.hotmart_plano_valido(p_user) or public.apple_plano_valido(p_user))
     and not exists (select 1 from public.profiles where user_id = p_user and (coalesce(billing_exempt, false) or coalesce(is_demo, false))) then
    insert into public.acesso_suspenso (user_id, motivo, suspenso_por) values (p_user, v_motivo, auth.uid())
    on conflict (user_id) where liberado_em is null do nothing;
  end if;
  -- 27/11: activating by hand lifts a suspension in force
  if p_ativar then
    update public.acesso_suspenso set liberado_em = now(), liberado_por = auth.uid(), liberado_motivo = v_motivo
     where user_id = p_user and liberado_em is null;
  end if;
  v_suspensa := public.conta_suspensa(p_user);
  update public.profiles
     set plan_status = case when p_ativar then 'active' else 'expired' end,
         plan_type   = case when p_ativar then 'pro' else 'expired' end,
         is_trial_active = false
   where user_id = p_user;
  insert into public.assinatura_manual (user_id, feito_por, acao, motivo)
  values (p_user, auth.uid(), case when p_ativar then 'ativar' else 'desativar' end, v_motivo);
  return jsonb_build_object('ok', true, 'plan_status', case when p_ativar then 'active' else 'expired' end, 'suspensa', v_suspensa);
end $function$;

-- ---------------------------------------------------------------------------------- 2. courtesy Pro
-- orbis_pro keeps one row per account, so a Hotmart Pro bought on top of a courtesy overwrote it and
-- a Hotmart revocation turned everything off. The courtesy is now remembered on its own.
alter table public.orbis_pro add column if not exists cortesia boolean not null default false,
  add column if not exists cortesia_ate timestamptz;
update public.orbis_pro set cortesia = true, cortesia_ate = expira_em
 where origem = 'cortesia' and ativo and cancelado_em is null and not cortesia;

-- Body = production's plus the courtesy mark. A Hotmart grant never touches the mark.
CREATE OR REPLACE FUNCTION public.pro_conceder(p_user uuid, p_origem text DEFAULT 'hotmart'::text, p_codigo text DEFAULT NULL::text, p_produto text DEFAULT NULL::text, p_ate timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_cortesia boolean := coalesce(p_origem, 'hotmart') = 'cortesia';
begin
  if auth.jwt() ->> 'role' is distinct from 'service_role' then
    raise exception 'so o servidor libera o Pro';
  end if;
  insert into public.orbis_pro (user_id, ativo, origem, assinante_codigo, produto_id, expira_em, cancelado_em, atualizado_em, cortesia, cortesia_ate)
  values (p_user, true, coalesce(p_origem,'hotmart'), p_codigo, p_produto, p_ate, null, now(), v_cortesia, case when v_cortesia then p_ate end)
  on conflict (user_id) do update set
    ativo = true, origem = excluded.origem,
    assinante_codigo = coalesce(excluded.assinante_codigo, public.orbis_pro.assinante_codigo),
    produto_id = coalesce(excluded.produto_id, public.orbis_pro.produto_id),
    expira_em = excluded.expira_em, cancelado_em = null, atualizado_em = now(),
    -- 27/11: a courtesy is set only by a courtesy grant and survives a Hotmart one
    cortesia = public.orbis_pro.cortesia or excluded.cortesia,
    cortesia_ate = case when excluded.cortesia then excluded.cortesia_ate else public.orbis_pro.cortesia_ate end;
  return true;
end;
$function$;

-- pro_revogar is NOT changed: it still closes the row (what Hotmart paid for). What changed is
-- that the readers below also accept the courtesy mark, which pro_revogar does not touch.
-- Taking a courtesy away is now its own, explicit action.
create or replace function public.pro_cortesia_revogar(p_user uuid)
returns boolean language plpgsql security definer set search_path to 'public' as $$
begin
  if auth.jwt() ->> 'role' is distinct from 'service_role' and not public.is_orbis_admin() then
    raise exception 'so o servidor ou um admin mexe na cortesia';
  end if;
  update public.orbis_pro
     set cortesia = false, cortesia_ate = null, atualizado_em = now(),
         ativo = case when origem = 'cortesia' then false else ativo end,
         cancelado_em = case when origem = 'cortesia' then now() else cancelado_em end
   where user_id = p_user;
  return true;
end $$;
revoke all on function public.pro_cortesia_revogar(uuid) from public, anon;
grant execute on function public.pro_cortesia_revogar(uuid) to authenticated, service_role;

-- A valid Pro in orbis_pro: what a provider paid for (the row is on and inside its period) OR a
-- courtesy in force.
create or replace function public.orbis_pro_vale(o public.orbis_pro)
returns boolean language sql stable set search_path to 'public' as $$
  select (o.ativo and o.cancelado_em is null and (o.expira_em is null or o.expira_em > now()))
      or (o.cortesia and (o.cortesia_ate is null or o.cortesia_ate > now()));
$$;
revoke all on function public.orbis_pro_vale(public.orbis_pro) from public, anon, authenticated;
grant execute on function public.orbis_pro_vale(public.orbis_pro) to service_role;

-- ---------------------------------------------------------------------------------- the readers
-- Each body is the one of 20261127120000 (production + the Apple "or") with the changes marked 27/11b.

create or replace function public.vant_pro_pleno(p_user uuid default null)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select not public.conta_suspensa(coalesce(p_user, auth.uid()))  -- 27/11b: a suspended account has no Pro
     and (exists (
    select 1 from public.orbis_pro o
    where o.user_id = coalesce(p_user, auth.uid())
      and public.orbis_pro_vale(o)                                -- 27/11b: the row on, or a courtesy in force
  ) or public.cortesia_com_banco_pago(coalesce(p_user, auth.uid()))
    or public.apple_pro_valido(coalesce(p_user, auth.uid())));
$$;

create or replace function public.pro_anual(p_user uuid)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select not public.conta_suspensa(p_user)                        -- 27/11b
     and (exists (
    select 1 from public.orbis_pro
     where user_id = p_user and ativo and cancelado_em is null
       and (expira_em is null or expira_em > now())
       and (produto_id in ('ew11enu0', '6vkxbh8c', 't9xt3k4z')
            or (expira_em is not null and expira_em > now() + interval '180 days'))
  ) or public.apple_pro_anual_valido(p_user));
$$;

-- 27/11b: the extra bank alone opens the bank features only while the account has a valid main
-- plan. vant_plano ("essencial_banco"), vant_recursos_pro and the bank readers all ask this function.
create or replace function public.orbis_pro_ativo(p_user uuid default null)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select public.vant_pro_pleno(coalesce(p_user, auth.uid()))
      or (exists (select 1 from public.bancos_extra_compras
                   where user_id = coalesce(p_user, auth.uid()) and ativo and ate > now())
          and public.vant_plano_principal_valido(coalesce(p_user, auth.uid())));
$$;

create or replace function public.vant_plano(p_user uuid default null)
returns text language sql stable security definer set search_path to 'public' as $$
  with u as (select coalesce(p_user, auth.uid()) as id),
  p as (select * from public.profiles where user_id = (select id from u))
  select case
    when (select id from u) is null then 'sem_plano'
    when public.conta_suspensa((select id from u)) then 'sem_plano'  -- 27/11b
    when coalesce((select billing_exempt from p), false) or coalesce((select is_demo from p), false) then 'equipe'
    when public.pro_anual((select id from u)) then 'pro_anual'
    when public.vant_pro_pleno((select id from u)) then 'pro'
    when public.orbis_pro_ativo((select id from u)) then 'essencial_banco'
    when (select plan_status from p) = 'active' then 'essencial'
    when coalesce((select is_trial_active from p), false)
         and (select trial_end from p) >= (now() at time zone 'America/Sao_Paulo')::date then 'teste'
    else 'sem_plano' end;
$$;

create or replace function public.open_finance_limite(p_user uuid default null)
returns jsonb language sql stable security definer set search_path to 'public' as $function$
  with u as (select coalesce(p_user, auth.uid()) as id),
  x as (select * from public.bancos_extra where user_id = (select id from u)),
  pro as (select o.produto_id from public.orbis_pro o where o.user_id = (select id from u) and public.orbis_pro_vale(o) and not public.conta_suspensa((select id from u))),  -- 27/11b
  pagos as (select count(*)::int n from public.bancos_extra_compras where user_id = (select id from u) and ativo and ate > now()
                                                                      and public.orbis_pro_ativo((select id from u))),  -- 27/11b: a paid slot counts while the account can use it
  anual as (select public.pro_anual((select id from u)) as sim),
  base as (select case when (select sim from anual) then 2 when exists (select 1 from pro) or (public.apple_pro_valido((select id from u)) and not public.conta_suspensa((select id from u))) then 1 else 0 end as n),
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
         -- 27/11b: "Minha Conta" keeps showing a paid extra bank as such even while it gives nothing
         -- (no valid main plan), so the person can see what they are paying for
         when not public.vant_pro_pleno(auth.uid())
           and exists (select 1 from public.bancos_extra_compras where user_id = auth.uid() and ativo and ate > now())
         then 'banco_avulso'
         when not public.vant_pro_pleno(auth.uid())
           and coalesce((select billing_exempt from public.profiles where user_id = auth.uid()), false)
           and not coalesce((select is_demo from public.profiles where user_id = auth.uid()), false)
         then 'cortesia'
         when public.apple_pro_valido(auth.uid())
           and not exists (select 1 from public.orbis_pro where user_id = auth.uid() and ativo and cancelado_em is null and (expira_em is null or expira_em > now()))
         then 'apple'
         -- 27/11b: the Pro is held only by the courtesy mark (the paid row is closed or over)
         when exists (select 1 from public.orbis_pro where user_id = auth.uid() and cortesia and (cortesia_ate is null or cortesia_ate > now()))
           and not exists (select 1 from public.orbis_pro where user_id = auth.uid() and ativo and cancelado_em is null and (expira_em is null or expira_em > now()))
         then 'cortesia'
         else (select origem from public.orbis_pro where user_id = auth.uid()) end,
    coalesce((select iniciado_em from public.orbis_pro where user_id = auth.uid()),
             (select min(criado_em) from public.apple_assinaturas where user_id = auth.uid() and direito = 'plano' and nivel = 'pro')),
    coalesce((select expira_em from public.orbis_pro where user_id = auth.uid()),
             (select max(ate) from public.bancos_extra_compras where user_id = auth.uid() and ativo),
             (select max(expira_em) from public.apple_assinaturas where user_id = auth.uid() and direito = 'plano' and nivel = 'pro')),
    (select count(*)::int from public.bank_connections where user_id = auth.uid() and coalesce(status,'') <> 'deleted'),
    coalesce((select verificado from public.profiles where user_id = auth.uid()), false);
$$;

-- vant_direitos: the courtesy mark shows as its own right
create or replace function public.vant_direitos(p_user uuid)
returns table (direito text, origem text, valido_ate timestamptz, referencia text, ambiente text)
language sql stable security definer set search_path to 'public' as $$
  with pode as (select auth.role() = 'service_role' or p_user = auth.uid() or public.is_orbis_admin() as sim)
  select x.* from (
    select 'suspensao'::text, 'admin'::text, null::timestamptz, s.motivo, null::text
      from public.acesso_suspenso s where s.user_id = p_user and s.liberado_em is null
    union all
    select 'plano', 'hotmart', coalesce(s.grace_until, s.current_period_end), s.hotmart_subscription_id, null
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
    select 'pro', 'cortesia', o.cortesia_ate, null, null
      from public.orbis_pro o where o.user_id = p_user and o.cortesia and (o.cortesia_ate is null or o.cortesia_ate > now())
       and not (o.origem = 'cortesia' and o.ativo and o.cancelado_em is null and (o.expira_em is null or o.expira_em > now()))
    union all
    select 'pro', 'apple', greatest(a.expira_em, coalesce(a.tolerancia_ate, a.expira_em)), a.original_transaction_id, a.ambiente
      from public.apple_assinaturas a where a.user_id = p_user and a.direito = 'plano' and a.nivel = 'pro' and public.apple_vale(a)
    union all
    select 'banco', case when b.chave like 'apple:%' then 'apple' else 'hotmart' end, b.ate, b.chave, null
      from public.bancos_extra_compras b where b.user_id = p_user and b.ativo and b.ate > now()
  ) as x (direito, origem, valido_ate, referencia, ambiente)
  where (select sim from pode);
$$;
