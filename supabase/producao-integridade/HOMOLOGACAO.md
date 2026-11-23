# Staging environment for the Vercel preview (proposal, 23/11/2026)

**Problem.** `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` have target `production` AND
`preview` on Vercel: every preview (PR #329 included) reads and writes the production database. Any
test of registration, flavours or stock on the preview creates real rows for real users.

## Option A — separate Supabase project "vant-homologacao" (recommended)
| Step | Who | Notes |
|---|---|---|
| 1. Create a project in the same Supabase organization (free tier) | Rick, panel | keys never pass through the chat |
| 2. Apply `supabase/baseline` + `supabase/migrations` (same order as the SQL tests) | Claude, after go | not proven yet: `npm run test:sql` uses a TRIMMED schema, so a full replay of every migration must be checked first; if it fails, copy the production schema without data instead |
| 3. Seed fictitious data: 3 sellers (maker, reseller, new), products with/without recipe, flavours, ingredients, a purchase | Claude writes `supabase/homologacao/seed.sql`; runs it only on the staging project | no real names, documents or bank data |
| 4. Storage bucket for product photos | Claude, staging only | |
| 5. Vercel: give the two variables separate values per environment — production keeps the CURRENT value, preview gets the staging one | Rick, Vercel panel | the production value is not edited; a redeploy of production is not needed |
| 6. Redeploy the PR preview and check it points to staging (read the network calls) | Claude | |

Out of staging on purpose: Hotmart, Pluggy/Open Finance, e-mail and push secrets (edge functions not
deployed there), so nothing in staging can reach real customers or banks.

## Option B — Supabase Branching (a database per PR)
Automatic and closest to production, but paid per hour per branch and needs the GitHub integration
on the Supabase project. Good later; heavier than needed now.

## What can interrupt the app
Only step 5: if the production value of a variable were changed by mistake, production would lose its
database. Mitigation: production value untouched; after step 5, open the production site and check it
still loads data before anything else. Until staging exists: no test writes on the preview.
