# Open Finance V2 · Module A · A-PR1 — new records and mirror

First step of Module A (connections and consent). It adds the records the contract separates —
provider, Item, bank account, consent, purpose, events, audit — and fills them as a **mirror** of
what `bank_connections` and `bank_saldos` already say. Nothing reads these records yet. The app,
the edge functions, the crons, the ranking, the prizes and every existing table behave exactly as
before.

Merging this PR applies nothing. Applying the migration to production is a separate, explicit
authorisation.

## What it creates

| Table | What it holds |
| --- | --- |
| `of_provedores` | Who reads the bank for us. One row: Pluggy, the only bank-connection provider |
| `of_vinculos` | One row per provider Item (today: one per `bank_connections` row), with its state |
| `of_contas` | One row per bank account. Belongs to the vendor, not to the Item |
| `of_vinculo_contas` | Which Item sees which account, since when, until when |
| `of_consentimentos` | Authorisation state of each Item. Starts as `nao_informado`; never deduced from `UPDATED` |
| `of_finalidades` | Purpose (`trabalho`, `pessoal`, `misto`, `nao_definida`) with validity dates and history |
| `of_eventos` | Raw provider events. **Empty in A-PR1**; A-PR2 starts filling it |
| `of_mudancas` | Audit: every state change with its reason |
| `of_espelho_execucoes` | One row per mirror run: counters, problem kinds, divergences. No identifier |

| Function | What it does |
| --- | --- |
| `of_espelho_atualizar()` | Fills / refreshes the mirror. Idempotent, one run at a time, never deletes or merges |
| `of_vinculo_conta_de_venda(vinculo, quando)` | "Is this a sales account?" answered only from the new records |
| `of_espelho_conferir(quando)` | Compares that answer with `banco_conta_de_venda` for every connection. Empty = zero divergence |
| `of_espelho_relatorio()` | Numbers only: what the mirror holds and what did not fit |
| `of_espelho_duplicadas()` | Connections that look like copies of each other. Report only |

No trigger is created. No retention mechanism is created: that belongs to a later step, once the
real legal obligations are confirmed.

## What it does not do

- It alters no existing table, function, trigger or policy. No foreign key points at
  `bank_connections` or `bank_saldos` (it could block deletes that work today); the origin of
  each mirrored row is a plain id column.
- The one link to something that already exists: `user_id references auth.users on delete
  cascade`, the same key `bank_connections` and 68 other tables have. It changes nothing in
  `auth.users`; Postgres keeps two internal triggers per key there, as it does for the others.
- It writes nothing to `daily_sales`, `auto_detected_sales`, `extrato_lancamentos`, ranking,
  prizes, goals, badges or charges.
- It schedules nothing. The mirror runs only when called. A daily schedule is a separate decision.
- It proves no account identity and knows no account type: every mirrored account is
  `nao_identificada` / `desconhecido`, so **no two accounts are ever merged**.
- The mirror deletes nothing. A connection row that disappears leaves its link as `removido`
  (`origem_apagada`) with its history.

## Account deletion and isolation

When the account is deleted, every row of the vendor in the new tables goes with it, in the same
transaction, whichever routine deleted the account. Nothing is kept.

| Path today | What it does | Why the new tables are covered |
| --- | --- | --- |
| Self-service (`delete-my-account` → `apagar_dados_do_usuario`) | Deletes from every public table that has a `user_id` column, in no fixed order, then removes the login | The new tables have `user_id`; deletes cascade between them, so no order can fail |
| Admin (`admin-delete-user`) | Deletes a fixed list of tables (none of the new ones), then removes the login | Removing the login cascades through the foreign keys |
| Supabase dashboard | Removes the login | Same |

No existing routine had to change. The run log keeps numbers and problem kinds only — never the
error text, which can quote a row's values — so no identifier outlives the vendor there either.

Isolation is structural: the vendor is part of the foreign keys between the new tables
(`(vinculo_id, user_id)`, `(conta_id, user_id)`), so the database refuses to tie one vendor's
Item to another vendor's account, or to write a purpose or a change for someone else's Item.

