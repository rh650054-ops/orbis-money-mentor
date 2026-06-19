-- Progresso da "Missão de Boas-Vindas" (onboarding gamificado).
-- Guarda em qual passo o usuário parou e se já concluiu, pra retomar
-- de onde parou em qualquer aparelho/navegador (cross-device).
-- O localStorage continua sendo o cache rápido; estas colunas são a fonte
-- de verdade quando o usuário troca de dispositivo.

alter table public.profiles
  add column if not exists onboarding_step integer not null default 0;

alter table public.profiles
  add column if not exists onboarding_completed boolean not null default false;

-- Contas antigas que já têm dados (nickname ou meta) são consideradas
-- com onboarding concluído, pra não disparar a missão de novo pra elas.
update public.profiles
set onboarding_completed = true
where onboarding_completed = false
  and (nickname is not null or coalesce(monthly_goal, 0) > 0);
