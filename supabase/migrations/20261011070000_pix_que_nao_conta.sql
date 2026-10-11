-- ============================================================
-- PIX QUE NÃO CONTA NO RANKING — 11/10/2026
-- Rick (11/10 03:40): "pix da própria conta não pode contar de nenhum jeito no
-- ranking para nenhum usuário, as regras se mantém para todos igualmente".
-- Tudo no servidor, sem opção de desligar. banco_entradas_por_dia (ranking,
-- reconciliação, fez × caiu, Foco) passa a ler só o que passa pelo classificador.
--
-- Motivos pra uma entrada NÃO contar (banco_entradas_classificadas):
--   propria     pagador é o próprio vendedor: CPF/CNPJ do perfil, dono (nome ou
--               documento) de qualquer banco que ele ligou, termo cadastrado,
--               ou o nome dele (≥2 palavras) no pagador
--   ida_volta   saiu Pix pra mesma pessoa em até 48h com 80%+ do valor
--   recorrente  o mesmo pagador manda Pix demais nos últimos 30 dias: 3+ no mesmo
--               dia, 5+ no total, ou 3+ dias somando mais de 6× o ticket → nenhum
--               Pix dele conta (cliente de todo dia pagando o ticket continua valendo)
--   vendedor    pagador é outro vendedor da Vant e o valor passa de 3× o ticket
--               (uma venda pelo ticket, uma vez, continua valendo)
--   grande      acima de R$ 500 E 20× o ticket: fica em revisão
--               (banco_entradas_revisao) até o admin liberar
-- Colunas novas: auto_detected_sales.pagador_nome/pagador_doc e
-- bank_connections.dono_nome/dono_doc (vêm da Pluggy a partir de agora).
-- Idempotente, sem comandos de apagar.
-- ============================================================

alter table public.auto_detected_sales add column if not exists pagador_nome text;
alter table public.auto_detected_sales add column if not exists pagador_doc text;
alter table public.bank_connections add column if not exists dono_nome text;
alter table public.bank_connections add column if not exists dono_doc text;

create table if not exists public.banco_entradas_revisao (
  transaction_id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  amount numeric not null,
  motivo text not null,
  status text not null default 'pendente',   -- pendente | aprovada | negada
  criado_em timestamptz not null default now(),
  decidido_em timestamptz,
  decidido_por uuid
);
alter table public.banco_entradas_revisao enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'banco_entradas_revisao' and policyname = 'revisao_admin_ve') then
    create policy revisao_admin_ve on public.banco_entradas_revisao for select to authenticated using (public.is_orbis_admin() or user_id = auth.uid());
  end if;
end $$;
revoke insert, update, delete on public.banco_entradas_revisao from anon, authenticated;

-- nome do pagador: coluna da Pluggy, senão o que dá pra tirar da descrição
create or replace function public.banco_pagador(p_nome text, p_descr text)
returns text language sql immutable set search_path to 'public' as $$
  select nullif(trim(regexp_replace(regexp_replace(lower(
           coalesce(nullif(trim(p_nome), ''),
                    nullif(trim(split_part(coalesce(p_descr, ''), '|', 2)), ''),
                    coalesce(p_descr, ''))),
           '^(pix recebido( c6)?( de)?|transfer[êe]ncia recebida\|?|pix|cr[ée]dito pix|recebimento pix)\s*', ''),
           '[0-9./-]+', ' ', 'g')), '');
$$;

-- "é a mesma pessoa?": todas as palavras (≥3 letras) de a aparecem em b, ou vice-versa, com ao menos 2 palavras
create or replace function public.banco_mesma_pessoa(a text, b text)
returns boolean language plpgsql immutable set search_path to 'public' as $$
declare pa text[]; pb text[]; w text; ok boolean := true; n int := 0;
begin
  if a is null or b is null then return false; end if;
  pa := array(select x from unnest(regexp_split_to_array(lower(a), '\s+')) x where length(x) >= 3 and x !~ '^(de|da|do|das|dos|ltda|me|mei|eireli|sa)$');
  pb := array(select x from unnest(regexp_split_to_array(lower(b), '\s+')) x where length(x) >= 3 and x !~ '^(de|da|do|das|dos|ltda|me|mei|eireli|sa)$');
  if coalesce(array_length(pa, 1), 0) < 2 or coalesce(array_length(pb, 1), 0) < 2 then return false; end if;
  -- o menor dentro do maior
  if array_length(pa, 1) > array_length(pb, 1) then declare t text[]; begin t := pa; pa := pb; pb := t; end; end if;
  foreach w in array pa loop
    n := n + 1;
    if not (w = any (pb)) then ok := false; end if;
  end loop;
  return ok and n >= 2;
