-- ============================================================
-- CRM "Resultados do período" (22/10/2026): compra reembolsada ou com chargeback
-- sai das vendas e da comissão. Antes contava pra sempre (1 caso em outubro: R$28,40).
-- ============================================================
create or replace function public.orbis_painel_periodo(p_inicio date, p_fim date, p_comissao numeric default null)
returns jsonb language plpgsql stable security definer set search_path = public as $function$
declare
  ini timestamptz;
  fim timestamptz;
  resultado jsonb;
begin
  if not public.is_orbis_admin() then
    raise exception 'apenas admin';
  end if;
  ini := (p_inicio::timestamp at time zone 'America/Sao_Paulo');
  fim := ((p_fim + 1)::timestamp at time zone 'America/Sao_Paulo');

  with
  origem as (select user_id, upper(trim(code)) as ref from public.orbis_atribuicao),
  codigos as (select upper(trim(code)) as ref, nome, tipo, comissao, recorrente from public.parceiros),
  aprovadas as (
    -- uma linha por transação aprovada (a Hotmart pode mandar APPROVED e COMPLETE)
    select distinct on (coalesce(nullif(e.purchase_id, ''), e.id::text))
           e.id, e.recebido_em, e.user_id, nullif(e.subscription_id, '') as sub,
           coalesce(e.user_id::text, lower(nullif(e.buyer_email, '')), nullif(e.buyer_cpf, ''), e.id::text) as pessoa,
           coalesce(e.payload #>> '{data,subscription,plan,name}', '') as plano,
           coalesce(e.valor, 0) as valor,
           coalesce((select sum((c->>'value')::numeric) from jsonb_array_elements(coalesce(e.payload #> '{data,commissions}', '[]'::jsonb)) c
                      where c->>'source' = 'PRODUCER'), e.valor * 0.85, 0) as liquido,
           upper(trim(coalesce(e.payload #>> '{data,purchase,offer,name}', ''))) as cupom,
           upper(trim(coalesce(e.afiliado_codigo, ''))) as afil
      from public.hotmart_eventos e
     where upper(coalesce(e.event_type, '')) in ('PURCHASE_APPROVED', 'PURCHASE_COMPLETE', 'SUBSCRIPTION_RENEWAL')
       -- 22/10/2026: compra reembolsada ou com chargeback não é venda e não paga comissão
       and not exists (select 1 from public.hotmart_eventos r
                        where nullif(e.purchase_id, '') is not null and r.purchase_id = e.purchase_id
                          and upper(coalesce(r.event_type, '')) in ('PURCHASE_REFUNDED', 'PURCHASE_CHARGEBACK'))
     order by coalesce(nullif(e.purchase_id, ''), e.id::text), e.recebido_em
  ),
  com_tipo as (
    select a.*,
           -- 1ª cobrança desta assinatura
           min(a.recebido_em) over (partition by coalesce(a.sub, a.id::text)) as ini_sub,
           -- 1ª cobrança da pessoa (qualquer assinatura)
           min(a.recebido_em) over (partition by a.pessoa) as ini_pessoa
      from aprovadas a
  ),
  classif as (
    select t.*,
           case when t.recebido_em > t.ini_sub then 'renovacao'
                when t.ini_sub > t.ini_pessoa then 'upgrade'
                else 'primeira' end as tipo,
           (t.ini_sub = t.ini_pessoa) as sub_era_primeira,
           t.plano ilike '%anual%' as anual
      from com_tipo t
  ),
  periodo as (
    select c.*,
           coalesce(o.ref,
                    (select k.ref from codigos k where k.ref = c.cupom),
                    (select k.ref from codigos k where k.ref = c.afil)) as ref
      from classif c
      left join origem o on o.user_id = c.user_id
     where c.recebido_em >= ini and c.recebido_em < fim
  ),
  com_comissao as (
    select p.*, k.recorrente,
           case
             when p.ref is null or k.ref is null then 0
             when p.tipo = 'upgrade' then 0
             when p.tipo = 'renovacao' and not (coalesce(k.recorrente, false) and p.sub_era_primeira) then 0
             when p.anual then round(p.liquido * 0.40, 2)
             else coalesce(k.comissao, 0)
           end as comissao
      from periodo p
      left join codigos k on k.ref = p.ref
  ),
  cadastros_periodo as (
    select p.user_id, p.created_at from public.profiles p where p.created_at >= ini and p.created_at < fim
  ),
  ativas as (
    select coalesce(nullif(plano, ''), 'Outro') as plano, count(*) as n
      from public.orbis_hotmart_assinatura where status_hotmart = 'ACTIVE' group by 1
  ),
  por_dia as (
    select d::date as dia,
      (select count(*) from cadastros_periodo c where (c.created_at at time zone 'America/Sao_Paulo')::date = d::date) as cadastros,
      (select count(*) from com_comissao v where v.tipo <> 'renovacao' and (v.recebido_em at time zone 'America/Sao_Paulo')::date = d::date) as assinaturas,
      (select count(*) from com_comissao v where v.tipo = 'renovacao' and (v.recebido_em at time zone 'America/Sao_Paulo')::date = d::date) as renovacoes
    from generate_series(p_inicio, p_fim, interval '1 day') d
  ),
  por_ref as (
    select k.ref, k.nome, k.tipo, k.comissao as comissao_unitaria, k.recorrente,
      (select count(*) from public.leads l where upper(trim(l.ref)) = k.ref and l.created_at >= ini and l.created_at < fim) as leads,
      (select count(*) from cadastros_periodo cp join origem o on o.user_id = cp.user_id where o.ref = k.ref) as cadastros,
      (select count(*) from com_comissao v where v.ref = k.ref and v.tipo = 'primeira') as assinaturas,
      (select count(*) from com_comissao v where v.ref = k.ref and v.tipo = 'upgrade') as upgrades,
      (select count(*) from com_comissao v where v.ref = k.ref and v.tipo = 'renovacao') as renovacoes,
      coalesce((select sum(v.comissao) from com_comissao v where v.ref = k.ref), 0) as comissao
    from codigos k
  )
  select jsonb_build_object(
    'inicio', p_inicio, 'fim', p_fim,
    'cadastros', (select count(*) from cadastros_periodo),
    'cadastros_total', (select count(*) from public.profiles),
    'leads', (select count(*) from public.leads where created_at >= ini and created_at < fim),
    'leads_total', (select count(*) from public.leads),
    'assinaturas_novas', (select count(*) from com_comissao where tipo <> 'renovacao'),
    'primeiras', (select count(*) from com_comissao where tipo = 'primeira'),
    'upgrades', (select count(*) from com_comissao where tipo = 'upgrade'),
    'renovacoes', (select count(*) from com_comissao where tipo = 'renovacao'),
    'cobrancas_hotmart', (select count(*) from com_comissao),
    'receita_hotmart', coalesce((select round(sum(valor)::numeric, 2) from com_comissao), 0),
    'liquido_hotmart', coalesce((select round(sum(liquido)::numeric, 2) from com_comissao), 0),
    'vendas_por_plano', coalesce((select jsonb_object_agg(plano, n) from (
        select coalesce(nullif(plano, ''), 'Outro') as plano, count(*) as n from com_comissao where tipo <> 'renovacao' group by 1) x), '{}'::jsonb),
    'assinaturas_ativas_agora', coalesce((select sum(n) from ativas), 0),
    'ativas_por_plano', coalesce((select jsonb_object_agg(plano, n) from ativas), '{}'::jsonb),
    'sem_origem', (select count(*) from com_comissao where tipo = 'primeira' and ref is null),
    'por_dia', coalesce((select jsonb_agg(jsonb_build_object('dia', dia, 'cadastros', cadastros, 'assinaturas', assinaturas, 'renovacoes', renovacoes) order by dia) from por_dia), '[]'::jsonb),
    'por_ref', coalesce((select jsonb_agg(jsonb_build_object(
        'ref', ref, 'nome', nome, 'tipo', tipo, 'recorrente', recorrente, 'comissao_unitaria', comissao_unitaria,
        'leads', leads, 'cadastros', cadastros, 'assinaturas', assinaturas, 'upgrades', upgrades, 'renovacoes', renovacoes,
        'comissao', round(comissao::numeric, 2))
        order by comissao desc, assinaturas desc, leads desc)
      from por_ref where leads > 0 or cadastros > 0 or assinaturas > 0 or upgrades > 0 or renovacoes > 0), '[]'::jsonb),
    'comissao_total', coalesce((select round(sum(comissao)::numeric, 2) from com_comissao), 0)
  ) into resultado;
  return resultado;
end;
$function$;
