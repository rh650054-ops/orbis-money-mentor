-- Trava de uso de IA: conta chamadas por usuario/dia/recurso. Protege o gasto do Claude.
create table if not exists public.ai_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  dia date not null,
  feature text not null,
  count int not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, dia, feature)
);

alter table public.ai_usage enable row level security;

drop policy if exists "ai_usage_select_own" on public.ai_usage;
create policy "ai_usage_select_own" on public.ai_usage
  for select using (auth.uid() = user_id);

-- Incrementa o contador do dia (atomico) e diz se passou do limite. Usa o usuario logado.
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
