-- ============================================================
-- Ranking rápido SEM perder a disputa ao vivo (Rick, 20/10/2026: "o legal do ranking
-- é o cara ir competindo com o próximo").
--
-- O pesado do ranking é a conferência do BANCO, e ela só vale pra dias que já
-- fecharam (ranking_valor_dias: dia < hoje). Hoje é sempre o que foi lançado no Foco.
-- Então:
--   • dias passados: guardados em ranking_dia_cache, recalculados de hora em hora
--     (e é só aí que o banco muda alguma coisa — a auditoria é da meia-noite);
--   • HOJE: somado na hora, direto de daily_sales — cada venda mexe no ranking na hora.
-- get_weekly_ranking_verified passa a ler os dois: abre em milissegundos e continua ao vivo.
-- ============================================================
create table if not exists public.ranking_dia_cache (
  user_id uuid not null,
  dia date not null,
  valor numeric not null default 0,
  pelo_banco boolean not null default false,
  atualizado_em timestamptz not null default now(),
  primary key (user_id, dia)
);
create index if not exists ranking_dia_cache_dia_idx on public.ranking_dia_cache (dia);
alter table public.ranking_dia_cache enable row level security;
revoke all on public.ranking_dia_cache from anon, authenticated;

-- Recalcula os dias que já fecharam (padrão: últimos 45 dias). Roda no cron.
create or replace function public.ranking_cache_atualizar(p_dias integer default 45)
returns integer language plpgsql security definer set search_path = public as $$
declare
  hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_de date := hoje - greatest(p_dias, 1);
  n integer;
begin
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
revoke all on function public.ranking_cache_atualizar(integer) from public, anon, authenticated;

-- Ranking: dias passados do cache + hoje ao vivo.
create or replace function public.get_weekly_ranking_verified(p_week_start date, p_week_end date, p_usar_extrato boolean default true)
returns table(user_id uuid, nome_usuario text, avatar_url text, faturamento_semana numeric, dias_semana integer)
language sql stable security definer set search_path = public as $function$
  with hoje as (select (now() at time zone 'America/Sao_Paulo')::date as d),
  ext as (
    select eu.user_id, eu.dia as d, sum(coalesce(eu.total_verificado, 0))::numeric as val
      from extrato_uploads eu
     where eu.dia >= p_week_start and eu.dia <= p_week_end
     group by eu.user_id, eu.dia
  ),
  passado as (
    select c.user_id, c.dia as d, c.valor as val
      from public.ranking_dia_cache c
     where c.dia between p_week_start and least(p_week_end, (select d from hoje) - 1)
  ),
  agora as (
    -- hoje: o que foi lançado e caiu (mesma regra de ranking_valor_dias pra hoje)
    select ds.user_id, ds.date::date as d, round(sum(coalesce(ds.total_profit, 0))::numeric, 2) as val
      from public.daily_sales ds
     where ds.date::date = (select d from hoje)
       and (select d from hoje) between p_week_start and p_week_end
     group by ds.user_id, ds.date::date
  ),
  live_dia as (select * from passado union all select * from agora),
  merged as (
    select coalesce(e.user_id, l.user_id) as user_id,
           case when p_usar_extrato then coalesce(e.val, 0) else coalesce(l.val, 0) end as val
      from ext e full outer join live_dia l on e.user_id = l.user_id and e.d = l.d
  ),
  agg as (
    select m.user_id, sum(m.val)::numeric as faturamento, count(*) filter (where m.val > 0)::integer as dias
      from merged m group by m.user_id
  )
  select a.user_id, coalesce(pp.nickname, ''), coalesce(pp.avatar_url, ''), a.faturamento, a.dias
    from agg a
    left join public_profiles pp on pp.user_id = a.user_id
    left join profiles pr        on pr.user_id = a.user_id
   where coalesce(pr.ranking_hidden, false) = false
     and coalesce(pr.ranking_oculto, false) = false
     and a.faturamento > 0
   order by a.faturamento desc;
$function$;

-- primeira carga e cron de hora em hora (minuto 25, depois da virada do ranking)
select public.ranking_cache_atualizar(45);
do $$ begin
  perform cron.unschedule('ranking-cache-hora');
exception when others then null; end $$;
select cron.schedule('ranking-cache-hora', '25 * * * *', $$ select public.ranking_cache_atualizar(45); $$);
