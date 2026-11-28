-- ============================================================================================
-- DEFCON — C0: keep what "Reiniciar o dia" destroys (ADR 0002, P1). DATA PRESERVATION ONLY.
--
-- This is NOT the fix of the financial incident (that is A/B/C, ADR 0002 §5). It changes no
-- result: every write of the old clients still does exactly what it did, with the same answer.
-- It only copies, before each destructive write, the rows that write destroys, grouped in one
-- "reinício" event, and it notices sales that arrive for a session that no longer exists.
--
-- The restart (restartChallenge, identical in builds 29/31/32 and the web app) is five separate
-- requests, no transaction, any of them may fail:
--   1 delete challenge_blocks (session)        -> etapa 'contadores'
--   2 delete challenge_sessions                -> etapa 'sessao'; its cascade deletes
--       defcon_abordagens / defcon_ajustes / defcon_occurrences / remaining challenge_blocks
--   3 delete hourly_goal_blocks '⏱%' (+1h)     -> etapa 'blocos_extras'
--   4 update hourly_goal_blocks to zero/idle   -> etapa 'blocos_zerados' (the OLD row is kept)
--   5 update daily_sales money to zero         -> etapa 'dia_zerado'     (the OLD row is kept)
-- Archiving is row-level and starts at the FIRST destructive write, whatever the order or the
-- failures: a request that never ran simply leaves its etapa out (the monitor shows it).
--
-- Rules:
--  - never blocks a client write: archiving errors become warnings, the write goes on;
--  - idempotent: one event per account and day while the writes keep coming (10 min window),
--    one archived copy per (event, table, row, etapa); a retried write archives nothing new;
--  - account deletion: nothing is archived while apagar_dados_do_usuario / conta_teste_zerar
--    run, nothing is archived for a user that does not exist, and every archive row references
--    auth.users ON DELETE CASCADE (the admin path deletes the auth user last: its archive goes);
--  - RLS: the owner reads its own rows; no client writes; the service role reads all;
--  - retention: events expire after 400 days (decision of Rick pending), purged weekly.
-- ============================================================================================

create table if not exists public.defcon_reinicios (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  dia date not null,
  sessao_id uuid,
  iniciado_em timestamptz not null default now(),
  ultima_em timestamptz not null default now(),
  etapas text[] not null default '{}',
  cliente text,
  vendas_deixadas integer not null default 0,
  valor_deixado numeric not null default 0,
  expira_em timestamptz not null default now() + interval '400 days'
);
create index if not exists defcon_reinicios_conta_dia on public.defcon_reinicios (user_id, dia, ultima_em desc);
create index if not exists defcon_reinicios_sessao on public.defcon_reinicios (sessao_id);