## How the old role becomes a purpose

| `bank_connections` | Mirror |
| --- | --- |
| `status = 'deleted'` | link `removido` |
| `pausado_em` set | link `pausado` |
| anything else | link `ativo` |
| `papel` null | purpose `nao_definida` |
| `papel = 'trabalho'` | purpose `trabalho`, in force from `papel_desde` — or from the start of that month (Brasília) when `papel_auto`, exactly like the rule in force |
| `papel = 'pessoal'` | purpose `pessoal` |

The purpose is stored on the link (`conta_id` null = "what the accounts of this Item inherit").
Per-account purposes come with A-PR5. A purpose whose origin is not `papel_legado` (for instance
one the vendor chose) is never overwritten by the mirror.

## Access

Server only. Row level security is on with no policy, and every privilege Supabase grants by
default to `anon` and `authenticated` is revoked on the tables, their sequences and the functions.
`service_role` keeps access. All functions are `security invoker`.

## Tests (`npm run test:sql`)

| Case | What it proves | Checks |
| --- | --- | --- |
| `10_modulo_a_espelho` | One bank, two banks, no role, removed connection, three reconnections, an Item with two accounts, a role that starts tomorrow; consent never deduced; idempotency; the lock; role change, pause, removal, hard-deleted row, same Item under a new row; incomplete origin rows; no pre-existing table changes | 51 |
| `11_modulo_a_formato_de_producao` | Anonymised shape of the 143 production connections of 11/11/2026: zero divergence | 8 |
| `12_modulo_a_permissoes_e_rollback` | Rollback rehearsal; migration applied again under Supabase's default grants; no table, sequence or function reachable by a vendor; the 14 keys validated and cascading; no trigger created | 32 |
| `13_modulo_a_exclusao_e_isolamento` | Three deletion paths (self-service with a verbatim, md5-checked copy of the production routine; admin; login only): no row and no identifier left in any `of_*` table, logs included; other vendors byte-identical; cross-vendor ties refused; the mirror racing a deletion recreates nothing | 22 |

Rehearsed outside the suite, in the test database:

| Rehearsal | Result |
| --- | --- |
| Six mirror runs started at once, production shape | One created the 143 links, five created none; no duplicate |
| Migration while another session writes to `auth.users` | Gave up after 3.04 s; **0 objects created** |
| Migration waiting, cancelled from another session (`pg_cancel_backend`) | 0 objects created |
| Migration with `auth.users` free | Applied in 0.08 s |
| Rollback while another session reads `auth.users` | Gave up after 3.04 s; all 9 tables intact |
| Rollback with `auth.users` free | 0.04 s; nothing left |
| Cascade between the new tables removed (mutation) | The production deletion routine fails on 8 tables with warnings only, and case 13 fails |
| Read-only simulation in production of the role → purpose mapping | 478 questions, 0 differences |

## Applying (only with explicit authorisation)

The migration is one transaction that gives up instead of waiting: `lock_timeout = 3s`,
`statement_timeout = 30s`. Either everything is created or nothing is.

**Why a lock matters.** Creating a foreign key to `auth.users` needs a lock there that conflicts
with any write in progress (a sign-up, a login updating its timestamp). The danger is not our
lock, which lasts milliseconds: it is queueing behind a long transaction while new sign-ups and
logins queue behind us. The timeout prevents that.

1. **Before** (read-only). Do not apply unless all three are clean:
   ```sql
   -- a) nothing named of_* exists yet (expect 0)
   select count(*) from pg_class where relnamespace = 'public'::regnamespace and relname like 'of\_%';
   -- b) nobody is holding auth.users in a long transaction (expect no row)
   select a.pid, a.state, now() - a.xact_start as aberta_ha, left(a.query, 60) as consulta
     from pg_locks l join pg_stat_activity a on a.pid = l.pid
    where l.relation = 'auth.users'::regclass and a.xact_start < now() - interval '5 seconds';
   -- c) the origin has no incomplete row (expect 0)
   select count(*) from public.bank_connections where user_id is null or item_id is null;
   ```
