-- 27/11/2026 (Rick): the money side of the Apple subscriptions, the commercial origin of each one and
-- the isolation of the Sandbox. DRAFT of Etapa 2. NOT applied to production: only with Rick's
-- authorisation. Needs 20261127120000 and 20261127121000. Rollback: supabase/direitos-apple/rollback.sql.
-- Tests: supabase/tests/casos/47..48.
--
-- Four different numbers that are never mixed here:
--   faturamento   what customers paid (gross), by the date of the purchase or renewal
--   MRR           what the subscriptions valid TODAY are worth per month (annual / 12)
--   a receber     the estimated net of what Apple has not paid out yet
--   caixa         what actually arrived in the bank (apple_repasses), typed in from Apple's statement
-- The Apple fee is an ESTIMATE (apple_taxas, by date) until the payout is recorded.
-- Sandbox: every row carries its environment and every reader below takes Production only.
-- Commissions: the commercial origin is RECORDED on each Apple subscription. Nothing here computes
-- or pays a commission (Rick: the calculation base and the attribution policy are not decided yet).

-- ---------------------------------------------------------------------------------- test accounts
create or replace function public.apple_conta_de_teste(p_user uuid)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists (select 1 from public.apple_contas_de_teste t where t.user_id = p_user);
$$;

-- A test account is fictional by definition: it is refused when the account has any commercial life
-- (a Hotmart purchase, a partner origin, an open CRM card), so no Sandbox purchase can ever reach a
-- commission, a funnel or a revenue figure through it.
create or replace function public.apple_conta_de_teste_registrar(p_user uuid, p_motivo text)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare v_motivo text := btrim(coalesce(p_motivo, '')); v_porque text;
begin
  if auth.role() is distinct from 'service_role' and not public.is_orbis_admin() then raise exception 'apenas admin'; end if;
  if length(v_motivo) < 5 then raise exception 'Escreva o motivo (pelo menos 5 letras).'; end if;
  if not exists (select 1 from public.profiles where user_id = p_user) then raise exception 'perfil não encontrado'; end if;
  v_porque := case
    when exists (select 1 from public.subscriptions s where s.user_id = p_user) then 'tem assinatura Hotmart'
    when exists (select 1 from public.orbis_hotmart_assinatura a where a.user_id = p_user) then 'tem compra na Hotmart'
    when exists (select 1 from public.bancos_extra_compras b where b.user_id = p_user and b.chave not like 'apple:%') then 'tem banco adicional da Hotmart'
    when exists (select 1 from public.orbis_pro o where o.user_id = p_user and o.origem = 'hotmart') then 'tem Pro da Hotmart'
    when exists (select 1 from public.apple_assinaturas a where a.user_id = p_user and a.ambiente = 'Production') then 'tem assinatura Apple de producao'
    when exists (select 1 from public.profiles p where p.user_id = p_user and nullif(btrim(coalesce(p.origem_ref, '')), '') is not null) then 'tem origem de parceiro'
    when exists (select 1 from public.orbis_atribuicao a where a.user_id = p_user) then 'tem atribuicao de parceiro'
    when exists (select 1 from public.crm_cartoes c where c.user_id = p_user and c.status = 'aberto') then 'tem cartao aberto no CRM'
  end;
  if v_porque is not null then
    raise exception 'Conta com vida comercial nao pode ser conta de teste da Apple: %.', v_porque;
  end if;
  insert into public.apple_contas_de_teste (user_id, motivo) values (p_user, v_motivo)
  on conflict (user_id) do update set motivo = excluded.motivo;
  return jsonb_build_object('ok', true);
end $$;

-- Leaving the list ends every right a Sandbox purchase was giving to the account.
create or replace function public.apple_conta_de_teste_remover(p_user uuid)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
begin
  if auth.role() is distinct from 'service_role' and not public.is_orbis_admin() then raise exception 'apenas admin'; end if;
  delete from public.apple_contas_de_teste where user_id = p_user;
  if exists (select 1 from public.apple_assinaturas where user_id = p_user) then
    perform public.apple_acesso_recalcular(p_user);
  end if;
  return jsonb_build_object('ok', true);
