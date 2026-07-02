-- ============================================================================
-- Caça-Sinal · Fase 1 — Semáforos REAIS (OpenStreetMap)
-- Tabela que guarda os semáforos de verdade (nós highway=traffic_signals do OSM),
-- pra substituir o "chute" da IA por pontos reais no mapa.
-- Rode este arquivo inteiro no Supabase → SQL Editor.
-- ============================================================================

create table if not exists public.caca_sinais (
  id          uuid primary key default gen_random_uuid(),
  osm_id      bigint unique,                 -- id do nó no OpenStreetMap (dedup entre imports)
  lat         double precision not null,
  lng         double precision not null,
  cidade      text,
  uf          text,
  vias        text,                          -- ruas próximas ao semáforo (quando o OSM traz)
  fonte       text not null default 'osm',
  criado_em   timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- Busca por proximidade (bounding box) e por cidade
create index if not exists idx_caca_sinais_geo    on public.caca_sinais (lat, lng);
create index if not exists idx_caca_sinais_cidade  on public.caca_sinais (lower(cidade), lower(uf));

-- RLS: qualquer usuário autenticado LÊ; escrita só pela edge function (service role ignora RLS)
alter table public.caca_sinais enable row level security;

drop policy if exists "caca_sinais_read" on public.caca_sinais;
create policy "caca_sinais_read"
  on public.caca_sinais
  for select
  using (auth.role() = 'authenticated');

-- ----------------------------------------------------------------------------
-- RPC: semáforos próximos de um ponto (raio em km, via bounding box — barato)
-- ----------------------------------------------------------------------------
create or replace function public.caca_sinais_proximos(
  p_lat    double precision,
  p_lng    double precision,
  p_raio_km double precision default 5
)
returns setof public.caca_sinais
language sql
stable
security definer
set search_path = public
as $$
  select *
  from public.caca_sinais s
  where s.lat between p_lat - (p_raio_km / 111.0)
                  and p_lat + (p_raio_km / 111.0)
    and s.lng between p_lng - (p_raio_km / (111.0 * cos(radians(p_lat))))
                  and p_lng + (p_raio_km / (111.0 * cos(radians(p_lat))))
  limit 500;
$$;

grant execute on function public.caca_sinais_proximos(double precision, double precision, double precision)
  to authenticated, anon;

-- ----------------------------------------------------------------------------
-- Conferência rápida (opcional): quantos semáforos por cidade
-- ----------------------------------------------------------------------------
-- select cidade, uf, count(*) from public.caca_sinais group by cidade, uf order by 3 desc;
