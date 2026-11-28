# ADR 0002 — DEFCON: restart the day's operation, reverse a sale, discard test records (P1)

Status: **proposal — nothing implemented, nothing changed in production.** Classified **P1** by Rick (28/11/2026).
Owner of the decision: Rick. Separate from PR #401 (Dynamic Island).

## 1. Incident

"Reiniciar o dia" (`restartChallenge`, `src/hooks/useDefconChallenge.ts`) deletes the DEFCON session but
keeps its sales. Read-only figures, production, 28/11/2026:

| | |
|---|---|
| sales whose session no longer exists | **1,982** (of 133,489) |
| deleted sessions behind them | **294** |
| accounts | **92** |
| value of those sales | **R$ 149,721.98** (24/06 → 28/11/2026) |
| of them with a product (stock moved) | 179 sales, 226 units, 13 accounts |
| account-days affected | 213 |
| sales linked to a machine payment (`mp_vendas`) | 0 |

No SQL function deletes sessions. In the repository the only delete is `restartChallenge`, identical in builds 29, 31 and 32 and in the web app.

## 2. What the restart does today (audited, in order)

Five independent requests from the app, with **no transaction**. A failure stops nothing: errors are collected and the user is told "Não consegui zerar o dia por completo".

| # | Write | Database effect |
|---|---|---|
| 1 | `delete challenge_blocks where session_id` | the block counters (sales / approaches per block) are gone |
| 2 | `delete challenge_sessions where id` | **cascade**: `defcon_abordagens`, `defcon_ajustes` (ledger corrections), `defcon_occurrences`. `defcon_sales` has **no** foreign key: the sales stay, pointing at a session that no longer exists |
| 3 | `delete hourly_goal_blocks where hour_label like '⏱%'` | "+1h" blocks gone |
| 4 | `update hourly_goal_blocks set achieved/valor_* = 0, idle` | the plan's blocks are zeroed |
| 5 | `update daily_sales set cash/card/pix/tip/profit/debt = 0` | the day's money is zeroed (fires `on_defcon_sale_recalc`, which recalculates the competition scores); `cost` is **not** zeroed |

What is **not** undone: product stock, flavour (variant) stock, ingredients, `defcon_daily_loadout.qty_sold`, `product_sales_log`, `daily_sales.cost`. Stock moves back only when a sale row is deleted (trigger `defcon_venda_estoque`), and the restart deletes no sale.

### Effects on readers

