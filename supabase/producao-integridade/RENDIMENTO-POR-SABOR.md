# Per-flavour recipe and yield — impact analysis (22/11/2026)

Status: **analysis only**. No migration written or applied. Needs Rick's decisions (end of file).

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

## Decisions for Rick

1. `usa_base` default `true` (today's behaviour) — confirm.
2. Old "Produzi" (`produto_produzir_sabores`): apply the same formula, or refuse flavours with their own yield until Etapa 3 retires it.
3. Market auto-production ignores flavours today — keep it until the Market stage.
4. Per-flavour cost: display only (recommended) or also feed sales cost (financial change).
