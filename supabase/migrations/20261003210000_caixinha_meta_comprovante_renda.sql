-- ============================================================
-- OPEN FINANCE · LOTE 6 (Rick, 03/10/2026) — mockup "Open Finance na Vant · v3"
--   1) CAIXINHA PELA META no fim do DEFCON: qual caixinha, quanto falta,
--      quanto por dia pra chegar na data (caixinha_sugestao) e o GUARDAR
--      de 1 toque (caixinha_guardar), que também conta no "guardado hoje"
--      e na sequência das Finanças.
--   2) COMPROVANTE DE RENDA: o faturamento dos últimos meses, mês a mês,
--      com o que o BANCO confirmou (entradas e Pix recebidos, sem transferência
--      entre contas próprias) ao lado do que foi lançado no DEFCON. Cada
--      comprovante gerado fica registrado com um código de verificação.
-- Idempotente, sem comandos de apagar.
-- ============================================================

create or replace function public.caixinha_sugestao()
returns jsonb language sql stable security definer set search_path to 'public' as $$
  with hoje as (select (now() at time zone 'America/Sao_Paulo')::date d),
  g as (
    select f.*,
      coalesce(f.deadline,
        (f.created_at at time zone 'America/Sao_Paulo')::date
          + case f.prazo when 'curto' then 30 when 'longo' then 365 else 90 end) as alvo_data
    from public.financial_goals f
    where f.user_id = auth.uid() and coalesce(f.status, 'active') = 'active'
      and coalesce(f.current_amount, 0) < coalesce(f.target_amount, 0)
  ),
  escolhida as (
    select * from g order by (deadline is null), alvo_data, created_at limit 1
  ),
  seq as (
    select count(*)::int n from (
      select d.data, row_number() over (order by d.data desc) rn
      from public.financas_dias d
      where d.user_id = auth.uid() and coalesce(d.guardado, 0) > 0
        and d.data <= (select d from hoje)
    ) t
    where t.data = (select d from hoje) - (t.rn - 1)::int
       or t.data = (select d from hoje) - t.rn::int
  )
  select case when auth.uid() is null or not exists (select 1 from escolhida) then null else (
    select jsonb_build_object(
      'goal_id', e.id, 'nome', e.name, 'icon', e.icon,
      'alvo', e.target_amount, 'tem', coalesce(e.current_amount, 0),
      'falta', greatest(0, e.target_amount - coalesce(e.current_amount, 0)),
      'data', e.alvo_data,
      'dias', greatest(1, e.alvo_data - (select d from hoje)),
      'por_dia', ceil(greatest(0, e.target_amount - coalesce(e.current_amount, 0))
                      / greatest(1, e.alvo_data - (select d from hoje))),
      'sequencia', (select n from seq),
      'guardado_hoje', coalesce((select guardado from public.financas_dias
                                  where user_id = auth.uid() and data = (select d from hoje)), 0)
    ) from escolhida e) end;
$$;

create or replace function public.caixinha_guardar(p_goal uuid, p_valor numeric)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare me uuid := auth.uid(); hoje date := (now() at time zone 'America/Sao_Paulo')::date; g record; novo numeric;
begin
  if me is null then raise exception 'sem login'; end if;
  if p_valor is null or p_valor <= 0 or p_valor > 100000 then raise exception 'valor inválido'; end if;
  select * into g from public.financial_goals where id = p_goal and user_id = me for update;
  if g is null then raise exception 'caixinha não encontrada'; end if;
  novo := coalesce(g.current_amount, 0) + p_valor;
  update public.financial_goals
     set current_amount = novo,
         status = case when novo >= g.target_amount then 'completed' else coalesce(status, 'active') end,
         updated_at = now()
   where id = p_goal;
  -- conta no "guardado hoje" do card Guardar e na sequência das Finanças
  insert into public.financas_guardar_dia (user_id, dia, alvo, guardado, updated_at)
  values (me, hoje, p_valor, p_valor, now())
  on conflict (user_id, dia) do update set guardado = least(100000, coalesce(public.financas_guardar_dia.guardado, 0) + p_valor), updated_at = now();
  insert into public.financas_dias (user_id, data, guardado, alvo, updated_at)
  values (me, hoje, p_valor, p_valor, now())
  on conflict (user_id, data) do update set guardado = coalesce(public.financas_dias.guardado, 0) + p_valor, updated_at = now();
  return jsonb_build_object('tem', novo, 'alvo', g.target_amount, 'concluida', novo >= g.target_amount, 'nome', g.name);
