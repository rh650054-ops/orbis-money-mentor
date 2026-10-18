-- BUG-007 (Mohamed, 18/10/2026): depois de ajustar um dia à mão, o Pix que já
-- tinha caído (ou que cai em seguida) só entrava no relatório/Vender na PRÓXIMA
-- leitura do robô — horas depois. Esta função deixa o próprio usuário reconferir
-- os dias passados AGORA, com o que o banco já mandou (não pede dados novos à
-- Pluggy, não gasta cota). Mesmas regras do banco_reconciliar: só dias passados
-- (hoje continua sendo conferido à meia-noite — regra do Rick 10/10), só Foco
-- encerrado, só de 11/10 em diante.
create or replace function public.banco_reconciliar_me()
returns integer
language sql
security definer
set search_path to 'public'
as $$
  select case when auth.uid() is null then 0 else public.banco_reconciliar(auth.uid()) end;
$$;

revoke all on function public.banco_reconciliar_me() from public, anon;
grant execute on function public.banco_reconciliar_me() to authenticated;
