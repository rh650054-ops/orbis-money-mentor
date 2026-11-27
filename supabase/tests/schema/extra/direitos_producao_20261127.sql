-- 27/11/2026: the rights functions (plan, Pro, annual, extra bank) exactly as they run in PRODUCTION
-- today, for the cases in casos/4x_direitos_*.sql. NOT loaded into the base test database: each of
-- those cases includes this file itself (\ir), so the doubles the other cases rely on stay as they are.
-- Source: the last definition in this repository when its fingerprint equals production's (checked
-- against the production catalog on 27/11/2026), or a copy from the catalog when the function exists
-- only there (pro_conceder, pro_revogar, cortesia_com_banco_pago, expire_overdue_subscriptions). No real data.
-- Bodies were copied by script and checked by fingerprint: do not edit a function body here.
set check_function_bodies = off;

-- orbis_pro with every column production has (06_cobranca.sql creates only three)
alter table public.orbis_pro add column if not exists origem text not null default 'hotmart',
  add column if not exists produto_id text, add column if not exists iniciado_em timestamptz not null default now(),
  add column if not exists expira_em timestamptz, add column if not exists cancelado_em timestamptz,
  add column if not exists atualizado_em timestamptz not null default now();
create unique index if not exists orbis_pro_user_id_key on public.orbis_pro (user_id);
create table if not exists public.bancos_extra (user_id uuid primary key, extras integer not null default 0, isento boolean not null default false);

-- vant_pro_pleno(uuid) = production ebb3e5b5e9  <- supabase/migrations/20261006180000_planos_vant.sql
create or replace function public.vant_pro_pleno(p_user uuid default null)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists (
    select 1 from public.orbis_pro
    where user_id = coalesce(p_user, auth.uid())
      and ativo and cancelado_em is null
      and (expira_em is null or expira_em > now())
  ) or public.cortesia_com_banco_pago(coalesce(p_user, auth.uid()));
$$;

-- pro_anual(uuid) = production 23c31b060e  <- supabase/migrations/20261025140000_anual_dois_bancos_e_selo.sql
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

-- orbis_pro_ativo(uuid) = production 0bca1afef2  <- supabase/migrations/20261006180000_planos_vant.sql
create or replace function public.orbis_pro_ativo(p_user uuid default null)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select public.vant_pro_pleno(coalesce(p_user, auth.uid()))
      or exists (select 1 from public.bancos_extra_compras
                  where user_id = coalesce(p_user, auth.uid()) and ativo and ate > now());
$$;

-- vant_plano(uuid) = production b5096ae261  <- supabase/migrations/20261025200000_beneficios_por_plano.sql
create or replace function public.vant_plano(p_user uuid default null)
returns text language sql stable security definer set search_path to 'public' as $$
  with u as (select coalesce(p_user, auth.uid()) as id),
  p as (select * from public.profiles where user_id = (select id from u))
  select case
    when (select id from u) is null then 'sem_plano'
    when coalesce((select billing_exempt from p), false) or coalesce((select is_demo from p), false) then 'equipe'
    when public.pro_anual((select id from u)) then 'pro_anual'
    when public.vant_pro_pleno((select id from u)) then 'pro'
    when public.orbis_pro_ativo((select id from u)) then 'essencial_banco'
    when (select plan_status from p) = 'active' then 'essencial'
    when coalesce((select is_trial_active from p), false)
         and (select trial_end from p) >= (now() at time zone 'America/Sao_Paulo')::date then 'teste'
    else 'sem_plano' end;
$$;

-- open_finance_limite(uuid) = production 0c9fbcebc2  <- supabase/migrations/20261025140000_anual_dois_bancos_e_selo.sql
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

-- orbis_pro_status() = production 42fd3773ab  <- supabase/migrations/20261029180000_cortesia_origem_pro_status.sql
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

-- banco_extra_registrar(uuid,text,boolean,timestamp with time zone) = production cfef5bec44  <- supabase/migrations/20261003190000_banco_extra_compra.sql
create or replace function public.banco_extra_registrar(p_user uuid, p_chave text, p_ativo boolean, p_ate timestamptz)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'apenas o servidor';
  end if;
  if p_user is null or coalesce(p_chave, '') = '' then
    raise exception 'compra sem dono ou sem chave';
  end if;
  insert into public.bancos_extra_compras (chave, user_id, ativo, ate, atualizado_em)
  values (p_chave, p_user, p_ativo, case when p_ativo then p_ate else now() end, now())
  on conflict (chave) do update
    set user_id = excluded.user_id,
        ativo = excluded.ativo,
        ate = case when excluded.ativo then greatest(public.bancos_extra_compras.ate, excluded.ate) else now() end,
        atualizado_em = now();
end $$;

-- cortesia_com_banco_pago = production adc206ecbf  <- production catalog, 27/11/2026 (exists only there)
CREATE OR REPLACE FUNCTION public.cortesia_com_banco_pago(p_user uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce((select billing_exempt from public.profiles where user_id = p_user), false)
     and exists (select 1 from public.bancos_extra_compras where user_id = p_user and ativo and ate > now());
$function$;

-- pro_conceder = production 06d0bacb4a  <- production catalog, 27/11/2026 (exists only there)
CREATE OR REPLACE FUNCTION public.pro_conceder(p_user uuid, p_origem text DEFAULT 'hotmart'::text, p_codigo text DEFAULT NULL::text, p_produto text DEFAULT NULL::text, p_ate timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if auth.jwt() ->> 'role' is distinct from 'service_role' then
    raise exception 'so o servidor libera o Pro';
  end if;
  insert into public.orbis_pro (user_id, ativo, origem, assinante_codigo, produto_id, expira_em, cancelado_em, atualizado_em)
  values (p_user, true, coalesce(p_origem,'hotmart'), p_codigo, p_produto, p_ate, null, now())
  on conflict (user_id) do update set
    ativo = true, origem = excluded.origem,
    assinante_codigo = coalesce(excluded.assinante_codigo, public.orbis_pro.assinante_codigo),
    produto_id = coalesce(excluded.produto_id, public.orbis_pro.produto_id),
    expira_em = excluded.expira_em, cancelado_em = null, atualizado_em = now();
  return true;
end;
$function$;

-- pro_revogar = production 57cdf97bdb  <- production catalog, 27/11/2026 (exists only there)
CREATE OR REPLACE FUNCTION public.pro_revogar(p_user uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if auth.jwt() ->> 'role' is distinct from 'service_role' then
    raise exception 'so o servidor mexe no Pro';
  end if;
  update public.orbis_pro set ativo = false, cancelado_em = now(), atualizado_em = now()
   where user_id = p_user;
  return true;
end;
$function$;

-- expire_overdue_subscriptions = production 47843e903e  <- production catalog, 27/11/2026 (exists only there)
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

-- checked when this file was generated: hotmart_acesso_aplicar in the base database (29d8a279c8, migration
-- 20261105110000) is production's too. expire_overdue_subscriptions in schema/07 differs from production only in
-- comments; the exact production copy above replaces it inside these cases.
