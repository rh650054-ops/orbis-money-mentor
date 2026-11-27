-- Rollback of the draft migrations of Etapa 2 (20261127120000, 20261127121000, 20261127122000) and
-- of Etapa 3 (20261127123000).
-- One transaction: all or nothing.
--   1. Refuses to run while there is something only Rick can decide about:
--        - a PRODUCTION Apple subscription or a PRODUCTION row in the Apple ledger (from the first real
--          Apple sale on, going back would take access from a paying customer and drop financial records);
--        - a suspension in force (going back would let the next Hotmart charge undo it);
--        - a payout typed into apple_repasses.
--   2. Gives back every courtesy Pro that today is held only by the courtesy mark (a courtesy whose
--      paid row was closed by Hotmart), so nobody loses a courtesy because of the rollback.
--   3. Puts the eighteen changed functions back EXACTLY as they were in production on 27/11/2026
--      (bodies copied by script and checked by fingerprint against the production catalog).
--   4. Closes the extra-bank slots written by Apple ('apple:...' keys) and removes the new objects,
--      except the history of lifted suspensions (public.acesso_suspenso), which is kept.
-- Hotmart data is not touched by the migrations nor by this rollback.
-- casos/43_direitos_rollback.sql runs this file and then the same assertions as casos/40 and casos/44.
begin;

do $$
begin
  if to_regclass('public.apple_assinaturas') is not null
     and exists (select 1 from public.apple_assinaturas where ambiente = 'Production') then
    raise exception 'rollback recusado: existem assinaturas Apple de producao. Decida conta a conta antes de remover o espelho.';
  end if;
  if to_regclass('public.apple_transacoes') is not null
     and exists (select 1 from public.apple_transacoes where ambiente = 'Production') then
    raise exception 'rollback recusado: existem vendas Apple de producao no registro financeiro. Guarde-as antes de remover a tabela.';
  end if;
  if to_regclass('public.apple_repasses') is not null and exists (select 1 from public.apple_repasses) then
    raise exception 'rollback recusado: existem repasses da Apple registrados. Guarde-os antes de remover a tabela.';
  end if;
  if to_regclass('public.acesso_suspenso') is not null
     and exists (select 1 from public.acesso_suspenso where liberado_em is null) then
    raise exception 'rollback recusado: existem contas suspensas. Sem esta migracao a proxima cobranca desfaz a suspensao: decida conta a conta.';
  end if;
end $$;

-- ---------------------------------------------------------------------------------- courtesies
do $$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'orbis_pro' and column_name = 'cortesia') then
    update public.orbis_pro
       set ativo = true, origem = 'cortesia', assinante_codigo = null, produto_id = null,
           expira_em = cortesia_ate, cancelado_em = null, atualizado_em = now()
     where cortesia and (cortesia_ate is null or cortesia_ate > now())
       and not (ativo and cancelado_em is null and (expira_em is null or expira_em > now()));
  end if;
end $$;

-- ---------------------------------------------------------------------------------- the functions that 20261127120000 changed
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

-- ---------------------------------------------------------------------------------- the functions that 20261127121000 and 20261127122000 changed
create or replace function public.orbis_pro_ativo(p_user uuid default null)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select public.vant_pro_pleno(coalesce(p_user, auth.uid()))
      or exists (select 1 from public.bancos_extra_compras
                  where user_id = coalesce(p_user, auth.uid()) and ativo and ate > now());
$$;

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