end $$;

-- toda entrada do período com o motivo de não contar (null = conta)
create or replace function public.banco_entradas_classificadas(p_user uuid, p_de date, p_ate date)
returns table(id uuid, transaction_id text, bank_connection_id uuid, amount numeric, description text,
              transaction_date date, transacted_at timestamptz, created_at timestamptz, is_pix boolean,
              pagador text, motivo text)
language sql stable security definer set search_path to 'public' as $$
  with perfil as (
    select p.nickname, regexp_replace(coalesce(p.cpf, ''), '\D', '', 'g') as cpf,
           regexp_replace(coalesce(p.tax_cnpj, ''), '\D', '', 'g') as cnpj, p.pix_merchant_name,
           coalesce((select f.ticket from public.orbis_ficha f where f.user_id = p_user), 20) as ticket
      from public.profiles p where p.user_id = p_user
  ),
  donos as (
    select bc.dono_nome, regexp_replace(coalesce(bc.dono_doc, ''), '\D', '', 'g') as doc
      from public.bank_connections bc where bc.user_id = p_user and (bc.dono_nome is not null or bc.dono_doc is not null)
  ),
  base as (
    select a.id, a.transaction_id, a.bank_connection_id, a.amount, a.description, a.transaction_date, a.transacted_at, a.created_at,
           coalesce(a.is_pix, coalesce(a.description, '') ilike '%pix%' or coalesce(a.description, '') ilike 'transfer%recebid%') as is_pix,
           public.banco_eh_maquininha(a.description) as maq,
           public.banco_pagador(a.pagador_nome, a.description) as pagador,
           regexp_replace(coalesce(a.pagador_doc, ''), '\D', '', 'g') as doc,
           coalesce(a.own_transfer, false) as own_transfer,
           -- CNPJ/CPF escrito na descrição ("59.604.945 ...", "62177181 ...")
           regexp_replace(coalesce(substring(a.description from '(\d{2}\.?\d{3}\.?\d{3})'), ''), '\D', '', 'g') as doc_descr
      from public.auto_detected_sales a
     where a.user_id = p_user
       and a.transaction_date between p_de - 2 and p_ate + 2
       and coalesce(a.status, 'pending') <> 'ignored'
  ),
  -- pagador que manda Pix demais (30 dias antes do fim do período)
  por_dia as (
    select public.banco_pagador(a.pagador_nome, a.description) as pagador, a.transaction_date as d, count(*) as cnt, sum(a.amount) as total
      from public.auto_detected_sales a
     where a.user_id = p_user and a.transaction_date between p_ate - 30 and p_ate + 2
       and coalesce(a.status, 'pending') <> 'ignored'
       and public.banco_pagador(a.pagador_nome, a.description) ~ '[a-z]{3,}.*[a-z]{3,}'   -- nome de gente, não "pix recebido"
       and not public.banco_eh_maquininha(a.description)
     group by 1, 2
  ),
  -- cliente de todo dia pagando o ticket continua valendo; quem manda muito (em dias ou em valor) não
  recorrentes as (
    select pd.pagador from por_dia pd cross join perfil pf
     group by pd.pagador, pf.ticket
    having max(pd.cnt) >= 3
        or sum(pd.cnt) >= 5
        or (count(*) >= 3 and sum(pd.total) > 6 * pf.ticket)
  ),
  classificada as (
    select b.*, pf.ticket,
      case
        when not (b.is_pix or b.maq) then 'nao_e_venda'
        when public.banco_nao_e_venda(b.description) then 'reembolso'
        when b.own_transfer then 'propria'
        when b.doc <> '' and (b.doc = pf.cpf or b.doc = pf.cnpj or exists (select 1 from donos d where d.doc <> '' and (d.doc = b.doc or left(d.doc, 8) = left(b.doc, 8)))) then 'propria'
        when b.doc_descr <> '' and (left(pf.cnpj, 8) = b.doc_descr or left(pf.cpf, 8) = b.doc_descr or exists (select 1 from donos d where left(d.doc, 8) = b.doc_descr)) then 'propria'
        when exists (select 1 from donos d where public.banco_mesma_pessoa(d.dono_nome, b.pagador)) then 'propria'
        when public.banco_mesma_pessoa(pf.nickname, b.pagador) or public.banco_mesma_pessoa(pf.pix_merchant_name, b.pagador) then 'propria'
        when exists (select 1 from public.open_finance_contas_proprias cp where cp.user_id = p_user and b.description ilike '%' || cp.termo || '%') then 'propria'
        when b.maq then null
        when not public.banco_conta_de_venda(b.bank_connection_id, coalesce(b.transacted_at, b.created_at)) then 'conta_pessoal'
        when exists (
          select 1 from public.extrato_lancamentos e
           where e.user_id = p_user and e.tipo = 'saida'
             and e.data between b.transaction_date - 2 and b.transaction_date + 2
             and e.valor >= b.amount * 0.8
             and public.banco_mesma_pessoa(coalesce(e.pessoa, e.comerciante, e.descricao), b.pagador)) then 'ida_volta'
        when b.pagador in (select r.pagador from recorrentes r) then 'recorrente'
        when b.amount > greatest(500, 20 * pf.ticket)
             and not exists (select 1 from public.banco_entradas_revisao rv where rv.transaction_id = b.transaction_id and rv.status = 'aprovada') then 'grande'
        when b.amount > greatest(60, 3 * pf.ticket) and exists (
          select 1 from public.profiles o
           where o.user_id <> p_user and o.nickname is not null and public.banco_mesma_pessoa(o.nickname, b.pagador)) then 'vendedor'
        else null
      end as motivo
    from base b cross join perfil pf
  )
  select c.id, c.transaction_id, c.bank_connection_id, c.amount, c.description, c.transaction_date, c.transacted_at, c.created_at,
         c.is_pix, c.pagador, c.motivo
    from classificada c;
