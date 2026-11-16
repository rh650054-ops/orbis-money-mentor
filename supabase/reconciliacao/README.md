# Reconciliation of the Mercado Pago copies — nothing here has been run

Until the provider-reference rule (#319) is live, a re-issued Pluggy id is stored as a new entry
on the oldest day of the read window. This folder holds what is needed to take the proven copies
out **reversibly and with evidence**. It is separate from any code publication, and every step
needs the owner's explicit approval.

| piece | what it is | state |
|---|---|---|
| `pluggy-conferir` (`supabase/functions`) | read-only check of stored entries against Pluggy; produces the evidence, pair by pair | written and tested; **not published** |
| `quarentena-de-entradas.sql` | moves approved pairs, whole and with their evidence, to a quarantine table; can put a batch back identical | written and tested; **not run** |

State on 16/11/2026 09:40 BRT (read-only detector at the end): **220 candidate copies,
R$ 4,955.26, 6 sellers, 10 connection-days (09–12/11)**. None is approvable yet: the evidence from
Pluggy does not exist until the checker runs.

## What this does not do
It does not change `daily_sales`, calotes, ranking caches or prizes. Taking an entry out changes
what the next reconciliation computes; recomputing is the last step, with its own approval. The
automatic reconciliation only reaches the last 6 days, so days already outside it need an approved
manual recomputation.

## The six conditions (per pair: the entry that goes out, the entry that stays)

| # | condition | who proves it |
|---|---|---|
| 1 | connection and account of both entries known and equal | checker (`conta_identificada`); routine re-checks the connection |
| 2 | every stored attribute equal: day, amount, description, Pix flag, instant, payer | checker (`atributos_iguais`); routine compares column by column |
| 3 | one of the two was created on/after day + 3 (Brasília) — the copy | checker (`copia_tardia`); routine re-checks |
| 4 | Pluggy does not have the id that goes out (404) **and** has the id that stays | checker (`sai_nao_existe`, `fica_existe`) |
| 5 | the whole statement was read, and it lists fewer payments like this than are stored | checker (`contagem_confere`); routine never leaves fewer than the statement listed |
| 6 | the entry that goes out was not used: status pending, no linked sale, no review decision | checker (`nao_usada`); routine re-checks |

Same day and same amount is never enough: Mercado Pago personal accounts send no time and no
payer, so two real Pix of R$ 20 are identical in every stored attribute. A 404 is never enough
either: without the count (5) it proves nothing about which rows are in excess.

### Three classes
| class | meaning | may be quarantined |
|---|---|---|
| `comprovada_por_id` | all six | yes, on approval of the list |
| `comprovada_por_contagem` | all but 4b: the id that stays is gone too (Pluggy re-issued again after the day left the window). Only the statement's count says how many are in excess; the oldest stay, the late ones go | only if the owner approves **this standard by name** (`p_por_contagem => true`) |
| `ambigua` | any condition missing, with the reason | never |

For 09–12/11 the second class is the likely one: those ids have been re-issued several times since.

## The checker (`pluggy-conferir`)
Read-only by construction: it selects from the database and sends only GET to Pluggy (plus the
usual key request); a test fails if either file gains a write. Gated by the cron token.
One connection and at most 7 days per call. For each pair it returns: connection and account
(8 characters), day, amount, both Pluggy ids with their creation time and what Pluggy says of each
(`listada` / `existe` / `nao_existe` / `sem_resposta`), the provider's reference of the entry that
stays as kind + change detector (never the value), stored vs listed count, the seven flags, the
class and the reasons. Per day it also reports payments the statement lists that are **not**
stored (`faltando`). Its log line has counts only.

Call (after approval to publish it; the token never leaves the database):
```sql
select net.http_post(
  url := 'https://qbcsjsdwjjpybvzbxszi.supabase.co/functions/v1/pluggy-conferir',
  headers := jsonb_build_object('Content-Type', 'application/json', 'x-orbis-cron', (select token from painel_tokens where nome = 'cron')),
  body := jsonb_build_object('conexao', '<connection uuid>', 'de', '2026-11-09', 'ate', '2026-11-12'),
  timeout_milliseconds := 120000);
-- then: select status_code, content::jsonb from net._http_response where id = <returned id>;
```

## Procedure
1. Publish #319, so nothing new is copied while this runs.
2. Publish `pluggy-conferir` (`verify_jwt = false`) and run it for each affected connection.
3. Owner receives the report: pairs by class, totals per seller and day, before and after.
4. Owner approves a list (and, separately, whether `comprovada_por_contagem` is accepted).
5. Rehearsal: `begin;` load `quarentena-de-entradas.sql`, call
   `pg_temp.quarentena_mover(lote, motivo, reports cut down to the approved pairs)`, read the
   summary, `rollback;`.
6. Same call, `commit`. All or nothing: the routine refuses the whole batch if any pair lacks a
   documented condition, comes from a report older than 24 h or from a partial statement, no
   longer matches the database, was used meanwhile, or would leave fewer entries than the
   statement listed.
7. Separate approval: recompute sales, calotes and ranking for the affected sellers and days, with
   a before/after report. Prizes of the affected periods stay provisional until then.

## Reversal
`pg_temp.quarentena_restaurar(lote)` puts every row of a batch back exactly as it was (same id,
same `created_at`, every column) and marks the quarantine rows as restored. All or nothing.

## Rehearsed on 16/11 (isolated local database, synthetic rows in production's shape, simulated evidence)
220 pairs, 6 sellers, 10 connection-days. With the one pair whose entry has a review decision the
whole batch was refused; without it 219 entries (R$ 4,433.97) moved and every seller-day was left
with exactly its real payments; `rollback` left the table byte-identical; a committed batch
followed by `quarentena_restaurar` left it byte-identical too.

## Known hazard, seen in production
When Pluggy sends `transactions/deleted`, the importer re-reads 7 days and removes vanished rows
that have a same-day, same-amount twin — by day and amount, with no record. Between 15/11 19:30
and 16/11 09:40 this removed 68 of the copies counted the day before (two connection-days) on its
own. The numbers above therefore move without anyone acting, and the checker must be run close to
the approval.

## Detector (read-only, database only — candidates, not proof)
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
