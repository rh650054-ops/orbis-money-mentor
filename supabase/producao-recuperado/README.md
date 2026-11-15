# Code recovered from production (snapshot, not deployable)

Code that runs in production and was never in this repository, copied here on 11/11/2026 so it
can be read, reviewed and diffed. **Nothing in this folder is deployed or applied.**

## Why it is not under `supabase/functions/`

Corrected on 12/11/2026. An earlier version of this file said functions are published
automatically after a merge. They are not. Functions in this project are published by hand
through the Supabase connector, usually as a one-line file that imports `index.ts` from GitHub at
a merge commit (that is what `pluggy-connect-token` v22 and `mp-criar-deposito` are today). The
only apps acting on `main` commits are `claude`, `github-actions` (preflight) and `vercel`.

These files stay outside `supabase/functions/` so that nobody publishes them by mistake when
shipping something else: none of them is meant to be redeployed, and the instruction is not to
touch the X1. Moving one into `supabase/functions/` is a separate, authorised step.

## What is here

| Path | What it is in production | How it was recovered | Fidelity |
| --- | --- | --- | --- |
| `functions/mp-criar-deposito` | X1 wallet deposit. **Closed**: answers 410 `x1_so_pontos` since the X1 became points-only | The deployed entry is one line importing this file from GitHub at a pinned commit; the file was fetched from that commit | Byte-exact |
| `functions/mp-connect` | Starts the vendor's Mercado Pago authorisation | Deployed source read through the Supabase connector | Transcribed; byte comparison pending |
| `functions/mp-callback` | Stores the vendor's Mercado Pago access, triggers the first read | Same | Same |
| `functions/pb-connect` | Starts the vendor's PagBank authorisation | Same | Same |
| `functions/pb-callback` | Stores the vendor's PagBank access | Same | Same |
| `sql/funcoes-integracoes-diretas.sql` | 13 SQL functions: `mp_*`, `conexao_*_selo`, `cobranca_registrar_paga`, `apagar_dados_do_usuario` | `pg_get_functiondef` | 13 of 13 identical to production by md5 |

`manifesto.json` has the deployed version, the `verify_jwt` setting, the published bundle hash and
the md5 of each SQL function at the time of reading.

No secret is in these files: the functions read their credentials from the environment or from
`public.pb_aplicacao`.

## Things worth knowing before touching any of it

- `mp-criar-deposito` in production depends on commit `947dc1a` staying reachable. That commit is
  the head of the unmerged branch `feat/x1-pontos-e-nectar`. Do not delete that branch before the
  function is redeployed from a file in `main`.
- Its header says the database also refuses new deposits (`20261015090000_x1_so_pontos.sql`).
  That migration is not in `main` and no migration or function with that name was found in
  production on 11/11/2026. The only guard confirmed is the function itself.
- `conexao_conceder_selo` returns `true` and grants nothing: the wallet connection no longer
  gives the verified badge, although `mp-callback` and `pb-callback` still call it.
- `apagar_dados_do_usuario` turns a failed table into a warning and carries on, so a partial
  deletion is silent.
- Still only in production and not recovered here: `pluggy-olhar`, `import-financial-pdf`, and the
  tables behind these functions (`mp_conexoes`, `mp_vendas`, `mp_oauth_states`, `pb_aplicacao`).
