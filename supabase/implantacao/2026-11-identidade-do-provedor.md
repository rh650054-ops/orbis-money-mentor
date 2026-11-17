# Rollout — Mercado Pago payment recognised by the provider's reference (PR #319)

Every step below needs the owner's explicit go. Nothing here is automatic.

Project: Supabase `qbcsjsdwjjpybvzbxszi` (Orbis Milion, sa-east-1, Postgres 17).
Functions: `pluggy-webhook`, `pluggy-hora`, `pluggy-sync`, `pluggy-item`.
Code before this change (the rollback point): commit `04effb5`.

## Phase 0 — merge
CI green (`app`, `sql`, `drift`). Merging changes nothing in production.

## Phase 1 — migration `20261115220000_entradas_identidade_do_provedor.sql`

### 1a. Before (read-only). Expected values in brackets.
```sql
select current_database(),                                                              -- [postgres]
       current_setting('server_version'),                                               -- [17.x]
       (select count(*) from public.auto_detected_sales),                               -- [≈ 23–25 thousand]
       (select count(*) from information_schema.columns where table_schema='public'
          and table_name='auto_detected_sales'
          and column_name in ('conta_id','provedor_ref','ids_anteriores')),             -- [0]
       to_regclass('public.auto_detected_sales_identidade_uq'),                         -- [null]
       to_regclass('public.banco_entradas_divergencias'),                               -- [null]
       (select count(*) from pg_stat_activity where xact_start < now() - interval '30 seconds'
          and pid <> pg_backend_pid());                                                 -- [0: no long transaction open]
```
Any other answer: stop.

### 1b. Run
The file is ONE transaction (`begin … commit`) that checks the database before and what it created
after; any failed check, or 3 s waiting for a lock, rolls everything back and it can be run again.
Send the whole file as one script. Avoid minute 0, 5, 10… (the robot runs every 5 minutes) only to
make a lock wait less likely; a wait is harmless (it fails clean).

### 1c. Migration history
Production's history (`supabase_migrations.schema_migrations`) is not keyed by this repository's
versions: its last rows are `20261111013056` / `20261111020423` (the application time of two
migrations whose files are `20261110120000` / `20261110121000`), and A-PR1 (`20261111170000`) and
the three migrations of 15/11 (`…190000`, `…200000`, `…210000`) are in the database but not in the
history. So:
- applying through the Supabase tool records a row with the application time and the name
  `entradas_identidade_do_provedor` — consistent with how the last ones were recorded;
- nothing is inserted by hand into that table, and no `db push` / `db reset` is run: the repair of
  versions stays a separate job, with the official CLI (`supabase migration repair`), for all the
  missing ones at once.

### 1d. After (read-only)
```sql
select (select string_agg(column_name || ':' || data_type, ', ' order by column_name) from information_schema.columns
          where table_schema='public' and table_name='auto_detected_sales'
            and column_name in ('conta_id','provedor_ref','ids_anteriores')),           -- [conta_id:text, ids_anteriores:ARRAY, provedor_ref:text]
       (select indisunique and indisvalid from pg_index
          where indexrelid='public.auto_detected_sales_identidade_uq'::regclass),       -- [true]
       (select relrowsecurity from pg_class where oid='public.banco_entradas_divergencias'::regclass), -- [true]
       (select count(*) from public.auto_detected_sales where provedor_ref is not null);               -- [0: nothing uses it yet]
```
And through the API (PostgREST must see the columns before any function is published):
`GET /rest/v1/auto_detected_sales?select=conta_id&limit=1` with the service key answers 200.
If it answers "column does not exist", reload the schema cache (`notify pgrst, 'reload schema'`) and ask again.

Between phase 1 and phase 2 production runs the old code over the new columns: it does not know
them, writes none of them, and behaves exactly as before.

## Phase 2 — publish the four functions
Same procedure as always: a stub that imports the function from the merge commit.
`verify_jwt`: `pluggy-webhook` false, `pluggy-hora` false, `pluggy-sync` true, `pluggy-item` true.
Order: `pluggy-sync`, `pluggy-item`, `pluggy-hora`, `pluggy-webhook` (the busiest last).

Smoke tests (unchanged answers): `pluggy-hora` without token → 401 `nao_autorizado`;
`pluggy-webhook` without secret → 401 `unauthorized`; `pluggy-sync` / `pluggy-item` with the
anonymous key → 401 `sem_login`.

## Phase 3 — the first real reads (24–48 h)

| # | what must be true | where |
|---|---|---|
| 1 | no `PROTECAO DESLIGADA`, no `estado indisponivel` | function logs |
| 2 | after its first read, each Mercado Pago personal connection has `provedor_ref` on the rows of the last 3 days whose ids came back | query A |
| 3 | `pluggy identidade: reemissao` shows `reconhecidas` > 0 (about 13 re-issues a day were seen) | function logs |
| 4 | no entry created after publication repeats a stored one | query B |
| 5 | `banco_entradas_divergencias` is empty (each row is a case to look at) | table |
| 6 | `adiadas`, `sem_referencia` and `a_conferir` are 0, or do not repeat on the same connection | function logs |
| 7 | `leitura_ok_em` of every Mercado Pago personal connection is less than 6 h old | `bank_connections` |
| 8 | other banks: same log lines, same error counts, p50/p95 of `pluggy-webhook` and `pluggy-hora` within 20% | function logs |
| 9 | decisions in `banco_entradas_revisao` pointing at no entry do not grow | query C |

Stop and go back (below) if: 4 fails; 7 fails for two connections or more; 5 or 6 grow from read
to read; any `23505` error repeats.