$$;
revoke all on function public.banco_entradas_classificadas(uuid, date, date) from public, anon, authenticated;

-- o que caiu por dia: só o que o classificador deixou passar
create or replace function public.banco_entradas_por_dia(p_user uuid, p_de date, p_ate date)
returns table(dia date, pix numeric, maquininha numeric, total numeric, qtd integer, ultimo timestamptz)
language sql stable security definer set search_path to 'public' as $$
  with sess as (
    select cs.date as d, min(cs.started_at) as ini
    from public.challenge_sessions cs
    where cs.user_id = p_user and cs.started_at is not null
      and cs.date between p_de - 3 and p_ate + 3
    group by cs.date
  ),
  vendeu as (
    select ds.date as d from public.daily_sales ds
     where ds.user_id = p_user and ds.date between p_de - 3 and p_ate + 3
       and coalesce(ds.total_profit, 0) + coalesce(ds.total_debt, 0) > 0
    union
    select s.d from sess s
  ),
  base as (
    select a.amount, a.transaction_date, a.transaction_id, a.bank_connection_id,
           public.banco_eh_maquininha(a.description) and not coalesce(a.is_pix, false) as maq,
           coalesce(a.transacted_at,
             case when (a.created_at at time zone 'America/Sao_Paulo')::date <= a.transaction_date + 1 then a.created_at end) as quando
    from public.banco_entradas_classificadas(p_user, p_de, p_ate) a
    where a.motivo is null
      -- o mesmo Pix lido por duas conexões conta uma vez só
      and not exists (
        select 1 from public.auto_detected_sales b
         where b.user_id = p_user
           and b.bank_connection_id is distinct from a.bank_connection_id
           and b.amount = a.amount and b.transaction_date = a.transaction_date
           and lower(coalesce(b.description, '')) = lower(coalesce(a.description, ''))
           and coalesce(b.status, 'pending') <> 'ignored'
           and public.banco_conta_de_venda(b.bank_connection_id, coalesce(b.transacted_at, b.created_at))
           and ((b.transacted_at is not null and a.transacted_at is null)
                or ((b.transacted_at is null) = (a.transacted_at is null) and b.transaction_id < a.transaction_id)))
  ),
  tx as (
    select x.amount, x.maq, x.quando,
           (x.quando at time zone 'America/Sao_Paulo')::date as dia_cal,
           (x.quando at time zone 'America/Sao_Paulo')::time as hora,
           (select s.d from sess s
             where x.quando is not null and s.ini <= x.quando
               and x.quando < (((s.d + 2)::timestamp) at time zone 'America/Sao_Paulo')
             order by s.ini desc limit 1) as dia_defcon,
           x.transaction_date
    from base x
  ),
  atribuido as (
    select t.amount, t.maq, t.quando,
           case
             when t.quando is null then t.transaction_date
             when t.dia_defcon is not null and t.dia_cal > t.dia_defcon and t.hora >= time '06:00'
                  and exists (select 1 from vendeu v where v.d = t.dia_cal) then t.dia_cal
             when t.dia_defcon is not null then t.dia_defcon
             else t.dia_cal
           end as dia
    from tx t
  )
  select a.dia,
         coalesce(sum(a.amount) filter (where not a.maq), 0)::numeric,
         coalesce(sum(a.amount) filter (where a.maq), 0)::numeric,
         sum(a.amount)::numeric,
         count(*)::int,
         max(a.quando)
  from atribuido a
  where a.dia between p_de and p_ate
  group by a.dia;
