-- 26/11/2026 (App Review 5.1.2(i)): AI consent counts only for the disclosure the vendor saw.
-- "valid" below = what the edge functions require: permitido = true AND versao = '2026-11-26'.
create or replace function pg_temp.valido(p uuid) returns boolean language sql as $$
  select coalesce((select permitido and versao = '2026-11-26' from public.consentimento_ia where user_id = p), false) $$;
create temp table f (k text primary key, id uuid);
create or replace function pg_temp.id(p text) returns uuid language sql as $$ select id from f where k = p $$;
insert into f values ('a', '00000000-0000-4000-8000-0000000000a1'), ('b', '00000000-0000-4000-8000-0000000000b2'), ('c', '00000000-0000-4000-8000-0000000000c3');
insert into f select k, t.vendedor(k) from unnest(array['novo','antigo','outro']) k;
grant select on f to authenticated;
-- a statement sent by the app of this person (RLS applies)
create or replace function pg_temp.app(p text, p_sql text) returns text language sql as $$ select t.erro(p_sql, 'authenticated', pg_temp.id(p)) $$;

select t.verdade('A1 answers that existed: 23/11 text → not valid; proven on the 26/11 screen → valid; new Terms but older AI answer → not valid',
  not pg_temp.valido(pg_temp.id('a')) and pg_temp.valido(pg_temp.id('b')) and not pg_temp.valido(pg_temp.id('c'))
  and (select count(*) from public.consentimento_ia_historico where origem = 'antes_da_versao') = 3);
select t.verdade('A2 never answered: no AI', not pg_temp.valido(pg_temp.id('novo')));

-- an OLDER app (still installed) writes straight to the table
select pg_temp.app('antigo', format($$insert into public.consentimento_ia (user_id, permitido) values (%L, true)$$, pg_temp.id('antigo'))) as o1 \gset
select t.verdade('A3 older app allows AI: no error (nobody stuck on the Terms screen) and NO AI (no version)',
  :'o1' = 'ok' and not pg_temp.valido(pg_temp.id('antigo')) and (select versao is null and permitido from public.consentimento_ia where user_id = pg_temp.id('antigo')));
select pg_temp.app('antigo', format($$update public.consentimento_ia set permitido = true, versao = '2026-11-26' where user_id = %L$$, pg_temp.id('antigo'))) as o2 \gset
select t.verdade('A4 a client cannot write the version itself', :'o2' = 'ok' and not pg_temp.valido(pg_temp.id('antigo')));

-- the CURRENT app answers through the RPC
select pg_temp.app('novo', $$select public.responder_consentimento_ia(true, '2026-11-26')$$) as n1 \gset
select t.verdade('A5 current app allows on the 26/11 text: AI released', :'n1' = 'ok' and pg_temp.valido(pg_temp.id('novo')));
select pg_temp.app('novo', format($$update public.consentimento_ia set permitido = true where user_id = %L$$, pg_temp.id('novo'))) as n2 \gset
select t.verdade('A6 repeating a permission that already stands from an older app changes nothing', :'n2' = 'ok' and pg_temp.valido(pg_temp.id('novo')));
select pg_temp.app('novo', format($$update public.consentimento_ia set permitido = false where user_id = %L$$, pg_temp.id('novo'))) as n3 \gset
select t.verdade('A7 turning AI off from an older app works', :'n3' = 'ok' and not pg_temp.valido(pg_temp.id('novo')));
select pg_temp.app('novo', format($$update public.consentimento_ia set permitido = true where user_id = %L$$, pg_temp.id('novo'))) as n4 \gset
select t.verdade('A8 after turning off, an older app cannot turn AI on again', :'n4' = 'ok' and not pg_temp.valido(pg_temp.id('novo')));
select pg_temp.app('novo', $$select public.responder_consentimento_ia(true, '2026-11-26')$$) \gset r_
select pg_temp.app('novo', $$select public.responder_consentimento_ia(false, '2026-11-26')$$) as n5 \gset
select t.verdade('A9 revoking in the current app: no AI', :'n5' = 'ok' and not pg_temp.valido(pg_temp.id('novo')));
select t.verdade('A10 allowing on an older text through the RPC: recorded, not valid',
  pg_temp.app('a', $$select public.responder_consentimento_ia(true, '2026-11-23')$$) = 'ok' and not pg_temp.valido(pg_temp.id('a')));

select t.verdade('A11 RPC refuses: no version, malformed version, no answer, no login',
  pg_temp.app('novo', $$select public.responder_consentimento_ia(true, null)$$) like '22023|%'
  and pg_temp.app('novo', $$select public.responder_consentimento_ia(true, 'ontem')$$) like '22023|%'
  and pg_temp.app('novo', $$select public.responder_consentimento_ia(null, '2026-11-26')$$) like '22023|%'
  and t.erro($$select public.responder_consentimento_ia(true, '2026-11-26')$$, 'anon') like '42501|%');

select t.verdade('A12 one person never reads or changes another person''s answer',
  t.linhas_como('authenticated', pg_temp.id('outro'), 'select 1 from public.consentimento_ia') = 0
  and pg_temp.app('outro', format($$insert into public.consentimento_ia (user_id, permitido) values (%L, false)$$, pg_temp.id('b'))) like '42501|%'
  and pg_temp.app('outro', format($$update public.consentimento_ia set permitido = false where user_id = %L$$, pg_temp.id('b'))) = 'ok'
  and pg_temp.valido(pg_temp.id('b')));

select t.verdade('A13 history keeps every answer of the person, in order, with where it came from',
  (select string_agg(origem || ':' || permitido || ':' || coalesce(versao, '-'), ' > ' order by id) from public.consentimento_ia_historico where user_id = pg_temp.id('novo'))
  = 'app:true:2026-11-26 > direto:true:2026-11-26 > direto:false:2026-11-26 > direto:true:- > app:true:2026-11-26 > app:false:2026-11-26');
select t.verdade('A14 the history is read-only for its owner and invisible to others',
  t.linhas_como('authenticated', pg_temp.id('novo'), 'select 1 from public.consentimento_ia_historico') = 6
  and t.linhas_como('authenticated', pg_temp.id('outro'), 'select 1 from public.consentimento_ia_historico') = 0
  and pg_temp.app('novo', $$delete from public.consentimento_ia_historico$$) like '42501|%'
  and pg_temp.app('novo', format($$insert into public.consentimento_ia_historico (user_id, permitido, origem) values (%L, true, 'app')$$, pg_temp.id('novo'))) like '42501|%');

delete from auth.users where id = pg_temp.id('novo');
select t.verdade('A15 deleting the account deletes the answer and its history',
  not exists (select 1 from public.consentimento_ia where user_id = pg_temp.id('novo'))
  and not exists (select 1 from public.consentimento_ia_historico where user_id = pg_temp.id('novo')));
