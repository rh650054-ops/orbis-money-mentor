# Open Finance V2 · Module A · A-PR2 — the provider's events, recorded

Second step of Module A. `pluggy-webhook` starts writing every event Pluggy sends into
`public.of_eventos` (created by A-PR1), together with the Item state it consulted and what it did
with the event. **Shadow only:** nothing reads that table. What the webhook does with an event,
and what it answers to Pluggy, is exactly what it did before.

No SQL. No screen. One function to publish: `pluggy-webhook`.

## What is recorded

| Column | What goes in |
| --- | --- |
| `evento_id` | Pluggy's `eventId`. The table accepts each one once: a second delivery is only noticed in the log |
| `item_id`, `tipo` | The Item and the event name, as sent |
| `bruto.evento` | The event as received, minus `clientId` (our own application id at Pluggy). Larger than 100 000 characters: stored cut, saying so |
| `bruto.consulta` | `ok`, `falhou`, `item_nao_existe` (Pluggy answered 404) or `nao_feita` |
| `bruto.consultado` | A fixed list of fields of the consulted Item: status, execution status, error code, per-product detail, dates, connector id and name. Never the whole Item (it carries `webhookUrl`, which holds the webhook secret, and `parameter`) |
| `provedor_em` | The Item's own update time, as Pluggy reports it |
| `chegou_em` | When the event arrived |
| `resultado` | What the webhook did: `lido`, `sem_extrato`, `pausado`, `conexao_removida`, `ignorado`, `adiado:…`, `recusa:…`, `sem_evento_ou_item`, `pluggy_sem_chave`, `erro` |
| `user_id` | The vendor of the connection, once known |
| `aplicado` | Left empty. Applying a state to the new records is A-PR3 |

The row is written as soon as the event is accepted (after the secret is checked) and completed
when the webhook is done with it.

## Who the rows belong to, and how long they live

- An event of a known connection belongs to that connection's vendor and is erased with the
  account (foreign key, on delete cascade). That includes events for a connection the vendor
  removed: recording that Pluggy sent an event reads nothing from the bank.
- An event whose vendor is not known (no connection row for that Item; the bank-status events,
  which have no Item) keeps `user_id` null and is **deleted after 7 days**
  (`VALIDADE_SEM_VENDEDOR_DIAS`). The webhook looks for expired ones at most once an hour per
  running instance. Seven days is about how long the function logs keep the same payload today.
  This closes risk 4 of the A-PR1 review; the number is a decision that can change.
- Events tied to a vendor have no expiry here (A-PR1 has no retention mechanism). At today's
  volume that is a few hundred to a few thousand small rows a day. How long to keep them is a
  separate decision.

## What cannot go wrong for the webhook

Recording is wrapped: a refused insert, a timeout (3 s per statement) or a network error is
logged (`pluggy-webhook: evento nao registrado`, `… registro do evento nao foi completado`) and
the event is processed as if nothing had happened. The cost is two short statements per event.

## Tests

`src/test/pluggy-webhook-eventos.test.ts` (23): what is stored of the event and of the Item;
what never is (secret-bearing address, parameter, credentials, error text, our application id);
unknown statuses kept raw; how each exit of the webhook is named; repeats stored once; failures
swallowed; no identifier in any log line; vendor-less events expire and vendor-tied ones do not.

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
          count(*) filter (where resultado is null) as abertos
     from public.of_eventos group by 1, 2 order by n desc;
   -- nothing that must never be stored (expect 0)
   select count(*) from public.of_eventos
    where bruto::text ilike '%webhookUrl%' or bruto::text ilike '%secret=%' or bruto ? 'clientId'
       or bruto->'evento' ? 'clientId';
   ```
   and the function log shows the same reads, stamps and imports as before, with no
   `evento nao registrado`.
4. Rollback: republish the previous version of `pluggy-webhook`. The rows already written stay
   (nothing reads them) and can be removed with `truncate public.of_eventos cascade` — a
   separate, explicit decision.
