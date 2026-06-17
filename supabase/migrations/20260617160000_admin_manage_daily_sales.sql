-- Modo admin: permite a admins corrigir (editar/excluir) as vendas diárias
-- de qualquer usuário — usado para anti-trapaça do ranking e correção de
-- lançamentos errados no DEFCON (o ranking é recalculado a partir do daily_sales).

drop policy if exists "Admins manage daily_sales" on public.daily_sales;
create policy "Admins manage daily_sales"
  on public.daily_sales for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));
