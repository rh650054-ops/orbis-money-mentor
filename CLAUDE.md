# CLAUDE.md

Repo-specific guidance for Claude Code (and humans) working in `orbis-money-mentor`.

## Preflight (run before every PR)

```bash
npm run preflight   # lint && typecheck && test:run
```

This is non-negotiable. A feature task is not "done" if `preflight` is red.

## Architecture (see `docs/adr/`)

```
src/
  app/          bootstrap: providers, router, root shell, layout, splash
  features/     one folder per feature (api, components, hooks, types, routes, index.ts)
  shared/
    api/        supabase client facade, query-keys factory, error mapper
    components/ cross-feature presentational + skeletons
    hooks/      cross-feature hooks
    lib/        utils, formatters, date helpers
    ui/         shadcn primitives
  test/         vitest setup + MSW server
```

### Part A rules (also in `docs/tasks.md`)

- **A1 Folder layout**: feature folders only. No top-level `pages/` or root `components/`. Cross-feature imports go through `@/features/<name>` only (the feature's root `index.ts`).
- **A2 Naming**: kebab-case files, PascalCase components, camelCase `use*` hooks.
- **A3 React Query mandatory**: zero direct `supabase.from(...)` outside `@/shared/api/**` and `@/features/*/api/**`. Reads via `useQuery` with typed keys from `<feature>Keys`; writes via `useMutation` with `onSuccess` invalidation. Default config: `staleTime: 30_000`, `retry: 1`, `refetchOnWindowFocus: false` (mobile-first).
- **A4 State**: local UI via `useState`. Server state always React Query — never mirror into `useState`. Cross-component client state: prefer URL / `searchParams` over context.
- **A5 LOC budgets**: route ≤200, regular component ≤150, hook ≤120, api hook file ≤80.
- **A6 TypeScript**: `strict`, `strictNullChecks`, `noImplicitAny`, `noUncheckedIndexedAccess`. Zod at API boundaries, types inferred. No `any` (`unknown` + narrow, or `@ts-expect-error <reason>`).
- **A7 Loading + error UX**: skeletons (`@/shared/components/skeletons`), not spinners. Every feature route wrapped in `<FeatureErrorBoundary feature="x" />`. Empty states first-class.
- **A8 Testing**: vitest + testing-library + msw. One happy-path test per feature minimum.
- **A9 Performance**: lazy-load every feature route in `app/router.tsx`. `React.memo` only after profiling.
- **A10 Feature done**: folder moved, all Supabase in `api/`, all reads/writes through RQ, LOC budgets met, skeleton + boundary present, legacy files deleted (no shims), routes registered, ≥1 test green, `preflight` green, `index.ts` barrel minimal.

### Migration status

Phase 0 complete. Phase 1 migrates one feature at a time (see `docs/tasks.md`). Legacy paths (`src/pages/**`, `src/components/**`, `src/hooks/**`, `src/utils/**`, `src/shared/lib/**`, `src/app/layout.tsx`) are temporarily exempt from the Supabase-direct-import ban via `eslint.config.js` overrides. Each feature migration deletes its legacy files; the exemption disappears file-by-file.

## Notable files

- `src/app/providers.tsx` — sole `QueryClient` owner.
- `src/app/router.tsx` — sole route tree.
- `src/app/root.tsx` — root shell (boundary + providers + splash + router).
- `src/shared/api/index.ts` — barrel: `supabase`, `createQueryKeys`, `mapSupabaseError`.
- `eslint.config.js` — `no-restricted-imports` enforcement + legacy override.
- `vitest.config.ts` + `src/test/setup.ts` — test harness.

## Conventions

- Brazilian Portuguese in user-facing strings (the product audience is BR).
- All code/comments/commits/PRs in English (see global rules).
- Currency formatting via `formatCurrency` in `@/shared/lib/utils`.
- Dates via `@/shared/lib/date-utils` (Brazil-timezone safe).
