-- ============================================================
-- BANCO EXTRA PAGO (Rick, 03/10/2026): +R$ 10/mês na Hotmart
-- (produto N104683123F, oferta otgozkn9). Cada assinatura ativa da
-- oferta libera 1 banco a mais no Open Finance.
--   • bancos_extra_compras: uma linha por assinatura (chave = código do
--     assinante na Hotmart, ou a transação se não houver), ativa até `ate`
--     (30 dias + 3 de tolerância, renovado a cada cobrança).
--   • banco_extra_registrar(): só o servidor (hotmart-webhook) chama.
--   • open_finance_limite(): extras = os dados à mão (bancos_extra.extras)
--     + as assinaturas ativas e no prazo. Vencer sem renovar tira a vaga
--     sozinho, sem depender de robô.
-- Idempotente, sem comandos de apagar.
-- ============================================================

create table if not exists public.bancos_extra_compras (
  chave text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  ativo boolean not null default true,
  ate timestamptz not null,
  atualizado_em timestamptz not null default now()
);
create index if not exists bancos_extra_compras_user_idx on public.bancos_extra_compras (user_id);
alter table public.bancos_extra_compras enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'bancos_extra_compras' and policyname = 'bancos_extra_compras_dono_le') then
    create policy bancos_extra_compras_dono_le on public.bancos_extra_compras for select to authenticated using (user_id = (select auth.uid()));
  end if;
end $$;

create or replace function public.banco_extra_registrar(p_user uuid, p_chave text, p_ativo boolean, p_ate timestamptz)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'apenas o servidor';
  end if;
  if p_user is null or coalesce(p_chave, '') = '' then
    raise exception 'compra sem dono ou sem chave';
  end if;
  insert into public.bancos_extra_compras (chave, user_id, ativo, ate, atualizado_em)
  values (p_chave, p_user, p_ativo, case when p_ativo then p_ate else now() end, now())
  on conflict (chave) do update
    set user_id = excluded.user_id,
        ativo = excluded.ativo,
        ate = case when excluded.ativo then greatest(public.bancos_extra_compras.ate, excluded.ate) else now() end,
        atualizado_em = now();
end $$;

create or replace function public.open_finance_limite(p_user uuid default null)
returns jsonb language sql stable security definer set search_path to 'public' as $$
  with u as (select coalesce(p_user, auth.uid()) as id),
  x as (select * from public.bancos_extra where user_id = (select id from u)),
  pagos as (select count(*)::int n from public.bancos_extra_compras
             where user_id = (select id from u) and ativo and ate > now()),
  ext as (select coalesce((select extras from x), 0) + (select n from pagos) as n),
  usados as (select count(*)::int n from public.bank_connections
              where user_id = (select id from u) and coalesce(status, '') <> 'deleted')
  select jsonb_build_object(
    'usados', (select n from usados),
    'isento', coalesce((select isento from x), false),
    'extras', (select n from ext),
    'limite', case when coalesce((select isento from x), false) then null else 1 + (select n from ext) end,
    'pode_conectar', coalesce((select isento from x), false) or (select n from usados) < 1 + (select n from ext)
  )
  where (select id from u) is not null
    and (p_user is null or p_user = auth.uid() or auth.role() = 'service_role');
$$;
grant execute on function public.open_finance_limite(uuid) to authenticated;
