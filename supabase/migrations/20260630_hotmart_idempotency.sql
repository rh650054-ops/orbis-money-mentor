-- Orbis — idempotencia do webhook Hotmart (correcao critica de pagamento).
--
-- A Hotmart REENVIA o mesmo evento em caso de timeout/erro. Sem deduplicacao, um
-- evento duplicado estendia a assinatura (+30 dias a cada retry) e um APPROVED
-- atrasado podia RESSUSCITAR uma conta ja cancelada/reembolsada (acesso sem receita).
-- Esta tabela registra cada evento ja processado; o webhook ignora repetidos.
--
-- Cole TUDO no Supabase -> SQL Editor -> Run.

create table if not exists public.processed_hotmart_events (
  event_id     text primary key,
  event_type   text,
  purchase_id  text,
  processed_at timestamptz not null default now()
);

alter table public.processed_hotmart_events enable row level security;
-- Sem policies de proposito: RLS ligado + nenhuma policy = so o service_role
-- (o proprio webhook) consegue ler/escrever. Ninguem mais acessa.
