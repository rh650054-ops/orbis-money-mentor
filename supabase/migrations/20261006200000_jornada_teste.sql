-- ============================================================
-- JORNADA DO TESTE — 06/10/2026 (Rick)
-- O teste da VANT dura o dia do cadastro (dia 0) + 3 dias. Cada dia tem uma missão:
--   dia 0 primeiro Foco + ranking · dia 1 relatório · dia 2 custo do produto ·
--   dia 3 Caça-Sinal + arte da marca.
-- Esta tabela guarda cada passo que a pessoa cumpriu, pra tela marcar o que já foi
-- feito em qualquer aparelho e pra gente medir quais missões levam à assinatura.
-- Só o próprio usuário lê e grava as linhas dele; o passo é uma palavra curta.
-- ============================================================

create table if not exists public.jornada_teste (
  user_id uuid not null references auth.users (id) on delete cascade,
  passo text not null check (passo ~ '^[a-z_]{2,20}$'),
  feito_em timestamptz not null default now(),
  primary key (user_id, passo)
);

alter table public.jornada_teste enable row level security;

drop policy if exists jornada_teste_ler on public.jornada_teste;
create policy jornada_teste_ler on public.jornada_teste
  for select to authenticated using (user_id = auth.uid());

drop policy if exists jornada_teste_gravar on public.jornada_teste;
create policy jornada_teste_gravar on public.jornada_teste
  for insert to authenticated with check (user_id = auth.uid());

revoke all on public.jornada_teste from anon;
grant select, insert on public.jornada_teste to authenticated;
