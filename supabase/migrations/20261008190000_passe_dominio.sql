-- 08/10/2026 — "passe" to move a logged-in user from the old address to the new one
-- without typing the password again (Rick: many users forgot it).
-- The old address asks for a one-time code (edge function passe-dominio, logged in);
-- the new address trades it for a sign-in. Only the SHA-256 of the code is stored,
-- it lives 10 minutes and works once.
create table if not exists public.passes_dominio (
  codigo_hash text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  criado_em timestamptz not null default now(),
  expira_em timestamptz not null default now() + interval '10 minutes',
  usado_em timestamptz
);
alter table public.passes_dominio enable row level security;
-- no policies: only the service role (edge function) reads or writes it
create index if not exists passes_dominio_expira_idx on public.passes_dominio (expira_em);
comment on table public.passes_dominio is
  'One-time codes (hash only) that carry a session from app.orbis.inf.br to the VANT domain. 10 min, single use.';
