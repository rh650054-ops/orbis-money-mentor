# Yield per flavour (DB stage)

Branch `feat/rendimento-por-sabor`, from `main`. Not merged, not deployed, nothing applied anywhere
but the local test database. Every step below needs Rick's explicit go.

## What changes

| | |
|---|---|
| Migration | `supabase/migrations/20261123120000_rendimento_por_sabor.sql` (requires Etapa 1 applied first) |
| Rollback | `supabase/rendimento-por-sabor/rollback.sql` (run BEFORE the Etapa 1 rollback) |
| New columns | `product_variants.batch_yield` (null = the product's yield), `product_variants.usa_base` (default `true` = today) |
| Constraint | `UNIQUE (product_id, ingredient_id)` on `product_recipes` becomes two partial unique indexes: one for the base, one per flavour |
| New flow (Etapa 1, not in production) | `producao_estado_alvo`: each item uses its flavour's yield; a flavour with `usa_base = false` skips the base; an active ingredient with no quantity (0 or "aprender") blocks the new production as an incomplete recipe |
| Saving flavours | `produto_sabores_salvar` accepts optional `rende` and `usa_base` per flavour; absent = keep what is stored (the app sends neither today) |
| Old paths | `produto_produzir`, `produto_produzir_sabores`, `produto_sabores_distribuir`: one line added, refusing ONLY products with per-flavour data (hint `VANT_RECEITA_POR_SABOR`) |
| Recipe log | `receita_registrar` + trigger on `product_variants`: yield and `usa_base` changes are logged; more units per batch or leaving the base count as a reduction (one justification on the next production) |
| Old sheet `/products/ficha` | `ProductActionsModal` (produce) and `Products.tsx` (save recipe) refuse per-flavour products / repeated ingredients with a message. No product of today matches |
| New helper (app cannot call) | `produto_receita_por_sabor(uuid)` |

The three old functions and `produto_sabores_salvar` are patched **in place from the production
body** (`pg_get_functiondef`), as `20261026180000` and `20261026200000` did. This matters: the repo's
newest `CREATE` of these functions is older than production (those two migrations patched them
dynamically). The test database now loads the production bodies (`tests/schema/04_…`, verified by
md5 against production on 23/11) so the patch is tested on exactly what it will meet.

## What is removed or stops working

1. **UNIQUE `product_recipes_product_id_ingredient_id_key`**: dropped (replaced by the two partial
   indexes). Nothing in the repo uses it as an `ON CONFLICT` target (searched SQL and client).
2. **New flow only (not in production yet)**: a recipe with an active ingredient at quantity 0, or
   still "aprender", no longer produces there. Today it produced and silently skipped that line.
   Read on production on 23/11: **4 of 55** batch products with a recipe have such a line; they keep
   working on the current "Produzi" (old path, unchanged for them) and would need the line filled
   or removed to use the new flow.
3. Old paths (`Produzi`, `Produzi por sabor`, `distribuir`, old sheet produce/save): stop working
   **only** for products with per-flavour data, which cannot exist until the app sends the new keys.

Nothing else: no cost, price, sale, Mercado, Open Finance or data row is changed.

## Tests (local Postgres, never Supabase)

`npm run test:sql`: **486 ok, 0 failures** (6 known bugs still open, unrelated).

- `28_rendimento_por_sabor.sql`: defaults; 10 maracujá (rende 5) + 12 morango (rende 6) = 4 cans;
  each extra by its own yield; shared ingredient in base + 2 flavours with one stock record and one
  consumption line; own recipe without base; mixed calls; incomplete flavour / "aprender" base;
  yield and `usa_base` changes logged and justified once; old paths refuse per-flavour products and
  work as in production for others; `produto_sabores_salvar` old payload, shared ingredients (the
  22/11 lost-save bug), new keys, invalid values, per_unit, another seller; grants.
- `29_rendimento_por_sabor_equivalencia.sql`: 60 random products (fixed seed), **400 random calls of
  the new flow identical to Etapa 1** (same JSON and refusals) and **120 random calls of the three old
  functions identical to the production bodies** (stock, batches, answer). A deliberate 0.0001%
  change in the formula makes 223 of the 400 differ, so the check is sharp. Rollback: functions back
  to the production md5, data untouched, refuses with per-flavour data or a shared ingredient,
  re-apply gives the same objects, second rollback harmless.
- `24`, `27` adjusted where they zeroed an ingredient and expected production (now incomplete);
  `26` rolls this migration back before rehearsing the Etapa 1 rollback.

## Deploy order (for later; nothing is authorised yet)

1. Etapa 1 in production (migrations `20261122120000`, `20261122130000`), rehearsed on staging.
2. This migration on staging, then `test:sql` scenarios by hand on staging.
3. This migration in production (one transaction; `ALTER TABLE … ADD COLUMN` with a default is
   metadata-only on Postgres 17; the two indexes are built on ~a few hundred rows).
4. Only then the app may send `rende` / `usa_base` (next PR, client).

Rollback: `rollback.sql` in the SQL editor. Refuses (and changes nothing) while a flavour has its own
yield / no base, or an ingredient is in two rows of one product.

## What can interrupt the app

- Applying before Etapa 1: the migration stops at its first statement (nothing applied).
- The in-place patch does not find the expected text (production changed since 23/11): the
  migration stops with "trecho encontrado 0 vezes", nothing applied.
- A client screen of the new flow does not yet know `VANT_RECEITA_POR_SABOR` /
  `VANT_RECEITA_INCOMPLETA`: it shows the server message. Only affects products that have the new data.

## Known limits left for a later stage (by Rick's rule, not touched now)

- **Mercado** (`mercado_concluir`, auto-production after a purchase, `mercado_aprender`) still uses
  the product's yield and reads every recipe row. For a per-flavour product it would compute with the
  wrong yield. Not changed: "não altere Mercado nesta etapa".
- **Displayed cost per flavour** (`produto_sabores.custo`) still divides the extras by the product's
  yield. Not changed: "não altere custos".
- **per_unit** products: flavours cannot have a yield or own recipe (refused when saving).
- The old sheet already rewrites flavour extras as base rows on save (pre-existing, confirmed in code;
  not changed for products of today).