create table if not exists public.defcon_arquivo (
  id bigserial primary key,
  evento_id uuid not null references public.defcon_reinicios(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  tabela text not null,
  linha_id uuid not null,
  etapa text not null,
  dados jsonb not null,
  arquivado_em timestamptz not null default now(),
  constraint defcon_arquivo_uma_copia unique (evento_id, tabela, linha_id, etapa)
);
create index if not exists defcon_arquivo_conta on public.defcon_arquivo (user_id, arquivado_em desc);

-- a sale written for a session that no longer exists (e.g. an offline sale uploaded after the
-- restart). The sale itself is written exactly as before; this only records it.
create table if not exists public.defcon_vendas_sem_sessao (
  venda_id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  sessao_id uuid not null,
  evento_id uuid references public.defcon_reinicios(id) on delete set null,
  valor numeric,
  detectado_em timestamptz not null default now()
);

alter table public.defcon_reinicios enable row level security;
alter table public.defcon_arquivo enable row level security;
alter table public.defcon_vendas_sem_sessao enable row level security;
drop policy if exists "dono le reinicios" on public.defcon_reinicios;
create policy "dono le reinicios" on public.defcon_reinicios for select using (user_id = auth.uid());
drop policy if exists "dono le arquivo" on public.defcon_arquivo;
create policy "dono le arquivo" on public.defcon_arquivo for select using (user_id = auth.uid());
drop policy if exists "dono le vendas sem sessao" on public.defcon_vendas_sem_sessao;
create policy "dono le vendas sem sessao" on public.defcon_vendas_sem_sessao for select using (user_id = auth.uid());
revoke all on public.defcon_reinicios, public.defcon_arquivo, public.defcon_vendas_sem_sessao from public, anon, authenticated;
grant select on public.defcon_reinicios, public.defcon_arquivo, public.defcon_vendas_sem_sessao to authenticated;

-- The open event of the account and day (writes of one restart arrive within seconds), or a new one.
create or replace function public.defcon_c0_evento(p_user uuid, p_dia date, p_sessao uuid, p_etapa text) returns uuid
language plpgsql security definer set search_path to 'public' as $$
declare v uuid; v_cliente text := left(coalesce(nullif(current_setting('request.headers', true), '')::json ->> 'x-client-info', ''), 120);
begin
  -- two writes of the same restart may run at once: one event, never two
  perform pg_advisory_xact_lock(hashtextextended('defcon_c0:' || p_user::text || ':' || p_dia::text, 0));
  select id into v from public.defcon_reinicios
   where user_id = p_user and dia = p_dia and ultima_em > now() - interval '10 minutes'
     and (p_sessao is null or sessao_id is null or sessao_id = p_sessao)
   order by ultima_em desc limit 1;
  if v is null then
    insert into public.defcon_reinicios (user_id, dia, sessao_id, etapas, cliente)
    values (p_user, p_dia, p_sessao, array[p_etapa], nullif(v_cliente, '')) returning id into v;
  else
    update public.defcon_reinicios
       set ultima_em = now(), sessao_id = coalesce(sessao_id, p_sessao),
           etapas = case when p_etapa = any(etapas) then etapas else etapas || p_etapa end
     where id = v;
  end if;
  return v;
end $$;

create or replace function public.defcon_c0_arquivar() returns trigger
language plpgsql security definer set search_path to 'public' as $$
declare v_ctx text; v_user uuid := old.user_id; v_dia date; v_sessao uuid; v_etapa text; v_ev uuid;
begin
  -- wiping a whole account is not a restart: nothing is kept
  get diagnostics v_ctx = pg_context;
  if v_ctx ~ '(apagar_dados_do_usuario|conta_teste_zerar)' then
    if tg_op = 'DELETE' then return old; else return new; end if;
  end if;
  begin
    if not exists (select 1 from auth.users a where a.id = v_user) then
      if tg_op = 'DELETE' then return old; else return new; end if;
    end if;
    if tg_table_name = 'challenge_sessions' then
      v_sessao := old.id; v_dia := old.date; v_etapa := 'sessao';
    elsif tg_table_name = 'challenge_blocks' then
      v_sessao := old.session_id; v_etapa := 'contadores';
      select date into v_dia from public.challenge_sessions where id = old.session_id;
    elsif tg_table_name in ('defcon_abordagens', 'defcon_ajustes', 'defcon_occurrences') then
      -- only what the session's own deletion takes with it: one approach removed while the
      -- session lives is an ordinary correction, not a restart
      if exists (select 1 from public.challenge_sessions where id = old.session_id) then return old; end if;
      v_sessao := old.session_id; v_etapa := tg_table_name;
    elsif tg_table_name = 'hourly_goal_blocks' then
      select date into v_dia from public.daily_goal_plans where id = old.plan_id;
      v_etapa := case when tg_op = 'DELETE' then 'blocos_extras' else 'blocos_zerados' end;
    elsif tg_table_name = 'daily_sales' then
      v_dia := old.date; v_etapa := 'dia_zerado';
    end if;
    if v_dia is null and v_sessao is not null then
      select dia into v_dia from public.defcon_reinicios where sessao_id = v_sessao order by ultima_em desc limit 1;
    end if;
    v_dia := coalesce(v_dia, (now() at time zone 'America/Sao_Paulo')::date);
    v_ev := public.defcon_c0_evento(v_user, v_dia, v_sessao, v_etapa);
    insert into public.defcon_arquivo (evento_id, user_id, tabela, linha_id, etapa, dados)
    values (v_ev, v_user, tg_table_name, old.id, v_etapa, to_jsonb(old))
    on conflict on constraint defcon_arquivo_uma_copia do nothing;
    if tg_table_name = 'challenge_sessions' then
      update public.defcon_reinicios r
         set vendas_deixadas = x.n, valor_deixado = x.v
        from (select count(*) n, coalesce(round(sum(amount), 2), 0) v from public.defcon_sales where session_id = old.id) x
       where r.id = v_ev;
    end if;
  exception when others then
    -- preservation must never stop the client's write
    raise warning 'defcon_c0_arquivar (% %): %', tg_table_name, old.id, sqlerrm;
  end;
  if tg_op = 'DELETE' then return old; else return new; end if;
end $$;

create or replace function public.defcon_c0_venda_sem_sessao() returns trigger
language plpgsql security definer set search_path to 'public' as $$
begin
  begin
    if not exists (select 1 from public.challenge_sessions where id = new.session_id)
       and exists (select 1 from auth.users a where a.id = new.user_id) then
      insert into public.defcon_vendas_sem_sessao (venda_id, user_id, sessao_id, evento_id, valor)
      values (new.id, new.user_id, new.session_id,
              (select id from public.defcon_reinicios where sessao_id = new.session_id order by ultima_em desc limit 1), new.amount)
      on conflict (venda_id) do nothing;
    end if;
  exception when others then
    raise warning 'defcon_c0_venda_sem_sessao (%): %', new.id, sqlerrm;
  end;
  return null;
end $$;

-- "zz_" so they run after every other BEFORE trigger (ADR 0001 guards may keep the old values;
-- then nothing is destroyed and nothing is archived). WHEN filters run in C, before any function
-- call: an ordinary sale (an UPDATE that does not zero the block or the day) costs nothing extra.
drop trigger if exists zz_defcon_c0_sessao on public.challenge_sessions;
create trigger zz_defcon_c0_sessao before delete on public.challenge_sessions
  for each row execute function public.defcon_c0_arquivar();
drop trigger if exists zz_defcon_c0_contadores on public.challenge_blocks;
create trigger zz_defcon_c0_contadores before delete on public.challenge_blocks
  for each row execute function public.defcon_c0_arquivar();
drop trigger if exists zz_defcon_c0_abordagens on public.defcon_abordagens;
create trigger zz_defcon_c0_abordagens before delete on public.defcon_abordagens
  for each row execute function public.defcon_c0_arquivar();
drop trigger if exists zz_defcon_c0_ajustes on public.defcon_ajustes;
create trigger zz_defcon_c0_ajustes before delete on public.defcon_ajustes
  for each row execute function public.defcon_c0_arquivar();
drop trigger if exists zz_defcon_c0_ocorrencias on public.defcon_occurrences;
create trigger zz_defcon_c0_ocorrencias before delete on public.defcon_occurrences
  for each row execute function public.defcon_c0_arquivar();
drop trigger if exists zz_defcon_c0_blocos_extras on public.hourly_goal_blocks;
create trigger zz_defcon_c0_blocos_extras before delete on public.hourly_goal_blocks
  for each row when (old.hour_label like '⏱%') execute function public.defcon_c0_arquivar();
drop trigger if exists zz_defcon_c0_blocos_zerados on public.hourly_goal_blocks;
create trigger zz_defcon_c0_blocos_zerados before update on public.hourly_goal_blocks
  for each row when (
    coalesce(new.achieved_amount, 0) = 0 and coalesce(new.valor_dinheiro, 0) = 0 and coalesce(new.valor_cartao, 0) = 0
    and coalesce(new.valor_pix, 0) = 0 and coalesce(new.valor_calote, 0) = 0 and coalesce(new.valor_gorjeta, 0) = 0
    and new.timer_status = 'idle'
    and (coalesce(old.achieved_amount, 0) <> 0 or coalesce(old.valor_dinheiro, 0) <> 0 or coalesce(old.valor_cartao, 0) <> 0
         or coalesce(old.valor_pix, 0) <> 0 or coalesce(old.valor_calote, 0) <> 0 or coalesce(old.valor_gorjeta, 0) <> 0
         or old.timer_status is distinct from 'idle'))
  execute function public.defcon_c0_arquivar();
drop trigger if exists zz_defcon_c0_dia_zerado on public.daily_sales;
create trigger zz_defcon_c0_dia_zerado before update on public.daily_sales
  for each row when (
    coalesce(new.cash_sales, 0) = 0 and coalesce(new.card_sales, 0) = 0 and coalesce(new.pix_sales, 0) = 0
    and coalesce(new.tip_sales, 0) = 0 and coalesce(new.total_profit, 0) = 0 and coalesce(new.total_debt, 0) = 0
    and (coalesce(old.cash_sales, 0) <> 0 or coalesce(old.card_sales, 0) <> 0 or coalesce(old.pix_sales, 0) <> 0
         or coalesce(old.tip_sales, 0) <> 0 or coalesce(old.total_profit, 0) <> 0 or coalesce(old.total_debt, 0) <> 0))
  execute function public.defcon_c0_arquivar();
drop trigger if exists zz_defcon_c0_venda_sem_sessao on public.defcon_sales;
create trigger zz_defcon_c0_venda_sem_sessao after insert on public.defcon_sales
  for each row when (new.session_id is not null) execute function public.defcon_c0_venda_sem_sessao();

-- Monitoring (service role): restarts, their steps, partial ones, and sales without a session.
create or replace function public.defcon_c0_resumo(p_desde timestamptz default now() - interval '1 day') returns jsonb
language sql stable security definer set search_path to 'public' as $$
  select jsonb_build_object(
    'desde', p_desde,
    'reinicios', (select count(*) from public.defcon_reinicios where iniciado_em >= p_desde),
    'contas', (select count(distinct user_id) from public.defcon_reinicios where iniciado_em >= p_desde),
    -- a restart whose five writes did not all arrive (a failure midway, or another destructive flow)
    'parciais', (select count(*) from public.defcon_reinicios where iniciado_em >= p_desde
                   and not (etapas @> array['sessao', 'blocos_zerados', 'dia_zerado'])),
    'vendas_deixadas', (select coalesce(sum(vendas_deixadas), 0) from public.defcon_reinicios where iniciado_em >= p_desde),
    'valor_deixado', (select coalesce(sum(valor_deixado), 0) from public.defcon_reinicios where iniciado_em >= p_desde),
    'linhas_arquivadas', (select coalesce(jsonb_object_agg(etapa, n), '{}'::jsonb)
                            from (select etapa, count(*) n from public.defcon_arquivo where arquivado_em >= p_desde group by etapa) x),
    'vendas_sem_sessao', (select count(*) from public.defcon_vendas_sem_sessao where detectado_em >= p_desde),
    'vendas_sem_sessao_sem_evento', (select count(*) from public.defcon_vendas_sem_sessao where detectado_em >= p_desde and evento_id is null))
$$;

create or replace function public.defcon_c0_expurgar() returns integer
language plpgsql security definer set search_path to 'public' as $$
declare n integer;
begin
  delete from public.defcon_reinicios where expira_em < now();
  get diagnostics n = row_count;
  delete from public.defcon_vendas_sem_sessao v where v.detectado_em < now() - interval '400 days';
  return n;
end $$;

revoke all on function public.defcon_c0_evento(uuid, date, uuid, text), public.defcon_c0_arquivar(), public.defcon_c0_venda_sem_sessao(),
  public.defcon_c0_resumo(timestamptz), public.defcon_c0_expurgar() from public, anon, authenticated;
