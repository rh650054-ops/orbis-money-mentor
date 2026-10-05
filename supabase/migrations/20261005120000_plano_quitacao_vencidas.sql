-- ============================================================
-- 05/10/2026 — aba Planejar redesenhada: "Montar plano" das contas vencidas.
-- "Em quanto tempo quer quitar? 3 / 5 / 10 / 15 dias" → "Usar este plano".
-- O plano fica salvo na conta e a vencida passa a entrar no "Guardar hoje",
-- dividida pelos dias de trabalho até plano_quitacao_ate. Antes a escolha
-- vivia só na tela e sumia ao fechar o app.
-- ============================================================
alter table public.planned_bills
  add column if not exists plano_quitacao_dias int check (plano_quitacao_dias is null or plano_quitacao_dias between 1 and 60),
  add column if not exists plano_quitacao_ate date;
