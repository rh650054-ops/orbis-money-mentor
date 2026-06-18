-- Toda conta do app deve passar pela "Missão de Boas-Vindas" pelo menos uma vez.
-- Garante as colunas (idempotente, caso a migration anterior não tenha rodado) e
-- reseta onboarding_completed para false em TODAS as contas. Quem concluir a
-- missão volta a true; contas novas já nascem false (default da coluna).

alter table public.profiles
  add column if not exists onboarding_step integer not null default 0;

alter table public.profiles
  add column if not exists onboarding_completed boolean not null default false;

-- Reset geral: ninguém concluiu a NOVA missão ainda, então todos a verão uma vez.
update public.profiles
set onboarding_completed = false,
    onboarding_step = 0;