CREATE OR REPLACE FUNCTION public.admin_assinatura_manual(p_user uuid, p_ativar boolean, p_motivo text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_motivo text := btrim(coalesce(p_motivo, ''));
begin
  if not public.is_orbis_admin() then raise exception 'apenas admin'; end if;
  if length(v_motivo) < 5 then raise exception 'Escreva o motivo (pelo menos 5 letras).'; end if;
  if not exists (select 1 from public.profiles where user_id = p_user) then raise exception 'perfil não encontrado'; end if;
  update public.profiles
     set plan_status = case when p_ativar then 'active' else 'expired' end,
         plan_type   = case when p_ativar then 'pro' else 'expired' end,
         is_trial_active = false
   where user_id = p_user;
  insert into public.assinatura_manual (user_id, feito_por, acao, motivo)
  values (p_user, auth.uid(), case when p_ativar then 'ativar' else 'desativar' end, v_motivo);
  return jsonb_build_object('ok', true, 'plan_status', case when p_ativar then 'active' else 'expired' end);
end $function$;

CREATE OR REPLACE FUNCTION public.total_assinantes_app()
 RETURNS integer
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select count(*)::int from public.profiles
  where plan_status = 'active' and coalesce(billing_exempt, false) = false;
$function$;

CREATE OR REPLACE FUNCTION public.lista_assinantes()
 RETURNS TABLE(nome text, email text, comp_label text)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce(nickname,'') as nome,
         lower(trim(email))     as email,
         comp_label
  from public.profiles
  where plan_status = 'active'
    and coalesce(billing_exempt, false) = false
    and email is not null and trim(email) <> '';
$function$;

CREATE OR REPLACE FUNCTION public.leads_assinantes_no_app()
 RETURNS SETOF text
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select distinct lower(trim(l.email))
  from public.leads l
  join public.profiles p on lower(trim(p.email)) = lower(trim(l.email))
  where p.plan_status='active' and coalesce(p.billing_exempt,false)=false and coalesce(l.email,'')<>''
$function$;

CREATE OR REPLACE FUNCTION public.beta_vagas_preenchidas()
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT count(*)::int
  FROM public.profiles
  WHERE COALESCE(is_demo, false) = false           -- ignora contas demo
    AND (
      plan_status = 'active'                        -- assinante
      OR (
        plan_status = 'trial'                       -- teste grátis...
        AND COALESCE(trial_end, CURRENT_DATE) >= CURRENT_DATE  -- ...ainda válido
      )
    );
$function$;

CREATE OR REPLACE FUNCTION public._crm_trial_sem_assinar(p_user uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from public.profiles p
     where p.user_id = p_user
       and not coalesce(p.billing_exempt, false) and not coalesce(p.is_demo, false)
       and p.trial_end < now()
       and coalesce(p.plan_status, '') <> 'active'
       and not exists (select 1 from public.subscriptions s where s.user_id = p.user_id)
       and not exists (select 1 from public._crm_compras_hotmart h where h.user_id = p.user_id)
       and not exists (select 1 from public.orbis_hotmart_assinatura a where a.user_id = p.user_id)
       and not exists (select 1 from public.crm_equipe e where e.user_id = p.user_id)
  ) and not public.orbis_pro_ativo(p_user);
$function$;

CREATE OR REPLACE FUNCTION public._crm_assinante_sem_pro(p_user uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from public.profiles p
     where p.user_id = p_user
       and not coalesce(p.billing_exempt, false) and not coalesce(p.is_demo, false)
       and (p.plan_status = 'active'
            or exists (select 1 from public.subscriptions s
                        where s.user_id = p.user_id and s.status = 'active'
                          and coalesce(s.grace_until, s.current_period_end) >= now()))
  ) and not public.orbis_pro_ativo(p_user);
$function$;

-- ---------------------------------------------------------------------------------- the two functions that 20261127123000 changed (Etapa 3)
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

-- ---------------------------------------------------------------------------------- the new objects
drop function if exists public.assinatura_apple_oferta();
do $$
begin
  if to_regclass('public.bancos_extra_compras') is not null then
    update public.bancos_extra_compras set ativo = false, ate = least(ate, now()), atualizado_em = now() where chave like 'apple:%' and ativo;
  end if;
end $$;
drop trigger if exists zz_profiles_respeita_suspensao on public.profiles;
drop function if exists public.receita_por_origem(date, date);
drop function if exists public.receita_apple(date, date);
drop function if exists public.apple_origem_comercial(date, date);
drop function if exists public.apple_repasse_registrar(date, date, numeric, date, text);
drop function if exists public.apple_taxa_definir(date, numeric, text);
drop function if exists public.apple_transacao_registrar(text, text, uuid, text, text, timestamptz, timestamptz, bigint, text, text, timestamptz, text, boolean, text, text, timestamptz);
drop function if exists public.apple_taxa_em(timestamptz);
drop function if exists public.apple_conta_de_teste_remover(uuid);
drop function if exists public.apple_conta_de_teste_registrar(uuid, text);
drop function if exists public.apple_conta_de_teste(uuid);
drop function if exists public.admin_liberar_acesso(uuid, text);
drop function if exists public.admin_suspender_acesso(uuid, text);
drop function if exists public.vant_acesso_recalcular(uuid);
drop function if exists public.vant_plano_principal_valido(uuid);
drop function if exists public.pro_cortesia_revogar(uuid);
drop function if exists public.orbis_pro_vale(public.orbis_pro);
drop function if exists public.profiles_respeita_suspensao();
drop function if exists public.conta_suspensa(uuid);
drop function if exists public.vant_direitos(uuid);
drop function if exists public.apple_conciliar_lista(integer);
drop function if exists public.apple_evento_concluir(text, text);
drop function if exists public.apple_evento_registrar(text, text, text, text, text, uuid, timestamptz, jsonb, text);
drop function if exists public.apple_expirar_vencidas();
drop function if exists public.apple_assinatura_gravar(uuid, text, text, text, timestamptz, timestamptz, text, timestamptz, boolean, timestamptz, text, boolean);
drop function if exists public.apple_acesso_recalcular(uuid);
drop function if exists public.vant_plano_pago_por_outro(uuid, text);
drop function if exists public.hotmart_plano_valido(uuid);
drop function if exists public.apple_pro_anual_valido(uuid);
drop function if exists public.apple_pro_valido(uuid);
drop function if exists public.apple_plano_valido(uuid);
drop function if exists public.apple_vale(public.apple_assinaturas);
drop function if exists public.apple_produto(text);
drop table if exists public.apple_transacoes;
drop table if exists public.apple_repasses;
drop table if exists public.apple_taxas;
drop table if exists public.apple_acesso;
drop table if exists public.apple_contas_de_teste;
drop table if exists public.apple_eventos;
drop table if exists public.apple_assinaturas;   -- its trigger and apple_assinaturas_fixar_origem go below
drop function if exists public.apple_assinaturas_fixar_origem();
-- public.acesso_suspenso is KEPT: it holds only lifted suspensions (checked above), which are history.
alter table public.orbis_pro drop column if exists cortesia, drop column if exists cortesia_ate;

commit;
