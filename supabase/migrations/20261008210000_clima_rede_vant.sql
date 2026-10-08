-- ============================================================
-- CLIMA · REDE VANT + MODELOS QUE APRENDEM (08/10/2026, redesenho da tela de Clima)
--
-- 1) clima_feedback: "tá chovendo aí agora?". Cada resposta fica presa à célula
--    de ~5 km (nunca a posição exata) e vale pros vendedores perto: se 2+ dizem
--    que chove, a tela de todo mundo naquela célula mostra chuva agora.
-- 2) clima_modelo_acerto: cada resposta dá nota pros 6 modelos daquela região
--    (quadrado de ~50 km). Os que mais acertam ali passam a pesar mais na chance.
-- Só a função clima-vendedor (service role) lê e escreve. Ninguém lê a resposta
-- de outro vendedor; o app só recebe contagens.
-- ============================================================

create table if not exists public.clima_feedback (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  cell text not null,
  hora_iso text not null,               -- hora local da previsão ("2026-10-08T14:00")
  chovendo boolean not null,
  modelos jsonb not null default '{}',  -- mm que cada modelo previa pra essa hora
  criado_em timestamptz not null default now()
);
create index if not exists clima_feedback_cell_idx on public.clima_feedback (cell, criado_em desc);
create index if not exists clima_feedback_user_idx on public.clima_feedback (user_id, criado_em desc);
alter table public.clima_feedback enable row level security;

create table if not exists public.clima_modelo_acerto (
  regiao text not null,                 -- "-30.0,-51.0" (grade de 0,5°)
  modelo text not null,
  acertos integer not null default 0,
  total integer not null default 0,
  atualizado_em timestamptz not null default now(),
  primary key (regiao, modelo)
);
alter table public.clima_modelo_acerto enable row level security;

-- soma atômica (duas respostas ao mesmo tempo não se atropelam)
create or replace function public.clima_modelo_registrar(p_regiao text, p_modelo text, p_acerto boolean)
returns void language sql security definer set search_path to 'public' as $$
  insert into public.clima_modelo_acerto (regiao, modelo, acertos, total)
  values (p_regiao, p_modelo, case when p_acerto then 1 else 0 end, 1)
  on conflict (regiao, modelo) do update
    set acertos = clima_modelo_acerto.acertos + case when p_acerto then 1 else 0 end,
        total = clima_modelo_acerto.total + 1,
        atualizado_em = now();
$$;
revoke all on function public.clima_modelo_registrar(text, text, boolean) from public, anon, authenticated;
grant execute on function public.clima_modelo_registrar(text, text, boolean) to service_role;