end $$;

revoke all on function public.apple_conta_de_teste(uuid) from public, anon, authenticated;
grant execute on function public.apple_conta_de_teste(uuid) to service_role;
revoke all on function public.apple_conta_de_teste_registrar(uuid, text), public.apple_conta_de_teste_remover(uuid) from public, anon;
grant execute on function public.apple_conta_de_teste_registrar(uuid, text), public.apple_conta_de_teste_remover(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------------- commercial origin
-- Who brought the customer, fixed when the Apple subscription is first stored, from what the account
-- already carries (the origin stamp of the sign-up and the partner attribution). Never from the app.
alter table public.apple_assinaturas add column if not exists origem_ref text,
  add column if not exists parceiro_code text, add column if not exists parceiro_prova text,
  add column if not exists origem_fixada_em timestamptz;

create or replace function public.apple_assinaturas_fixar_origem()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  select nullif(upper(btrim(p.origem_ref)), '') into new.origem_ref from public.profiles p where p.user_id = new.user_id;
  select nullif(upper(btrim(a.code)), ''), a.prova into new.parceiro_code, new.parceiro_prova
    from public.orbis_atribuicao a where a.user_id = new.user_id limit 1;
  if new.origem_ref is not null or new.parceiro_code is not null then new.origem_fixada_em := now(); end if;
  return new;
end $$;
drop trigger if exists apple_assinaturas_fixar_origem on public.apple_assinaturas;
create trigger apple_assinaturas_fixar_origem before insert on public.apple_assinaturas
  for each row execute function public.apple_assinaturas_fixar_origem();
revoke all on function public.apple_assinaturas_fixar_origem() from public, anon, authenticated;

-- ---------------------------------------------------------------------------------- the ledger
-- Apple's fee as a share of the price, by date. An estimate: the real figure is the payout.
create table if not exists public.apple_taxas (
  vigente_de date primary key,
  percentual numeric(6, 4) not null check (percentual >= 0 and percentual < 1),
  motivo text not null check (length(btrim(motivo)) >= 5),
  criado_em timestamptz not null default now()
);
insert into public.apple_taxas (vigente_de, percentual, motivo)
values ('2026-01-01', 0.2573, 'Estimativa antes do Small Business Program: o App Store Connect mostrou ~74,27% do preco como receita em 26/11/2026')
on conflict do nothing;

create or replace function public.apple_taxa_em(p_quando timestamptz)
returns numeric language sql stable security definer set search_path to 'public' as $$
  select t.percentual from public.apple_taxas t
   where t.vigente_de <= (p_quando at time zone 'America/Sao_Paulo')::date
   order by t.vigente_de desc limit 1;
$$;

-- What Apple actually paid, typed in from the App Store Connect payments page. This is cash.
create table if not exists public.apple_repasses (
  id uuid primary key default gen_random_uuid(),
  periodo_inicio date not null,
  periodo_fim date not null check (periodo_fim >= periodo_inicio),
  valor_recebido numeric(12, 2) not null check (valor_recebido >= 0),
  moeda text not null default 'BRL',
  recebido_em date not null,
  referencia text,
  registrado_por uuid,
  criado_em timestamptz not null default now(),
  unique (periodo_inicio, periodo_fim)
);

-- One row per Apple transaction (the first purchase and each renewal are separate transactions).
create table if not exists public.apple_transacoes (
  transaction_id text primary key check (transaction_id ~ '^[0-9A-Za-z._-]{1,64}$'),
  original_transaction_id text not null,
  user_id uuid references auth.users (id) on delete set null,   -- the money record outlives the account
  produto text not null,
  ambiente text not null check (ambiente in ('Production', 'Sandbox')),
  origem_pagamento text not null default 'apple' check (origem_pagamento = 'apple'),
  motivo text not null check (motivo in ('compra', 'renovacao', 'outro')),
  comprado_em timestamptz not null,             -- date of the purchase or of the renewal
  periodo_ate timestamptz,                      -- end of the period it paid for = date of the next renewal
  moeda text,
  valor_bruto numeric(12, 2),                   -- what the customer paid (null when Apple did not sign a price)
  taxa_percentual numeric(6, 4),
  taxa_estimada numeric(12, 2),
  liquido_estimado numeric(12, 2),
  liquido_informado numeric(12, 2),             -- per-transaction figure from Apple's report, when typed in
  reembolsado_em timestamptz,
  reembolso_motivo text,
  substituida boolean not null default false,   -- replaced by an upgrade: Apple returns part of it
  loja text,
  oferta text,
  origem_ref text,                              -- commercial origin, copied from the subscription
  parceiro_code text,
  assinado_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists apple_transacoes_original_idx on public.apple_transacoes (original_transaction_id, comprado_em desc);
create index if not exists apple_transacoes_comprado_idx on public.apple_transacoes (ambiente, comprado_em);

alter table public.apple_taxas enable row level security;
alter table public.apple_repasses enable row level security;
alter table public.apple_transacoes enable row level security;
revoke all on public.apple_taxas, public.apple_repasses, public.apple_transacoes from public, anon, authenticated;
grant select, insert, update, delete on public.apple_taxas, public.apple_repasses, public.apple_transacoes to service_role;

-- The only door that writes the ledger. Called by the server with what Apple SIGNED (price in
-- thousandths of the currency unit, dates, refund). Same transaction again = the same row:
--   registrada | atualizada | reembolso_registrado | reembolso_revertido
-- Amounts are fixed at the first write (with the fee of the purchase date) and never erased; a
-- refund only marks the row.
create or replace function public.apple_transacao_registrar(
  p_transacao text, p_original text, p_user uuid, p_produto text, p_ambiente text, p_comprado timestamptz,
  p_periodo_ate timestamptz default null, p_preco_milesimos bigint default null, p_moeda text default null,
  p_motivo text default null, p_reembolsado timestamptz default null, p_reembolso_motivo text default null,
  p_substituida boolean default false, p_loja text default null, p_oferta text default null, p_assinado timestamptz default null)
returns text language plpgsql security definer set search_path to 'public' as $$
declare
  x public.apple_transacoes;
  a public.apple_assinaturas;
  v_bruto numeric(12, 2) := round(p_preco_milesimos / 1000.0, 2);
  v_taxa numeric(6, 4);
  v_motivo text := case upper(coalesce(p_motivo, '')) when 'PURCHASE' then 'compra' when 'RENEWAL' then 'renovacao' else 'outro' end;
begin
  if coalesce(p_transacao, '') = '' or coalesce(p_original, '') = '' or p_produto is null or p_comprado is null then
    raise exception 'transacao incompleta';
  end if;
  if p_ambiente is null or p_ambiente not in ('Production', 'Sandbox') then raise exception 'ambiente invalido'; end if;
  if not exists (select 1 from public.apple_produto(p_produto)) then raise exception 'produto desconhecido: %', p_produto; end if;

  perform pg_advisory_xact_lock(hashtextextended('apple-tx:' || p_transacao, 0));
  select * into x from public.apple_transacoes where transaction_id = p_transacao;
  select * into a from public.apple_assinaturas where original_transaction_id = p_original;

  if x.transaction_id is null then
    v_taxa := public.apple_taxa_em(p_comprado);
    insert into public.apple_transacoes (transaction_id, original_transaction_id, user_id, produto, ambiente, motivo, comprado_em,
        periodo_ate, moeda, valor_bruto, taxa_percentual, taxa_estimada, liquido_estimado, reembolsado_em, reembolso_motivo,
        substituida, loja, oferta, origem_ref, parceiro_code, assinado_em)
    values (p_transacao, p_original,
        coalesce(a.user_id, (select u.id from auth.users u where u.id = p_user)), p_produto, p_ambiente, v_motivo, p_comprado,
        p_periodo_ate, p_moeda, v_bruto, v_taxa, round(v_bruto * v_taxa, 2), v_bruto - round(v_bruto * v_taxa, 2),
        p_reembolsado, p_reembolso_motivo, coalesce(p_substituida, false), p_loja, p_oferta, a.origem_ref, a.parceiro_code, p_assinado);
    return case when p_reembolsado is not null then 'reembolso_registrado' else 'registrada' end;
  end if;

  if x.ambiente <> p_ambiente then return 'ambiente_diferente'; end if;
  if p_assinado is not null and x.assinado_em is not null and p_assinado < x.assinado_em then return 'antigo_ignorado'; end if;
  update public.apple_transacoes
     set user_id = coalesce(user_id, a.user_id), origem_ref = coalesce(origem_ref, a.origem_ref), parceiro_code = coalesce(parceiro_code, a.parceiro_code),
         periodo_ate = coalesce(p_periodo_ate, periodo_ate),
         reembolsado_em = p_reembolsado, reembolso_motivo = case when p_reembolsado is null then null else coalesce(p_reembolso_motivo, reembolso_motivo) end,
         substituida = substituida or coalesce(p_substituida, false),
         assinado_em = coalesce(p_assinado, assinado_em), atualizado_em = now()
   where transaction_id = p_transacao;
  return case when p_reembolsado is not null and x.reembolsado_em is null then 'reembolso_registrado'
              when p_reembolsado is null and x.reembolsado_em is not null then 'reembolso_revertido'
              else 'atualizada' end;
end $$;

create or replace function public.apple_taxa_definir(p_vigente_de date, p_percentual numeric, p_motivo text)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
begin
  if auth.role() is distinct from 'service_role' and not public.is_orbis_admin() then raise exception 'apenas admin'; end if;
  insert into public.apple_taxas (vigente_de, percentual, motivo) values (p_vigente_de, p_percentual, btrim(coalesce(p_motivo, '')))
  on conflict (vigente_de) do update set percentual = excluded.percentual, motivo = excluded.motivo;
  return jsonb_build_object('ok', true, 'aviso', 'vale para as transacoes registradas daqui em diante; as ja registradas guardam a taxa do dia da compra');
end $$;

create or replace function public.apple_repasse_registrar(p_inicio date, p_fim date, p_valor numeric, p_recebido_em date, p_referencia text default null)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
begin
  if auth.role() is distinct from 'service_role' and not public.is_orbis_admin() then raise exception 'apenas admin'; end if;
  insert into public.apple_repasses (periodo_inicio, periodo_fim, valor_recebido, recebido_em, referencia, registrado_por)
  values (p_inicio, p_fim, p_valor, p_recebido_em, p_referencia, auth.uid())
  on conflict (periodo_inicio, periodo_fim) do update
    set valor_recebido = excluded.valor_recebido, recebido_em = excluded.recebido_em, referencia = excluded.referencia, registrado_por = excluded.registrado_por;
  return jsonb_build_object('ok', true);
end $$;

-- ---------------------------------------------------------------------------------- the readers (admin)
-- Apple, Production only. p_de and p_ate are Brazil dates, both inclusive.
create or replace function public.receita_apple(p_de date, p_ate date)
returns jsonb language sql stable security definer set search_path to 'public' as $$
  with pode as (select auth.role() = 'service_role' or public.is_orbis_admin() as sim),
  t as (select x.*, (x.comprado_em at time zone 'America/Sao_Paulo')::date as dia,
               (x.reembolsado_em at time zone 'America/Sao_Paulo')::date as dia_reembolso
          from public.apple_transacoes x where x.ambiente = 'Production'),
  no_periodo as (select * from t where dia between p_de and p_ate),
  pago_ate as (select coalesce(max(periodo_fim), date '1900-01-01') as dia from public.apple_repasses),
  vigentes as (
    select a.original_transaction_id, a.anual, a.renova,
           (select x.valor_bruto from t x where x.original_transaction_id = a.original_transaction_id and x.reembolsado_em is null
             order by x.comprado_em desc limit 1) as bruto,
           (select x.liquido_estimado from t x where x.original_transaction_id = a.original_transaction_id and x.reembolsado_em is null
             order by x.comprado_em desc limit 1) as liquido
      from public.apple_assinaturas a where a.ambiente = 'Production' and public.apple_vale(a))
  select case when not (select sim from pode) then null else jsonb_build_object(
    'origem', 'apple', 'de', p_de, 'ate', p_ate, 'moeda', 'BRL',
    'faturamento', jsonb_build_object(
      'transacoes', (select count(*) from no_periodo),
      'compras', (select count(*) from no_periodo where motivo = 'compra'),
      'renovacoes', (select count(*) from no_periodo where motivo = 'renovacao'),
      'bruto', coalesce((select sum(valor_bruto) from no_periodo), 0),
      'taxa_apple_estimada', coalesce((select sum(taxa_estimada) from no_periodo), 0),
      'liquido_estimado', coalesce((select sum(liquido_estimado) from no_periodo), 0),
      'sem_preco_assinado', (select count(*) from no_periodo where valor_bruto is null)),
    'reembolsos', jsonb_build_object(
      'transacoes', (select count(*) from t where dia_reembolso between p_de and p_ate),
      'bruto', coalesce((select sum(valor_bruto) from t where dia_reembolso between p_de and p_ate), 0),
      'liquido_estimado', coalesce((select sum(liquido_estimado) from t where dia_reembolso between p_de and p_ate), 0)),
    'mrr', jsonb_build_object(
      'assinaturas', (select count(*) from vigentes),
      'bruto', coalesce((select round(sum(case when anual then bruto / 12 else bruto end), 2) from vigentes), 0),
      'liquido_estimado', coalesce((select round(sum(case when anual then liquido / 12 else liquido end), 2) from vigentes), 0),
      'sem_renovacao_automatica', (select count(*) from vigentes where renova is false)),
    'a_receber', jsonb_build_object(
      'desde', (select dia + 1 from pago_ate where dia > date '1900-01-01'),
      'liquido_estimado', coalesce((select sum(liquido_estimado) from t where reembolsado_em is null and dia > (select dia from pago_ate) and dia <= p_ate), 0)),
    'caixa', jsonb_build_object(
      'repasses', (select count(*) from public.apple_repasses r where r.recebido_em between p_de and p_ate),
      'recebido', coalesce((select sum(r.valor_recebido) from public.apple_repasses r where r.recebido_em between p_de and p_ate), 0))
  ) end;
$$;

-- Hotmart, Apple and both, side by side. Hotmart's figures are the ones the business already uses
-- (public._crm_compras_hotmart: gross and Hotmart's own net per payment); Apple's net is an estimate.
create or replace function public.receita_por_origem(p_de date, p_ate date)
returns jsonb language sql stable security definer set search_path to 'public' as $$
  with pode as (select auth.role() = 'service_role' or public.is_orbis_admin() as sim),
  h as (select count(*) n, coalesce(sum(c.bruto), 0) bruto, coalesce(sum(c.liquido), 0) liquido
          from public._crm_compras_hotmart c
         where (c.recebido_em at time zone 'America/Sao_Paulo')::date between p_de and p_ate),
  a as (select public.receita_apple(p_de, p_ate) as j)
  select case when not (select sim from pode) then null else jsonb_build_object(
    'de', p_de, 'ate', p_ate,
    'hotmart', jsonb_build_object('pagamentos', (select n from h), 'bruto', (select bruto from h), 'liquido', (select liquido from h)),
    'apple', (select j from a),
    'consolidado', jsonb_build_object(
      'faturamento_bruto', (select bruto from h) + coalesce(((select j from a) #>> '{faturamento,bruto}')::numeric, 0),
      'liquido', (select liquido from h) + coalesce(((select j from a) #>> '{faturamento,liquido_estimado}')::numeric, 0),
      'liquido_apple_e_estimativa', true,
      'observacao', 'faturamento por data do pagamento; nao e MRR, nem valor a receber, nem dinheiro em caixa')
  ) end;
$$;

-- Apple subscriptions and their gross by commercial origin (Production only). It identifies who
-- brought the customer. It does NOT compute a commission.
create or replace function public.apple_origem_comercial(p_de date, p_ate date)
returns jsonb language sql stable security definer set search_path to 'public' as $$
  with pode as (select auth.role() = 'service_role' or public.is_orbis_admin() as sim),
  t as (select coalesce(x.parceiro_code, x.origem_ref, '(sem origem)') as origem, x.*
          from public.apple_transacoes x
         where x.ambiente = 'Production' and (x.comprado_em at time zone 'America/Sao_Paulo')::date between p_de and p_ate),
  g as (select origem, count(distinct original_transaction_id) assinaturas, count(*) transacoes,
               coalesce(sum(valor_bruto), 0) bruto, coalesce(sum(liquido_estimado), 0) liquido_estimado,
               count(*) filter (where reembolsado_em is not null) reembolsadas
          from t group by origem)
  select case when not (select sim from pode) then null else jsonb_build_object(
    'de', p_de, 'ate', p_ate, 'comissao', 'nao calculada: base e politica ainda nao definidas',
    'origens', coalesce((select jsonb_agg(to_jsonb(g) order by g.bruto desc, g.origem) from g), '[]'::jsonb)) end;
$$;

revoke all on function public.apple_taxa_em(timestamptz),
  public.apple_transacao_registrar(text, text, uuid, text, text, timestamptz, timestamptz, bigint, text, text, timestamptz, text, boolean, text, text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.apple_taxa_em(timestamptz),
  public.apple_transacao_registrar(text, text, uuid, text, text, timestamptz, timestamptz, bigint, text, text, timestamptz, text, boolean, text, text, timestamptz)
  to service_role;
revoke all on function public.apple_taxa_definir(date, numeric, text), public.apple_repasse_registrar(date, date, numeric, date, text),
  public.receita_apple(date, date), public.receita_por_origem(date, date), public.apple_origem_comercial(date, date) from public, anon;
grant execute on function public.apple_taxa_definir(date, numeric, text), public.apple_repasse_registrar(date, date, numeric, date, text),
  public.receita_apple(date, date), public.receita_por_origem(date, date), public.apple_origem_comercial(date, date) to authenticated, service_role;

-- ---------------------------------------------------------------------------------- the indicators
-- The counters below look at "plan on" in the profile. A registered Apple test account gets its plan
-- turned on by a Sandbox purchase, so each one now leaves test accounts out. Bodies = production's
-- of 27/11/2026 plus the ONE marked condition. With no test account registered they answer as today.
-- (Revenue, MRR and commissions read Hotmart tables or the ledger above: Sandbox never reaches them.)

CREATE OR REPLACE FUNCTION public.total_assinantes_app()
 RETURNS integer
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select count(*)::int from public.profiles
  where plan_status = 'active' and coalesce(billing_exempt, false) = false
    and not public.apple_conta_de_teste(user_id);  -- 27/11
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
    and email is not null and trim(email) <> ''
    and not public.apple_conta_de_teste(user_id);  -- 27/11
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
    and not public.apple_conta_de_teste(p.user_id)  -- 27/11
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
    AND NOT public.apple_conta_de_teste(user_id)   -- 27/11: nem contas de teste da Apple
    AND (
      plan_status = 'active'                        -- assinante
      OR (
        plan_status = 'trial'                       -- teste grátis...
        AND COALESCE(trial_end, CURRENT_DATE) >= CURRENT_DATE  -- ...ainda válido
      )
    );
$function$;

-- The two questions the CRM asks before opening a card (rescue of a finished test, upgrade to Pro).
-- A test account never gets a card, so it never counts in a funnel or a conversion rate.
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
       and not public.apple_conta_de_teste(p.user_id)  -- 27/11
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
       and not public.apple_conta_de_teste(p.user_id)  -- 27/11
       and (p.plan_status = 'active'
            or exists (select 1 from public.subscriptions s
                        where s.user_id = p.user_id and s.status = 'active'
                          and coalesce(s.grace_until, s.current_period_end) >= now()))
  ) and not public.orbis_pro_ativo(p_user);
$function$;
