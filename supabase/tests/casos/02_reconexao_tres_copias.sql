-- F-01 (audit 10/11/2026): the same bank connected three times. Each reconnection is a new Pluggy
-- item, so the same Pix is stored once per connection with a different id. Fictional data that
-- reproduces the Cora case: day 3 = the Saturday, connections created on days 3, 2 and 1.
begin;
select t.vendedor('Vendedor A') as a \gset
select t.conexao(:'a', 'Cora', t.hora(3, '12:55'), 'deleted') as c1 \gset
select t.conexao(:'a', 'Cora', t.hora(2, '10:03'), 'deleted') as c2 \gset
select t.conexao(:'a', 'Cora', t.hora(1, '08:59'), 'UPDATED') as c3 \gset
select t.foco(:'a', 3, '06:43', '18:05', 60);
select t.pix(c, t.hora(3, '06:41'), 12, 'CLIENTE UM SILVA')   from unnest(array[:'c1', :'c2', :'c3']::uuid[]) c;
select t.pix(c, t.hora(3, '08:15'), 24, 'CLIENTE DOIS SOUZA') from unnest(array[:'c1', :'c2', :'c3']::uuid[]) c;
select t.pix(c, t.hora(3, '14:20'), 24, 'CLIENTE TRES LIMA')  from unnest(array[:'c2', :'c3']::uuid[]) c;

-- another vendor, same day, one bank, no copies: must be untouched by any fix
select t.vendedor('Vendedora B') as b \gset
select t.conexao(:'b', 'Nubank', t.hora(10, '09:00')) as cb \gset
select t.foco(:'b', 3, '08:00', '16:00', 36);
select t.pix(:'cb', t.hora(3, '09:00'), 12, 'PAULA REGO NEVES');
select t.pix(:'cb', t.hora(3, '10:00'), 12, 'RAUL TELES BRITO');
select t.pix(:'cb', t.hora(3, '11:00'), 12, 'SARA VIDAL PINTO');
commit;

select t.igual('são 8 linhas guardadas para 3 Pix reais (nada é apagado)',
               (select count(*) from public.auto_detected_sales where user_id = :'a')::numeric, 8);
select t.verdade('o Pix importado por 3 conexões não é contado 3 vezes (dia ≤ R$ 60)', t.caiu(:'a', 3) <= 60);
select t.igual('F-01: vendas legítimas do vendedor com 3 conexões contam inteiras', t.caiu(:'a', 3), 60);
select t.igual('F-01: nenhum cliente dele é excluído como recorrente',
               (select count(*) from public.banco_entradas_classificadas(:'a', t.dia(3), t.dia(3)) where motivo = 'recorrente')::numeric, 0);
select t.igual('as cópias das conexões apagadas continuam fora (conta_pessoal), sem somar',
               (select count(*) from public.banco_entradas_classificadas(:'a', t.dia(3), t.dia(3)) where motivo = 'conta_pessoal')::numeric, 5);
select public.banco_reconciliar(:'a');
select t.igual('F-01: o dia dele não vira calote', (select total_debt from public.daily_sales where user_id = :'a'), 0);
select t.igual('F-01: ranking do dia dele = R$ 60',
               (select valor from public.ranking_valor_dias(t.dia(3), t.dia(3), :'a')), 60);
select t.igual('a outra vendedora, sem cópias, continua com R$ 36', t.caiu(:'b', 3), 36);
select public.banco_reconciliar(:'b');
select t.igual('a outra vendedora continua sem calote', (select total_debt from public.daily_sales where user_id = :'b'), 0);
