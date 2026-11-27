-- 27/11/2026 (third part): the two old partner functions that count "plan on", exactly as they run
-- in PRODUCTION today, for casos/50. Same rules as the other two files: not loaded into the base
-- test database, copied from the production catalog, checked by fingerprint (casos/50, F0).
set check_function_bodies = off;
create table if not exists public.parceiros (id uuid primary key default gen_random_uuid(), code text not null, nome text, tipo text,
  comissao numeric not null default 0, recorrente boolean not null default false);

-- parceiros_painel = production 21280dfd4b
CREATE OR REPLACE FUNCTION public.parceiros_painel(p_ini text, p_fim text)
 RETURNS json
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with per as (select p_ini::date ini, p_fim::date fim),
  atr as (
    select a.code, a.user_id, a.prova,
           coalesce(pr.billing_exempt,false) exempt,
           pr.plan_status,
           (select min(s.created_at) from public.subscriptions s where s.user_id = a.user_id) sub
    from public.orbis_atribuicao a
    join public.profiles pr on pr.user_id = a.user_id
  ),
  base as (
    select p.code, p.nome, p.tipo, p.comissao::numeric c, p.recorrente,
      (select count(*) from public.leads l, per
        where upper(trim(coalesce(l.ref,'')))=upper(trim(p.code))
          and (l.created_at at time zone 'America/Sao_Paulo')::date >= per.ini
          and (l.created_at at time zone 'America/Sao_Paulo')::date <  per.fim) leads,
      (select count(*) from public.leads l where upper(trim(coalesce(l.ref,'')))=upper(trim(p.code))) leads_total,
      (select count(*) from atr a, per
        where a.code=upper(trim(p.code)) and a.exempt=false and a.sub is not null
          and (a.sub at time zone 'America/Sao_Paulo')::date >= per.ini
          and (a.sub at time zone 'America/Sao_Paulo')::date <  per.fim) novos,
      (select count(*) from atr a
        where a.code=upper(trim(p.code)) and a.exempt=false and a.plan_status='active') ativos
    from public.parceiros p
  )
  select json_build_object(
    'ini', (select to_char(ini,'DD/MM/YYYY') from per),
    'fim', (select to_char(fim - 1,'DD/MM/YYYY') from per),
    'totais', json_build_object(
      'leads', (select coalesce(sum(leads),0) from base),
      'novos', (select coalesce(sum(novos),0) from base),
      'a_pagar', (select coalesce(sum(novos*c),0) from base),
      'com_venda', (select count(*) from base where novos>0)
    ),
    'parceiros', coalesce((select json_agg(json_build_object(
      'code',code,'nome',nome,'tipo',tipo,'comissao',c,'recorrente',recorrente,
      'leads',leads,'leads_total',leads_total,'novos',novos,'ativos',ativos,
      'ganhos', novos*c
    ) order by (novos*c) desc, leads desc) from base), '[]'::json)
  );
$function$;

-- parceiros_resumo = production 32a930da42
CREATE OR REPLACE FUNCTION public.parceiros_resumo(p_mes text DEFAULT NULL::text)
 RETURNS json
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with per as (
    select
      coalesce(to_date(p_mes,'YYYY-MM'), date_trunc('month',(now() at time zone 'America/Sao_Paulo'))::date) as mes_ini,
      (coalesce(to_date(p_mes,'YYYY-MM'), date_trunc('month',(now() at time zone 'America/Sao_Paulo'))::date) + interval '1 month')::date as mes_fim
  ),
  atr as (
    select a.code, a.user_id,
           coalesce(pr.billing_exempt,false) exempt,
           pr.plan_status,
           (select min(s.created_at) from public.subscriptions s where s.user_id = a.user_id) sub
    from public.orbis_atribuicao a
    join public.profiles pr on pr.user_id = a.user_id
  ),
  base as (
    select p.id, p.code, p.nome, p.tipo, p.comissao, p.recorrente,
      (select count(*) from public.leads l, per
        where upper(trim(coalesce(l.ref,'')))=upper(trim(p.code))
          and (l.created_at at time zone 'America/Sao_Paulo')::date >= per.mes_ini
          and (l.created_at at time zone 'America/Sao_Paulo')::date <  per.mes_fim) as leads_mes,
      (select count(*) from public.leads l where upper(trim(coalesce(l.ref,'')))=upper(trim(p.code))) as leads_total,
      (case when p.recorrente then
        (select count(*) from atr a
          where a.code=upper(trim(p.code)) and a.exempt=false and a.plan_status='active')
      else
        (select count(*) from atr a, per
          where a.code=upper(trim(p.code)) and a.exempt=false and a.sub is not null
            and (a.sub at time zone 'America/Sao_Paulo')::date >= per.mes_ini
            and (a.sub at time zone 'America/Sao_Paulo')::date <  per.mes_fim)
      end) as assinantes_mes
    from public.parceiros p
  )
  select coalesce(json_agg(json_build_object(
    'id', id, 'code', code, 'nome', nome, 'tipo', tipo,
    'comissao', comissao, 'recorrente', recorrente,
    'leads_mes', leads_mes, 'leads_total', leads_total,
    'assinantes_mes', assinantes_mes,
    'ganhos_mes', assinantes_mes * comissao
  ) order by nome), '[]'::json)
  from base;
$function$;