| Reader | Joins the session? | Sees the orphan sales? |
|---|---|---|
| `ranking_valor_dias`, `relatorio_bloco`, `banco_lancado_dia`, `banco_vendas_a_parte`, `orbis_dias_trabalhados` | yes | no |
| `objetivo_lucro_dias`, `objetivo_lucro_base`, `vant_sobrar_mes`, `x1_golpes`, `x1_sala_golpes`, `admin_ficha_usuario`, `mp_conciliacao_dia/_mes` | no (by account and date) | **yes** |
| `daily_sales` (day's money) | n/a | no: zeroed, then rebuilt from the new session |

Measured on the 213 account-days: by-date readers see **R$ 147,970.83 more** than the session-based ones. Approaches and ledger corrections of the deleted session are lost, so conversion and the history lose them. Profit readers keep the cost of products whose revenue was zeroed.

### Other origins to confirm (hypotheses, not proven)

- Offline queue: a sale queued with the old `session_id` and uploaded after the restart would create a new orphan (the restart does not touch the queue).
- A VANT Quick tap processed between write 1 and write 2 lands in the session that is about to be deleted (only the homologation account can tap today).

## 3. Why "just block the delete" is not a containment

If the server refused write 2, writes 1, 3, 4 and 5 still run. The session would survive with its sales and `total_sold`, without block counters, with zeroed blocks and a zeroed day. The app then reloads a partly reset day. That is worse than today. Old builds cannot be changed, so any containment must accept the five writes as they come.

## 4. Immediate containment (proposal C0): keep everything the restart deletes, change no result

Server only, transparent to every build, no financial change:

- `before delete` trigger on `challenge_sessions`: copies the session row and the rows the cascade is about to delete (`defcon_abordagens`, `defcon_ajustes`, `defcon_occurrences`, the `challenge_blocks` counters) into append-only archive tables (`defcon_arquivo_*`, same columns plus `arquivado_em`, `motivo = 'reinicio_app'`, `cliente` from `x-client-info`). It also writes one row in `defcon_reinicios` (session id, account, day, number and sum of the sales left behind, stock-moving sales).
- The delete then proceeds exactly as today: same response to the app, same reset, no partial state.
- From then on, every sale left behind resolves to an archived session (`defcon_sales.session_id` → `defcon_arquivo_sessoes.id`). New sales are no longer "unlinked", and the approaches and ledger corrections are no longer lost.
- Reversible: dropping the trigger restores today's behaviour; the archive tables are only read.
- Concurrency: the trigger runs inside the delete's own transaction, so a VANT Quick tap that holds the session lock (`FOR UPDATE`) makes the delete wait, and vice versa. No tap is lost between archive and delete.
- RLS: archives readable by the owner (select) and by the service role; no client write.

C0 does not fix the double meaning of the orphan sales for the by-date readers. That needs the decision of section 5 (A).

## 5. Target architecture: three different operations

Each one is a single `SECURITY DEFINER` RPC, atomic, idempotent by a client id (`p_id`, kept in `defcon_ids_encerrados` like the ledger's taps), with `FOR UPDATE` on the session (the same lock VANT Quick takes), and one row in an append-only audit table (who, when, client, before/after totals).

### A. Restart the operation (`defcon_reiniciar_jornada(p_sessao, p_id)`)
The day's **sales are kept**: they were real, and their money, stock and cost stay.
- The session is **not** deleted. Its timer, the current block, the pauses and the block plan return to the start (a new `jornada` number on the session, so reports can tell the two runs apart).
- The day's revenue is **unchanged** (derived from the sales, ADR 0001). The user is told before confirming: "As vendas de hoje continuam registradas".
- Approaches are kept with their `jornada` (conversion per run and per day both computable).

### B. Reverse a sale (`defcon_estornar_venda(p_venda, p_motivo, p_id)`)
- The sale row is kept, marked `estornada_em` / `estorno_motivo` / `estornada_por`. Revenue, ranking, X1 and profit readers exclude reversed sales.
- Its effects are undone **exactly once**: stock, flavour, ingredients, `qty_sold`, cost and `product_sales_log`, guarded by the reversal row's unique key (a second call answers "já estornada").
- Allowed on any day the user may edit. A sale already conciliated (`mp_vendas.defcon_sale_id`, Open Finance match) is refused with "venda conciliada", and points to the bank screen.

### C. Discard wrong or test records (`defcon_descartar(p_ids[], p_motivo, p_devolver_estoque bool, p_id)`)
- Explicit confirmation listing every record and its value. The rows move to `defcon_arquivo_*` with the reason (`teste`, `duplicada_confirmada`); they are never physically lost.
- Stock is returned **only** when the user says the products did not leave (`p_devolver_estoque`). The default is no, which avoids physical/digital stock drift.
- Conciliated sales are refused (same rule as B).

### Old clients
Builds that still call the five writes go through C0 (section 4) until a minimum version is enforced. New builds call A / B / C. A server switch (`defcon_persistencia_config`) decides when the old path is refused (with an update message), never before most users have moved.

### Concerns checked
Operation atomic on the server (one RPC, one transaction) · idempotency (`p_id`) · concurrency with VANT Quick (`FOR UPDATE` on the session, the advisory lock per tap) · financial history kept (archive, no physical delete) · stock and cost moved once, only by B or by C with explicit consent · Open Finance and machine payments: conciliated sales are protected · ranking, X1, profit goals read "not reversed, not discarded" in one shared view (`defcon_vendas_validas`) instead of each filtering on its own · audit table on every operation.

## 6. Historical records (the 1,982 sales): classification, no change

Rule from Rick: **two sales are never duplicates just because they share value and payment method.**

Classes, per deleted session, from signals:

| Class | Signals (all read-only) |
|---|---|
| test | account in `apple_contas_de_teste` or review/test e-mail |
| confirmed legitimate | linked to a machine payment (`mp_vendas`) or to a bank entry matched by Open Finance |
| probable legitimate | no new session that day, or the new session repeats none of the old sales after the restart |
| possible repetition | a new session that day whose sales, **after** the restart, repeat ≥ 80% of the old ones **in the same order** (value, method, product, quantity), entered much faster than the original pace (≤ ⅓ of the original span or ≤ 10 min) |
| inconclusive | everything else |

Preliminary read-only count (28/11, session level; one session was counted in two classes, to check):

| Class | Sessions | Sales | Value | With product | Accounts |
|---|---|---|---|---|---|
| probable legitimate | 284 | 1,904 | R$ 149,291.98 | 109 | 91 |
| inconclusive | 6 | 44 | R$ 753.00 | 35 | 5 |
| possible repetition | 4 | 35 | R$ 420.00 | 35 | 3 |
| test | 1 | 4 | R$ 80.00 | 0 | 1 |
| confirmed legitimate | 0 | 0 | — | — | — |

The earlier signal "1,062 sales with an equal value and method in the new session" over-counts. With the order and pace rules, the possible repetitions are 35 sales.

## 7. Reconciliation plan (separate, not executed)

1. **Snapshot**: copy the 1,982 rows and every derived figure (stock, `qty_sold`, cost, `daily_sales`) to a dated read-only schema. This is the rollback point.
2. **Classification table** `defcon_reconciliacao` (sale id, class, signals as JSON, rule version), written by a read-only job. Re-runnable, versioned.
3. **Report per account** (sessions, sales, value, products, class, evidence) for Rick's review. Nothing changes without his explicit decision per class, and per account for "possible repetition" and "inconclusive".
4. **Actions**, only after approval and only through the section 5 operations:
   - probable or confirmed legitimate: link to the archived session (C0 tables), no money or stock change;
   - test: C (discard), stock untouched unless confirmed;
   - confirmed repetition: B (reverse), stock once.
5. **Audit and reversal**: every action writes its before/after. A per-batch undo reads the snapshot and the audit (no hand edits).
6. **Verification**: after each batch, the session totals, `daily_sales`, ranking, X1 and profit goals of the affected days are recomputed and compared with the expected figures.

## 8. Decisions needed from Rick

1. C0 (archive on delete) as the immediate containment.
2. A, B and C as the target, and the restart's new meaning ("as vendas continuam").
3. Whether by-date readers (profit, X1, sobrar) should exclude sales of restarted sessions **before** the reconciliation (it changes figures users see).
4. The classification thresholds (80% / ⅓ of the span / 10 min) before the per-account report.
