-- Aba Estoque, "Ajustar estoque" (25/11/2026, Rick): "o sistema mostra 20 garrafas, mas eu contei 17".
-- A physical count of ONE ingredient, with a reason, kept in history. It is not a purchase (no cost,
-- no Mercado row) and not a production. Additive only: one new table + one function. No existing row,
-- function or policy is changed.
--   estoque_ajustes: who, which ingredient, before, after, reason, when. Read by the owner; written
--   only by the function below (no insert/update/delete policy).
--   ingrediente_ajustar_estoque(ingrediente, contado, motivo): locks the ingredient row, refuses a
--   negative count or an empty reason, sets the counted quantity and logs it in the same transaction.
--   The same count sent twice (double tap) changes nothing the second time.
-- Rollback: supabase/ajuste-estoque/rollback.sql

create table if not exists public.estoque_ajustes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  ingredient_id uuid not null references public.ingredients(id) on delete cascade,
  antes numeric not null,
  depois numeric not null check (depois >= 0),
  diferenca numeric generated always as (depois - antes) stored,
  motivo text not null check (char_length(motivo) between 3 and 200),
  criado_em timestamptz not null default now()
);
create index if not exists estoque_ajustes_ingrediente on public.estoque_ajustes (ingredient_id, criado_em desc);
alter table public.estoque_ajustes enable row level security;
drop policy if exists estoque_ajustes_dono on public.estoque_ajustes;
create policy estoque_ajustes_dono on public.estoque_ajustes for select using (user_id = auth.uid());
revoke insert, update, delete on public.estoque_ajustes from anon, authenticated;
revoke all on public.estoque_ajustes from anon;
grant select on public.estoque_ajustes to authenticated;

create or replace function public.ingrediente_ajustar_estoque(p_ingrediente uuid, p_contado numeric, p_motivo text)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare
  u uuid := auth.uid();
  v_antes numeric;
  v_motivo text := left(trim(coalesce(p_motivo, '')), 200);
begin
  if u is null then raise exception 'login necessario'; end if;
  if p_contado is null or p_contado < 0 or p_contado > 10000000 then raise exception 'quantidade invalida'; end if;
  if char_length(v_motivo) < 3 then raise exception 'motivo obrigatorio'; end if;
  select i.stock_quantity into v_antes from public.ingredients i where i.id = p_ingrediente and i.user_id = u for update;
  if not found then raise exception 'ingrediente não é seu'; end if;
  if v_antes = p_contado then
    return jsonb_build_object('antes', v_antes, 'depois', p_contado, 'mudou', false);
  end if;
  update public.ingredients set stock_quantity = p_contado, updated_at = now() where id = p_ingrediente;
  insert into public.estoque_ajustes (user_id, ingredient_id, antes, depois, motivo) values (u, p_ingrediente, v_antes, p_contado, v_motivo);
  return jsonb_build_object('antes', v_antes, 'depois', p_contado, 'diferenca', p_contado - v_antes, 'mudou', true);
end $$;
revoke all on function public.ingrediente_ajustar_estoque(uuid, numeric, text) from public, anon;
grant execute on function public.ingrediente_ajustar_estoque(uuid, numeric, text) to authenticated;
