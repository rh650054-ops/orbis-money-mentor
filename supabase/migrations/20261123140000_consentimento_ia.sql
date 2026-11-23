-- 23/11/2026 — App Store guideline 5.1.2(i) + LGPD: explicit permission before any personal
-- data goes to a third-party AI (Anthropic, OpenAI, Google Gemini). One row per user; no row =
-- not answered yet (treated as "not allowed"). Deleting the auth user deletes the row.
create table if not exists public.consentimento_ia (
  user_id uuid primary key references auth.users(id) on delete cascade,
  permitido boolean not null,
  respondido_em timestamptz not null default now()
);

alter table public.consentimento_ia enable row level security;

drop policy if exists "consentimento_ia: dono le" on public.consentimento_ia;
create policy "consentimento_ia: dono le" on public.consentimento_ia
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "consentimento_ia: dono cria" on public.consentimento_ia;
create policy "consentimento_ia: dono cria" on public.consentimento_ia
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "consentimento_ia: dono muda" on public.consentimento_ia;
create policy "consentimento_ia: dono muda" on public.consentimento_ia
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

grant select, insert, update on public.consentimento_ia to authenticated;
