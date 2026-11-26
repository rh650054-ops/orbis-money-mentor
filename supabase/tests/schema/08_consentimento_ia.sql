-- 26/11/2026: AI consent table as it is in production before 20261126160000 (catalog copy, no data).
alter table public.profiles add column if not exists termos_aceitos_versao text, add column if not exists termos_aceitos_em timestamptz;
create table if not exists public.consentimento_ia (
  user_id uuid primary key references auth.users(id) on delete cascade,
  permitido boolean not null,
  respondido_em timestamptz not null default now()
);
alter table public.consentimento_ia enable row level security;
create policy "consentimento_ia: dono cria" on public.consentimento_ia for insert to authenticated with check (user_id = auth.uid());
create policy "consentimento_ia: dono le" on public.consentimento_ia for select to authenticated using (user_id = auth.uid());
create policy "consentimento_ia: dono muda" on public.consentimento_ia for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update, delete on public.consentimento_ia to authenticated;

-- rows that exist when the migration runs (fictional): the migration is applied after this file
do $$
declare a uuid := '00000000-0000-4000-8000-0000000000a1'; b uuid := '00000000-0000-4000-8000-0000000000b2'; c uuid := '00000000-0000-4000-8000-0000000000c3';
begin
  insert into auth.users (id) values (a), (b), (c);
  insert into public.profiles (user_id, nickname, termos_aceitos_versao, termos_aceitos_em) values
    (a, 'antes-texto-antigo', '2026-11-23', '2026-11-23 17:10+00'),
    (b, 'antes-texto-novo', '2026-11-26', '2026-11-26 15:00+00'),
    (c, 'antes-termos-novos-ia-antiga', '2026-11-26', '2026-11-26 15:00+00');
  insert into public.consentimento_ia (user_id, permitido, respondido_em) values
    (a, true, '2026-11-23 17:10+00'),   -- allowed on the 23/11 text
    (b, true, '2026-11-26 15:00:01+00'),-- allowed on the 26/11 screen
    (c, true, '2026-11-24 10:00+00');   -- accepted the new Terms but the AI answer is older
end $$;