end $$;

create table if not exists public.comprovantes_renda (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  codigo text not null unique,
  meses jsonb not null,
  criado_em timestamptz not null default now()
);
alter table public.comprovantes_renda enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'comprovantes_renda' and policyname = 'comprovantes_renda_dono_le') then
    create policy comprovantes_renda_dono_le on public.comprovantes_renda for select to authenticated using (user_id = (select auth.uid()));
  end if;
end $$;

-- p_meses meses FECHADOS + o mês atual até hoje
create or replace function public.comprovante_renda(p_meses int default 3)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare me uuid := auth.uid(); hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  ini date; linhas jsonb; cod text; nome text; v_cpf text; bancos jsonb;
begin
  if me is null then raise exception 'sem login'; end if;
  ini := (date_trunc('month', hoje) - make_interval(months => greatest(1, least(coalesce(p_meses, 3), 12))))::date;
  select coalesce(jsonb_agg(m order by m->>'mes'), '[]'::jsonb) into linhas from (
    select jsonb_build_object(
      'mes', to_char(mm, 'YYYY-MM'),
      'parcial', mm = date_trunc('month', hoje)::date,
      'entradas_banco', coalesce((select sum(valor) from public.extrato_lancamentos e
          where e.user_id = me and e.tipo = 'entrada' and coalesce(e.movimento, 'normal') <> 'entre_contas'
            and e.data >= mm and e.data < (mm + interval '1 month')::date), 0),
      'pix_banco', coalesce((select sum(valor) from public.extrato_lancamentos e
          where e.user_id = me and e.tipo = 'entrada' and e.categoria = 'pix_recebido'
            and coalesce(e.movimento, 'normal') <> 'entre_contas'
            and e.data >= mm and e.data < (mm + interval '1 month')::date), 0),
      'vendas_lancadas', coalesce((select sum(coalesce(cash_sales,0) + coalesce(pix_sales,0) + coalesce(card_sales,0))
          from public.daily_sales s where s.user_id = me and s.date >= mm and s.date < (mm + interval '1 month')::date), 0),
      'dias_trabalhados', (select count(*)::int from public.daily_sales s
          where s.user_id = me and s.date >= mm and s.date < (mm + interval '1 month')::date
            and coalesce(cash_sales,0) + coalesce(pix_sales,0) + coalesce(card_sales,0) > 0)
    ) m
    from generate_series(ini, date_trunc('month', hoje)::date, interval '1 month') mm
  ) t;
  select p.nickname, p.cpf into nome, v_cpf from public.profiles p where p.user_id = me;
  select coalesce(jsonb_agg(distinct institution_name), '[]'::jsonb) into bancos
    from public.bank_connections where user_id = me and coalesce(status, '') <> 'deleted';
  cod := upper(substr(md5(me::text || clock_timestamp()::text || random()::text), 1, 10));
  insert into public.comprovantes_renda (user_id, codigo, meses) values (me, cod, linhas);
  return jsonb_build_object(
    'codigo', cod, 'gerado_em', now(), 'nome', nome,
    'cpf_mascarado', case when length(regexp_replace(coalesce(v_cpf, ''), '\D', '', 'g')) = 11
      then '***.' || substr(regexp_replace(v_cpf, '\D', '', 'g'), 4, 3) || '.' || substr(regexp_replace(v_cpf, '\D', '', 'g'), 7, 3) || '-**' else null end,
    'bancos', bancos, 'verificado', jsonb_array_length(bancos) > 0,
    'meses', linhas);
end $$;