2. **Apply** `supabase/migrations/20261111170000_modulo_a_conexoes_espelho.sql`, at a quiet hour.
   - If it answers `lock timeout` or `statement timeout`: nothing was created. Do **not** retry in
     a loop. Run check (b) again, wait, try once more later.
   - To interrupt by hand from another session:
     `select pg_cancel_backend(pid) from pg_stat_activity where query ilike '%of_vinculos%' and pid <> pg_backend_pid();`
     The transaction rolls back; nothing is left.
3. **After** (read-only):
   ```sql
   -- 9 tables, 5 functions
   select (select count(*) from pg_class where relnamespace='public'::regnamespace and relkind='r' and relname like 'of\_%') as tabelas,
          (select count(*) from pg_proc where pronamespace='public'::regnamespace and proname like 'of\_%') as funcoes;
   -- the 14 keys: validated and cascading (the migration itself refuses to commit otherwise)
   select conrelid::regclass, confrelid::regclass, convalidated, confdeltype
     from pg_constraint where contype='f' and conrelid::regclass::text like '%of\_%' order by 1, 2;
   -- no privilege for vendors (expect 0)
   select count(*) from pg_class c, (values ('anon'),('authenticated')) r(p)
    where c.relnamespace='public'::regnamespace and c.relkind='r' and c.relname like 'of\_%' and has_table_privilege(r.p, c.oid, 'select');
   ```
   and `npm run drift` still green (no other object changed).
4. **Run the mirror once, by hand:** `select public.of_espelho_atualizar();`
5. **Approve only if** the result shows `divergencias = 0`, `problemas = 0`, `conflitos = 0`,
   `select * from public.of_espelho_conferir();` is empty, and reference integrity holds:
   ```sql
   select (select count(*) from public.of_vinculos v where not exists (select 1 from auth.users u where u.id = v.user_id)) as vinculos_sem_usuario,
          (select count(*) from public.of_vinculos v where not exists (select 1 from public.bank_connections b where b.id = v.origem_conexao_id and b.user_id = v.user_id)) as vinculos_sem_origem,
          (select count(*) from public.of_vinculo_contas l join public.of_vinculos v on v.id = l.vinculo_id join public.of_contas c on c.id = l.conta_id where v.user_id <> l.user_id or c.user_id <> l.user_id) as elos_cruzados;
   ```
   All three must be 0.
6. Read `select public.of_espelho_relatorio();` and `select * from public.of_espelho_duplicadas();`.
   Nothing is acted on: the lists are for review.

Between runs the mirror goes stale (a new connection, a role change). That is expected; the
comparison is meaningful right after a run.

## Rollback

`supabase/modulo-a/rollback-a-pr1.sql` drops the 5 functions and the 9 tables, in one
transaction, with the same 3-second lock limit and without `CASCADE`: if anything unexpected came
to depend on them the script stops. Nothing else depends on these objects, so the app does not
notice. What is lost is the mirror and its history; the origin data is untouched and the mirror
can be rebuilt by applying the migration and running it again.

Removing the foreign keys needs, for an instant, a lock on `auth.users` that blocks reads as well
as writes — stronger than the one the migration takes. Run the rollback at a quiet hour too. If
it answers `lock timeout`, nothing was removed.

## Known limits, on purpose

- **No retention.** Deleting the account deletes everything in these tables. If an obligation to
  keep some record is confirmed later, it is built then, as its own step.
- **Events not tied to a vendor.** `of_eventos.user_id` is nullable, for events whose Item we
  cannot place. A-PR2, which starts writing events, must give those an expiry.
- **Account ties** keep one row per (Item, account). If a tie is closed and later reopened, the
  gap is not recorded.
- **Duplicates** follow the signature the cleanup robot uses today (vendor, institution, holder,
  account names). It is a hint, not proof of identity.
- **Outside this PR, found while reviewing deletion:** `apagar_dados_do_usuario` exists only in
  production and turns any failed table into a warning, so a partial deletion is silent;
  `admin-delete-user` does not call it and relies on its fixed list plus foreign keys. Neither is
  changed here.
