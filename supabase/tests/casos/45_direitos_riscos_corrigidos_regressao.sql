-- 27/11/2026: REGRESSION after the three draft migrations, with no Apple data at all.
--   1. the photograph of casos/40 gives the same answers, except the two it marks FIXED (P7, B3);
--   2. the risk scenarios of casos/44 give the FIXED answers, and every "both before and after"
--      line is unchanged.
\ir direitos/preparo.sql
\ir ../schema/extra/direitos_producao_20261127_b.sql
\ir ../schema/extra/direitos_producao_20261127_c.sql
\ir direitos/migracoes.sql
select pg_temp.servidor();
\set corrigido true
\ir direitos/caracterizacao.sql
\ir direitos/riscos.sql
select t.verdade('R1 none of these accounts got an Apple record, a suspension it did not ask for, or a row in the Apple ledger',
  not exists (select 1 from public.apple_assinaturas) and not exists (select 1 from public.apple_acesso)
  and not exists (select 1 from public.apple_transacoes) and not exists (select 1 from public.apple_contas_de_teste)
  and (select count(*) = 0 from public.acesso_suspenso where liberado_em is null));
