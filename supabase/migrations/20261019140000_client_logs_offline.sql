-- 19/10/2026: erros do celular chegam até nós (Fase 4 do offline). Cada vendedor só
-- grava os próprios registros; ninguém lê pelo app (só o painel/admin via service role).
-- O app guarda os erros no aparelho e manda quando tem sinal; sem esta tabela ele
-- apenas segura no celular (até 100) e tenta de novo depois.
create table if not exists public.client_logs (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid(),
  quando timestamptz not null,
  recebido_em timestamptz not null default now(),
  nivel text not null check (nivel in ('erro','usuario','fila')),
  ctx text not null check (char_length(ctx) <= 200),
  msg text check (char_length(msg) <= 500),
  pendentes integer,
  fila_mais_velha_min integer,
  app text check (char_length(app) <= 200)
);
create index if not exists client_logs_user_quando on public.client_logs (user_id, quando desc);
alter table public.client_logs enable row level security;
drop policy if exists "client_logs insere o proprio" on public.client_logs;
create policy "client_logs insere o proprio" on public.client_logs for insert to authenticated with check (user_id = auth.uid());
revoke all on public.client_logs from anon;
grant insert on public.client_logs to authenticated;
