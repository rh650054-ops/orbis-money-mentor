# ADR 0002 — DEFCON: restart the day's operation, reverse a sale, discard test records (P1)

Status: **accepted (Rick, 28/11/2026)** — the A/B/C architecture of §5 is approved; its implementation has **not** started and needs a separate go. C0 (§4) is in production since 28/11/2026 (PR #403, migration 20261129100000). Classified **P1** by Rick (28/11/2026).
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

## 4. Immediate containment C0: data preservation, NOT the fix (PR #403, in production since 28/11/2026)

The first proposal (one `before delete` trigger on the session) was wrong: write 1 deletes the block counters **before** the session (Rick, 28/11). C0 now archives **row by row on each destructive write, from the first one**:

| Write | Kept (full old row, as JSON) | Step |
|---|---|---|
| 1 delete `challenge_blocks` | counters | `contadores` |
| 2 delete `challenge_sessions` (+ cascade) | session, approaches, ledger corrections, notes, counters re-created meanwhile | `sessao`, … |
| 3 delete `hourly_goal_blocks '⏱%'` | +1h blocks | `blocos_extras` |
| 4 zero the blocks | each block **before** zeroing | `blocos_zerados` |
| 5 zero `daily_sales` | the day **before** zeroing | `dia_zerado` |
| a sale later written for the deleted session (offline upload) | recorded and linked to the event | — |

Properties (all tested in `supabase/tests/casos/60_defcon_c0_preservacao.sql`):
- One event per account and day (10-minute window, advisory lock), one copy per (event, table, row, step), so retries archive nothing new. A step missing from the event means that write never ran (`defcon_c0_resumo` reports it as partial).
- It never blocks a client. Errors become warnings, and an ordinary sale costs nothing extra (`WHEN` filters run before any function call).
- VANT Quick: the session delete waits for the tap's session lock, so the archived session includes the tap.
- Account deletion: nothing is archived inside `apagar_dados_do_usuario` / `conta_teste_zerar` (`pg_context`) or for an unknown user. Archive rows cascade with `auth.users`, which covers the admin path that deletes the auth user last.
- RLS: owner reads, no client writes. Retention: 400 days (decision pending), with a purge function and no cron created.

C0 does not change the double meaning of the orphan sales for the by-date readers; that is A/B/C plus the reconciliation.

## 5. Target architecture: three different operations

Each one is a single `SECURITY DEFINER` RPC, atomic, idempotent by a client id (`p_id`, kept in `defcon_ids_encerrados` like the ledger's taps), with `FOR UPDATE` on the session (the same lock VANT Quick takes), and one row in an append-only audit table (who, when, client, before/after totals).

### Data model (proposal)

| Change | Purpose |
|---|---|
| `challenge_sessions.jornada int not null default 1` | the current run of the day's operation; A increments it |
| `defcon_jornadas (session_id, jornada, iniciada_em, encerrada_em, motivo, cliente)` | history of the runs (who, when, why) |
| `jornada int` on `defcon_abordagens`, `defcon_ajustes`, `challenge_blocks` (unique becomes `(session_id, jornada, block_index)`), `defcon_sales` | approaches, corrections and counters per run; sales keep the run they happened in |
| `defcon_sales.estornada_em / estorno_motivo / estornada_por / estorno_devolveu_estoque` | B: the original row stays, marked |
| `defcon_estornos (venda_id pk, id_operacao unique, devolveu_estoque, efeitos jsonb, criado_em)` | B exactly once: the effects actually undone |
| `defcon_descartes (id, id_operacao unique, ids uuid[], motivo, devolveu_estoque, confirmacao, criado_em)` + rows moved to `defcon_arquivo` | C with an audit trail |
| view `defcon_vendas_validas` = not reversed, not discarded | the ONE reader filter for ranking, X1, profit goals, reports |
| `defcon_operacoes (id_operacao pk, tipo, user_id, resultado jsonb, criado_em)` | idempotency of A/B/C (a resent call returns the first answer) |

### RPC contracts (proposal)

All three: `security definer`, `auth.uid()` must own the session or sale, a client `p_id_operacao uuid` (a retry returns the stored answer), `FOR UPDATE` on the session (the lock VANT Quick takes), one transaction, one audit row.

| RPC | Input | Answer | Refuses |
|---|---|---|---|
| `defcon_reiniciar_jornada(p_sessao, p_id_operacao, p_motivo)` | session | `{ok, jornada, vendas_preservadas, valor_preservado}` | session of another account; a day already closed |
| `defcon_estornar_venda(p_venda, p_id_operacao, p_motivo, p_devolver_estoque bool)` | sale | `{ok, ja_estornada, efeitos}` | `venda_conciliada` (mp_vendas / Open Finance match), `competicao_encerrada` (a sale of a closed competition or awarded period: kept, its own correction flow), another account |
| `defcon_descartar(p_ids uuid[], p_id_operacao, p_motivo, p_devolver_estoque bool, p_confirmacao text)` | sales or records | `{ok, descartados, valor, devolvido}` | missing or wrong confirmation (must repeat the count and total shown), conciliated sales, another account |

- **A, restart the run**: sales, the day's revenue, cost and stock stay untouched. The timer, the current block and the pauses go back to the start of `jornada + 1`; earlier runs' blocks and approaches stay readable. The app shows "Nenhuma venda será apagada" before confirming.
- **Interaction with #401** (Rick, 28/11): the Live Activity refuses an older block of the same session. A restart is legitimate only as a new **run**, so the Live Activity's mark becomes `(sessao, jornada)`. Within a run, an older block is refused; a newer run starts over at block 1; a late answer of the previous run is refused like one of another session.
- **B, reversal**: cancelling the money and returning the goods are separate. `p_devolver_estoque` defaults to false (the product left with the customer unless the seller says otherwise). Stock, variant, ingredients, `qty_sold` and cost move only when it is true, exactly once (`defcon_estornos`). Competition and prize closing rules are respected (refused after the close, so a closed ranking never changes silently).
- **C, discard**: explicit confirmation, rows archived (never physically lost), stock only by consent, no silent financial deletion (the count and value removed are in the answer and in the audit).

### Old clients
Builds that still call the five writes go through C0 (section 4) until a minimum version is enforced. New builds call A / B / C. A server switch (`defcon_persistencia_config`) decides when the old path is refused (with an update message), never before most users have moved.

### Concerns checked
Operation atomic on the server (one RPC, one transaction) · idempotency (`p_id`) · concurrency with VANT Quick (`FOR UPDATE` on the session, the advisory lock per tap) · financial history kept (archive, no physical delete) · stock and cost moved once, only by B or by C with explicit consent · Open Finance and machine payments: conciliated sales are protected · ranking, X1, profit goals read "not reversed, not discarded" in one shared view (`defcon_vendas_validas`) instead of each filtering on its own · audit table on every operation.

## 6. Historical records: classification (no change to any record)

The query is `arquitetura/0002-classificacao.sql` (read only, versioned, fixed cutoff). It returns one row per sale with its class and its evidence: the pair in the live session, when it was entered, the session's share paired, and the original and re-entry durations.

**Universe** at cutoff `2026-11-28 20:00 UTC`: **1,987 sales, 295 sessions, 92 accounts, R$ 150,544.98**. The first audit (~18:40 UTC) saw 1,982 / 294 / R$ 149,721.98. The difference (5 sales, 1 session, R$ 823.00) is a customer restart on 28/11 between 16:06 and 16:08 BRT, between the two queries: the incident is still happening. One deleted session spans midnight (18→19/09), so a session's day is the day of its first sale.

Every sale has exactly one class (one `CASE`, first rule that holds), and the classes add up to the universe:

| Class | Sales | Value | With product | Sessions* | Accounts* |
|---|---|---|---|---|---|
| L probable legitimate | 1,368 | R$ 140,254.98 | 124 | 232 | 82 |
| I inconclusive | 400 | R$ 6,923.00 | 20 | 98 | 40 |
| R possible repetition | 215 | R$ 3,287.00 | 35 | 21 | 10 |
| T test | 4 | R$ 80.00 | 0 | 1 | 1 |
| C confirmed legitimate | 0 | — | — | — | — |
| **Total (unique)** | **1,987** | **R$ 150,544.98** | **179** | **295** | **92** |

\* A session or an account can hold sales of several classes, so those columns overlap (their sum is above the unique total). The 619 pairs are 619 different live sales (1 to 1).

**Corrections to the first count (28/11, same day).**
1. Product compared with `USING (product_id)`: a NULL product never matched NULL, so most pairs were lost (35 "repetitions").
2. Each deleted session was compared with the same live sales: a day with three restarts used the same 52 live sales three times.
3. The two counts were taken at different moments without a fixed cutoff.

The thresholds (80%, ⅓ of the span, 10 min) are **investigative heuristics only**, not proof of duplication (Rick, 28/11). Value and method alone never classify.

**Concentration.** Three accounts hold R$ 111,438 of the R$ 150,545: one with five sales totalling R$ 51,234 on 12/08, one with 42 sales totalling R$ 32,300 on 07/08, and one with 636 sales across 35 sessions. Values that high in one session are a signal for the per-account review (a typo or a test), not a class.

## 7. Reconciliation plan (separate, not executed)

1. **Classification table** `defcon_reconciliacao (venda_id, classe, regra, evidencia jsonb, versao_regra, corte)`, filled by the read-only query. Re-runnable, versioned, with the cutoff stored.
2. **Per-account review** by Rick. Nothing changes without his decision per account; R and I always per account. The report is `reconciliacao_por_conta_*.csv`.
3. **Actions only through the operations of §5, one audit row each:**
   - legitimate: linked to the archived session (C0 tables); money and stock untouched;
   - test: C (discard), stock untouched unless confirmed;
   - confirmed repetition: B (reverse), stock only if the goods came back.
4. **Reversal by compensating operations**, never by restoring snapshots. Undoing a reversal is a new counter-entry (re-apply the sale's effects once, audited). A snapshot restore could overwrite legitimate sales made after the reconciliation. Snapshots exist only for **comparison** in the verification step.
5. **Verification after each batch**: session totals, `daily_sales`, ranking, X1, profit goals and stock of the affected days, recomputed and compared with the expected figures (snapshot + the batch's own audit).
6. Until Rick decides otherwise, the by-date screens **keep counting** the orphan sales (no reader changes now).

## 8. Decisions needed from Rick

1. ~~C0 (PR #403): authorize its application~~ — **decided 28/11/2026**: applied; retention 400 days (account deletion still removes everything at once). Purge schedule still open: nothing expires before 2027-12, so `defcon_c0_expurgar()` needs a weekly cron before then.
2. ~~The data model and RPC contracts of §5~~ — **decided 28/11/2026**: A/B/C approved as documented here; implementation waits for Rick's go. Open inside it: the meaning of B for closed competitions and awards.
3. No historical sale is changed (Rick, 28/11/2026): the 1,987 sales of §6 stay exactly as they are.
4. The per-account review of classes R and I (215 + 400 sales), starting with the three concentrated accounts.
