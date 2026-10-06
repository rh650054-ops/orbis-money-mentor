-- ============================================================
-- PLANOS DA VANT — 06/10/2026 (Rick)
--   Essencial R$ 29,90 · + banco R$ 12,90 (cada) · Pro R$ 49,90 (1 banco)
--   Pro Anual R$ 418,80 (2 bancos). Banco avulso: oferta otgozkn9. Anual novo: ew11enu0
--   (o anual antigo 6vkxbh8c continua reconhecido pra quem já assinou).
-- O que muda no banco de dados:
--   • vant_pro_pleno(): o Pro DE VERDADE (assinatura Pro ativa ou cortesia isenta com
--     banco pago). É ele que dá o selo e o "pro" da tela.
--   • orbis_pro_ativo(): passa a significar "pode usar Open Finance" = Pro pleno OU
--     qualquer pessoa com banco avulso pago (Essencial + banco). As funções do Pluggy
--     (ligar banco, ler Pix) já consultam esta função, então o Essencial + banco liga
--     o banco sem precisar republicar nada.
--   • usuario_verificado() (selo) e orbis_pro_status().pro usam o Pro pleno: o selo e o
--     ranking conferido continuam sendo do Pro.
--   • open_finance_limite(): bancos incluídos por plano — Pro anual 2, Pro mensal 1,
--     Essencial 0 — mais 1 por banco avulso pago. Devolve também 'liberado' e 'plano'.
-- Hoje ninguém tem banco avulso ativo (conferido em 06/10), então nada muda pra quem já usa.
-- ============================================================

create or replace function public.vant_pro_pleno(p_user uuid default null)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists (
    select 1 from public.orbis_pro
    where user_id = coalesce(p_user, auth.uid())
      and ativo and cancelado_em is null
      and (expira_em is null or expira_em > now())
  ) or public.cortesia_com_banco_pago(coalesce(p_user, auth.uid()));
$$;

create or replace function public.orbis_pro_ativo(p_user uuid default null)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select public.vant_pro_pleno(coalesce(p_user, auth.uid()))
      or exists (select 1 from public.bancos_extra_compras
                  where user_id = coalesce(p_user, auth.uid()) and ativo and ate > now());
$$;

create or replace function public.usuario_verificado(p_user uuid)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select public.vant_pro_pleno(p_user)
     and exists (select 1 from public.bank_connections b
                  where b.user_id = p_user and coalesce(b.status, '') <> 'deleted');
$$;

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
  pro as (select produto_id from public.orbis_pro
           where user_id = (select id from u) and ativo and cancelado_em is null
             and (expira_em is null or expira_em > now())),
  pagos as (select count(*)::int n from public.bancos_extra_compras
             where user_id = (select id from u) and ativo and ate > now()),
  base as (select case
             when exists (select 1 from pro where produto_id in ('ew11enu0', '6vkxbh8c')) then 2  -- Pro anual
             when exists (select 1 from pro) then 1                                                -- Pro mensal / cortesia Pro
             else 0 end as n),                                                                     -- Essencial: só banco avulso
  ext as (select coalesce((select extras from x), 0) + (select n from pagos) as n),
  usados as (select count(*)::int n from public.bank_connections
              where user_id = (select id from u) and coalesce(status, '') <> 'deleted')
  select jsonb_build_object(
    'usados', (select n from usados),
    'isento', coalesce((select isento from x), false),
    'incluidos', (select n from base),
    'extras', (select n from ext),
    'limite', case when coalesce((select isento from x), false) then null else (select n from base) + (select n from ext) end,
    'pode_conectar', coalesce((select isento from x), false) or (select n from usados) < (select n from base) + (select n from ext),
    'liberado', public.orbis_pro_ativo((select id from u)),
    'plano', case
       when exists (select 1 from pro where produto_id in ('ew11enu0', '6vkxbh8c')) then 'pro_anual'
       when public.vant_pro_pleno((select id from u)) then 'pro'
       when (select n from pagos) > 0 then 'essencial_banco'
       else 'essencial' end
  )
  where (select id from u) is not null
    and (p_user is null or p_user = auth.uid() or auth.role() = 'service_role');
$$;

revoke all on function public.vant_pro_pleno(uuid) from public, anon;
grant execute on function public.vant_pro_pleno(uuid) to authenticated, service_role;
