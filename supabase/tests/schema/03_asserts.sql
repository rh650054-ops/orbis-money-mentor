set check_function_bodies = off;  -- helpers below mention functions that are loaded right after this file
-- Tiny assertion kit, in plain SQL so a test file reads top to bottom.
--   t.igual(nome, obtido, esperado)             must hold today
--   t.verdade(nome, condicao)                   must hold today
--   t.pendente(achado, nome, obtido, esperado)  KNOWN BUG: expected to FAIL today. It is reported,
--                                               never hidden. When the fix lands it starts passing
--                                               and the runner demands promoting it to t.igual.
create schema t;
create table t.resultados (id serial primary key, nome text not null, tipo text not null, ok boolean not null, obtido text, esperado text, achado text);
create or replace function t.igual(p_nome text, p_obtido numeric, p_esperado numeric) returns void language sql as $$
  insert into t.resultados (nome, tipo, ok, obtido, esperado) values (p_nome, 'igual', p_obtido is not distinct from p_esperado, p_obtido::text, p_esperado::text)
$$;
create or replace function t.verdade(p_nome text, p_cond boolean) returns void language sql as $$
  insert into t.resultados (nome, tipo, ok, obtido, esperado) values (p_nome, 'verdade', coalesce(p_cond, false), coalesce(p_cond, false)::text, 'true')
$$;
create or replace function t.pendente(p_achado text, p_nome text, p_obtido numeric, p_esperado numeric) returns void language sql as $$
  insert into t.resultados (nome, tipo, ok, obtido, esperado, achado) values (p_nome, 'pendente', p_obtido is not distinct from p_esperado, p_obtido::text, p_esperado::text, p_achado)
$$;
-- Dates relative to "today in Brasília", because the functions under test use now().
create or replace function t.dia(p_dias_atras integer) returns date language sql stable as $$
  select (now() at time zone 'America/Sao_Paulo')::date - p_dias_atras
$$;
-- A moment on a given day, in Brasília clock: t.hora(3, '06:41') = 06:41 three days ago.
create or replace function t.hora(p_dias_atras integer, p_hhmm text) returns timestamptz language sql stable as $$
  select ((t.dia(p_dias_atras)::text || ' ' || p_hhmm)::timestamp) at time zone 'America/Sao_Paulo'
$$;
-- Become a logged-in vendor (what auth.uid() returns).
create or replace function t.logar(p_user uuid) returns void language sql as $$
  select set_config('request.jwt.claim.sub', p_user::text, false)
$$;

-- ---------------------------------------------------------------- fixture builders (fictional data)
-- A vendor: profile, average ticket and (optionally) the Pro plan that allows Open Finance.
create or replace function t.vendedor(p_apelido text, p_ticket numeric default 12, p_pro boolean default true, p_verificado boolean default true)
returns uuid language plpgsql as $$
declare u uuid := gen_random_uuid();
begin
  insert into public.profiles (user_id, nickname, verificado) values (u, p_apelido, p_verificado);
  insert into public.orbis_ficha (user_id, ticket) values (u, p_ticket);
  if p_pro then insert into public.teste_pro values (u); end if;
  return u;
end $$;
-- A bank connection. p_leitura_ok = when the app last stamped "bank read" (null = never).
create or replace function t.conexao(p_user uuid, p_banco text, p_criada timestamptz, p_status text default 'UPDATED', p_leitura_ok timestamptz default now())
returns uuid language sql as $$
  insert into public.bank_connections (user_id, item_id, institution_name, status, created_at, papel, leitura_ok_em, last_synced_at)
  values (p_user, 'item-' || gen_random_uuid(), p_banco, p_status, p_criada, 'trabalho', p_leitura_ok, p_leitura_ok)
  returning id
$$;
-- The holder and the accounts Pluggy lists for a connection (what tells one account from another).
create or replace function t.titular(p_conexao uuid, p_dono text, variadic p_contas text[] default '{}')
returns void language plpgsql as $$
begin
  update public.bank_connections set dono_nome = p_dono where id = p_conexao;
  insert into public.bank_saldos (conta_id, user_id, bank_connection_id, nome)
  select 'conta-' || gen_random_uuid(), bc.user_id, bc.id, n from public.bank_connections bc, unnest(p_contas) n where bc.id = p_conexao;
end $$;
-- One Pix credit as the importer stores it. Every call is a NEW transaction id, like a new Pluggy item.
create or replace function t.pix(p_conexao uuid, p_quando timestamptz, p_valor numeric, p_pagador text)
returns void language sql as $$
  insert into public.auto_detected_sales (user_id, bank_connection_id, transaction_id, amount, description, transaction_date, transacted_at, is_pix)
  select bc.user_id, bc.id, 'tx-' || gen_random_uuid(), p_valor, 'Pix recebido de ' || p_pagador,
         (p_quando at time zone 'America/Sao_Paulo')::date, p_quando, true
    from public.bank_connections bc where bc.id = p_conexao
$$;
-- A closed Foco day: the session, what the vendor tapped (Pix and cash) and the day row the app writes.
create or replace function t.foco(p_user uuid, p_dias_atras integer, p_inicio text, p_fim text, p_pix numeric, p_dinheiro numeric default 0)
returns void language plpgsql as $$
declare s uuid := gen_random_uuid();
begin
  insert into public.challenge_sessions (id, user_id, date, status, daily_goal, total_sold, started_at, ended_at)
  values (s, p_user, t.dia(p_dias_atras), 'completed', 100, p_pix + p_dinheiro, t.hora(p_dias_atras, p_inicio), t.hora(p_dias_atras, p_fim));
  if p_pix > 0 then insert into public.defcon_sales (user_id, session_id, amount, method) values (p_user, s, p_pix, 'pix'); end if;
  if p_dinheiro > 0 then insert into public.defcon_sales (user_id, session_id, amount, method) values (p_user, s, p_dinheiro, 'dinheiro'); end if;
  insert into public.daily_sales (user_id, date, total_profit, pix_sales, cash_sales, total_debt)
  values (p_user, t.dia(p_dias_atras), p_pix + p_dinheiro, p_pix, p_dinheiro, 0);
end $$;
-- What the bank counts as sales on a day (Dia de Vendas).
create or replace function t.caiu(p_user uuid, p_dias_atras integer) returns numeric language sql as $$
  select coalesce((select sum(x.total) from public.banco_entradas_por_dia(p_user, t.dia(p_dias_atras), t.dia(p_dias_atras)) x), 0)
$$;
-- How many rows a query returns when run AS another role and user; -1 = permission denied.
create or replace function t.linhas_como(p_role text, p_user uuid, p_sql text) returns integer language plpgsql as $$
declare n integer;
begin
  perform set_config('request.jwt.claim.sub', p_user::text, true);
  execute format('set local role %I', p_role);
  begin
    execute 'select count(*) from (' || p_sql || ') q' into n;
  exception when insufficient_privilege then n := -1;
  end;
  reset role;
  return n;
end $$;
