-- HOTFIX F-17 (audit 10/11/2026) — the closing table is no longer readable by vendors.
--
-- Before: policy premio_fechamento_ler (to authenticated, using true) + select grants let ANY
-- logged-in vendor read every row, including `pendencias`: other vendors' names, user ids, bank
-- names and the amount of their Pix under review.
--
-- After: no direct read. The app never read the table: it calls premio_resultado() (security
-- definer), which returns status, winner and only the NUMBER of pending items. Server functions
-- (premio_*, ranking_congelado_ate, ranking_cache_atualizar) run as the owner and are unaffected.
--
-- Rollback:
--   create policy premio_fechamento_ler on public.premio_fechamento for select to authenticated using (true);
--   grant select on public.premio_fechamento to anon, authenticated;

drop policy if exists premio_fechamento_ler on public.premio_fechamento;
revoke select on public.premio_fechamento from anon, authenticated;
