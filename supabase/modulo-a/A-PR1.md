# Open Finance V2 · Module A · A-PR1 — new records and mirror

First step of Module A (connections and consent). It adds the records the contract separates —
provider, Item, bank account, consent, purpose, history — and fills them as a **mirror** of what
`bank_connections` and `bank_saldos` already say. Nothing reads these records yet. The app, the
edge functions, the crons, the ranking, the prizes and every existing table behave exactly as
before.

Merging this PR applies nothing. Applying the migration to production is a separate, explicit
authorisation.

## What it creates

| Object | What it holds |
| --- | --- |
| `of_provedores` | Who reads the bank for us. One row: Pluggy, the only bank-connection provider |
| `of_vinculos` | One row per provider Item (today: one per `bank_connections` row), with its state |
| `of_contas` | One row per bank account. Belongs to the vendor, not to the Item |
| `of_vinculo_contas` | Which Item sees which account, since when, until when |
| `of_consentimentos` | Authorisation state of each Item. Starts as `nao_informado`; never deduced from `UPDATED` |
| `of_finalidades` | Purpose (`trabalho`, `pessoal`, `misto`, `nao_definida`) with validity dates and history |
| `of_eventos` | Raw provider events. **Empty in A-PR1**; A-PR2 starts filling it |
| `of_mudancas` | Every state change with its reason |
| `of_espelho_execucoes` | One row per mirror run: counters, problems, divergences |

| Function | What it does |
| --- | --- |
| `of_espelho_atualizar()` | Fills / refreshes the mirror. Idempotent, one run at a time, never deletes or merges |
| `of_vinculo_conta_de_venda(vinculo, quando)` | "Is this a sales account?" answered only from the new records |
| `of_espelho_conferir(quando)` | Compares that answer with `banco_conta_de_venda` for every connection. Empty = zero divergence |
| `of_espelho_relatorio()` | Numbers only: what the mirror holds and what did not fit |
| `of_espelho_duplicadas()` | Connections that look like copies of each other. Report only |

## What it does not do

- It alters no existing table, function, trigger or policy, and adds no foreign key to one (a
  foreign key would add internal triggers to `bank_connections` / `auth.users` and could block
  deletes that work today). The origin of each mirrored row is a plain id column.
- It writes nothing to `daily_sales`, `auto_detected_sales`, `extrato_lancamentos`, ranking,
  prizes, goals, badges or charges.
- It schedules nothing. The mirror runs only when called. A daily schedule is a separate decision.
- It proves no account identity and knows no account type: every mirrored account is
  `nao_identificada` / `desconhecido`, so **no two accounts are ever merged**.
- It deletes nothing, including in the new tables. A connection row that disappears leaves its
  link as `removido` (`origem_apagada`) with its history.

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
Per-account purposes come with A-PR5, when account type and identity are known. A purpose whose
origin is not `papel_legado` (for instance one the vendor chose) is never overwritten by the mirror.

## Access

Server only. Row level security is on with no policy, and every privilege Supabase grants by
default to `anon` and `authenticated` is revoked on the tables, their sequences and the functions.
`service_role` keeps access. The functions are `security invoker`.

## Tests (`npm run test:sql`)

- `casos/10_modulo_a_espelho.sql` — one bank, two banks, no role, removed connection, three
  reconnections of the same bank, an Item with two accounts, a role that starts tomorrow; consent
  never deduced; idempotency; the advisory lock; role change, pause, removal, a hard-deleted row,
  the same Item under a new row; incomplete and inconsistent origin rows; no pre-existing table
  changes (fingerprint of every table before and after).
- `casos/11_modulo_a_formato_de_producao.sql` — the anonymised shape of the 143 production
  connections of 11/11/2026 (no id, name, document, bank or amount): zero divergence.
- `casos/12_modulo_a_permissoes_e_rollback.sql` — rollback rehearsal, then the migration applied
  again under Supabase's default grants: no table, sequence or function reachable by a vendor.

Also checked outside the suite: six mirror runs started at the same instant on the production
shape (one created the 143 links, five created none, no duplicate), and a read-only simulation
in production of the mapping above against `banco_conta_de_venda` (478 questions, 0 differences).

## Applying (only with explicit authorisation)

1. Apply `supabase/migrations/20261111170000_modulo_a_conexoes_espelho.sql`.
2. Check, read-only: 9 tables and 5 functions named `of_*` exist; `anon`/`authenticated` have no
   privilege on them; no other object changed (`npm run drift` still green).
3. Run the mirror once, by hand: `select public.of_espelho_atualizar();`
4. Approve only if the result shows `divergencias = 0`, `problemas = 0`, `conflitos = 0`, and
   `select * from public.of_espelho_conferir();` is empty.
5. Read `select public.of_espelho_relatorio();` and `select * from public.of_espelho_duplicadas();`.
   Nothing is acted on: the lists are for review.

Between runs the mirror goes stale (a new connection, a role change). That is expected; the
comparison is meaningful right after a run.

## Rollback

`supabase/modulo-a/rollback-a-pr1.sql` drops the 5 functions and the 9 tables, without `CASCADE`:
if anything unexpected came to depend on them the script stops. Nothing else depends on these
objects, so the app does not notice. What is lost is the mirror and its history; the origin data
is untouched and the mirror can be rebuilt by applying the migration and running it again.
The rehearsal is `casos/12_modulo_a_permissoes_e_rollback.sql`.

## Known limits, on purpose

- **Account deletion.** When a vendor deletes the account, the routines that erase their rows do
  not know the new tables. What stays is the vendor id, the institution name and the provider's
  Item / account ids — no name, document, balance or transaction. `of_espelho_relatorio()` counts
  these (`vendedores_sem_cadastro`). Teaching the deletion routines about the new tables means
  changing existing functions, so it is left for its own PR.
- **Account ties** keep one row per (Item, account). If a tie is closed and later reopened, the
  gap is not recorded.
- **Duplicates** follow the signature the cleanup robot uses today (vendor, institution, holder,
  account names). It is a hint, not proof of identity.
