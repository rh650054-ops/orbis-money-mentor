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
--                   nothing new is asked until that is checked
create or replace function public.hotmart_negociacao_reservar(
  p_user uuid, p_assinatura text, p_hotmart_id bigint, p_recorrencia integer, p_valor numeric,
  p_proxima timestamptz, p_origem text default 'app'
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

  insert into public.hotmart_negociacoes (user_id, assinatura, hotmart_assinatura_id, recorrencia, valor, proxima_cobranca, origem)
  values (p_user, p_assinatura, p_hotmart_id, p_recorrencia, p_valor, p_proxima, coalesce(p_origem, 'app'))
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
    else jsonb_build_object('acao', 'incerto', 'id', a.id) end;
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

-- The logged-in person's own open Pix (null when there is none or it has expired).
create or replace function public.hotmart_negociacao_minha()
returns jsonb language sql stable security definer set search_path to 'public' as $$
  select jsonb_build_object('pix_code', n.pix_code, 'pix_qrcode', n.pix_qrcode, 'vence_em', n.vence_em, 'valor', n.valor,
                            'recorrencia', n.recorrencia, 'assinatura', n.assinatura)
    from public.hotmart_negociacoes n
   where n.user_id = auth.uid() and n.status = 'gerado' and n.vence_em > now()
   order by n.pedido_em desc limit 1;
$$;

revoke all on function public.hotmart_negociacao_reservar(uuid, text, bigint, integer, numeric, timestamptz, text) from public, anon, authenticated;
revoke all on function public.hotmart_negociacao_gravar(uuid, text, text, text, text, timestamptz, text) from public, anon, authenticated;
grant execute on function public.hotmart_negociacao_reservar(uuid, text, bigint, integer, numeric, timestamptz, text) to service_role;
grant execute on function public.hotmart_negociacao_gravar(uuid, text, text, text, text, timestamptz, text) to service_role;
revoke all on function public.hotmart_negociacao_minha() from public, anon;
grant execute on function public.hotmart_negociacao_minha() to authenticated;
