# `src/features/`

Each feature lives in its own folder. Pages, components, hooks, types, and data fetching for that feature live together. Cross-feature consumers only import via the feature's root `index.ts`.

## Canonical sub-structure

```
src/features/<feature>/
  api/                 react-query hooks (useXQuery, useXMutation) + raw fetchers
  components/          feature-owned UI
  hooks/               local feature hooks (NOT data; data lives in api/)
  types/               zod schemas + inferred TS types
  routes/              page-level components mounted by app/router.tsx
  index.ts             public barrel — ONLY what other features may import
```

## Rules

- A feature cannot import from another feature's internals. Only via `features/<other>/index.ts`.
- No barrel exports inside a feature. Only one `index.ts` at the feature root.
- Pages live inside features (`features/products/routes/products-page.tsx`), not in a top-level `pages/`.
- `app/router.tsx` is the only file that knows the route tree.

## Naming (A2)

- Files: kebab-case (`products-list.tsx`, `use-products-query.ts`).
- React components export PascalCase (`export function ProductsList()`).
- Hooks export camelCase prefixed with `use` (`export function useProductsQuery()`).
- Zod schemas: camelCase, TS type inferred (`type Product = z.infer<typeof productSchema>`).
- Query key factories: `productsKeys.all`, `productsKeys.detail(id)`, `productsKeys.byUser(userId)` (built from `createQueryKeys` in `@/shared/api`).

## Data fetching (A3)

- No direct `supabase.from(...)` calls outside `api/*.ts`. Use `@/shared/api/supabase` and route through `useQuery` / `useMutation`.
- Loading: `<Skeleton*>` from `@/shared/components/skeletons`.
- Errors: surface via query state, wrap each route in `<FeatureErrorBoundary feature="x" />` from `@/shared/components/feature-error-boundary`.

## Size budgets (A5)

| Kind | Hard cap (LOC) |
|------|----------------|
| Route component | 200 |
| Regular component | 150 |
| Hook | 120 |
| API hook file | 80 |

If a file exceeds the budget after a task ships, the task is incomplete. Split it before merging.

## Lazy loading (A9)

Every feature route is `React.lazy()`-loaded inside `src/app/router.tsx`. Pages live in `routes/` and are referenced by the router via dynamic import.

## Done definition (A10)

A feature migration task is "done" only when **all** of these hold:

- [ ] Folder moved into `src/features/<name>/` with the canonical sub-structure.
- [ ] All Supabase calls live in `api/`.
- [ ] All reads/writes go through react-query.
- [ ] Route component ≤200 LOC, no other file over budget.
- [ ] Skeleton + error boundary present.
- [ ] Old files in `src/pages/` and `src/components/` deleted (no shims, no re-exports).
- [ ] Routes registered in `app/router.tsx`.
- [ ] At least one happy-path test passes (`npm test`).
- [ ] `npm run typecheck` and `npm run lint` clean.
- [ ] Feature `index.ts` barrel exports only what other features may consume.
