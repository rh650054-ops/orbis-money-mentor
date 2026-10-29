-- ============================================================================
-- CORTESIA SEM BANCO PAGO: o app precisa saber — 29/10/2026
-- Caso real (influenciador com Pro de cortesia): queria ligar 3 bancos e comprar os
-- 3 avulsos, mas a aba Vender mostrava a vitrine "assine o Pro", porque orbis_pro_status()
-- devolvia origem nula pra cortesia sem banco pago. Agora devolve 'cortesia': o app mostra
-- o caminho certo (comprar o banco avulso, R$ 12,90/mês cada) em vez dos planos.
-- Nada muda em vant_pro_pleno / orbis_pro_ativo (o banco segue pago à parte na cortesia).
-- ============================================================================
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
