-- 26/11/2026 (Rick): "Plano de assinatura já foi comprado anteriormente" on renewal.
-- Cause: every "Renovar"/"Assinar" sent the person to a NEW checkout of the same Hotmart offer,
-- even when Hotmart still keeps his subscription alive (PAST_DUE = overdue, STARTED = first
-- payment pending, ACTIVE). Hotmart refuses a second subscription of the same plan, so he is
-- stuck. The fix: one server decision of the right path, read by every checkout button.
--
-- assinatura_caminho_de(user) → jsonb { acao, assinatura, status, oferta, plano, proxima_cobranca, valor, tem_pix }
--   em_dia       ACTIVE subscription and access released → nothing to buy again
--   conciliar    ACTIVE on Hotmart but access blocked here → check with Hotmart and release
--   regularizar  PAST_DUE / DELAYED / OVERDUE → pay the existing charge (Pix or Hotmart area)
--   pendente     STARTED → the first payment is still open (Pix/boleto) → pay it
--   nova         no live subscription (none, or cancelled / inactive) → a normal new checkout
-- Only the main plan counts (the extra-bank add-on is never a reason to block a plan checkout).
-- Read only: it changes nothing. Rollback: supabase/assinatura-caminho/rollback.sql
create or replace function public.assinatura_caminho_de(p_user uuid)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare
  a record; v_ativo boolean; v_pix boolean;
begin
  if p_user is null then return jsonb_build_object('acao', 'nova'); end if;
  select (coalesce(p.plan_status, '') = 'active' or coalesce(p.billing_exempt, false)) into v_ativo
    from public.profiles p where p.user_id = p_user;
  select x.subscription_id, x.status_hotmart, x.oferta_codigo, x.plano, x.proxima_cobranca, x.valor into a
    from public.orbis_hotmart_assinatura x
   where x.user_id = p_user
     and coalesce(x.oferta_codigo, '') not in ('3nnrr1xn', 'otgozkn9')
     and not exists (select 1 from public.bancos_extra_compras b where b.chave = x.subscription_id)
     and x.status_hotmart in ('ACTIVE', 'PAST_DUE', 'DELAYED', 'OVERDUE', 'STARTED')
   order by case x.status_hotmart when 'ACTIVE' then 0 when 'STARTED' then 2 else 1 end,
            x.ultimo_evento_em desc nulls last
   limit 1;
  if a.subscription_id is null then return jsonb_build_object('acao', 'nova'); end if;
  v_pix := exists (select 1 from public.renovacao_pix_de(p_user) r where r.subscription_id = a.subscription_id);
  return jsonb_build_object(
    'acao', case when a.status_hotmart = 'ACTIVE' then case when coalesce(v_ativo, false) then 'em_dia' else 'conciliar' end
                 when a.status_hotmart = 'STARTED' then 'pendente'
                 else 'regularizar' end,
    'assinatura', a.subscription_id, 'status', a.status_hotmart, 'oferta', a.oferta_codigo, 'plano', a.plano,
    'proxima_cobranca', a.proxima_cobranca, 'valor', a.valor, 'tem_pix', v_pix);
end $$;
revoke all on function public.assinatura_caminho_de(uuid) from public, anon, authenticated;
grant execute on function public.assinatura_caminho_de(uuid) to service_role;   -- hotmart-conciliar

-- the logged-in person's own path
create or replace function public.assinatura_caminho()
returns jsonb language sql stable security definer set search_path to 'public' as $$
  select public.assinatura_caminho_de(auth.uid());
$$;
revoke all on function public.assinatura_caminho() from public, anon;
grant execute on function public.assinatura_caminho() to authenticated;

-- /assinar?t=… opened from the store app (no session): the same path, by the 30-minute token
create or replace function public.assinar_token_caminho(p_token text)
returns jsonb language sql stable security definer set search_path to 'public' as $$
  select coalesce((select public.assinatura_caminho_de(t.user_id) from public.assinar_tokens t
                    where t.token = p_token and t.criado_em > now() - interval '30 minutes'), jsonb_build_object('acao', 'nova'));
$$;
revoke all on function public.assinar_token_caminho(text) from public;
grant execute on function public.assinar_token_caminho(text) to anon, authenticated;

-- "Já paguei, conferir": at most one Hotmart check per person per minute (edge hotmart-conciliar)
create table if not exists public.hotmart_conciliacoes (
  id bigint generated always as identity primary key,
  user_id uuid not null,
  em timestamptz not null default now(),
  resultado jsonb
);
create index if not exists hotmart_conciliacoes_user on public.hotmart_conciliacoes (user_id, em desc);
alter table public.hotmart_conciliacoes enable row level security;
revoke all on public.hotmart_conciliacoes from anon, authenticated;
grant select, insert on public.hotmart_conciliacoes to service_role;