$$;
revoke all on function public.banco_entradas_por_dia(uuid, date, date) from public, anon, authenticated;

-- Pix grande entra na fila de revisão (roda na virada do ranking, de hora em hora)
create or replace function public.banco_revisao_registrar()
returns integer language plpgsql security definer set search_path to 'public' as $$
declare hoje date := (now() at time zone 'America/Sao_Paulo')::date; u uuid; n int := 0;
begin
  for u in select distinct bc.user_id from public.bank_connections bc where coalesce(bc.status, '') <> 'deleted' loop
    insert into public.banco_entradas_revisao (transaction_id, user_id, amount, motivo)
    select c.transaction_id, u, c.amount, c.motivo
      from public.banco_entradas_classificadas(u, hoje - 7, hoje) c
     where c.motivo = 'grande'
    on conflict (transaction_id) do nothing;
    n := n + 1;
  end loop;
  return n;
end $$;
revoke all on function public.banco_revisao_registrar() from public, anon, authenticated;

-- admin: libera (ou nega) um Pix grande; ranking recalcula na hora
create or replace function public.admin_banco_revisao_decidir(p_transaction_id text, p_aprovar boolean)
returns void language plpgsql security definer set search_path to 'public' as $$
declare u uuid; d date; m text;
begin
  if not public.is_orbis_admin() then raise exception 'apenas admin'; end if;
  update public.banco_entradas_revisao
     set status = case when p_aprovar then 'aprovada' else 'negada' end, decidido_em = now(), decidido_por = auth.uid()
   where transaction_id = p_transaction_id
  returning user_id into u;
  if u is null then return; end if;
  select a.transaction_date into d from public.auto_detected_sales a where a.transaction_id = p_transaction_id;
  m := to_char(coalesce(d, (now() at time zone 'America/Sao_Paulo')::date), 'YYYY-MM');
  perform public.ranking_atualizar(u, m);
  perform public.recalculate_ranking_positions(m);
end $$;
revoke all on function public.admin_banco_revisao_decidir(text, boolean) from public, anon;
grant execute on function public.admin_banco_revisao_decidir(text, boolean) to authenticated;

-- admin: o que foi barrado nos últimos dias, com o motivo
create or replace function public.admin_banco_barrados(p_dias integer default 7)
returns table(nickname text, user_id uuid, dia date, amount numeric, pagador text, motivo text, transaction_id text, revisao text)
language sql stable security definer set search_path to 'public' as $$
  select pp.nickname, bc.user_id, c.transaction_date, c.amount, c.pagador, c.motivo, c.transaction_id,
         (select rv.status from public.banco_entradas_revisao rv where rv.transaction_id = c.transaction_id)
    from (select distinct b.user_id from public.bank_connections b where coalesce(b.status, '') <> 'deleted') bc
    join public.public_profiles pp on pp.user_id = bc.user_id
    cross join lateral public.banco_entradas_classificadas(bc.user_id,
                 (now() at time zone 'America/Sao_Paulo')::date - greatest(1, least(coalesce(p_dias, 7), 60)),
                 (now() at time zone 'America/Sao_Paulo')::date) c
   where public.is_orbis_admin()
     and c.motivo is not null and c.motivo not in ('nao_e_venda', 'conta_pessoal')
   order by c.transaction_date desc, pp.nickname;
$$;
revoke all on function public.admin_banco_barrados(integer) from public, anon;
grant execute on function public.admin_banco_barrados(integer) to authenticated;

-- a virada do ranking também registra os Pix grandes pra revisão
create or replace function public.ranking_virada()
returns integer language plpgsql security definer set search_path to 'public' as $$
declare
  hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  m text;
  u uuid;
  n integer := 0;
begin
  begin perform public.banco_revisao_registrar(); exception when others then raise notice 'revisao: %', sqlerrm; end;
  foreach m in array array[to_char(hoje - 1, 'YYYY-MM'), to_char(hoje, 'YYYY-MM')] loop
    for u in
      select distinct bc.user_id from public.bank_connections bc
        join public.leaderboard_stats ls on ls.user_id = bc.user_id and ls.mes_referencia = m
       where coalesce(bc.status, '') <> 'deleted'
    loop
      perform public.ranking_atualizar(u, m);
      n := n + 1;
    end loop;
    perform public.recalculate_ranking_positions(m);
  end loop;
  return n;
end $$;
revoke all on function public.ranking_virada() from public, anon, authenticated;

-- acerta o ranking de todo mundo com a regra nova
select public.ranking_virada();
