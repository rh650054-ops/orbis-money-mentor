-- "Ajustar estoque" of an ingredient (25/11/2026): a physical count with a reason and history.
create temp table f (k text primary key, id uuid);
do $$
declare u uuid := t.vendedor('Ajuste Teste'); o uuid := t.vendedor('Outro'); v uuid;
begin
  insert into f values ('u', u), ('o', o);
  insert into public.ingredients (user_id, name, unit, stock_quantity, cost_per_unit) values (u, 'Garrafa', 'un', 20, 1.19) returning id into v; insert into f values ('gar', v);
  insert into public.ingredients (user_id, name, unit, stock_quantity, cost_per_unit) values (o, 'Garrafa', 'un', 50, 1) returning id into v; insert into f values ('gar_outro', v);
end $$;
create or replace function pg_temp.id(p text) returns uuid language sql as $$ select id from f where k = p $$;
create or replace function pg_temp.est(p text) returns numeric language sql as $$ select stock_quantity from public.ingredients where id = pg_temp.id(p) $$;
select t.logar(pg_temp.id('u'));

select t.erro(format('select public.ingrediente_ajustar_estoque(%L, 17, %L)', pg_temp.id('gar'), 'contei na geladeira')) as a1 \gset
select t.verdade('A1a a contagem foi aceita', :'a1' = 'ok');
select t.verdade('A1 contei 17 de 20: o estoque vira 17 e o ajuste fica no histórico',
  pg_temp.est('gar') = 17
  and (select count(*) from public.estoque_ajustes where ingredient_id = pg_temp.id('gar') and antes = 20 and depois = 17 and motivo = 'contei na geladeira') = 1);
select t.verdade('A2 mesmo número de novo (toque duplo): não muda nada nem duplica o histórico',
  t.erro(format('select public.ingrediente_ajustar_estoque(%L, 17, %L)', pg_temp.id('gar'), 'contei na geladeira')) = 'ok'
  and (select count(*) from public.estoque_ajustes where ingredient_id = pg_temp.id('gar')) = 1);
select t.verdade('A3 sem motivo: recusado, estoque igual', t.erro(format('select public.ingrediente_ajustar_estoque(%L, 10, %L)', pg_temp.id('gar'), ' ')) <> 'ok' and pg_temp.est('gar') = 17);
select t.verdade('A4 quantidade negativa: recusada', t.erro(format('select public.ingrediente_ajustar_estoque(%L, -1, %L)', pg_temp.id('gar'), 'quebrou')) <> 'ok' and pg_temp.est('gar') = 17);
select t.verdade('A5 ingrediente de outra pessoa: recusado, o dele não muda', t.erro(format('select public.ingrediente_ajustar_estoque(%L, 0, %L)', pg_temp.id('gar_outro'), 'teste')) <> 'ok' and pg_temp.est('gar_outro') = 50);
select t.verdade('A6 não é compra: nenhuma linha em compras_mercadoria', not exists (select 1 from public.compras_mercadoria where ingredient_id = pg_temp.id('gar')));
select t.verdade('A7 o histórico não aceita escrita direta do app (sem insert/update/delete para authenticated)',
  not has_table_privilege('authenticated', 'public.estoque_ajustes', 'INSERT') and not has_table_privilege('authenticated', 'public.estoque_ajustes', 'UPDATE')
  and not has_table_privilege('authenticated', 'public.estoque_ajustes', 'DELETE') and has_table_privilege('authenticated', 'public.estoque_ajustes', 'SELECT'));
select t.verdade('A8 zerar é permitido (contei 0)', t.erro(format('select public.ingrediente_ajustar_estoque(%L, 0, %L)', pg_temp.id('gar'), 'acabou tudo')) = 'ok' and pg_temp.est('gar') = 0);
