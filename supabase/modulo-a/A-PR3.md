# Open Finance V2 · Module A · A-PR3 — states calculated in parallel

Third step of Module A. From the provider events the webhook records since A-PR2, it keeps the
**consent state** of each link in the records A-PR1 created, with the history of its changes,
and lists where that state and what the screen says today disagree.

**In parallel only.** `bank_connections.status` stays what the app, the robot, the webhook and
every financial rule use. Nothing reads the new state. No edge function changes, no screen, no
cron. Merging this PR applies nothing; applying the migration and running the calculation are
separate, explicit authorisations.

## What it creates

One migration, `20261112230000_modulo_a_estados_em_paralelo.sql`: **seven functions and nothing
else** — no table, column, index, trigger, policy or cron.

| Function | What it does |
| --- | --- |
| `of_consentimento_do_motivo(codigo)` | The reasons only the vendor can solve, and the consent each one means |
| `of_grupo_do_status(status)` | What a stored `status` means for the screen today |
| `of_consentimento_do_estado(status, execucao, erro, expira, quando)` | The consent, from what the provider says explicitly |
| `of_consentimento_pede_vendedor(consentimento)` | Whether a consent state asks the vendor to reauthorise |
| `of_estados_atualizar()` | Applies the recorded events to the consent of their link. Idempotent, one run at a time |
| `of_estados_conferir()` | The list of differences between the new state and the screen. Empty = they agree |
| `of_estados_relatorio()` | Numbers only |

The first four are the same rules as `supabase/functions/_shared/pluggy-estado.ts` (what the app
and the edge functions use today), written again in SQL. The two are kept in step by **one list
of cases that both test suites run**: `supabase/modulo-a/estados-casos.json` (26 statuses, 35
consulted states). Change a rule in one place and the list fails the other.

## How an event becomes a state

`of_estados_atualizar()` takes the completed event records not evaluated yet, in arrival order,
and for each one decides once (`of_eventos.aplicado`):

| Situation | `aplicado` | Consent |
| --- | --- | --- |
| Consultation `ok`, provider date equal to or later than the one applied last | `true` | Recalculated; a change is written to `of_mudancas` only when the state changes |
| Provider date **older** than the one already applied (late event, A14) | `false` | Unchanged |
| Consultation failed, was not made, or the Item no longer exists | `false` | Unchanged (the attempt stays in the event) |
| No provider date in the consulted state | `false` | Unchanged |
| Link removed | `false` | Unchanged |
| No vendor or no Item (bank-status events) | `false` | — |
| Event's vendor is not the link's | `false` | Unchanged; counted as a conflict |
| Record the webhook opened and never completed (older than 10 minutes) | `false` | — |
| No link yet for that Item (the mirror has not run since the connection was made) | stays empty | Evaluated on a later run |

Then, with no event needed, a consent that has an explicit expiry date moves between
`autorizado`, `expirando` (7 days) and `expirado` as time passes.

