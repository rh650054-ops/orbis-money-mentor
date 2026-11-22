-- Etapa 1 (22/11/2026): conta_teste_zerar wipes the production history and the recipe log of the
-- TEST account it runs for, and nothing of anybody else. The reset must leave the account able to
-- start over (same idempotency keys usable again) with no leftovers pointing at deleted products.

-- What conta_teste_zerar needs that the trimmed test schema lacks (columns as in production).
create table if not exists public.contas_teste (user_id uuid primary key, criado_em timestamptz default now());
alter table public.profiles
  add column if not exists onboarding_completed boolean, add column if not exists onboarding_step integer,
  add column if not exists trial_start date, add column if not exists trial_end date,
  add column if not exists trial_started_at timestamptz, add column if not exists trial_days_remaining integer,
  add column if not exists is_trial_active boolean, add column if not exists plan_status text,
  add column if not exists plan_type text, add column if not exists monthly_goal numeric,
  add column if not exists weekly_goal numeric, add column if not exists base_daily_goal numeric,
  add column if not exists daily_sales_goal numeric, add column if not exists goal_hours numeric,
  add column if not exists weekly_work_days integer, add column if not exists week_start_date date,
  add column if not exists goal_timer_active boolean, add column if not exists goal_timer_started_at timestamptz,
  add column if not exists must_change_password boolean;

create temp table f (k text primary key, id uuid);
create or replace function pg_temp.id(p text) returns uuid language sql as $$ select id from f where k = p $$;
create or replace function pg_temp.tudo(p_user uuid) returns numeric language sql as $$
  select (select count(*) from public.producao_registros where user_id = p_user) + (select count(*) from public.producao_eventos where user_id = p_user)
       + (select count(*) from public.producao_itens where user_id = p_user) + (select count(*) from public.producao_consumos where user_id = p_user)
       + (select count(*) from public.producao_movimentos where user_id = p_user) + (select count(*) from public.receita_alteracoes where user_id = p_user)
       + (select count(*) from public.products where user_id = p_user) + (select count(*) from public.ingredients where user_id = p_user)
       + (select count(*) from public.product_recipes where user_id = p_user) + (select count(*) from public.product_variants where user_id = p_user)
$$;
create or replace function pg_temp.foto(p_user uuid) returns text language sql as $$
  select md5(concat_ws('|',
    (select string_agg(x::text, ',' order by x::text) from public.producao_eventos x where user_id = p_user),
    (select string_agg(x::text, ',' order by x::text) from public.producao_movimentos x where user_id = p_user),
    (select string_agg(x::text, ',' order by x::text) from public.receita_alteracoes x where user_id = p_user),
    (select string_agg(x::text, ',' order by x::text) from public.products x where user_id = p_user),
    (select string_agg(x::text, ',' order by x::text) from public.ingredients x where user_id = p_user)))
$$;
-- A full life for one account: recipe, flavour, production, correction, undo, recipe edits.
create or replace function pg_temp.vida(p_user uuid, p_sufixo text) returns void language plpgsql as $$
declare p uuid; v uuid; g uuid; r jsonb;
begin
  perform t.logar(p_user);
  insert into public.ingredients (user_id, name, unit, stock_quantity) values (p_user, 'Leite', 'L', 100) returning id into g;
  insert into public.products (user_id, name, recipe_mode, batch_yield) values (p_user, 'Geladinho', 'batch', 10) returning id into p;
  insert into public.product_variants (user_id, product_id, name) values (p_user, p, 'Uva') returning id into v;
  insert into public.product_recipes (user_id, product_id, ingredient_id, quantity) values (p_user, p, g, 1);
  r := public.producao_registrar('vida-a-' || p_sufixo, jsonb_build_array(jsonb_build_object('produto', p, 'sabor', v, 'unidades', 20)));
  perform public.producao_corrigir((r->>'registro_id')::uuid, 'vida-b-' || p_sufixo, jsonb_build_array(jsonb_build_object('produto', p, 'sabor', v, 'unidades', 10)), null, 'contei errado');
  perform public.producao_desfazer((r->>'registro_id')::uuid, 'vida-c-' || p_sufixo, 'era teste');
  update public.product_recipes set quantity = 2 where product_id = p;
  update public.products set batch_yield = 20 where id = p;   -- more units per batch: a reduction
  perform public.producao_registrar('vida-d-' || p_sufixo, jsonb_build_array(jsonb_build_object('produto', p, 'unidades', 5)), null, null, 'receita nova da loja');
end $$;

do $$
declare tst uuid := t.vendedor('Conta de Teste'); real uuid := t.vendedor('Conta Real');
begin
  insert into f values ('teste', tst), ('real', real);
  insert into public.contas_teste (user_id) values (tst);
end $$;
select pg_temp.vida(pg_temp.id('teste'), 't');
select pg_temp.vida(pg_temp.id('real'), 'r');
select pg_temp.foto(pg_temp.id('real')) as foto_real \gset

select t.verdade('setup: the test account has production, events of every kind, ledger and recipe log',
  (select count(distinct tipo) = 3 from public.producao_eventos where user_id = pg_temp.id('teste'))
  and exists (select 1 from public.receita_alteracoes where user_id = pg_temp.id('teste') and reduz));

-- ---------------------------------------------------------------- a real account cannot reset itself
select t.logar(pg_temp.id('real'));
select t.verdade('a real account calling the reset: refused (returns false)', public.conta_teste_zerar() = false);
select t.verdade('...and nothing of it changed', pg_temp.foto(pg_temp.id('real')) = :'foto_real');

-- ---------------------------------------------------------------- the reset
select t.logar(pg_temp.id('teste'));
select t.verdade('the test account resets', public.conta_teste_zerar());
select t.igual('reset: no production, event, item, consumption, ledger, recipe log, product, ingredient, recipe or flavour left', pg_temp.tudo(pg_temp.id('teste')), 0);
select t.igual('reset: the recipe rows it deleted did not write new log rows', (select count(*) from public.receita_alteracoes where user_id = pg_temp.id('teste')), 0);
select t.verdade('reset: the profile is back to the start', (select onboarding_completed = false and plan_status = 'trial' from public.profiles where user_id = pg_temp.id('teste')));
select t.verdade('reset: the real account is byte-for-byte the same', pg_temp.foto(pg_temp.id('real')) = :'foto_real');
select t.verdade('reset: no history row is left without its account or pointing at a wiped account',
  not exists (select 1 from public.producao_eventos e where not exists (select 1 from public.producao_registros r where r.id = e.registro_id)));

-- ---------------------------------------------------------------- starting over
select pg_temp.vida(pg_temp.id('teste'), 't');
select t.verdade('after the reset the same idempotency keys work again (fresh account)',
  (select count(*) = 4 from public.producao_eventos where user_id = pg_temp.id('teste') and chave like 'vida-%-t'));
select t.verdade('the second life is complete (status desfeita on the first, ativa on the last)',
  (select array_agg(status order by criado_em) = array['desfeita', 'ativa'] from public.producao_registros where user_id = pg_temp.id('teste')));
select t.verdade('outside the reset the history is still immutable',
  t.erro(format('delete from public.producao_eventos where user_id = %L', pg_temp.id('teste'))) like 'VANT_HISTORICO_IMUTAVEL|%');
