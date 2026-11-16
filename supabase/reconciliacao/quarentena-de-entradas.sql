-- Vant — reversible removal of PROVEN copies of bank entries (prepared 15/11/2026, revised 16/11).
-- NOT a migration and NOT run by anything: an operator runs it, on the owner's explicit
-- approval, for pairs that carry the evidence produced by pluggy-conferir. See README.md here.
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
  evidencia jsonb not null,              -- the pair as pluggy-conferir reported it, plus when that report was made
  movida_em timestamptz not null default now(),
  restaurada_em timestamptz,
  unique (lote, transaction_id)
);
alter table public.auto_detected_sales_quarentena enable row level security;
revoke all on public.auto_detected_sales_quarentena from anon, authenticated;
comment on table public.auto_detected_sales_quarentena is 'Bank entries taken out as proven copies, kept whole with their evidence so a batch can be put back. Server only.';

-- p_relatorios: an array of reports exactly as pluggy-conferir returned them, each cut down to the
--   pairs the owner approved. A pair is the unit; without its evidence nothing moves.
-- p_por_contagem: also accept class "comprovada_por_contagem" (the id that stays is gone too and
--   only the statement's count speaks). False unless the owner approved that standard by name.
-- ALL OR NOTHING: one refused pair aborts the whole batch.
--
-- For every pair the routine requires the six conditions twice — as documented in the evidence,
-- and again, where the database can tell, as they are NOW:
--   1 connection and account   evidence: conta_identificada · now: both rows in the connection the report names
--   2 every attribute equal    evidence: atributos_iguais   · now: compared column by column
--   3 a late copy              evidence: copia_tardia       · now: one of the two created on/after day + 3 (Brasília)
--   4 ids at Pluggy            evidence: sai_nao_existe, and fica_existe (or class por_contagem, if allowed)
--   5 count against statement  evidence: contagem_confere, from a WHOLE statement at most 24 h old
--                              · now: what stays of that payment is never fewer than the statement listed
--   6 not used                 evidence: nao_usada          · now: status pending, no linked sale, no review decision
create or replace function pg_temp.quarentena_mover(p_lote text, p_motivo text, p_relatorios jsonb, p_por_contagem boolean default false) returns jsonb
language plpgsql as $$
declare
  v_n int; v_movidas int; v_problema text;
begin
  if coalesce(trim(p_lote), '') = '' or coalesce(trim(p_motivo), '') = '' then raise exception 'lote and motivo are required'; end if;
  if exists (select 1 from public.auto_detected_sales_quarentena where lote = p_lote) then raise exception 'lote % already used', p_lote; end if;
  if jsonb_typeof(p_relatorios) is distinct from 'array' then raise exception 'p_relatorios must be an array of pluggy-conferir reports'; end if;

  if to_regclass('pg_temp._pares') is not null then drop table _pares; end if;
  create temp table _pares on commit drop as
    select par->'sai'->>'transaction_id' as sai, par->'fica'->>'transaction_id' as fica, par->>'classe' as classe,
           par->>'conexao' as conexao, (par->>'dia')::date as dia, (par->>'valor')::numeric as valor,
           (par->'sai'->>'criada_em')::timestamptz as sai_criada_em,
           (par->'contagem'->>'no_extrato')::int as no_extrato,
           coalesce((rel->>'extrato_completo')::boolean, false) as extrato_completo,
           (rel->>'gerado_em')::timestamptz as gerado_em,
           par->'condicoes' as c, coalesce(jsonb_array_length(par->'motivos'), 1) as n_motivos,
           par || jsonb_build_object('relatorio_gerado_em', rel->>'gerado_em') as evidencia
    from jsonb_array_elements(p_relatorios) rel, jsonb_array_elements(coalesce(rel->'pares', '[]'::jsonb)) par;
  select count(*) into v_n from _pares;
  if v_n = 0 then raise exception 'empty batch'; end if;

  select string_agg(distinct p, '; ') into v_problema from (
    -- the list itself
    select 'pair without ids' p from _pares where sai is null or fica is null
    union all select 'id listed twice or on both sides' from _pares group by sai having count(*) > 1
    union all select 'id listed twice or on both sides' from _pares a join _pares b on a.sai = b.fica
    -- the evidence, as documented
    union all select 'evidence: report missing, older than 24 hours or from the future' from _pares
      where gerado_em is null or gerado_em < now() - interval '24 hours' or gerado_em > now() + interval '5 minutes'
    union all select 'evidence: the statement was not whole' from _pares where not extrato_completo
    union all select 'evidence: class not approvable' from _pares
      where classe is null or not (classe = 'comprovada_por_id' or (p_por_contagem and classe = 'comprovada_por_contagem'))
    union all select 'evidence: a condition is not documented as met' from _pares
      where n_motivos <> 0
         or not coalesce((c->>'conta_identificada')::boolean, false) or not coalesce((c->>'atributos_iguais')::boolean, false)
         or not coalesce((c->>'copia_tardia')::boolean, false) or not coalesce((c->>'sai_nao_existe')::boolean, false)
         or not coalesce((c->>'contagem_confere')::boolean, false) or not coalesce((c->>'nao_usada')::boolean, false)
         or (classe = 'comprovada_por_id' and not coalesce((c->>'fica_existe')::boolean, false))
    -- the database, as it is now
    union all select 'entry to remove not found' from _pares p left join public.auto_detected_sales s on s.transaction_id = p.sai where s.id is null
    union all select 'entry to keep not found' from _pares p left join public.auto_detected_sales f on f.transaction_id = p.fica where f.id is null
    union all select 'now: the row is not the one the evidence describes (connection, day, amount or creation time)'
      from _pares p join public.auto_detected_sales s on s.transaction_id = p.sai
      where left(s.bank_connection_id::text, 8) is distinct from p.conexao or s.transaction_date is distinct from p.dia
         or s.amount is distinct from p.valor or s.created_at is distinct from p.sai_criada_em
    union all select 'now: pair differs in connection, day, amount, description, pix, time or payer'
      from _pares p join public.auto_detected_sales s on s.transaction_id = p.sai join public.auto_detected_sales f on f.transaction_id = p.fica
      where (s.bank_connection_id, s.user_id, s.transaction_date, s.amount) is distinct from (f.bank_connection_id, f.user_id, f.transaction_date, f.amount)
         or (s.description, s.is_pix, s.transacted_at, s.pagador_doc, s.pagador_nome) is distinct from (f.description, f.is_pix, f.transacted_at, f.pagador_doc, f.pagador_nome)
    union all select 'now: neither entry of the pair was created on or after day + 3'
      from _pares p join public.auto_detected_sales s on s.transaction_id = p.sai join public.auto_detected_sales f on f.transaction_id = p.fica
      where greatest(s.created_at, f.created_at) at time zone 'America/Sao_Paulo' < (s.transaction_date + 3)::timestamp
    -- an entry the seller, a sale or a review decision already used is never taken out by this routine
    union all select 'now: entry to remove was used (status, linked sale or review decision)' from _pares p join public.auto_detected_sales s on s.transaction_id = p.sai
      where s.status <> 'pending' or s.daily_sale_id is not null
         or exists (select 1 from public.banco_entradas_revisao r where r.transaction_id = s.transaction_id)
    -- never below what the statement listed for that payment
    union all select 'now: fewer identical entries would stay than the statement listed'
      from (select s.bank_connection_id, s.transaction_date, s.amount, s.description, s.is_pix, s.transacted_at, s.pagador_doc, s.pagador_nome,
                   count(*) as saem, max(p.no_extrato) as no_extrato
              from _pares p join public.auto_detected_sales s on s.transaction_id = p.sai group by 1, 2, 3, 4, 5, 6, 7, 8) g
      where coalesce(g.no_extrato, 0) < 1
         or (select count(*) from public.auto_detected_sales a
              where (a.bank_connection_id, a.transaction_date, a.amount) = (g.bank_connection_id, g.transaction_date, g.amount)
                and (a.description, a.is_pix, a.transacted_at, a.pagador_doc, a.pagador_nome) is not distinct from (g.description, g.is_pix, g.transacted_at, g.pagador_doc, g.pagador_nome)
            ) - g.saem < g.no_extrato
  ) q;
  if v_problema is not null then raise exception 'batch refused: %', v_problema; end if;

  insert into public.auto_detected_sales_quarentena (lote, motivo, transaction_id, par_transaction_id, user_id, bank_connection_id, transaction_date, amount, linha, evidencia)
    select p_lote, p_motivo, s.transaction_id, p.fica, s.user_id, s.bank_connection_id, s.transaction_date, s.amount, to_jsonb(s), p.evidencia
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
