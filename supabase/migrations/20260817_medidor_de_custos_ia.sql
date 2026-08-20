-- MEDIDOR DE GASTO DE IA: cada chamada (Claude, imagem, voz) vira uma linha com o
-- custo estimado em dólar, calculado na hora com a tabela de preços do provedor.
-- Motivação (17/08/2026): o Orbis não media nada — o crédito da Anthropic zerou e
-- ninguém soube até vendedor reclamar; a OpenAI cobrou no cartão sem aviso.
-- (Aplicada em produção via mcp apply_migration; este arquivo é o registro no repo.)
create table if not exists public.ai_custos (
  id uuid primary key default gen_random_uuid(),
  ts timestamptz not null default now(),
  user_id uuid,
  servico text not null,          -- claude_chat | imagem | tts_openai | stt_gemini
  modelo text,
  qtd numeric not null default 1, -- tokens, caracteres ou imagens
  unidade text not null default 'chamada',
  custo_usd numeric(12,6) not null default 0
);
create index if not exists ai_custos_ts_idx on public.ai_custos (ts desc);
create index if not exists ai_custos_servico_idx on public.ai_custos (servico, ts desc);

alter table public.ai_custos enable row level security;
-- Escrita: só service role (edge functions). Leitura: só admin do Orbis.
drop policy if exists ai_custos_admin_select on public.ai_custos;
create policy ai_custos_admin_select on public.ai_custos
  for select using (public.is_orbis_admin());

-- Resumo pronto: gasto por dia e serviço
create or replace view public.vw_custos_ia_dia as
  select ts::date as dia, servico, count(*) as chamadas,
         round(sum(custo_usd), 4) as usd
  from public.ai_custos
  group by 1, 2
  order by 1 desc, 4 desc;
