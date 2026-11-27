# Apple subscriptions (Etapas 2 and 3): deploy and rollback

Draft. **Nothing here is applied to production.** Each step below needs Rick's authorisation.

## What is in the branch

| Piece | Where |
|---|---|
| Access rule by provider (Apple mirror, guards on the Hotmart writers) | `supabase/migrations/20261127120000_direitos_multi_provedor_apple.sql` |
| The risks recorded in PR #373 (suspension, courtesy, extra bank) | `supabase/migrations/20261127121000_direitos_riscos_registrados.sql` |
| Apple ledger, commercial origin, Sandbox out of the indicators | `supabase/migrations/20261127122000_apple_financeiro_origem_e_indicadores.sql` |
| Who may be offered a purchase on the iPhone; partner counts leave out Apple-only accounts (Etapa 3) | `supabase/migrations/20261127123000_apple_oferta_e_parceiros.sql` |
| Edge functions | `supabase/functions/apple-validar`, `apple-webhook`, `apple-conciliar`, shared code in `_shared/apple` |
| Read-only comparison of every account, before and after | `supabase/direitos-apple/comparar-antes-depois.sql` |
| Rollback | `supabase/direitos-apple/rollback.sql` |
| StoreKit 2 bridge (local Capacitor plugin) and its simulator tests | `plugins/vant-storekit`, `.github/workflows/ios-testes.yml` |
| Native plans screen and purchase flow of the iPhone app | `src/features/assinatura-apple` |

## Before the deploy

1. `npm run preflight`, `npm run test:sql` and `npm run drift` green on the commit to deploy.
2. Run `comparar-antes-depois.sql` in production (it is one select inside a READ ONLY transaction).
   Expected on 27/11/2026: 1,498 accounts, **1** with a difference (a paid extra bank on an account
   whose main plan is blocked: `essencial_banco` -> `sem_plano`), 0 Hotmart subscribers with a
   difference. Any other difference: stop.
3. Check that the eighteen functions about to be replaced still have the fingerprints recorded in
   `supabase/tests/casos/44_direitos_riscos_hoje.sql` (assertion F0) and, for the two partner
   functions, `casos/50_apple_oferta_e_parceiros.sql`. If one changed in production
   since 27/11/2026, regenerate the migration from the new body before applying.
4. Smoke under Deno: see the header of `supabase/functions/_shared/apple/fumaca-deno.ts`.

## Deploy order

1. **Migrations**, in order, in one maintenance step (the four belong together; the fourth needs
   the first three). With no Apple data every guard, and both partner counts, answer as today.
2. Run `comparar-antes-depois.sql` again: it must now report **0** differences (what it predicted is
   what the migrated functions answer).
3. **Secrets** (Rick, in the Supabase panel, never in chat): `APPLE_IAP_KEY_ID`, `APPLE_IAP_ISSUER_ID`,
   `APPLE_IAP_PRIVATE_KEY`. Optional: `APPLE_OCSP=1` after step 5 proved the functions on the runtime.
4. **Edge functions**, as stubs pinned to the merge commit (the pattern the other functions use):
   `apple-webhook` (`verify_jwt = false`), `apple-conciliar` (`verify_jwt = false`), `apple-validar`
   (`verify_jwt = true`).
5. **Smoke**, with no Apple call and no account touched:
   - `apple-webhook` with `{"signedPayload":"x"}` -> 401 `assinatura_invalida` (proves Apple's library
     and the pinned root load on the Edge runtime);
   - `apple-conciliar` without the cron header -> 401; with it -> 200 and `com_apple: true`;
   - `apple-validar` without a session -> 401.
6. **Schedule** (only now), hourly, like the Hotmart expiry:
   ```sql
   select cron.schedule('apple-conciliar-hora', '23 * * * *', $$
     select net.http_post(
       url := 'https://qbcsjsdwjjpybvzbxszi.supabase.co/functions/v1/apple-conciliar',
       body := '{}'::jsonb,
       headers := jsonb_build_object('Content-Type', 'application/json',
                                     'x-orbis-cron', (select token from public.painel_tokens where nome = 'cron')))
   $$);
   ```
7. **App Store Connect** (Rick): the notification URLs (Production and Sandbox) pointing to
   `apple-webhook`, then "Request a Test Notification": the function must log a `TEST` event.
8. Register the review / test accounts with `public.apple_conta_de_teste_registrar` before any
   Sandbox purchase.

Nothing in the iPhone app calls these functions until a build made in `apple` mode ships (below),
so steps 1 to 8 change no customer's experience.

## The iPhone app (Etapa 3)

The app sells through Apple only when it is **built** with `VITE_COBRANCA_LOJA=apple`, and only on
iOS (on Android the same value behaves as `link`). `ios-build.yml` builds `link` unless the
repository variable `VITE_COBRANCA_LOJA_IOS` is `apple`, so the switch is one variable and going
back is the next build without it.

Before the first Sandbox purchase, besides steps 1 to 8:

1. Paid Apps agreement, tax forms and bank account "Active" in App Store Connect.
2. The four products created there with exactly the ids in `_shared/apple/regras.ts` (`PRODUTOS`),
   the three plans in one subscription group (Essencial below Pro) and the bank add-on in another.
3. A Sandbox tester (App Store Connect > Users and Access > Sandbox).
4. A TestFlight build with `VITE_COBRANCA_LOJA_IOS=apple`. It is the first build with the plugin:
   `npx cap sync ios` must list `vant-storekit`.

The StoreKit tests (`ios-testes.yml`) run in the simulator with a StoreKit Configuration of
fictional products: no signing, no secret, no upload, no real purchase. The purchase tests need a
host app, generated in CI from `plugins/vant-storekit/ios/Hospedeiro` (never signed or shipped).

## Rollback

- iPhone app: build without `VITE_COBRANCA_LOJA_IOS=apple` (the app goes back to the link mode). An
  Apple subscription already bought keeps its access: the server side decides it, not the screen.
- Edge functions: delete the three functions (or deploy a stub that answers 410). Remove the schedule:
  `select cron.unschedule('apple-conciliar-hora');`
- Database: `supabase/direitos-apple/rollback.sql`, one transaction. It **refuses** to run while there
  is a Production Apple subscription, a Production sale in the ledger, a payout typed in, or a
  suspension in force: from that point on going back is a decision per account, not a script. It
  gives back every courtesy held only by the courtesy mark, restores the eighteen functions to
  production's bodies of 27/11/2026 and removes the new objects (the history of lifted suspensions
  is kept). Tested by `supabase/tests/casos/43_direitos_rollback.sql`.

## Known limits

- The plans screen in the real app on a device, and the first `apple-validar` call from the iPhone,
  are only proved by the first Sandbox purchase.
- One bank add-on per Apple account for now (the add-on is one product in its own group).
- `painel_parceiro` is not patched: it pays only on rows of `subscriptions`, which Apple never
  writes (asserted in `casos/50`). A change there must keep that.
- The call from the Edge runtime to Apple's API is covered in Node (intercepted network) and its
  request building under Deno; the first real call happens at step 5 with Rick's key.
- OCSP (asking Apple whether a certificate was revoked) is off by default (`APPLE_OCSP`). The chain to
  Apple's pinned root, the validity dates and the signature are always checked.
- The ledger's fee and net are estimates (`public.apple_taxas`); the real figure is the payout typed
  into `public.apple_repasses`. An upgrade's partial refund is not itemised by Apple in the
  notification: the replaced transaction is only marked (`substituida`).
