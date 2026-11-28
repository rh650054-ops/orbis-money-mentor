# ADR 0001 — DEFCON: the server becomes the source of the financial totals

Status: **proposed** (28/11/2026). Nothing in this document is implemented or applied to production.
Owner of the decision: Rick. Prerequisite of VANT Quick interactive (widget / Live Activity).

## 1. Problem

The DEFCON keeps the day's totals in **aggregate columns written by the client with absolute values**
computed from what the phone has in memory. A second writer (VANT Quick in the background, another
device, an old build) makes the phone's next write erase what it did not know:

> app in memory R$ 40 · widget sells R$ 20 on the server (R$ 60) · app sells R$ 10 and writes **R$ 50**
> → the widget's R$ 20 disappear from the block, the day total and the X1.

## 2. Map of every absolute write (28/11/2026)

| # | Path (client) | Table · columns | Kind | Source rows exist? |
|---|---|---|---|---|
| 1 | `addSale` / `addLateSale` / `addTip` / `deleteSale` → `queueBlockOffline` → `offline-sync` | `hourly_goal_blocks` · `achieved_amount`, `valor_dinheiro/pix/cartao/gorjeta` | absolute | yes: `defcon_sales` |
| 2 | same → `queueVendaOffline` / `guardarTotalSessaoOffline` → `venda-offline` (`total_sessao`) | `challenge_sessions` · `total_sold` (read by **X1**) | absolute | yes: `defcon_sales` |
| 3 | `saveBlockApproaches` → `fila-defcon` (upsert) | `challenge_blocks` · `approaches_count`, `sales_count` | absolute | sales yes; **standalone approaches no** |
| 4 | `deleteSale` (other block) read-modify-write | `challenge_blocks` counts | absolute | partly |
| 5 | "Como recebeu" (`foco/como-recebeu.tsx`) and the block split editor in `useDefconChallenge` | `hourly_goal_blocks` · re-split of dinheiro/cartão/pix/calote (same total) | absolute | **no** (a correction, not a sale) |
| 6 | `DailySalesForm` (Nova Venda outside the DEFCON) read-modify-write | `hourly_goal_blocks.achieved_amount` | absolute | **no** |
| 7 | `syncBlocksToDailySales` / `syncLeaderboardRevenue` (11 callers) | `daily_sales`, `leaderboard_stats` | absolute, derived from blocks | derived |
| 8 | start / restart / reopen / "zerar" of the day (`useDefconChallenge` 1055, 1416, 1481, 1579) | `challenge_sessions.total_sold`, blocks reset | absolute | — |
| 9 | `orbis_subir_dia_offline` (RPC, offline day) | replaces sales + blocks of an `origem='offline'` session | absolute, server | builds the rows itself |

Readers that must keep working: ranking (`ranking_valor_dias` ← `defcon_sales`), X1 (`x1_*` ←
`challenge_sessions.total_sold`), bank reconciliation (`mp_conciliacao_*`, `banco_*` ← `defcon_sales`,
`daily_sales`), stock (`defcon_venda_baixa_estoque` trigger on `defcon_sales`), reports, history.

Clients that write absolutes and **cannot be updated by us**: iOS builds 19, 29, 30 (and any build in
review), Android test builds, web tabs/PWA still running an old bundle.

## 3. Decision (proposed): ledger + totals derived by the server

1. **Ledger rows are the truth.** Sales already are rows (`defcon_sales`, id chosen by the client =
   idempotency key). Add two ledger tables:
   - `defcon_abordagens (id uuid pk, user_id, session_id, block_index, origem, criado_em)` — standalone approaches;
   - `defcon_ajustes (id uuid pk, user_id, plan_id, block_id, tipo, dinheiro, cartao, pix, calote, origem, criado_em)`
     — "Como recebeu" re-splits and manual amounts (paths 5 and 6), as signed differences.
2. **The server derives the aggregates** (`defcon_recalcular(session_id, block_index)`, SECURITY DEFINER,
   `FOR UPDATE` on the session row): block money = Σ sales by method + Σ ajustes; `sales_count`,
   `approaches_count` = sales (non-late, non-tip) + standalone approaches; `total_sold`, `daily_sales`,
   `leaderboard_stats` from those. Run by triggers on the three ledgers. Same columns as today, so every
   reader keeps working unchanged.
3. **New clients write only ledger operations**, through idempotent RPCs
   (`defcon_lancar(id, tipo, ...)` returns the derived totals). The screen stays optimistic exactly as
   today; the offline queue keeps working (it already queues sales with their id; approaches and
   ajustes get ids too). The UI, buttons and DEFCON experience do not change.
4. **Old clients are disarmed by a guard trigger**, only on sessions marked `totais_servidor = true`
   (created by a new client):
   - writes to protected aggregate columns are **replaced by the derived values** (an old client can
     never lower or overwrite a total);
   - a positive jump in `approaches_count` becomes standalone approach rows (`origem = 'legado'`);
   - a re-split with the same block total becomes a `defcon_ajustes` row;
   - anything else is ignored and logged in `defcon_conflitos` for audit.
   Old clients still insert/delete their sale rows normally, so their money is never lost.
5. **VANT Quick** registers through the same `defcon_lancar` (scoped device credential, Phase 1).

## 4. Rollout (gradual) and rollback

| Step | What | Visible change | Rollback |
|---|---|---|---|
| A | Schema + functions + triggers, **inactive** (no session marked) | none | drop the new objects |
| B | **Shadow mode** for 3–7 days: a job recomputes the derived totals of every session and reports divergences vs. the client-written ones (finds any path this map missed) | none | stop the job |
| C | Flag per account (`persistencia_servidor`): test accounts → Rick → team → all. Marked accounts' new sessions get `totais_servidor = true` and the web client uses `defcon_lancar` | none on screen | unmark the account: next sessions go back to today's path; the derived values already sit in the same columns, nothing to convert |
| D | New iOS / Android builds carry the same web code | none | as C |
| E | VANT Quick interactive enabled for marked accounts, after homologation | widget / Live Activity buttons | switch off the feature flag |

Kill switch: one server flag turns the guard trigger off for every session at once.

## 5. Tests required before step C

- SQL: idempotency (same id twice = once); concurrency (two `defcon_lancar` at the same time);
  **the R$ 20 case** (old-client absolute write after a widget sale keeps R$ 60 + R$ 10); delete reverses;
  tip, late Pix, calote, "Como recebeu" re-split, DailySalesForm amount; offline day RPC on a marked
  session; ranking, X1, reconciliation and stock unchanged for the same rows; shadow job = zero
  divergence on a replayed real day.
- App: every DEFCON path produces the same totals as today (snapshot of state before/after);
  offline queue replay; reopening the app shows the server totals.
- Old build simulation: replay the absolute writes of build 29 against a marked session.

## 6. Risks

- It is the core sales path: mitigated by shadow mode, per-account flag and rollback without data conversion.
- Old-client approach counted from an outdated screen while another device also counts: the positive
  jump may under-count by the concurrent approaches; money is never affected (rows).
- Server load: recompute touches one block per write (tens of rows); session lock serialises writers.
