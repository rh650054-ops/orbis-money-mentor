-- challenge_blocks as in production (28/11/2026): per-block counters of a DEFCON session.
create table if not exists public.challenge_blocks (
  id uuid not null default gen_random_uuid(), session_id uuid not null references public.challenge_sessions(id) on delete cascade,
  user_id uuid not null, block_index integer not null, sold_amount numeric default 0,
  started_at timestamptz default now(), ended_at timestamptz, status text default 'active',
  created_at timestamptz default now(), updated_at timestamptz default now(),
  approaches_count integer default 0, sales_count integer default 0,
  primary key (id), constraint challenge_blocks_session_block_unique unique (session_id, block_index));
alter table public.challenge_blocks enable row level security;
create extension if not exists dblink;
