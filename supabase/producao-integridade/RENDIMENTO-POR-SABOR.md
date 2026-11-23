# Per-flavour recipe and yield — impact analysis (22/11/2026)

Status: **approved in concept on 23/11** (decisions below). Implementation = a separate database stage
(migration + rollback + equivalence tests), not written or applied yet.

## Today

| Piece | Today |
|---|---|
| Yield | `products.batch_yield`, one per product |
| Recipe | `product_recipes`: base rows (`variant_id null`) + flavour extras (`variant_id` set) |
| Uniqueness | `UNIQUE (product_id, ingredient_id)` — one ingredient in ONE place of the product |
| Production consumption (new flow and `produto_produzir_sabores`) | base × total units ÷ product yield + extras of each flavour × its units ÷ **product** yield |
| Product cost | `produto_salvar_receita`: base ÷ product yield → `products.cost` (used by sales: `product_sales_log.unit_cost`) |
| Data | 14 flavours in 7 products; 9 flavour recipe rows; 5 flavours with a recipe |

Confirmed problem (22/11): because of the unique key, the same ingredient in two flavours (or in the
base and a flavour) makes `produto_sabores_salvar` fail and every flavour of that save is lost. This
PR adds a screen-side guard (the line turns red, the registration does not continue); the real fix
is part of the model below.

## Proposed model (additive)

1. `product_variants.batch_yield numeric null` — null = uses the product yield.
2. `product_variants.usa_base boolean not null default true` — false = "receita própria": the base
   recipe does not go into this flavour.
3. Replace `UNIQUE (product_id, ingredient_id)` with two partial unique indexes:
   `(product_id, ingredient_id) where variant_id is null` and `(variant_id, ingredient_id) where variant_id is not null`.

Effective yield of a flavour: `Y_v = coalesce(v.batch_yield, p.batch_yield)`.
Producing `u_v` units of flavour `v` consumes:
`extras_v × u_v / Y_v` + (`usa_base` ? `base × u_v / Y_v` : 0). Units without flavour: `base × u / Y_p`.

**Example.** Base: 1 can of condensed milk per batch, product yield 20.
- Maracujá: own recipe (`usa_base = false`): 1 can + 200 g pulp; yields 5.
- Morango: base + 300 g strawberry; yields 6.

Producing 10 maracujá and 12 morango takes 10 ÷ 5 × 1 + 12 ÷ 6 × 1 = **4 cans**, plus
10 ÷ 5 × 200 = 400 g pulp and 12 ÷ 6 × 300 = 600 g strawberry. With today's formula (everything
÷ 20) it would be 22 ÷ 20 = 1,1 cans. The shared ingredient is taken only in the amount each
flavour uses.

**Existing users: unchanged by construction.** With `batch_yield null` and `usa_base true`, the
formula becomes `Σ base × u_v / Y_p + extras_v × u_v / Y_p` = `base × Σu / Y_p + …`, which is
exactly today's. No row is rewritten; relaxing the unique key accepts every existing row. A SQL test
must run the current fixtures through both formulas and require identical consumption.

## Database impact

| Object | Change | Risk |
|---|---|---|
| `product_variants` | 2 columns, nullable/defaulted | none for existing rows |
| `product_recipes` unique key | 1 constraint → 2 partial indexes | readers that index rows by ingredient only (below) |
| `producao_estado_alvo` (Etapa 1) | consumption per flavour with `Y_v` and `usa_base`; validity check per flavour (`usa_base = false` without extras = incomplete) | main change; covered by cases 20–27 + new ones |
| `produto_produzir_sabores` (old "Produzi") | either the same formula or refuse flavours with their own yield | **decision 2** |
| `produto_sabores_salvar` | save `batch_yield`, `usa_base`; extras may share an ingredient with the base / other flavours | the save stops failing |
| `mercado_concluir`, `mercado_desfazer`, `mercado_aprender` | base only, product yield; flavours ignored as today | unchanged in this step (Market is a later stage) |
| `produto_sabores`, `produto_sabores_distribuir` | read flavour stock; return `Y_v` if screens need it | read-only |
| `produto_salvar_receita`, `recalc_custo_produtos_do_ingrediente` | **no change**: `products.cost` stays base ÷ product yield | financial: unchanged |
| `defcon_venda_baixa_estoque` | `per_unit` uses base only | unchanged |
| `receita_registrar` trigger (Etapa 1) | also log `product_variants.batch_yield` / `usa_base` (reduction = higher yield, or `usa_base` true → false) | keeps the "recipe reduced" rule honest |
| `producao_*` history | unchanged structure; consumption rows already store the real amount | none |

## Screens impact

