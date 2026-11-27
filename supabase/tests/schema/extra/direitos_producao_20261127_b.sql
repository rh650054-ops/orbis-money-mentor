-- 27/11/2026 (second part): more functions exactly as they run in PRODUCTION today, for the cases
-- casos/44..49. Same rules as direitos_producao_20261127.sql: NOT loaded into the base test database,
-- copied from the production catalog, every body checked by fingerprint (casos/44, assertion F0).
-- The tables below are stand-ins with production's column names; they hold fictional rows only.
set check_function_bodies = off;

alter table public.profiles add column if not exists comp_label text;
create table if not exists public.leads (id bigint generated always as identity primary key, nome text, email text, ref text, whatsapp text, created_at timestamptz not null default now());
create table if not exists public.crm_equipe (user_id uuid primary key);
-- production: a view over the Hotmart events; here a table with the same columns
create table if not exists public._crm_compras_hotmart (purchase_id text, user_id uuid, subscription_id text, recebido_em timestamptz, renovacao boolean, bruto numeric, liquido numeric);
create table if not exists public.assinatura_manual (id uuid primary key default gen_random_uuid(), user_id uuid not null, feito_por uuid,
  acao text not null check (acao in ('ativar', 'desativar')), motivo text not null check (length(btrim(motivo)) >= 5), created_at timestamptz not null default now());
create table if not exists public.ai_limites (chave text primary key, valor text not null);
insert into public.ai_limites values ('chat_limite_anual', '200'), ('chat_limite_pro', '100'), ('chat_limite_essencial', '30'), ('chat_limite_trial', '10') on conflict do nothing;
create table if not exists public.orbis_atribuicao (user_id uuid primary key, code text not null, prova text);
create table if not exists public.crm_cartoes (id uuid primary key default gen_random_uuid(), pipeline text not null, etapa text, status text not null default 'aberto', user_id uuid, ref text,
  criado_em timestamptz default now(), etapa_desde timestamptz, fechado_em timestamptz, atualizado_em timestamptz);
create or replace function public.orbis_is_admin_user(p_user uuid) returns boolean language sql stable as $$ select false $$;

-- admin_assinatura_manual = production 52e799d460
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

-- total_assinantes_app = production a9354b933f
CREATE OR REPLACE FUNCTION public.total_assinantes_app()
 RETURNS integer
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select count(*)::int from public.profiles
  where plan_status = 'active' and coalesce(billing_exempt, false) = false;
$function$;

-- lista_assinantes = production 8f6367dbb2
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

-- leads_assinantes_no_app = production 8700c8fcef
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

-- beta_vagas_preenchidas = production 6db9db3070
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

-- _crm_trial_sem_assinar = production d574837fcb
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

-- _crm_assinante_sem_pro = production b36b636e3c
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

-- vant_recursos_pro = production 9ba18c0e97 (not changed by the migrations; photographed because it reads orbis_pro_ativo)
CREATE OR REPLACE FUNCTION public.vant_recursos_pro(p_user uuid DEFAULT NULL::uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with u as (select coalesce(p_user, auth.uid()) as id)
  select (select id from u) is not null and (
    public.orbis_pro_ativo((select id from u))
    or public.orbis_is_admin_user((select id from u))
    or exists (
      select 1 from public.profiles p
       where p.user_id = (select id from u)
         and (coalesce(p.billing_exempt, false) or coalesce(p.is_demo, false)
              or (coalesce(p.is_trial_active, false) and p.trial_end >= (now() at time zone 'America/Sao_Paulo')::date))
    ));
$function$;

-- mentor_limite_dia = production f8b2afb2b3 (not changed; photographed because it reads vant_plano)
CREATE OR REPLACE FUNCTION public.mentor_limite_dia(p_user uuid DEFAULT NULL::uuid)
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce((select valor::int from public.ai_limites where chave = case public.vant_plano(p_user)
            when 'pro_anual' then 'chat_limite_anual'
            when 'equipe' then 'chat_limite_anual'
            when 'pro' then 'chat_limite_pro'
            when 'essencial_banco' then 'chat_limite_essencial'
            when 'essencial' then 'chat_limite_essencial'
            else 'chat_limite_trial' end), 10);
$function$;
