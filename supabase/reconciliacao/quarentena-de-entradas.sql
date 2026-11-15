-- Vant — reversible removal of PROVEN copies of bank entries (prepared 15/11/2026).
-- NOT a migration and NOT run by anything: an operator runs it, on the owner's explicit
-- approval, for an explicit list of ids. See README.md in this folder.
--
-- What it leaves in the database: one table (the quarantine). The two routines live in pg_temp:
-- they exist only in the session that loaded this file.
--
-- It does NOT touch daily_sales, calotes, ranking caches or prizes. Removing an entry changes what
-- the next reconciliation computes; that step is separate and has its own approval.

create table if not exists public.auto_detected_sales_quarentena (
  id bigint generated always as identity primary key,
  lote text not null,                    -- one name per approved batch
  motivo text not null,
  transaction_id text not null,          -- the entry taken out
  par_transaction_id text not null,      -- the identical entry that STAYS (same connection, day, amount)
  user_id uuid not null,
  bank_connection_id uuid,
  transaction_date date not null,
  amount numeric not null,
  linha jsonb not null,                  -- the whole row exactly as it was, whatever columns the table has
  movida_em timestamptz not null default now(),
  restaurada_em timestamptz,
  unique (lote, transaction_id)
);
alter table public.auto_detected_sales_quarentena enable row level security;
revoke all on public.auto_detected_sales_quarentena from anon, authenticated;
comment on table public.auto_detected_sales_quarentena is 'Bank entries taken out as proven copies, kept whole so a batch can be put back. Server only.';

-- p_pares: [{"sai": "<transaction_id out>", "fica": "<transaction_id that stays>"}, ...]
-- All or nothing: any refused pair aborts the whole batch.
create or replace function pg_temp.quarentena_mover(p_lote text, p_motivo text, p_pares jsonb) returns jsonb
language plpgsql as $$
declare
  v_n int; v_movidas int; v_problema text;
begin
  if coalesce(trim(p_lote), '') = '' or coalesce(trim(p_motivo), '') = '' then raise exception 'lote and motivo are required'; end if;
  if exists (select 1 from public.auto_detected_sales_quarentena where lote = p_lote) then raise exception 'lote % already used', p_lote; end if;

  drop table if exists _pares;
  create temp table _pares on commit drop as
    select x->>'sai' sai, x->>'fica' fica from jsonb_array_elements(p_pares) x;
  select count(*) into v_n from _pares;
  if v_n = 0 then raise exception 'empty batch'; end if;

  select string_agg(distinct p, '; ') into v_problema from (
    select 'id listed twice or on both sides' p from _pares group by sai having count(*) > 1
    union all select 'id listed twice or on both sides' from _pares a join _pares b on a.sai = b.fica
    union all select 'the same entry is kept for two removals' from _pares group by fica having count(*) > 1
    union all select 'entry to remove not found' from _pares p left join public.auto_detected_sales s on s.transaction_id = p.sai where s.id is null
    union all select 'entry to keep not found' from _pares p left join public.auto_detected_sales f on f.transaction_id = p.fica where f.id is null
    union all select 'pair differs in connection, day, amount, description, pix, time or payer'
      from _pares p join public.auto_detected_sales s on s.transaction_id = p.sai join public.auto_detected_sales f on f.transaction_id = p.fica
      where (s.bank_connection_id, s.user_id, s.transaction_date, s.amount) is distinct from (f.bank_connection_id, f.user_id, f.transaction_date, f.amount)
         or (s.description, s.is_pix, s.transacted_at, s.pagador_doc, s.pagador_nome) is distinct from (f.description, f.is_pix, f.transacted_at, f.pagador_doc, f.pagador_nome)
    -- an entry the seller or a sale already used is never taken out by this routine
    union all select 'entry to remove was used (status or linked sale)' from _pares p join public.auto_detected_sales s on s.transaction_id = p.sai
      where s.status <> 'pending' or s.daily_sale_id is not null
  ) q;
  if v_problema is not null then raise exception 'batch refused: %', v_problema; end if;

  insert into public.auto_detected_sales_quarentena (lote, motivo, transaction_id, par_transaction_id, user_id, bank_connection_id, transaction_date, amount, linha)
    select p_lote, p_motivo, s.transaction_id, p.fica, s.user_id, s.bank_connection_id, s.transaction_date, s.amount, to_jsonb(s)
    from _pares p join public.auto_detected_sales s on s.transaction_id = p.sai;
  delete from public.auto_detected_sales s using _pares p where s.transaction_id = p.sai;
  get diagnostics v_movidas = row_count;
  if v_movidas <> v_n then raise exception 'moved % of % entries', v_movidas, v_n; end if;

  return jsonb_build_object('lote', p_lote, 'movidas', v_movidas,
    'valor', (select sum(amount) from public.auto_detected_sales_quarentena where lote = p_lote),
    'por_vendedor_e_dia', (select jsonb_agg(jsonb_build_object('user', left(user_id::text, 8), 'dia', transaction_date, 'entradas', n, 'valor', v) order by user_id, transaction_date)
      from (select user_id, transaction_date, count(*) n, sum(amount) v from public.auto_detected_sales_quarentena where lote = p_lote group by 1, 2) g));
end $$;

-- Puts a whole batch back exactly as it was (same id, same created_at, every column).
-- All or nothing: if any of its transaction_ids is stored again, nothing is restored.
create or replace function pg_temp.quarentena_restaurar(p_lote text) returns jsonb
language plpgsql as $$
declare v_n int; v_voltaram int;
begin
  select count(*) into v_n from public.auto_detected_sales_quarentena where lote = p_lote and restaurada_em is null;
  if v_n = 0 then raise exception 'lote % has nothing to restore', p_lote; end if;
  insert into public.auto_detected_sales
    select (jsonb_populate_record(null::public.auto_detected_sales, q.linha)).*
    from public.auto_detected_sales_quarentena q where q.lote = p_lote and q.restaurada_em is null;
  get diagnostics v_voltaram = row_count;
  if v_voltaram <> v_n then raise exception 'restored % of % entries', v_voltaram, v_n; end if;
  update public.auto_detected_sales_quarentena set restaurada_em = now() where lote = p_lote and restaurada_em is null;
  return jsonb_build_object('lote', p_lote, 'restauradas', v_voltaram);
end $$;
