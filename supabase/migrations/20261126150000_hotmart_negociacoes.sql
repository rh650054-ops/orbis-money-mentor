-- 26/11/2026 (Rick): "Gerar Pix" — an overdue subscriber pays the pending monthly fee through
-- Hotmart's official installment negotiation, without opening a new subscription.
-- This table is the record of every negotiation VANT asked Hotmart for. It exists so that:
--   · one subscription never has two open negotiations (unique index = the atomic lock);
--   · a valid Pix is shown again instead of generating another;
--   · a request whose answer was lost (timeout) is never repeated blindly ('incerto');
--   · the payment is recognised by the transaction code Hotmart returned, tied to the account,
--     the subscription and the recurrence it was generated for.
-- Only the backend (service_role) reads and writes it. The app reads its own open Pix through
-- hotmart_negociacao_minha(). Rollback: supabase/gerar-pix/rollback.sql
create table if not exists public.hotmart_negociacoes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  assinatura text not null,                 -- our subscription code (Hotmart subscriber_code)
  hotmart_assinatura_id bigint,             -- Hotmart's numeric subscription_id (what negotiate takes)
  recorrencia integer not null,             -- the overdue recurrence being negotiated
  valor numeric,                            -- price of that recurrence, as Hotmart lists it
  proxima_cobranca timestamptz,             -- the subscription's next charge when the Pix was generated
  transacoes_antes jsonb,                   -- transactions Hotmart listed for the subscription right before the request
  status text not null default 'pedindo' check (status in ('pedindo', 'gerado', 'incerto', 'falhou', 'vencido', 'pago')),
  transacao text unique,                    -- Hotmart's transaction of the negotiation (HP…)
  pix_code text,
  pix_qrcode text,
  vence_em timestamptz,
  erro text,
  origem text not null default 'app',
  pedido_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  pago_em timestamptz
);
-- the lock: at most one open negotiation per subscription, enforced by the database
create unique index if not exists hotmart_negociacoes_uma_aberta
  on public.hotmart_negociacoes (assinatura) where status in ('pedindo', 'gerado', 'incerto');
create index if not exists hotmart_negociacoes_user on public.hotmart_negociacoes (user_id, pedido_em desc);
alter table public.hotmart_negociacoes enable row level security;
revoke all on public.hotmart_negociacoes from public, anon, authenticated;
grant select, insert, update on public.hotmart_negociacoes to service_role;

-- Reserves the right to ask Hotmart for a Pix. Answers:
--   reservado     → nobody else is asking: go on (id of the new row)
--   ja_paga       → this recurrence was already paid through a negotiation
--   reutilizar    → a Pix of this subscription is still valid: show it, do not ask again
--   em_andamento  → another request for this subscription started less than 2 minutes ago
--   incerto       → an earlier request got no answer: Hotmart may have generated the charge;
--                   nothing new is asked until the reconciliation (hotmart_negociacao_reconciliar)
--                   says whether a charge exists
create or replace function public.hotmart_negociacao_reservar(
  p_user uuid, p_assinatura text, p_hotmart_id bigint, p_recorrencia integer, p_valor numeric,
  p_proxima timestamptz, p_origem text default 'app', p_transacoes_antes jsonb default null
) returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare
  a public.hotmart_negociacoes;
  v_id uuid;
begin
  if auth.jwt() ->> 'role' is distinct from 'service_role' then raise exception 'so o servidor'; end if;
  if p_user is null or coalesce(btrim(p_assinatura), '') = '' or p_recorrencia is null then raise exception 'dados incompletos'; end if;
  -- this recurrence was already paid through a negotiation: never charge it again
  if exists (select 1 from public.hotmart_negociacoes where assinatura = p_assinatura and recorrencia = p_recorrencia and status = 'pago') then
    return jsonb_build_object('acao', 'ja_paga');
  end if;
  -- an expired Pix no longer holds the subscription
  update public.hotmart_negociacoes set status = 'vencido', atualizado_em = now()
   where assinatura = p_assinatura and status = 'gerado' and vence_em is not null and vence_em <= now();
  -- a request that never came back: Hotmart may have created the charge
  update public.hotmart_negociacoes set status = 'incerto', atualizado_em = now(), erro = coalesce(erro, 'sem resposta')
   where assinatura = p_assinatura and status = 'pedindo' and pedido_em < now() - interval '2 minutes';

  insert into public.hotmart_negociacoes (user_id, assinatura, hotmart_assinatura_id, recorrencia, valor, proxima_cobranca, origem, transacoes_antes)
  values (p_user, p_assinatura, p_hotmart_id, p_recorrencia, p_valor, p_proxima, coalesce(p_origem, 'app'), p_transacoes_antes)
  on conflict (assinatura) where status in ('pedindo', 'gerado', 'incerto') do nothing
  returning id into v_id;
  if v_id is not null then return jsonb_build_object('acao', 'reservado', 'id', v_id); end if;

  select * into a from public.hotmart_negociacoes
   where assinatura = p_assinatura and status in ('pedindo', 'gerado', 'incerto') limit 1;
  if a.user_id is distinct from p_user then raise exception 'assinatura de outra conta'; end if;
  return case a.status
    when 'gerado' then jsonb_build_object('acao', 'reutilizar', 'id', a.id, 'transacao', a.transacao, 'pix_code', a.pix_code,
                                          'pix_qrcode', a.pix_qrcode, 'vence_em', a.vence_em, 'valor', a.valor, 'recorrencia', a.recorrencia)
    when 'pedindo' then jsonb_build_object('acao', 'em_andamento', 'id', a.id)
    else jsonb_build_object('acao', 'incerto', 'id', a.id, 'pedido_em', a.pedido_em, 'transacoes_antes', a.transacoes_antes, 'transacao', a.transacao) end;
