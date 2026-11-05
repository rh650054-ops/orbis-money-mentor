-- 04/11/2026 (Rick): three ranking decisions.
--  1) Connecting the bank verifies the WHOLE month: bank values count from the 1st of the month of
--     the first connection (before: only from the connection day).
--  2) Buying the bank add-on (bancos_extra_compras) counts as verified, same as Pro. One rule for
--     the seal, the ranking and the prize: ranking_pode_verificar(uid) + an active connection.
--  3) Results freeze on Sunday 23:30 (Brasília) for the week that ended on Saturday; the month
--     freezes on day 1 at 23:30. After freezing, those days stop being recalculated.

-- 1+2) one rule ---------------------------------------------------------------
create or replace function public.ranking_pode_verificar(p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.orbis_pro_ativo(p_user) or public.open_finance_teste(p_user);
$$;
revoke all on function public.ranking_pode_verificar(uuid) from public, anon;
grant execute on function public.ranking_pode_verificar(uuid) to authenticated, service_role;

create or replace function public.usuario_verificado(p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.ranking_pode_verificar(p_user)
     and exists (select 1 from public.bank_connections b
                  where b.user_id = p_user and coalesce(b.status, '') <> 'deleted');
$$;

-- the seal given by the bank webhook follows the same rule (before: any connection gave it)
create or replace function public.banco_conceder_selo(p_user uuid)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if auth.jwt() ->> 'role' is distinct from 'service_role' then
    raise exception 'so o servidor concede o selo';
  end if;
  if not public.usuario_verificado(p_user) then return false; end if;
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  update public.profiles
     set verificado = true, verificado_em = coalesce(verificado_em, now()), verificado_por = 'banco'
   where user_id = p_user and coalesce(verificado, false) = false;
  return true;
end $$;

-- auto role ("trabalho" set by the app) counts from the 1st of that month
create or replace function public.banco_conta_de_venda(p_conexao uuid, p_quando timestamptz)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.bank_connections bc
     where bc.id = p_conexao and coalesce(bc.status, '') <> 'deleted'
       and (
         bc.papel is null
         or (bc.papel = 'trabalho' and (bc.papel_desde is null or p_quando is null
             or p_quando >= case when coalesce(bc.papel_auto, false)
                                 then (date_trunc('month', bc.papel_desde at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo')
                                 else bc.papel_desde end))
         or (select count(*) from public.bank_connections o
              where o.user_id = bc.user_id and coalesce(o.status, '') <> 'deleted') = 1
       ));
$$;

create or replace function public.ranking_valor_dias(p_de date, p_ate date, p_user uuid default null)
returns table(user_id uuid, dia date, valor numeric, pelo_banco boolean)
language sql stable security definer set search_path = public as $$
  with hoje as (select (now() at time zone 'America/Sao_Paulo')::date as d),
  ofi as (
    select bc.user_id,
           greatest(date_trunc('month', min((bc.created_at at time zone 'America/Sao_Paulo')::date))::date,
                    public.ranking_banco_desde()) as desde
      from public.bank_connections bc
     where coalesce(bc.status, '') <> 'deleted'
       and (p_user is null or bc.user_id = p_user)
       and public.ranking_pode_verificar(bc.user_id)
     group by bc.user_id
  ),
  ds as (
    select d.user_id, d.date::date as dia,
           sum(coalesce(d.total_profit, 0))::numeric as recebido,
           sum(coalesce(d.total_profit, 0) + coalesce(d.total_debt, 0))::numeric as vend,
           sum(coalesce(d.cash_sales, 0))::numeric as din
      from public.daily_sales d
     where d.date::date between p_de and p_ate
       and (p_user is null or d.user_id = p_user)
     group by d.user_id, d.date::date
  ),
  lanc as (
    select cs.user_id, cs.date as dia, round(sum(s.amount), 2) as v
      from public.challenge_sessions cs
      join public.defcon_sales s on s.session_id = cs.id and not coalesce(s.late, false)
     where cs.date between p_de and p_ate and (p_user is null or cs.user_id = p_user)
     group by cs.user_id, cs.date
  ),
  elegivel as (
    select ds.user_id, ds.dia
      from ds join ofi o on o.user_id = ds.user_id
     where ds.dia >= o.desde and ds.dia < (select d from hoje)
       and exists (
         select 1 from public.bank_connections c
          where c.user_id = ds.user_id and coalesce(c.status, '') <> 'deleted'
            and c.last_synced_at >= (((ds.dia + 1)::timestamp) at time zone 'America/Sao_Paulo')
            and public.banco_conta_de_venda(c.id, null)
            and exists (select 1 from public.auto_detected_sales a where a.bank_connection_id = c.id))
  ),
  banco as (
    select o.user_id, x.dia, x.total
      from ofi o
      cross join lateral public.banco_entradas_por_dia(o.user_id, greatest(p_de, o.desde), least(p_ate, (select d from hoje) - 1)) x
     where greatest(p_de, o.desde) <= least(p_ate, (select d from hoje) - 1)
  )
  select ds.user_id, ds.dia,
         case
           when e.user_id is null then round(ds.recebido, 2)
           when exists (select 1 from public.banco_excesso_ok ok where ok.user_id = ds.user_id and ok.dia = ds.dia)
             then round(coalesce(b.total, 0), 2)
           else round(least(coalesce(b.total, 0),
                            greatest(coalesce(nullif(l.v, 0), ds.vend) - ds.din, 0) + 500), 2)
         end,
         e.user_id is not null
    from ds
    left join elegivel e on e.user_id = ds.user_id and e.dia = ds.dia
    left join banco b on b.user_id = ds.user_id and b.dia = ds.dia
    left join lanc l on l.user_id = ds.user_id and l.dia = ds.dia;
$$;

-- 3) freeze -------------------------------------------------------------------
create table if not exists public.premio_fechamento (
  tipo text not null check (tipo in ('semana', 'mes')),
  inicio date not null,
  fim date not null,
  user_id uuid not null,
  posicao integer not null,
  valor numeric not null,
  dias integer not null default 0,
  verificado boolean not null default false,
  leva_premio boolean not null default false,
  congelado_em timestamptz not null default now(),
  primary key (tipo, inicio, user_id)
);
alter table public.premio_fechamento enable row level security;
drop policy if exists premio_fechamento_ler on public.premio_fechamento;
create policy premio_fechamento_ler on public.premio_fechamento for select to authenticated using (true);
revoke insert, update, delete on public.premio_fechamento from anon, authenticated;

-- last frozen day: the hourly cache stops touching days up to it
create or replace function public.ranking_congelado_ate()
returns date language sql stable security definer set search_path = public as $$
  select max(fim) from public.premio_fechamento;
$$;

create or replace function public.ranking_cache_atualizar(p_dias integer default 45)
returns integer language plpgsql security definer set search_path = public as $$
declare
  hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_de date := greatest(hoje - greatest(p_dias, 1),
                        coalesce(public.ranking_congelado_ate() + 1, date '1900-01-01'));
  n integer;
begin
  if v_de > hoje - 1 then return 0; end if;
  create temporary table if not exists _rk (user_id uuid, dia date, valor numeric, pelo_banco boolean) on commit drop;
  truncate _rk;
  insert into _rk select r.user_id, r.dia, coalesce(r.valor, 0), coalesce(r.pelo_banco, false)
    from public.ranking_valor_dias(v_de, hoje - 1) r where r.user_id is not null and r.dia is not null;

  delete from public.ranking_dia_cache c
   where c.dia between v_de and hoje - 1
     and not exists (select 1 from _rk k where k.user_id = c.user_id and k.dia = c.dia);

  insert into public.ranking_dia_cache (user_id, dia, valor, pelo_banco, atualizado_em)
  select k.user_id, k.dia, k.valor, k.pelo_banco, now() from _rk k
  on conflict (user_id, dia) do update
    set valor = excluded.valor, pelo_banco = excluded.pelo_banco, atualizado_em = now()
    where public.ranking_dia_cache.valor is distinct from excluded.valor
       or public.ranking_dia_cache.pelo_banco is distinct from excluded.pelo_banco;
  get diagnostics n = row_count;
  return n;
end $$;

-- freezes one period: last cache refresh, then the ranking as shown in the app, with seal and winner
create or replace function public.premio_congelar(p_tipo text, p_inicio date, p_fim date)
returns integer language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  if p_tipo not in ('semana', 'mes') or p_fim < p_inicio then raise exception 'periodo invalido'; end if;
  if exists (select 1 from public.premio_fechamento where tipo = p_tipo and inicio = p_inicio) then
    return 0;  -- already frozen: never rewritten
  end if;
  perform public.ranking_cache_atualizar(45);
  perform public.selo_revisar();
  insert into public.premio_fechamento (tipo, inicio, fim, user_id, posicao, valor, dias, verificado)
  select p_tipo, p_inicio, p_fim, r.user_id,
         row_number() over (order by r.faturamento_semana desc, r.user_id)::int,
         round(r.faturamento_semana, 2), coalesce(r.dias_semana, 0), coalesce(pr.verificado, false)
    from public.get_weekly_ranking_verified(p_inicio, p_fim, false) r
    left join public.profiles pr on pr.user_id = r.user_id;
  get diagnostics n = row_count;
  update public.premio_fechamento f set leva_premio = true
   where f.tipo = p_tipo and f.inicio = p_inicio
     and f.posicao = (select min(x.posicao) from public.premio_fechamento x
                       where x.tipo = p_tipo and x.inicio = p_inicio and x.verificado and x.valor > 0);
  return n;
end $$;
revoke all on function public.premio_congelar(text, date, date) from public, anon, authenticated;
grant execute on function public.premio_congelar(text, date, date) to service_role;

-- what the cron calls: Sunday → the week Sun..Sat that just ended; day 1 → the previous month
create or replace function public.premio_congelar_agora()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  r jsonb := '{}'::jsonb;
begin
  if extract(dow from hoje) = 0 then
    r := r || jsonb_build_object('semana', public.premio_congelar('semana', hoje - 7, hoje - 1));
  end if;
  if extract(day from hoje) = 1 then
    r := r || jsonb_build_object('mes', public.premio_congelar('mes', (hoje - 1) - (extract(day from hoje - 1)::int - 1), hoje - 1));
  end if;
  return r;
end $$;
revoke all on function public.premio_congelar_agora() from public, anon, authenticated;
grant execute on function public.premio_congelar_agora() to service_role;

-- 23:30 in Brasília = 02:30 UTC of the next day (Brazil has no daylight saving)
select cron.unschedule(jobid) from cron.job where jobname = 'premio-fechamento';
select cron.schedule('premio-fechamento', '30 2 * * *', $c$ select public.premio_congelar_agora(); $c$);

-- the seal follows the rule every hour (before: only revised by hand)
select cron.unschedule(jobid) from cron.job where jobname = 'selo-hora';
select cron.schedule('selo-hora', '40 * * * *', $c$ select public.selo_revisar(); $c$);

select public.selo_revisar();
select public.ranking_cache_atualizar(45);
