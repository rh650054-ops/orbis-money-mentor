-- 27/11/2026: the read-only comparison Rick asked for before any migration in production
-- (supabase/direitos-apple/comparar-antes-depois.sql) is itself tested here:
--   1. on production's functions it predicts, for a zoo of fictional accounts in every state the
--      photographs build (paid, overdue, cancelled, courtesy, free test, Pro, annual, extra bank...),
--      what each account's rights will be after the migrations;
--   2. the three real migrations are applied;
--   3. every prediction is compared, account by account and field by field, with what the real
--      migrated functions answer. One wrong prediction fails the case.
-- So when the same file says "1 account changes" in production, that count can be trusted.
\ir direitos/preparo.sql
\ir ../schema/extra/direitos_producao_20261127_b.sql
\ir ../schema/extra/direitos_producao_20261127_c.sql
select pg_temp.servidor();
\o /dev/null
\ir direitos/caracterizacao.sql
\ir direitos/riscos.sql
\o
-- (test only) the photographs' own assertions belong to casos/40 and casos/44, not to this case
delete from t.resultados;
select pg_temp.servidor();
select public.pro_conceder(pg_temp.id('k_essencial'), 'cortesia', null, null, null) \gset x_

-- 1. the prediction, on production's functions (the file opens its own READ ONLY transaction)
\set vant_com_detalhe true
\set vant_guardar 1
\ir ../../direitos-apple/comparar-antes-depois.sql
select pg_temp.servidor();
create temp table previsao as
  select * from jsonb_to_recordset(:'vant_comparacao'::jsonb -> 'detalhe') as x (user_id uuid, plan_status text,
    antes_plano text, depois_plano text, antes_pro boolean, depois_pro boolean, antes_anual boolean, depois_anual boolean,
    antes_banco_liberado boolean, depois_banco_liberado boolean, antes_recursos_pro boolean, depois_recursos_pro boolean,
    antes_mentor integer, depois_mentor integer, antes_bancos integer, depois_bancos integer);
select t.verdade('C1 the comparison covers every account',
  (select count(*) from previsao) = (select count(*) from public.profiles) and (select count(*) from previsao) > 35);
select t.verdade('C2 "antes" is what the installed functions answer (plan name, Pro, annual, bank features, Pro resources, Mentor limit)',
  not exists (select 1 from previsao v where v.antes_plano is distinct from public.vant_plano(v.user_id)
     or v.antes_pro is distinct from public.vant_pro_pleno(v.user_id) or v.antes_anual is distinct from public.pro_anual(v.user_id)
     or v.antes_banco_liberado is distinct from public.orbis_pro_ativo(v.user_id) or v.antes_recursos_pro is distinct from public.vant_recursos_pro(v.user_id)
     or v.antes_mentor is distinct from public.mentor_limite_dia(v.user_id)));
select t.verdade('C3 the banks each account can connect ("antes") come from production''s own limit function',
  not exists (select 1 from previsao v where v.antes_bancos is distinct from (public.open_finance_limite(v.user_id) ->> 'limite')::int)
  and exists (select 1 from previsao v where v.antes_bancos = 2) and exists (select 1 from previsao v where v.antes_bancos = 0));
select t.verdade('C4 the zoo has every plan name on both sides of the comparison',
  (select count(distinct antes_plano) from previsao) = 7 and (select count(distinct depois_plano) from previsao) = 7);
select t.verdade('C5 the only accounts predicted to change are the ones with a paid extra bank and no valid main plan',
  (select count(*) > 0 and bool_and(v.antes_plano = 'essencial_banco' and v.depois_plano = 'sem_plano' and v.antes_banco_liberado and not v.depois_banco_liberado
          and v.plan_status is distinct from 'active' and not v.depois_pro)
     from previsao v
    where (antes_plano, antes_pro, antes_anual, antes_banco_liberado, antes_recursos_pro, antes_mentor, antes_bancos)
       is distinct from (depois_plano, depois_pro, depois_anual, depois_banco_liberado, depois_recursos_pro, depois_mentor, depois_bancos)));

-- 2. the real migrations
\ir direitos/migracoes.sql
select pg_temp.servidor();

-- 3. every prediction against the real thing
select t.verdade('C6 PLAN NAME: every account''s predicted "depois" equals the migrated vant_plano',
  not exists (select 1 from previsao v where v.depois_plano is distinct from public.vant_plano(v.user_id)));
select t.verdade('C7 PRO and ANNUAL PRO: every prediction equals the migrated functions',
  not exists (select 1 from previsao v where v.depois_pro is distinct from public.vant_pro_pleno(v.user_id) or v.depois_anual is distinct from public.pro_anual(v.user_id)));
select t.verdade('C8 BANK FEATURES and PRO RESOURCES: every prediction equals the migrated functions',
  not exists (select 1 from previsao v where v.depois_banco_liberado is distinct from public.orbis_pro_ativo(v.user_id)
     or v.depois_recursos_pro is distinct from public.vant_recursos_pro(v.user_id)));
select t.verdade('C9 MENTOR LIMIT and BANKS TO CONNECT: every prediction equals the migrated functions',
  not exists (select 1 from previsao v where v.depois_mentor is distinct from public.mentor_limite_dia(v.user_id)
     or v.depois_bancos is distinct from (public.open_finance_limite(v.user_id) ->> 'limite')::int));
select t.verdade('C10 the plan itself (profiles.plan_status) of every account is exactly what it was: the migrations write no account''s plan',
  not exists (select 1 from previsao v join public.profiles p on p.user_id = v.user_id where p.plan_status is distinct from v.plan_status));
select t.verdade('C11 the courtesy Pros were marked as courtesies and kept the access they had',
  (select count(*) > 0 and bool_and(o.cortesia and public.vant_pro_pleno(o.user_id)) from public.orbis_pro o where o.origem = 'cortesia' and o.ativo and o.cancelado_em is null));
-- the summary Rick will read runs too, now on the migrated database: nothing left to change
\set vant_com_detalhe false
\ir ../../direitos-apple/comparar-antes-depois.sql
select t.verdade('C12 after the migrations the same comparison finds no difference left, and it kept the totals it reported before (same accounts, same Hotmart subscribers)',
  (:'vant_comparacao'::jsonb ->> 'contas_com_alguma_diferenca')::int = 0
  and (:'vant_comparacao'::jsonb ->> 'contas')::int = (select count(*) from previsao)
  and :'vant_comparacao'::jsonb -> 'detalhe' = 'null'::jsonb
  and (:'vant_comparacao'::jsonb ->> 'assinantes_hotmart')::int = (select count(*) from public.subscriptions where status in ('active', 'past_due')));
select t.verdade('C13 the comparison is a read-only transaction that leaves nothing behind (no table, no prepared statement, no open transaction)',
  not exists (select 1 from pg_prepared_statements) and to_regclass('pg_temp.vant_previsao') is null
  and (select count(*) = 0 from pg_stat_activity where pid = pg_backend_pid() and xact_start is not null and state = 'idle in transaction'));
