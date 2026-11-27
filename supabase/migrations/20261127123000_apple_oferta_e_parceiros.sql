-- 27/11/2026 (Rick, Etapa 3): two server rules the iPhone purchase screen needs. DRAFT, NOT applied to
-- production. Needs the three migrations of Etapa 2. Rollback: supabase/direitos-apple/rollback.sql.
-- Tests: supabase/tests/casos/50.
--
-- 1. public.assinatura_apple_oferta(): may THIS account be offered a purchase on the iPhone?
--    Rick: "Quem já possui assinatura válida pela Hotmart deve continuar utilizando normalmente o
--    iPhone. Não apresente outra contratação do plano principal para esse usuário. Garanta a proteção
--    também para assinaturas em processamento, período de tolerância e transações pendentes."
--    The answer is decided here, on the server; the app only draws it.
--      plano: livre     no paying provider and nothing in progress: the three plans can be offered
--             trocar    the plan is already Apple's: changing it (upgrade / downgrade) goes through Apple
--             bloqueado see "motivo": hotmart_ativa | hotmart_em_tolerancia | hotmart_processando |
--                       hotmart_pagamento_pendente | cortesia | suspensa | sem_sessao
--      banco: livre | ja_tem (one add-on per Apple subscription for now) | sem_plano (the add-on never
--             gives the main plan, so it is not offered to an account without one) | bloqueado
-- 2. The two old partner functions that count "plan on" (parceiros_painel.ativos and the recurring
--    count of parceiros_resumo, which multiplies it by the commission) no longer count an account
--    whose plan is on ONLY because of an Apple subscription. Rick: no commission is computed or paid
--    on Apple subscriptions until the base and the policy are decided. The attribution itself stays
--    recorded on the Apple subscription (apple_origem_comercial). Bodies = production's of 27/11/2026
--    plus the two marked lines. (The third old function, painel_parceiro, pays only on accounts with
--    a row in public.subscriptions, which an Apple purchase never writes: casos/50, P3.)

create or replace function public.assinatura_apple_oferta()
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare
  u uuid := auth.uid();
  p public.profiles;
  c jsonb;
  a public.apple_assinaturas;
  v_motivo text;
  v_banco text;
begin
  if u is null then return jsonb_build_object('plano', 'bloqueado', 'motivo', 'sem_sessao', 'banco', 'bloqueado'); end if;
  select * into p from public.profiles where user_id = u;
  if p.user_id is null then return jsonb_build_object('plano', 'bloqueado', 'motivo', 'sem_sessao', 'banco', 'bloqueado'); end if;
  -- the Hotmart side as the rest of the app already reads it: nova | em_dia | conciliar | pendente | regularizar
  c := public.assinatura_caminho_de(u);
  select x.* into a from public.apple_assinaturas x
   where x.user_id = u and x.direito = 'plano' and public.apple_vale(x)
   order by x.nivel desc, x.anual desc, x.expira_em desc limit 1;

  v_motivo := case
    when public.conta_suspensa(u) then 'suspensa'
    when coalesce(p.billing_exempt, false) or coalesce(p.is_demo, false) then 'cortesia'
    when public.hotmart_plano_valido(u) then
      case when exists (select 1 from public.subscriptions s where s.user_id = u and s.status = 'past_due') then 'hotmart_em_tolerancia' else 'hotmart_ativa' end
    when c ->> 'acao' in ('em_dia', 'conciliar') then 'hotmart_ativa'           -- Hotmart says it is paid; the access is being reconciled
    when c ->> 'acao' = 'pendente' then 'hotmart_processando'                   -- a Hotmart purchase waiting for its payment
    when c ->> 'acao' = 'regularizar' or coalesce((c ->> 'tem_pix')::boolean, false) then 'hotmart_pagamento_pendente'
  end;

  v_banco := case
    when public.conta_suspensa(u) then 'bloqueado'
    when exists (select 1 from public.apple_assinaturas x where x.user_id = u and x.direito = 'banco' and public.apple_vale(x)) then 'ja_tem'
    -- 27/11/2026 (Rick): the bank add-on is not sold on the iPhone in the first version; the Hotmart
    -- add-on is untouched. To sell it later: 'livre' when the main plan is valid, else 'sem_plano'.
    else 'bloqueado' end;

  return jsonb_build_object(
    'plano', case when v_motivo is not null then 'bloqueado' when a.original_transaction_id is not null then 'trocar' else 'livre' end,
    'motivo', v_motivo,
    'apple', case when a.original_transaction_id is not null then jsonb_build_object(
               'produto', a.produto, 'renova', a.renova, 'ate', greatest(a.expira_em, coalesce(a.tolerancia_ate, a.expira_em))) end,
    'banco', v_banco,
    'conta_de_teste', public.apple_conta_de_teste(u));
end $$;
revoke all on function public.assinatura_apple_oferta() from public, anon;
grant execute on function public.assinatura_apple_oferta() to authenticated, service_role;

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
           -- 27/11: the plan is on ONLY because of an Apple subscription (no valid Hotmart one)
           (public.apple_plano_valido(a.user_id) and not public.hotmart_plano_valido(a.user_id)) so_apple,
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
        where a.code=upper(trim(p.code)) and a.exempt=false and a.plan_status='active' and not a.so_apple) ativos
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

CREATE OR REPLACE FUNCTION public.parceiros_resumo(p_mes text)
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
           -- 27/11: the plan is on ONLY because of an Apple subscription (no valid Hotmart one)
           (public.apple_plano_valido(a.user_id) and not public.hotmart_plano_valido(a.user_id)) so_apple,
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
          where a.code=upper(trim(p.code)) and a.exempt=false and a.plan_status='active' and not a.so_apple)
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
