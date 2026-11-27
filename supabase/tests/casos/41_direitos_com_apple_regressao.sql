-- 27/11/2026: REGRESSION. The same photograph as casos/40, taken AFTER the Apple migration
-- (20261127120000_direitos_multi_provedor_apple) with no Apple data at all: for the accounts that
-- exist today (Hotmart, courtesy, free test) every answer must be the same as in production.
\ir direitos/preparo.sql
\ir ../../migrations/20261127120000_direitos_multi_provedor_apple.sql
\ir direitos/caracterizacao.sql
select t.verdade('R1 the Apple mirror stayed empty: none of these accounts got an Apple record',
  not exists (select 1 from public.apple_assinaturas) and not exists (select 1 from public.apple_acesso)
  and not exists (select 1 from public.bancos_extra_compras where chave like 'apple:%'));
