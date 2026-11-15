# Reconciliation of the Mercado Pago copies (prepared 15/11/2026 — nothing here has been run)

Until the provider-reference rule (#319) is live, a re-issued Pluggy id is stored as a new
entry on the oldest day of the read window. On 15/11/2026 19:30 BRT the read-only detector
below found **288 copies, R$ 5,768.26, 6 sellers, 12 connection-days (09–12/11)**, plus
5 isolated identical rows (R$ 372.91) that are **ambiguous** and are not to be touched.
None of the 288 had been used by a seller (`status = 'pending'`, no linked sale).

This document is the procedure to take the proven ones out **reversibly**. It is separate from
any code publication and each step needs the owner's explicit approval.

## What this does not do

It does not change `daily_sales`, calotes, ranking caches or prizes. Taking an entry out changes
what the next reconciliation computes; recomputing is step 6, with its own approval. The
automatic reconciliation only reaches the last 6 days, so days already outside it need an
approved manual recomputation.

## Three classes

| class | rule | action |
|---|---|---|
| proven copy | every condition of "Proof" below holds for the pair | quarantine |
| legitimate | its Pluggy id still exists, or any stored attribute differs from every other row | none |
| ambiguous | identical to another row but a condition of "Proof" is missing | none; listed in the report |

Same day and same amount is never enough. Mercado Pago personal accounts send no time and no
payer, so two real Pix of R$ 20 are identical in every stored attribute.

## Proof (per pair: the entry that goes out, the entry that stays)

1. Same connection, seller, day, amount, description, Pix flag, instant and payer.
2. The entry that goes out was created on or after day + 3 (Brasília), i.e. when that day was
   the oldest of the read window, in a batch that repeats entries already stored.
3. The batch repeats at least 3 entries of that connection-day.
4. Pluggy does not have the id that goes out (`GET /transactions/{id}` → 404) **and** lists the id
   that stays. A 404 alone proves nothing; with 1–3 it shows which of two identical rows is dead.
5. The number of entries left for that connection-day equals what Pluggy lists for it.
6. The entry that goes out was not used (`status = 'pending'`, `daily_sale_id is null`).

Conditions 4 and 5 need a read at Pluggy. Inside the read window they come for free once #319 is
live: a stored row whose id came back carries `provedor_ref`. For the days already outside the
window (09–12/11) there is no authorised tool yet; a read-only checker has to be built and
approved first. Until then those pairs satisfy 1, 2, 3 and 6 only and are **not** proven.

## Detector (read-only)

```sql
with mp as (select id from bank_connections where institution_name ilike 'mercado pago%' and status <> 'deleted'),
r as (select s.bank_connection_id con, s.transaction_date d, s.amount,
        md5(concat_ws('|', s.amount, s.description, s.is_pix, s.transacted_at, s.pagador_doc, s.pagador_nome)) fp,
        ((s.created_at at time zone 'America/Sao_Paulo')::date >= s.transaction_date + 3) tardia,
        date_trunc('minute', s.created_at) onda
      from auto_detected_sales s join mp on mp.id = s.bank_connection_id where s.transaction_date >= date '2026-11-01'),
o as (select con, d, fp, onda, bool_or(tardia) tardia, count(*) n, max(amount) amount from r group by 1, 2, 3, 4),
c as (select *, coalesce(sum(n) over (partition by con, d, fp order by onda rows between unbounded preceding and 1 preceding), 0) antes from o),
w as (select con, d, onda, sum(least(n, antes)) copias, sum(least(n, antes) * amount) valor from c where tardia group by 1, 2, 3)
select con, d, sum(copias) filter (where copias >= 3) copias, sum(valor) filter (where copias >= 3) valor,
       sum(copias) filter (where copias < 3) ambiguas
from w where copias > 0 group by 1, 2 order by 1, 2;
```

## Procedure

1. Publish #319 first, so nothing new is copied while this runs.
2. Build the list of pairs `{sai, fica}` and the evidence for each (the six conditions).
3. Owner approves the list (ids, totals before and after per seller and day).
4. Rehearsal: in one transaction, load `supabase/reconciliacao/quarentena-de-entradas.sql`,
   call `pg_temp.quarentena_mover(lote, motivo, pares)`, read its summary, `rollback`.
5. Same call, `commit`. The routine refuses the whole batch if any pair fails conditions 1 or 6,
   if an id is missing or listed twice, or if one kept entry is used for two removals. It moves
   each row whole (as JSON) to `auto_detected_sales_quarentena` and deletes it from the entries.
6. Separate approval: recompute sales, calotes and ranking for the affected sellers and days,
   with a before/after report. Prizes of the affected periods stay provisional until then.

## Reversal

`pg_temp.quarentena_restaurar(lote)` puts every row of a batch back exactly as it was (same id,
same `created_at`, every column) and marks the quarantine rows as restored. All or nothing.
Tested in `supabase/tests/casos/16_quarentena_de_entradas.sql`.

## Known hazard, independent of this procedure

When Pluggy sends `transactions/deleted`, the importer re-reads 7 days and removes vanished rows
that have a same-day, same-amount twin. That can remove some of these copies on its own, by day
and amount, with no record. The totals above can therefore change without anyone acting.
