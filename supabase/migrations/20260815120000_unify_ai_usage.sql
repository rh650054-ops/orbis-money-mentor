-- Unifica a tabela ai_usage — resolve o conflito dos dois esquemas que faziam o
-- teto de gasto de IA falhar (17/06 criou (user_id,date,count); 29/06 criou a
-- funcao bump_ai_usage gravando em (dia,feature), que nao existiam na tabela real).
--
-- Esta migration e IDEMPOTENTE e converge o banco pro esquema (user_id,dia,feature,count)
-- ESTEJA ELE no formato antigo (date) OU no novo (dia/feature). Depois dela, TODOS os
-- consumidores usam bump_ai_usage e o teto volta a valer de verdade.

-- 1) Garante a tabela (se nao existir, ja nasce no formato final)
create table if not exists public.ai_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  dia date not null,
  feature text not null,
  count int not null default 0,
  updated_at timestamptz not null default now()
);

-- 2) Adiciona as colunas novas se faltarem (caso o banco esteja no esquema antigo)
alter table public.ai_usage add column if not exists dia date;
alter table public.ai_usage add column if not exists feature text;
alter table public.ai_usage add column if not exists updated_at timestamptz not null default now();
alter table public.ai_usage add column if not exists count int not null default 0;

-- 3) Backfill do esquema antigo: date -> dia, e marca o uso legado como 'chat'
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'ai_usage' and column_name = 'date'
  ) then
    update public.ai_usage set dia = coalesce(dia, date) where dia is null;
    update public.ai_usage set feature = coalesce(feature, 'chat') where feature is null;
  end if;
end $$;

-- 4) Fecha buracos e trava NOT NULL nas colunas-chave
update public.ai_usage set feature = 'chat' where feature is null;
update public.ai_usage set dia = (now() at time zone 'America/Sao_Paulo')::date where dia is null;
alter table public.ai_usage alter column dia set not null;
alter table public.ai_usage alter column feature set not null;

-- 5) Recria a primary key como (user_id, dia, feature)
do $$
declare pk_name text;
begin
  select conname into pk_name from pg_constraint
   where conrelid = 'public.ai_usage'::regclass and contype = 'p';
  if pk_name is not null then
    execute format('alter table public.ai_usage drop constraint %I', pk_name);
  end if;
end $$;
-- No esquema antigo (user_id,date) era unico, entao (user_id,dia,'chat') tambem e unico:
-- a PK nova nao colide. No esquema novo, a PK ja era essa.
alter table public.ai_usage add primary key (user_id, dia, feature);

-- 6) Remove a coluna antiga 'date' (ja migrada pra 'dia')
alter table public.ai_usage drop column if exists date;

-- 7) Recria bump_ai_usage batendo com o esquema final (fonte unica de verdade do teto)
create or replace function public.bump_ai_usage(p_feature text, p_limit int)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  d date := (now() at time zone 'America/Sao_Paulo')::date;
  c int;
begin
  if auth.uid() is null then
    return jsonb_build_object('over', false, 'count', 0);
  end if;
  insert into public.ai_usage (user_id, dia, feature, count)
  values (auth.uid(), d, p_feature, 1)
  on conflict (user_id, dia, feature) do update set count = ai_usage.count + 1, updated_at = now()
  returning count into c;
  return jsonb_build_object('over', c > p_limit, 'count', c);
end;
$$;
grant execute on function public.bump_ai_usage(text, int) to authenticated;

-- 8) RLS: usuario le o proprio uso; escrita e via bump_ai_usage (security definer)
alter table public.ai_usage enable row level security;
drop policy if exists "ai_usage_select_own" on public.ai_usage;
drop policy if exists "users read own ai_usage" on public.ai_usage;
create policy "ai_usage_select_own" on public.ai_usage
  for select to authenticated using (auth.uid() = user_id);
