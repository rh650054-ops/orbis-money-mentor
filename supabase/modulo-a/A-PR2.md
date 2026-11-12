# Open Finance V2 · Module A · A-PR2 — the provider's events, recorded

Second step of Module A. `pluggy-webhook` starts writing every event Pluggy sends into
`public.of_eventos` (created by A-PR1), together with the Item state it consulted and what it did
with the event. **Shadow only:** nothing reads that table. What the webhook does with an event,
and what it answers to Pluggy, is exactly what it did before.

No SQL. No screen. One function to publish: `pluggy-webhook`.

## What is recorded: chosen field by field

Nothing is copied whole — not the event, not the Item, not its per-product detail. Each kept
field is read by name and must have the expected shape. Free text, nested objects, fields the
provider adds later and values of the wrong type are left out.

| Column | What goes in |
| --- | --- |
| `evento_id` | Pluggy's `eventId` (a UUID). The table accepts each one once: a second delivery is only noticed in the log |
| `item_id`, `tipo` | The Item (a UUID) and the event name (`word/word`) |
| `bruto.evento` | `event`, `eventId`, `itemId`, `triggeredBy` (a code), `erro` (the error **code**), `connectorId` (a number), `statusDoConector` (a code), `transacoes` (**how many** transaction ids the event lists) |
| `bruto.consulta` | `ok`, `falhou`, `item_nao_existe` (Pluggy answered 404) or `nao_feita` |
| `bruto.consultado` | Of the consulted Item: `status`, `executionStatus`, `erro` (codes), `createdAt`, `updatedAt`, `lastUpdatedAt`, `consentExpiresAt` (dates), `conector` (a number), and `statusDetail` rebuilt for the known products (`accounts`, `creditCards`, `transactions`, `investments`, `investmentsTransactions`, `identity`, `paymentData`, `loans`): `isUpdated` (boolean), `lastUpdatedAt` (date), `avisos` (how many warnings) |
| `resultado` | What the webhook did: `lido`, `sem_extrato`, `pausado`, `conexao_removida`, `ignorado`, `adiado:…`, `recusa:…`, `sem_evento_ou_item`, `pluggy_sem_chave`, `erro` |
| `user_id` | The vendor of the connection, once known |
| `chegou_em` | When the event arrived (set by the database) |
| `provedor_em` | **Not written.** See below |
| `aplicado` | Left empty. Applying a state to the new records is A-PR3 |

Accepted shapes: a code is capitals, digits and `_` (an unknown code is kept as it came — A13);
an id is a UUID; a connector id is digits; a date must parse as a date; a count is a number.

**Never stored:** `clientId` (our application id at Pluggy), `clientUserId`, account ids,
transaction ids, links, date ranges of the data, error messages and parameters, the Item's
`webhookUrl` (it holds the webhook secret), `parameter`, credentials, instructions, connector
names and images, warning texts, anything inside a product the list above does not name.

The column is still called `bruto` (A-PR1 named it); what it holds is this selection.

### The provider's time

`provedor_em` exists for a time **of the event, supplied by the provider**. Pluggy's events carry
none: its documented payloads have no such field, and no payload seen in production on
12/11/2026 had one. The Item's `updatedAt` is the time the Item last changed, not the time of
the event, so it is not used as a substitute. The column stays empty. The Item's own dates are
kept where they belong, inside `bruto.consultado`. Ordering by provider time (contract, step 3)
is A-PR3's problem and will have to use the consulted state.

## The function log

The line that printed the first 300 characters of the payload is gone (it carried the vendor's
id, the Item, the account and transaction ids). In its place:
`pluggy-webhook evento {"tipo","com_id","com_item","origem","erro","transacoes"}` — the event
type, whether it came with an id and an Item, who triggered it, the error code and a count.
The line that ended an import no longer prints the vendor's id; it prints the connection's.
Errors of the recording print the database error code only.

## Who the rows belong to, and how long they live

- An event of a known connection belongs to that connection's vendor and is erased with the
  account (foreign key, on delete cascade). That includes events for a connection the vendor
  removed: recording that Pluggy sent an event reads nothing from the bank.
- An event whose vendor is not known (no connection row for that Item; the bank-status events,
  which have no Item) keeps `user_id` null and is **deleted after 7 days**
  (`VALIDADE_SEM_VENDEDOR_DIAS`, initial value approved on 12/11/2026).
- **The deletion depends on new events arriving.** It runs inside the webhook, at most once an
  hour per running instance, when an event is being handled. There is no cron. If no event
  arrives, an expired row stays until the next one does. With today's traffic (hundreds of
  events a day) that is minutes; if the webhook were ever switched off, vendor-less rows would
  stop expiring and would need a scheduled job or a manual delete.
- Events tied to a vendor have no expiry here (A-PR1 has no retention mechanism). How long to
  keep them is a separate decision.

## What cannot go wrong for the webhook

Recording is wrapped: a refused insert, a timeout (3 s per statement) or a network error is
logged (`pluggy-webhook: evento nao registrado`, `… registro do evento nao foi completado`) and
the event is processed as if nothing had happened. The cost is two short statements per event.

## Tests

`src/test/pluggy-webhook-eventos.test.ts` (32): each kind of event and the Item reduced to the
chosen fields; sensitive fields nested at any depth, fields added later and unknown products
left out; chosen fields with the wrong shape dropped (every leaf replaced by a marker text: the
marker never reaches the row or the log); unknown codes kept (A13); the provider's time never
written; each exit of the webhook named; repeats stored once; failures swallowed; no identifier
in any log line; vendor-less events expire and vendor-tied ones do not.

Rehearsed against the real table definition (local database with the A-PR1 migration applied):
insert, repeated `eventId` refused with `23505`, completion, expiry of vendor-less rows only,
and deletion of the account taking the vendor's events with it.

The handler itself runs on Deno and is not unit-tested: its change is the calls to the tested
functions and a wrapper around the existing answers. It type-checks under strict `tsc`.

## Publishing (only with explicit authorisation)

1. Publish `pluggy-webhook` from the merge commit.
2. No secret → still 401 `unauthorized`.
3. After real events (read-only):
   ```sql
   -- one row per event, closed, tied to its vendor
   select resultado, bruto->>'consulta' as consulta, count(*) as n,
          count(*) filter (where user_id is null) as sem_vendedor,
          count(*) filter (where resultado is null) as abertos,
          count(*) filter (where provedor_em is not null) as com_hora_do_provedor
     from public.of_eventos group by 1, 2 order by n desc;
   -- only the chosen keys exist (expect exactly the lists in the table above)
   select 'evento' as onde, k, count(*) from public.of_eventos, jsonb_object_keys(bruto->'evento') k group by 1, 2
   union all
   select 'consultado', k, count(*) from public.of_eventos, jsonb_object_keys(bruto->'consultado') k
    where jsonb_typeof(bruto->'consultado') = 'object' group by 1, 2 order by 1, 2;
   ```
   and the function log shows the same reads, stamps and imports as before, with no
   `evento nao registrado`.
4. Rollback: republish the previous version of `pluggy-webhook`. The rows already written stay
   (nothing reads them) and can be removed with `truncate public.of_eventos cascade` — a
   separate, explicit decision.