```sql
-- A: coverage of the reference, per Mercado Pago connection
select left(c.id::text, 8) con, count(*) filter (where s.provedor_ref like 'code:%') com_code,
       count(*) filter (where s.provedor_ref like 'id:%') com_id, count(*) filter (where s.provedor_ref is null) sem
from bank_connections c join auto_detected_sales s on s.bank_connection_id = c.id
where c.institution_name ilike 'mercado pago%' and c.status <> 'deleted' and s.transaction_date >= current_date - 3 group by 1;

-- B: entries created after publication that repeat a stored one (replace the timestamp)
select left(n.bank_connection_id::text, 8) con, n.transaction_date, count(*)
from auto_detected_sales n join auto_detected_sales o
  on o.bank_connection_id = n.bank_connection_id and o.transaction_date = n.transaction_date and o.amount = n.amount
 and o.description is not distinct from n.description and o.transacted_at is not distinct from n.transacted_at
 and o.created_at < n.created_at and o.transaction_id <> n.transaction_id
join bank_connections c on c.id = n.bank_connection_id and c.institution_name ilike 'mercado pago%'
where n.created_at > timestamptz '<publication time>'
  and (n.created_at at time zone 'America/Sao_Paulo')::date >= n.transaction_date + 3
group by 1, 2;

-- C: decisions left on an id that no longer exists
select count(*) from banco_entradas_revisao r where not exists (select 1 from auto_detected_sales a where a.transaction_id = r.transaction_id);
```

## Phase 4 — make the columns mandatory
One-line PR: `exigida: true` in `MODOS_DA_IDENTIDADE`. From then on a read that cannot find the
columns writes nothing and gets no stamp, instead of running unprotected.

## Going back — by code only
Once phase 2 happened the columns hold data and are never dropped.

| level | action | effect |
|---|---|---|
| 1 | one-line commit: `code: "observar"`, republish the four functions | re-issues are only counted; entries written as before this change; references keep being stored |
| 2 | republish the four functions from `04effb5` | the code from before; it ignores the columns and writes none of them. The unique index constrains only rows that carry a reference, so it never refuses anything that code writes |

Either level: copies can be stored again from that moment (the defect this change fixes).
Rows already pointed back keep their current id and their `ids_anteriores`.

## What stays exposed after phase 2
1. Mercado Pago business accounts (`providerId`): observed only; a re-issue on the oldest day is still copied.
2. A transaction that arrives without `providerCode` in an account that sends it: written as before, not stamped, logged. If it is a re-issue, a copy is stored next to the referenced row.
3. Rows without a reference (stored before, other banks) are still removed by the day-and-amount rule after a complete read; a list Pluggy cuts short without saying so cannot be told from a whole one.
4. A real payment with the reference, account and window of a vanished stored one but another day or amount is withheld as a divergence until decided.
5. Two transactions of one read with the same reference, day and amount: both stored, neither constrained.
6. An account with more than 5 pages in the window is never a whole list: re-issues wait, the read is not stamped.
7. The copies stored before publication (separate procedure, PR #321).

## 17/11 — an id handed to another payment (second change, code only)

**What production showed** (first night, statement of 6 connections checked 13–17/11; 28 of 30
connection-days equal to Pluggy's to the cent): Pluggy also gives an id that belonged to one
payment to another payment of the same amount. The importer trusted the id and rewrote the row.

| Seller | Day | Vant | Pluggy | What happened |
|---|---|---|---|---|
| 18b4ce0f | 13/11 | 23 · R$ 478.90 | 19 · R$ 383.90 | ids of three Pix of 16/11 came back as payments of 13/11 (already stored): +3 rows, +R$ 80 (one more row, R$ 15, was there before) |
| 820e8266 | 13/11 | 3 · R$ 41.00 | 6 · R$ 74.00 | ids of three Pix of 13/11 came back as payments of 16 and 17/11, with 13/11 no longer read: −3 rows, −R$ 33 |

**The rule** (`reaproveitados`, in `reapontarReemitidas`): a returned entry whose id is stored, in
this connection, with ANOTHER providerCode → the stored entry is not overwritten. It moves to an id
of its own (`vant-sem-id:` + digest of connection, account, reference, day, amount; its decision in
`banco_entradas_revisao` moves with it; the Pluggy id goes to `ids_anteriores`) and the returned
entry is a new id like any other. When the stored payment comes back under a new Pluggy id, the
existing re-issue rule points its row to it. Scope: both references of an applied kind
(providerCode). A stored row without reference, or a providerId, is rewritten exactly as before and
only counted.

**No migration.** `transaction_id` is text; nothing casts it.

**What to watch** — log `pluggy identidade: id reaproveitado {conexao, preservadas,
sem_referencia_so_observadas, adiadas}`:

```sql
-- stored entries currently without a Pluggy id (each one is a payment that was NOT overwritten)
select left(bank_connection_id::text, 8) conexao, transaction_date, count(*), sum(amount)
  from auto_detected_sales where transaction_id like 'vant-sem-id:%' group by 1, 2 order by 1, 2;
```

A day where that count grows AND Vant shows more entries than Pluggy's statement would mean a
provider changing the providerCode of one payment — never seen (72 re-issues recognised by
reference, 0 divergences); it would show here first.

**Rollback**: republish the four functions from the commit before this one. Rows already kept under
`vant-sem-id:` stay valid for the previous code (it never removes an entry that carries a
providerCode for being absent from a list) and are still pointed back by reference.

**Does NOT correct what already happened**: the 3 rows too many (18b4ce0f, 13/11) and the 3 missing
payments (820e8266, 13/11) are data corrections, to be authorised separately.

**Known**: `pluggy-conferir` (PR #321) asks Pluggy about every stored id it did not list; an id of
ours would be asked too. To be taught the prefix before the next use of the checker on a day that
has such rows.
