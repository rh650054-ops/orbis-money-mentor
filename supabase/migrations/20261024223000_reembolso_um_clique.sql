-- ============================================================
-- Reembolso com UM CLIQUE (Rick, 24/10/2026 — opção B). Nada sai do caixa sem ele ver.
-- O robô (hotmart-conferir) cancela o plano duplicado / o plano antigo de quem virou Pro
-- e registra em hotmart_cancelamentos_auto. Aqui a lista do que DÁ pra reembolsar:
--   duplicada  → cobranças da assinatura cancelada aprovadas até 2 dias de uma cobrança
--                da assinatura que ficou (pagou duas vezes a mesma coisa);
--   depois_pro → cobranças do plano antigo aprovadas NO DIA ou DEPOIS do 1º pagamento do Pro.
-- A função hotmart-reembolsar só reembolsa o que está nesta lista, e só pra admin.
-- ============================================================
create table if not exists public.hotmart_reembolsos (
  purchase_id text primary key,
  user_id uuid,
  subscription_id text,
  valor numeric,
  motivo text,
  por uuid,
  em timestamptz not null default now(),
  resultado text not null
);
alter table public.hotmart_reembolsos enable row level security;
revoke all on public.hotmart_reembolsos from anon, authenticated;

create or replace function public.admin_reembolsos_sugeridos()
returns table(purchase_id text, user_id uuid, nome text, subscription_id text, manteve text,
              motivo text, valor numeric, cobrado_em timestamptz, reembolsado_em timestamptz, resultado text)
language sql stable security definer set search_path to 'public' as $$
  with pag as (   -- 1 linha por cobrança aprovada
    select distinct on (e.purchase_id) e.purchase_id, e.subscription_id, e.valor, e.user_id,
           coalesce(case when (e.payload #>> '{data,purchase,approved_date}') ~ '^\d+$'
                         then to_timestamp((e.payload #>> '{data,purchase,approved_date}')::bigint / 1000) end, e.recebido_em) as em
      from public.hotmart_eventos e
     where e.event_type in ('PURCHASE_APPROVED','PURCHASE_COMPLETE') and e.purchase_id is not null and e.subscription_id is not null
     order by e.purchase_id, e.recebido_em
  ), c as (
    select distinct on (a.subscription_id) a.* from public.hotmart_cancelamentos_auto a order by a.subscription_id, a.em desc
  ), sug as (
    select p.purchase_id, c.user_id, c.subscription_id, c.manteve, 'duplicada'::text motivo, p.valor, p.em
      from c join pag p on p.subscription_id = c.subscription_id
     where c.motivo = 'duplicada'
       and exists (select 1 from pag k where k.subscription_id = c.manteve and abs(extract(epoch from (k.em - p.em))) <= 2 * 86400)
    union all
    select p.purchase_id, c.user_id, c.subscription_id, c.manteve, 'depois_pro', p.valor, p.em
      from c join pag p on p.subscription_id = c.subscription_id
     where c.motivo = 'upgrade_pro'
       and (p.em at time zone 'America/Sao_Paulo')::date >=
           (select min((k.em at time zone 'America/Sao_Paulo')::date) from pag k where k.subscription_id = c.manteve)
  )
  select s.purchase_id, s.user_id, coalesce(pr.nickname, '—'), s.subscription_id, s.manteve, s.motivo, s.valor, s.em,
         r.em, r.resultado
    from sug s
    left join public.profiles pr on pr.user_id = s.user_id
    left join public.hotmart_reembolsos r on r.purchase_id = s.purchase_id
   where public.is_orbis_admin()
     -- já reembolsado pela própria Hotmart (painel/cliente) não aparece como pendente
     and not exists (select 1 from public.hotmart_eventos x where x.purchase_id = s.purchase_id and x.event_type in ('PURCHASE_REFUNDED','PURCHASE_CHARGEBACK') and r.purchase_id is null)
   order by r.em nulls first, s.em desc;
$$;
revoke all on function public.admin_reembolsos_sugeridos() from public, anon;
grant execute on function public.admin_reembolsos_sugeridos() to authenticated, service_role;
