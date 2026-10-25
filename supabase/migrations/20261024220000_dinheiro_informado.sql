-- Fim do dia com banco ligado (Rick, 24/10/2026): o dinheiro que o vendedor INFORMA no
-- fechamento não era lembrado — ao voltar pra tela o campo abria vazio e o "falta cair"
-- voltava alto. Guarda aqui o último valor informado (null = ainda não informou).
-- Coluna nova, nada é apagado.
set local lock_timeout = '5s';
alter table public.daily_sales add column if not exists dinheiro_informado numeric;
