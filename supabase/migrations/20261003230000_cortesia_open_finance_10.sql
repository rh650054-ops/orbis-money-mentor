-- ============================================================
-- EQUIPE E INFLUENCIADORES: app de cortesia + Open Finance a R$ 10/mês
-- (decisão do Rick, 03/10/2026)
--   • Quem tem o app de cortesia (profiles.billing_exempt = true) não paga o
--     Vant Pro, mas pode comprar a oferta de R$ 10/mês que já existe na
--     Hotmart (otgozkn9, "banco extra"). Com ela ativa, vira Pro pro banco:
--     liga o banco, ganha selo, entra no X1.
--   • Nesse caso os R$ 10 compram o PRIMEIRO banco (não um extra): o limite
--     é o número de ofertas pagas, não 1 + extras.
--   • Mesmas assinaturas: orbis_pro_ativo, orbis_pro_status,
--     open_finance_limite. Só a regra muda. Idempotente.
-- ============================================================

create or replace function public.cortesia_com_banco_pago(p_user uuid)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select coalesce((select billing_exempt from public.profiles where user_id = p_user), false)
     and exists (select 1 from public.bancos_extra_compras where user_id = p_user and ativo and ate > now());
$$;
revoke all on function public.cortesia_com_banco_pago(uuid) from public, anon, authenticated;

create or replace function public.orbis_pro_ativo(p_user uuid default null)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists (
    select 1 from public.orbis_pro
    where user_id = coalesce(p_user, auth.uid())
      and ativo and cancelado_em is null
      and (expira_em is null or expira_em > now())
  ) or public.cortesia_com_banco_pago(coalesce(p_user, auth.uid()));
$$;

create or replace function public.orbis_pro_status()
returns table (pro boolean, origem text, desde timestamptz, ate timestamptz, bancos integer, verificado boolean)
language sql stable security definer set search_path to 'public' as $$
  select
    public.orbis_pro_ativo(auth.uid()),
    case when public.cortesia_com_banco_pago(auth.uid())
           and not exists (select 1 from public.orbis_pro where user_id = auth.uid() and ativo and cancelado_em is null and (expira_em is null or expira_em > now()))
         then 'cortesia_banco'
         else (select origem from public.orbis_pro where user_id = auth.uid()) end,
    (select iniciado_em from public.orbis_pro where user_id = auth.uid()),
    coalesce((select expira_em from public.orbis_pro where user_id = auth.uid()),
             (select max(ate) from public.bancos_extra_compras where user_id = auth.uid() and ativo)),
    (select count(*)::int from public.bank_connections where user_id = auth.uid() and coalesce(status,'') <> 'deleted'),
    coalesce((select verificado from public.profiles where user_id = auth.uid()), false);
$$;

create or replace function public.open_finance_limite(p_user uuid default null)
returns jsonb language sql stable security definer set search_path to 'public' as $$
  with u as (select coalesce(p_user, auth.uid()) as id),
  x as (select * from public.bancos_extra where user_id = (select id from u)),
  pagos as (select count(*)::int n from public.bancos_extra_compras
             where user_id = (select id from u) and ativo and ate > now()),
  -- cortesia sem Pro pago: os R$ 10 compram o primeiro banco, não um extra
  base as (select case when public.cortesia_com_banco_pago((select id from u))
                        and not exists (select 1 from public.orbis_pro where user_id = (select id from u) and ativo and cancelado_em is null and (expira_em is null or expira_em > now()))
                       then 0 else 1 end as n),
  ext as (select coalesce((select extras from x), 0) + (select n from pagos) as n),
  usados as (select count(*)::int n from public.bank_connections
              where user_id = (select id from u) and coalesce(status, '') <> 'deleted')
  select jsonb_build_object(
    'usados', (select n from usados),
    'isento', coalesce((select isento from x), false),
    'extras', (select n from ext),
    'limite', case when coalesce((select isento from x), false) then null else (select n from base) + (select n from ext) end,
    'pode_conectar', coalesce((select isento from x), false) or (select n from usados) < (select n from base) + (select n from ext)
  )
  where (select id from u) is not null
    and (p_user is null or p_user = auth.uid() or auth.role() = 'service_role');
$$;
