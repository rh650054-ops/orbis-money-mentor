-- Libera o vendedor a EXCLUIR o proprio extrato (faltava a policy de delete).
-- Sem isso, o RLS bloqueia o delete silenciosamente (0 linhas, sem erro).
drop policy if exists "extrato_delete_own" on public.extrato_uploads;
create policy "extrato_delete_own" on public.extrato_uploads
  for delete using (auth.uid() = user_id);
