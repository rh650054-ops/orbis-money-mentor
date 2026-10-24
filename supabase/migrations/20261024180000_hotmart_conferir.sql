-- ============================================================
-- hotmart-conferir (Rick, 24/10/2026): a Hotmart aceita o cancelamento pela API mas não
-- manda o aviso de volta, então o CRM ficava com "ativa" pra sempre. A função nova
-- pergunta o status real e registra aqui como um evento "conferido pela API", copiando o
-- último evento da assinatura (nome, plano, valor continuam aparecendo) e trocando só o
-- status. Cancelado vira SUBSCRIPTION_CANCELLATION (o que o resto do sistema já entende).
-- Nada é apagado.
-- ============================================================
create table if not exists public.hotmart_cancelamentos_auto (
  id uuid primary key default gen_random_uuid(),
  subscription_id text not null,
  user_id uuid,
  motivo text not null check (motivo in ('upgrade_pro', 'duplicada')),
  manteve text,
  em timestamptz not null default now()
);
alter table public.hotmart_cancelamentos_auto enable row level security;
revoke all on public.hotmart_cancelamentos_auto from anon, authenticated;

create or replace function public.hotmart_status_conferido(p_sub text, p_status text)
returns void language plpgsql security definer set search_path to 'public' as $$
declare u public.hotmart_eventos; tipo text;
begin
  select * into u from public.hotmart_eventos
   where subscription_id = p_sub and payload is not null order by recebido_em desc limit 1;
  if not found then return; end if;
  tipo := case when p_status like 'CANCELLED%' then 'SUBSCRIPTION_CANCELLATION'
               when p_status in ('INACTIVE') then 'SUBSCRIPTION_INACTIVE'
               else 'SUBSCRIPTION_STATUS' end;
  insert into public.hotmart_eventos (event_id, event_type, purchase_id, subscription_id, buyer_email, buyer_cpf,
    buyer_nome, valor, moeda, user_id, payload)
  values ('api:' || p_sub || ':' || p_status || ':' || to_char(now(), 'YYYYMMDDHH24MI'), tipo, u.purchase_id, p_sub,
    u.buyer_email, u.buyer_cpf, u.buyer_nome, u.valor, u.moeda, u.user_id,
    jsonb_set(u.payload, '{data,subscription,status}', to_jsonb(p_status), true)
      || jsonb_build_object('conferido_api', true));
end $$;
revoke all on function public.hotmart_status_conferido(text, text) from public, anon, authenticated;
grant execute on function public.hotmart_status_conferido(text, text) to service_role;

-- de hora em hora (minuto 41)
select cron.schedule('hotmart-conferir-hora', '41 * * * *', $cron$
  select net.http_post(
    url := 'https://qbcsjsdwjjpybvzbxszi.supabase.co/functions/v1/hotmart-conferir',
    body := '{}'::jsonb,
    headers := jsonb_build_object('Content-Type','application/json','x-orbis-cron',(select token from public.painel_tokens where nome='cron')),
    timeout_milliseconds := 60000
  );
$cron$);
