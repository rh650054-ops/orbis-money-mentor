# VANT staging (homologação) — 23/11/2026

Goal: test registration, flavours and stock on the Vercel preview **without touching production**.
Today `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` have target production + preview, so every
preview writes to the production database.

## Finding: the migrations alone do NOT rebuild the database

`node supabase/homologacao/reconstruir.mjs` replays all 276 files of `supabase/migrations` on an
empty Postgres (with `00_plataforma.sql` standing in for what Supabase provides: auth, storage,
roles, pgcrypto, pg_cron/pg_net, realtime publication).

| | Replay of the repo | Production (catalog, 23/11) |
|---|---|---|
| Migrations applied | 163 / 276 (113 fail) | — |
| Tables | 84 | 201 |
| Functions | 117 | 461 |
| Policies | 206 | 303 |

The first failure is #63 (`20260617123000_dedup_challenge_blocks_unique.sql`: column `sales_count`
does not exist). The rest fail because core objects (`defcon_sales`, `orbis_pro`, `hotmart_eventos`,
`planned_bills`, `premio_fechamento`, `crm_*`, `profiles.tax_cnpj`, …) were created outside the repo.
Consequences: (1) Supabase Branching, which builds from the migrations, would fail the same way;
(2) staging must start from a **structure-only copy of production** (no rows). Later, a squashed
"baseline schema" migration would make the repo rebuildable — separate task.

Etapa 1 (`20261122120000`, `20261122130000`) is **not** applied in production yet: staging is the
first place to apply it, as a rehearsal.

## Files
| File | What |
|---|---|
| `00_plataforma.sql` | local stand-in of the platform, only for `reconstruir.mjs` (never applied to a real project) |
| `reconstruir.mjs` | full-replay rehearsal; `CONTINUAR=1` lists every failing migration |
| `seed.sql` | fictitious data: 3 sellers (makes / resells / new), shared ingredients, complete + draft recipes, flavours, resale. Refuses to run without the marker table or with ≥ 20 profiles |

## Checklist

Never: edit a production variable, copy rows, personal data, bank credentials, Hotmart/Pluggy keys or
webhooks into staging. Keys and passwords go only through the panels and your own terminal.

| # | Where | Who | Step |
|---|---|---|---|
| 1 | Supabase panel | Rick | New project "vant-homologacao" in the same organization, region São Paulo, free plan. Keep its DB password in your password manager |
| 2 | Your terminal | Rick | Structure-only dump of production, in a folder outside the repo: `npx supabase@latest login`, `npx supabase@latest link --project-ref qbcsjsdwjjpybvzbxszi` (asks the production DB password locally), then `npx supabase@latest db dump --linked -s public -f vant-esquema.sql`. Without `--data-only` the dump has structure only, no rows. Do not commit this file |
| 3 | Supabase SQL editor of **vant-homologacao** | Rick | Run `vant-esquema.sql` (or `psql "<staging url>" -f vant-esquema.sql`) |
| 4 | Same | Rick / Claude | Run Etapa 1: `20261122120000_producao_integridade.sql`, then `20261122130000_receita_historico_e_conta_teste.sql` (+ the per-flavour migration when approved) |
| 5 | Supabase panel (staging) → Storage | Rick | Create the product-photo bucket with the same name and policies as production |
| 6 | SQL editor (staging) | Rick | `create table public.ambiente_homologacao (criado_em timestamptz default now());` (the marker the seed requires) |
| 7 | Supabase panel (staging) → Authentication → Add user (auto confirm) | Rick | `faz@vant-homologacao.test`, `revenda@vant-homologacao.test`, `novo@vant-homologacao.test` with passwords of your choice |
| 8 | SQL editor (staging) | Rick / Claude | Run `seed.sql` |
| 9 | Vercel → Project → Settings → Environment Variables | Rick | For `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`: **keep the production entry as it is** and uncheck Preview on it; add a NEW entry for **Preview only** with the staging URL and the staging publishable (anon) key |
| 10 | Production site | Rick | Open the production app and check it still loads your data (production value untouched) |
| 11 | PR #329 | Claude | Redeploy the preview; check in the browser's network calls that it talks to the staging URL; then run the registration flows with the fictitious accounts |

Not deployed to staging on purpose: edge functions with Hotmart, Pluggy/Open Finance, e-mail, push.
Screens that need them show their own errors there; that is expected.

## What can interrupt the app
Only step 9. If the production entry were edited instead of split, production would point to the
wrong database. Mitigation: never edit the production value; step 10 right after.