| Screen / code | Change |
|---|---|
| `editor-sabores`, `passo-sabores` | per flavour: "Rende ___" (empty = product yield) and "Receita própria" toggle; the red guard of this PR goes away |
| Product line list (Rick's mockup "5 un. por receita") | shows `Y_v` per flavour and "Receita própria configurada" |
| `custoDoSabor` (display only) | uses `Y_v`; **not** written to `products.cost` |
| "Pode produzir até" (`levasPossiveis`, compra-detalhe) | per flavour with `Y_v` |
| `use-receita-query`, `use-sobra-estoque-query`, `use-mercado-query` | key rows by (variant, ingredient), not ingredient alone |
| Legacy `Products.tsx`, `ProductActionsModal` | legacy recipe screens: read base only; must not merge flavour rows |

## Costs and financial history

Not touched. `products.cost` keeps today's rule; past sales keep their stored `unit_cost`. A
per-flavour cost feeding sales would be a financial rule change: it needs a before/after example and
Rick's authorization.

## Rollout and rollback (when authorized)

One additive migration (columns, indexes, function updates) + rollback. Rollback refuses while any
flavour has its own yield/`usa_base = false` or while two rows of a product share an ingredient
(restoring the old key would reject them).

## Tests to write

SQL: equivalence on current data shapes; flavour yield; shared ingredient across flavours and with
the base; `usa_base = false`; incomplete own recipe; legacy path (decision 2); recipe log on yield
change; rollback refusal. UI: per-flavour yield field, own-recipe toggle, list "x un. por receita".

## Decisions (Rick, 23/11)

1. `product_variants.batch_yield` optional; `usa_base = true` by default; a flavour may have its own
   recipe independent of the base. **Approved.**
2. The same ingredient may be reused by several flavours (and the base) without a second ingredient
   row: one `ingredients` row, several `product_recipes` rows. **Approved** (partial unique indexes).
3. Full compatibility with existing products: equivalence tests are mandatory. **Approved.**
4. Per-flavour cost is **informative only**: `products.cost` and the cost stored in sales do not change.

## Old production paths: contextual block (proposal)

A product is "per-flavour" when any of its flavours has `batch_yield` set or `usa_base = false`.
Existing products have neither, so none of them is affected.

| Path | For per-flavour products | For every other product |
|---|---|---|
| `produto_produzir_sabores`, `produto_produzir` (old "Produzi") | refuse: "Esse produto tem receita por sabor; registre pela produção nova" | unchanged |
| `ProductActionsModal` (legacy client production) | hide/refuse "Produzir" (reads the new columns) | unchanged |
| `mercado_concluir` automatic production | skip the product (it would take base ÷ product yield and ignore flavours), say so in its answer | unchanged |
| `producao_registrar` (Etapa 1) | the only path, with `Y_v` and `usa_base` | unchanged formula (equivalence test) |

Until the new production screen is active (Etapa 3), a per-flavour product cannot be produced
automatically at all, which is what "bloqueio contextual" means: nothing produces it with a wrong
consumption. SQL tests: each old path refuses a per-flavour product and still works, byte-for-byte,
for a product without flavour yields.

## Price precision per g/ml (investigation, nothing changed)

`receitaDoRascunho` (client, since before Etapa 2) rounds the price of 1 g/ml to 4 decimals before
sending it; `produto_salvar_receita` / `produto_sabores_salvar` store what they receive in
`ingredients.cost_per_unit` (numeric, no limit) and recompute `products.cost` from it.

| Purchase | Exact per g | Saved today | Reopened as | Exact product cost | Cost saved today |
|---|---|---|---|---|---|
| 1 kg for R$ 35,99 | 0,03599 | 0,0360 | **R$ 36,00** | 1 can R$ 6,50 + 200 g, yields 20: **R$ 0,68** | **R$ 0,69** |
| 25 kg for R$ 129,90 | 0,005196 | 0,0052 | **R$ 130,00** | 5 kg per batch, yields 100: R$ 0,2598 | R$ 0,2600 |

Also: saving a recipe overwrites `cost_per_unit` with the rounded value, so a precise cost that came
from a market purchase (10 of the 442 priced ingredients in production have more than 4 decimals)
is silently rounded when the recipe is opened and saved.

Proposed fix (needs authorization, financial): send the price of 1 g/ml with full precision (or 8
decimals). Formulas stay the same; only FUTURE saves change, by the amounts above; past sales keep
their stored `unit_cost`; no stored cost is recomputed retroactively.

## Next stage (database), when authorized
One migration (2 columns, 2 partial unique indexes, `producao_estado_alvo` with `Y_v`/`usa_base`,
`produto_sabores_salvar` accepting shared ingredients, contextual blocks above, recipe log of flavour
yields) + rollback (refuses while a per-flavour product or a shared ingredient exists) + SQL cases:
equivalence on today's shapes, flavour yield, own recipe, shared ingredients, every old path refusing
per-flavour products and unchanged otherwise. Then the screens (own-recipe question, yield per flavour,
stock per flavour in the review).
