-- Profit challenge ("Bater um lucro", Rick 27/10/2026).
-- A goal like "R$ 5.000 of profit in 15 days". The Vant reads the last 60 days
-- (DEFCON sales + Open Finance "corre" expenses or the recipe cost) and tells how
-- many units per day are needed. Lives in its own table so the savings goals
-- (financial_goals: daily split, queue, % of profit, Essencial limit) are untouched.

create table if not exists public.objetivos_lucro (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  alvo numeric not null check (alvo > 0),
  inicio date not null,
  fim date not null,
  dias_trabalho int not null check (dias_trabalho > 0),
  custo_unid numeric not null default 0,
  lucro_unid numeric not null default 0,
  status text not null default 'ativo' check (status in ('ativo', 'concluido', 'encerrado')),
  analise jsonb not null default '{}'::jsonb,
  criado_em timestamptz not null default now(),
  check (fim >= inicio)
);

create index if not exists objetivos_lucro_user_idx on public.objetivos_lucro (user_id, status);
alter table public.objetivos_lucro enable row level security;

drop policy if exists objetivos_lucro_owner on public.objetivos_lucro;
create policy objetivos_lucro_owner on public.objetivos_lucro
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Base numbers of the last 60 days. The app does the scenarios (days worked etc).
create or replace function public.objetivo_lucro_base(p_user uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  de date := hoje - 59;
  v_unid numeric; v_valor numeric; v_dias int; v_recorde numeric;
  v_primeira date; v_janela int;
  v_custo_receita numeric; v_preco numeric; v_estoque numeric;
  v_saidas numeric; v_banco boolean;
  v_ticket numeric; v_custo numeric; v_fonte text; v_nome text;
begin
  with vd as (
    select (created_at at time zone 'America/Sao_Paulo')::date as d, coalesce(qty, 1) as q, amount
    from defcon_sales
    where user_id = p_user and method <> 'gorjeta' and not coalesce(late, false)
      and (created_at at time zone 'America/Sao_Paulo')::date between de and hoje
  ), dia as (select d, sum(q) as u from vd group by d)
  select coalesce((select sum(q) from vd), 0), coalesce((select sum(amount) from vd), 0),
         (select count(*) from dia where u > 0), coalesce((select max(u) from dia), 0)
    into v_unid, v_valor, v_dias, v_recorde;

  select min((created_at at time zone 'America/Sao_Paulo')::date) into v_primeira
  from defcon_sales where user_id = p_user and method <> 'gorjeta';
  v_janela := least(60, greatest(1, hoje - coalesce(v_primeira, hoje) + 1));

  select avg(nullif(cost, 0)), avg(nullif(sale_price, 0)),
         coalesce(sum(greatest(stock_quantity, 0)) filter (where coalesce(controla_estoque, true)), 0)
    into v_custo_receita, v_preco, v_estoque
  from products where user_id = p_user and coalesce(is_active, true);
  -- Unit label ("batidas") when there is a single active product.
  select case when count(*) = 1 then max(name) end into v_nome
  from products where user_id = p_user and coalesce(is_active, true);

  select exists (select 1 from bank_connections where user_id = p_user) into v_banco;
  select coalesce(sum(abs(valor)), 0) into v_saidas
  from extrato_lancamentos
  where user_id = p_user and esfera = 'corre' and tipo = 'saida' and movimento = 'normal'
    and not coalesce(fora_analise, false) and data between de and hoje;

  v_ticket := case when v_unid > 0 then v_valor / v_unid else coalesce(v_preco, 0) end;

  -- Bank cost per unit only when it is believable (below 90% of the ticket).
  if v_banco and v_saidas > 0 and v_unid >= 20 and v_saidas / v_unid < v_ticket * 0.9 then
    v_custo := v_saidas / v_unid; v_fonte := 'extrato';
  else
    v_custo := coalesce(v_custo_receita, 0); v_fonte := 'receita';
  end if;

  return jsonb_build_object(
    'janela_dias', v_janela,
    'dias_vendidos', v_dias,
    'unidades', v_unid,
    'vendas', round(v_valor, 2),
    'unid_dia', case when v_dias > 0 then round(v_unid / v_dias, 1) else 0 end,
    'recorde_dia', v_recorde,
    'ticket', round(v_ticket, 2),
    'custo_unid', round(v_custo, 2),
    'custo_receita', round(coalesce(v_custo_receita, 0), 2),
    'custo_extrato', case when v_unid > 0 and v_saidas > 0 then round(v_saidas / v_unid, 2) else null end,
    'gastos_corre', round(v_saidas, 2),
    'fonte_custo', v_fonte,
    'banco', v_banco,
    'estoque', v_estoque,
    'produto_nome', v_nome,
    'frequencia', round(v_dias::numeric / v_janela, 3)
  );
end;
$$;

create or replace function public.objetivo_lucro_analise()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then return null; end if;
  return public.objetivo_lucro_base(auth.uid());
end;
$$;

-- One active challenge at a time: creating a new one closes the previous one.
create or replace function public.objetivo_lucro_criar(p_alvo numeric, p_dias int, p_dias_trabalho int)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  u uuid := auth.uid();
  hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  b jsonb; v_id uuid;
begin
  if u is null then raise exception 'not authenticated'; end if;
  if p_alvo is null or p_alvo <= 0 or p_alvo > 1000000 then raise exception 'valor inválido'; end if;
  if p_dias is null or p_dias < 1 or p_dias > 366 then raise exception 'prazo inválido'; end if;
  if p_dias_trabalho is null or p_dias_trabalho < 1 or p_dias_trabalho > p_dias then raise exception 'dias de trabalho inválidos'; end if;

  b := public.objetivo_lucro_base(u);
  update objetivos_lucro set status = 'encerrado' where user_id = u and status = 'ativo';
  insert into objetivos_lucro (user_id, alvo, inicio, fim, dias_trabalho, custo_unid, lucro_unid, analise)
  values (u, round(p_alvo, 2), hoje, hoje + p_dias - 1, p_dias_trabalho,
          (b->>'custo_unid')::numeric,
          greatest(0, (b->>'ticket')::numeric - (b->>'custo_unid')::numeric), b)
  returning id into v_id;
  return v_id;
end;
$$;

-- Active challenge + live progress from DEFCON sales since it started.
create or replace function public.objetivo_lucro_atual()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  u uuid := auth.uid();
  hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  o objetivos_lucro%rowtype;
  v_valor_antes numeric; v_unid_antes numeric; v_dias_antes int;
  v_valor_hoje numeric; v_unid_hoje numeric;
  v_lucro_antes numeric; v_lucro_hoje numeric; v_lucro numeric;
  v_rest int; v_precisa numeric; v_unid_meta numeric;
begin
  if u is null then return null; end if;
  -- A finished challenge stays visible for 3 days after its end (celebration).
  select * into o from objetivos_lucro
  where user_id = u and (status = 'ativo' or (status = 'concluido' and fim >= hoje - 3)
                         or (status = 'encerrado' and fim between hoje - 3 and hoje - 1))
  order by (status = 'ativo') desc, criado_em desc limit 1;
  if not found then return null; end if;

  with vd as (
    select (created_at at time zone 'America/Sao_Paulo')::date as d, amount,
           case when method <> 'gorjeta' and not coalesce(late, false) then coalesce(qty, 1) else 0 end as q
    from defcon_sales
    where user_id = u and (created_at at time zone 'America/Sao_Paulo')::date between o.inicio and least(hoje, o.fim)
  )
  select coalesce(sum(amount) filter (where d < hoje), 0), coalesce(sum(q) filter (where d < hoje), 0),
         count(distinct d) filter (where d < hoje and q > 0),
         coalesce(sum(amount) filter (where d = hoje), 0), coalesce(sum(q) filter (where d = hoje), 0)
    into v_valor_antes, v_unid_antes, v_dias_antes, v_valor_hoje, v_unid_hoje
  from vd;

  v_lucro_antes := v_valor_antes - v_unid_antes * o.custo_unid;
  v_lucro_hoje := v_valor_hoje - v_unid_hoje * o.custo_unid;
  v_lucro := v_lucro_antes + v_lucro_hoje;

  if o.status <> 'ativo' then
    null;
  elsif v_lucro >= o.alvo then
    update objetivos_lucro set status = 'concluido' where id = o.id;
    o.status := 'concluido';
  elsif hoje > o.fim then
    update objetivos_lucro set status = 'encerrado' where id = o.id;
    o.status := 'encerrado';
  end if;

  -- Today counts as a work day still to do.
  v_rest := greatest(1, o.dias_trabalho - v_dias_antes);
  v_precisa := greatest(0, o.alvo - v_lucro_antes) / v_rest;
  v_unid_meta := case when o.lucro_unid > 0 then ceil(v_precisa / o.lucro_unid) else null end;

  return jsonb_build_object(
    'id', o.id, 'alvo', o.alvo, 'inicio', o.inicio, 'fim', o.fim, 'status', o.status,
    'dias_periodo', o.fim - o.inicio + 1,
    'dia_atual', least(o.fim - o.inicio + 1, hoje - o.inicio + 1),
    'dias_trabalho', o.dias_trabalho, 'dias_trabalhados', v_dias_antes + case when v_unid_hoje > 0 then 1 else 0 end,
    'custo_unid', o.custo_unid, 'lucro_unid', o.lucro_unid,
    'lucro', round(v_lucro, 2), 'vendas', round(v_valor_antes + v_valor_hoje, 2),
    'unidades', v_unid_antes + v_unid_hoje,
    'hoje', jsonb_build_object('precisa', round(v_precisa, 2), 'unid_meta', v_unid_meta,
                               'unid', v_unid_hoje, 'lucro', round(v_lucro_hoje, 2)),
    'analise', o.analise
  );
end;
$$;

create or replace function public.objetivo_lucro_excluir(p_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  delete from objetivos_lucro where id = p_id and user_id = auth.uid();
$$;

revoke all on function public.objetivo_lucro_base(uuid) from public, anon, authenticated;
grant execute on function public.objetivo_lucro_analise() to authenticated;
grant execute on function public.objetivo_lucro_criar(numeric, int, int) to authenticated;
grant execute on function public.objetivo_lucro_atual() to authenticated;
grant execute on function public.objetivo_lucro_excluir(uuid) to authenticated;
