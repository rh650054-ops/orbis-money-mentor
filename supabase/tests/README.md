# SQL tests for the financial chain

What decides money in VANT is SQL: which bank entry is a sale, which day it belongs to, how much
is calote, what goes to the ranking, who takes the prize. These tests run that SQL — the same
function bodies production runs — against a throwaway database with fictional data.

```bash
npm run test:sql     # needs psql and a local Postgres 17 (PGHOST/PGPORT/PGUSER/PGPASSWORD)
npm run drift        # does the repo still describe what production runs?
```

Never point these at Supabase: the runner refuses a supabase host, and it only creates and drops
databases named `vant_teste_*` / `vant_caso_*`.

## How a run is built

1. `schema/00_supabase.sql` — the roles and `auth.uid()` a Supabase project gives for free.
2. `schema/01_tabelas.sql` — the tables of the chain, generated from the production catalog.
3. `schema/02_dubles.sql` — test doubles for what is not under test (plan access, badge, positions).
4. `schema/03_asserts.sql` — `t.igual`, `t.verdade`, `t.pendente` and the fixture builders.
5. The LAST definition of each chain function found in `supabase/migrations` + `supabase/baseline`.
   The runner prints how many are identical to production (`baseline/manifesto-producao.json`)
   and which ones the current branch changes.
6. Every file in `casos/`, each in its own fresh database.

## Reading the output

- `ok` — holds.
- `FALHOU` — a regression. The PR does not merge.
- `pendente [F-xx]` — a bug the audit of 10/11/2026 proved, written as a test that fails today.
  It is shown on every run, never hidden. The fix for F-xx must turn it green.
- `PROMOVER` — a `t.pendente` started passing: the fix landed. Change it to `t.igual` in the same
  PR, so it guards against the bug coming back. The run fails until you do.

## Baseline (`supabase/baseline`)

- `manifesto-producao.json` — fingerprint of 114 financial functions as deployed on 10/11/2026.
- `20261110000000_funcoes_producao.sql` — exact copies (md5-checked) of 10 functions production
  ran that the repo did not have. NOT a migration: nothing applies it; it is a record and the
  source the tests load.
- `pendentes-de-registro.json` — 29 functions that still differ and are not copied yet. The list
  may only shrink.

When production changes through a reviewed migration, refresh the manifest with the query stored
in it. A function that differs and is in neither list fails `npm run drift`.