What is written, and only when the function is called: `of_consentimentos` (state, raw value,
expiry, provider date), `of_mudancas` (one row per change: from, to, what the provider said, the
provider's date, the event it came from) and `of_eventos.aplicado`. It never deletes, never
writes a link state (the mirror owns those — A11) and touches no table that existed before
A-PR1.

### The provider's date — a decision to confirm

The contract orders consulted states by "the update date the provider gives". That is the
**Item's own update date** (`updatedAt` in the consulted state). A-PR3 uses it for that one
purpose — deciding whether a consulted state is newer than the one applied — and stores it as
`of_consentimentos.confirmado_em` and `of_mudancas.provedor_em`. It is never the time of an
event: `of_eventos.provedor_em` stays empty, as decided in A-PR2, and the arrival time of a
change is the `chegou_em` of the event it points to. In production (12/11, 75 events, 12 Items)
that date was present in every consulted state and never went backwards for the same Item.

## The list of differences

`of_estados_conferir()` returns one row per problem, for live connections only:

| `problema` | Meaning |
| --- | --- |
| `novo_pede_o_vendedor_e_a_tela_nao` | The provider said something that depends on the vendor; the screen does not offer "Autorizar" |
| `tela_pede_o_vendedor_e_o_novo_nao` | The screen offers "Autorizar"; the new state has nothing that asks for it |
| `consentimento_desconhecido` | The provider said something we do not know (the alarm of A13) |
| `status_desconhecido` | The stored `status` is one the screen does not know |
| `item_nao_existe_no_provedor` | The last consultation found no Item, and the connection is still live |
| `sem_vinculo` / `sem_consentimento` | The mirror has not caught up |

Each row carries the stored status, its group, the new consent and `com_evento`. **`com_evento =
false`** means no recorded event has confirmed that link's consent yet: the new state is still
the initial `nao_informado`, so the difference says nothing about the provider. That is expected
at the start — events are recorded only since A-PR2 (12/11, 18:38), and a bank waiting for the
vendor is not read, so it produces no event until the vendor acts.

**Expected on the first run in production** (prediction from the data of 12/11, not a test): no
consent leaves `nao_informado` (every consulted state so far is `UPDATED` or `UPDATING`, with no
expiry date), and the three connections whose screen asks for the vendor today appear as
`tela_pede_o_vendedor_e_o_novo_nao` with `com_evento = false`.

## Tests

| Suite | What it proves | Checks |
| --- | --- | --- |
| `supabase/tests/casos/14_modulo_a_estados.sql` (`npm run test:sql`) | Same rules as the app (the shared list); UPDATED proves no consent (A12); vendor states with full history (A15); late event refused (A14); failed consultation and missing Item change nothing; unknown stays raw (A13); explicit expiry and the passing of time; events with no vendor, another vendor's, for a removed link, never completed, or waiting for the mirror; link and consent independent (A11); nothing that existed changes; idempotent; the list of differences; no vendor can run or read; account deletion; rollback and re-apply | 70 |
| `src/test/pluggy-estados-gemeos.test.ts` | The TypeScript rules against the same list; every status the code knows is in it; every consent state of the contract is covered | 5 |

Mutations of the SQL (each makes the suite fail): late event applied — 4 checks; `UPDATED` taken
as authorised — the case stops with an error; a failed consultation treated as healthy — 4; one
rule made different from the app — 2.

Not tested: anything in production. The functions have not been created there.

## Applying and running (only with explicit authorisation, each step)

1. **Before** (read-only): none of the seven functions exists; the file is identical to `main`;
   A-PR1's objects are there (9 tables, 5 functions).
2. **Apply** the migration once (one transaction, `lock_timeout = 3s`, `statement_timeout =
   30s`). It creates functions only and takes no lock on `auth.users`.
3. **After** (read-only): seven new functions, none `security definer`, none executable by
   `anon` or `authenticated`; every object that existed before unchanged.
4. **Run**, by hand: `select public.of_espelho_atualizar();` (so new connections have a link),
   then `select public.of_estados_atualizar();`.
5. **Read** `select public.of_estados_relatorio();` and `select problema, grupo_atual,
   consentimento, com_evento, count(*) from public.of_estados_conferir() group by 1, 2, 3, 4;`.
   Nothing is acted on.
6. Running again with nothing new applies nothing.

Applying through the SQL API does not register the migration in the history, as with A-PR1:
reconciling it is the same separate step (`supabase migration repair`, on an authorised machine).

## Rollback

`supabase/modulo-a/rollback-a-pr3.sql` drops the seven functions, in one transaction, without
`CASCADE`. Nothing depends on them. What they wrote stays (nothing reads it); the file ends with
an optional block, to be run by hand and only with explicit authorisation, that takes the
records back to how A-PR2 left them. Everything can be rebuilt from the recorded events.

If A-PR1 is ever rolled back, roll this one back first.

## Known limits, on purpose

- **Two implementations of the rules** (TypeScript and SQL). The shared list of cases is what
  keeps them equal; a rule added to one side without a case would not be caught.
- **Only what events say.** The robot's own consultations (A5) correct `status` but are not
  recorded as events, so the new state can stay behind the screen until an event arrives.
  Recording those consultations is a natural next step.
- **No schedule.** The state is as fresh as the last run. A schedule is a separate decision.
- **History starts at A-PR2.** Nothing is seeded from the stored `status`: the contract starts
  every existing connection at `nao_informado`.
- **Link states from the provider** (an Item that no longer exists) are listed as a difference,
  not applied: the mirror owns link states until substitution and quarantine exist (A-PR8).
- **No panel.** The "internal panel" of the plan is, for now, the two read-only functions.