end $$;

-- Hotmart answered. p_resultado: 'gerado' (Pix in hand), 'falhou' (Hotmart refused: no charge
-- exists, a new request is allowed) or 'incerto' (no answer: a charge may exist).
create or replace function public.hotmart_negociacao_gravar(
  p_id uuid, p_resultado text, p_transacao text default null, p_pix_code text default null,
  p_pix_qrcode text default null, p_vence timestamptz default null, p_erro text default null
) returns text language plpgsql security definer set search_path to 'public' as $$
begin
  if auth.jwt() ->> 'role' is distinct from 'service_role' then raise exception 'so o servidor'; end if;
  if p_resultado not in ('gerado', 'falhou', 'incerto') then raise exception 'resultado invalido'; end if;
  if p_resultado = 'gerado' and (coalesce(p_transacao, '') = '' or coalesce(p_pix_code, '') = '') then
    raise exception 'pix sem transacao ou sem codigo';
  end if;
  update public.hotmart_negociacoes
     set status = p_resultado, transacao = nullif(p_transacao, ''), pix_code = p_pix_code, pix_qrcode = p_pix_qrcode,
         vence_em = p_vence, erro = left(p_erro, 300), atualizado_em = now()
   where id = p_id and status in ('pedindo', 'incerto');
  return case when found then p_resultado else 'ignorado' end;
end $$;

-- Reconciliation of an 'incerto' request, after reading Hotmart's purchase history again:
--   sem_cobranca       → Hotmart created nothing: the request is closed as 'falhou' (asking again is safe)
--   cobranca_existe    → a charge exists at Hotmart: its transaction is recorded so the payment is
--                        recognised by the webhook; the subscription STAYS blocked for a new Pix
--   cobranca_encerrada → that charge expired/was cancelled unpaid: closed as 'vencido' (asking again is safe)
create or replace function public.hotmart_negociacao_reconciliar(p_id uuid, p_resultado text, p_transacao text default null)
returns text language plpgsql security definer set search_path to 'public' as $$
begin
  if auth.jwt() ->> 'role' is distinct from 'service_role' then raise exception 'so o servidor'; end if;
  if p_resultado not in ('sem_cobranca', 'cobranca_existe', 'cobranca_encerrada') then raise exception 'resultado invalido'; end if;
  if p_resultado <> 'sem_cobranca' and coalesce(p_transacao, '') = '' then raise exception 'falta a transacao'; end if;
  update public.hotmart_negociacoes
     set status = case p_resultado when 'sem_cobranca' then 'falhou' when 'cobranca_encerrada' then 'vencido' else 'incerto' end,
         transacao = coalesce(nullif(p_transacao, ''), transacao),
         erro = 'reconciliado: ' || p_resultado, atualizado_em = now()
   where id = p_id and status = 'incerto';
  return case when not found then 'ignorado' when p_resultado = 'cobranca_existe' then 'incerto' when p_resultado = 'sem_cobranca' then 'falhou' else 'vencido' end;
end $$;

-- The webhook saw this negotiation's transaction approved. Idempotent (APPROVED, then COMPLETE).
create or replace function public.hotmart_negociacao_paga(p_id uuid, p_nota text default null)
returns text language plpgsql security definer set search_path to 'public' as $$
begin
  if auth.jwt() ->> 'role' is distinct from 'service_role' then raise exception 'so o servidor'; end if;
  update public.hotmart_negociacoes
     set status = 'pago', pago_em = now(), erro = left(p_nota, 300), atualizado_em = now()
   where id = p_id and status <> 'pago';
  return case when found then 'paga' else 'ja_paga' end;
end $$;

-- The logged-in person's own state: the valid Pix, or bloqueado = true while a request is being
-- made or is uncertain (the app keeps "Gerar Pix" disabled until the reconciliation), or null.
create or replace function public.hotmart_negociacao_minha()
returns jsonb language sql stable security definer set search_path to 'public' as $$
  select coalesce(
    (select jsonb_build_object('pix_code', n.pix_code, 'pix_qrcode', n.pix_qrcode, 'vence_em', n.vence_em, 'valor', n.valor,
                               'recorrencia', n.recorrencia, 'assinatura', n.assinatura)
       from public.hotmart_negociacoes n
      where n.user_id = auth.uid() and n.status = 'gerado' and n.vence_em > now()
      order by n.pedido_em desc limit 1),
    (select jsonb_build_object('bloqueado', true, 'assinatura', n.assinatura)
       from public.hotmart_negociacoes n
      where n.user_id = auth.uid() and n.status in ('pedindo', 'incerto')
      order by n.pedido_em desc limit 1));
$$;

revoke all on function public.hotmart_negociacao_reservar(uuid, text, bigint, integer, numeric, timestamptz, text, jsonb) from public, anon, authenticated;
revoke all on function public.hotmart_negociacao_reconciliar(uuid, text, text) from public, anon, authenticated;
grant execute on function public.hotmart_negociacao_reconciliar(uuid, text, text) to service_role;
revoke all on function public.hotmart_negociacao_gravar(uuid, text, text, text, text, timestamptz, text) from public, anon, authenticated;
grant execute on function public.hotmart_negociacao_reservar(uuid, text, bigint, integer, numeric, timestamptz, text, jsonb) to service_role;
grant execute on function public.hotmart_negociacao_gravar(uuid, text, text, text, text, timestamptz, text) to service_role;
revoke all on function public.hotmart_negociacao_paga(uuid, text) from public, anon, authenticated;
grant execute on function public.hotmart_negociacao_paga(uuid, text) to service_role;
revoke all on function public.hotmart_negociacao_minha() from public, anon;
grant execute on function public.hotmart_negociacao_minha() to authenticated;
