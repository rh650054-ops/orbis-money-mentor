-- Asked by the owner before deploying PR 1: the pairing of copies must tell different ACCOUNTS
-- apart, also inside the same bank. Same account = same bank + same holder + same accounts.
begin;
-- A) same bank, two holders (her own account and the shop's): 3 real Pix of one customer
select t.vendedor('Vendedora PF e PJ') as a \gset
select t.conexao(:'a', 'Nubank', t.hora(10, '09:00')) as a1 \gset
select t.conexao(:'a', 'Nubank', t.hora(9, '09:00')) as a2 \gset
select t.titular(:'a1', 'Fulana de Tal', 'Conta');
select t.titular(:'a2', 'Fulana Doces LTDA', 'Conta');
select t.foco(:'a', 2, '08:00', '17:00', 60);
select t.pix(:'a1', t.hora(2, '09:00'), 12, 'QUEILA FIEL MOURA');
select t.pix(:'a1', t.hora(2, '11:00'), 12, 'QUEILA FIEL MOURA');
select t.pix(:'a2', t.hora(2, '15:00'), 12, 'QUEILA FIEL MOURA');

-- B) same bank, same holder, two different accounts
select t.vendedor('Vendedor Duas Contas Mesmo Banco') as b \gset
select t.conexao(:'b', 'Inter', t.hora(10, '09:00')) as b1 \gset
select t.conexao(:'b', 'Inter', t.hora(9, '09:00')) as b2 \gset
select t.titular(:'b1', 'Beltrano Souza', 'Conta Corrente');
select t.titular(:'b2', 'Beltrano Souza', 'Conta Digital PJ');
select t.foco(:'b', 2, '08:00', '17:00', 60);
select t.pix(:'b1', t.hora(2, '09:00'), 12, 'RAUL FIEL TORRES');
select t.pix(:'b1', t.hora(2, '11:00'), 12, 'RAUL FIEL TORRES');
select t.pix(:'b2', t.hora(2, '15:00'), 12, 'RAUL FIEL TORRES');

-- C) the SAME account connected again (same bank, holder and accounts): these are copies
select t.vendedor('Vendedor Mesma Conta') as c \gset
select t.conexao(:'c', 'Cora', t.hora(6, '09:00'), 'deleted') as c1 \gset
select t.conexao(:'c', 'Cora', t.hora(4, '09:00'), 'deleted') as c2 \gset
select t.conexao(:'c', 'Cora', t.hora(1, '09:00')) as c3 \gset
select t.titular(k, 'Ciclano Lima', 'Conta PJ') from unnest(array[:'c1', :'c2']::uuid[]) k;
select t.titular(:'c3', 'Ciclano Lima');          -- reconnected a minute ago: accounts not listed yet
select t.foco(:'c', 2, '08:00', '17:00', 24);
select t.pix(k, t.hora(2, '09:00'), 12, 'SONIA UMA VEZ') from unnest(array[:'c1', :'c2', :'c3']::uuid[]) k;
select t.pix(k, t.hora(2, '10:00'), 12, 'TALES UMA VEZ') from unnest(array[:'c1', :'c2', :'c3']::uuid[]) k;
commit;

select t.igual('A) mesmo banco, titulares diferentes: 3 Pix reais valem 3 para a regra',
               (select count(*) from public.banco_entradas_classificadas(:'a', t.dia(2), t.dia(2)) where motivo = 'recorrente')::numeric, 3);
select t.igual('B) mesmo banco e titular, contas diferentes: 3 Pix reais valem 3 para a regra',
               (select count(*) from public.banco_entradas_classificadas(:'b', t.dia(2), t.dia(2)) where motivo = 'recorrente')::numeric, 3);
select t.igual('C) a mesma conta reconectada 3 vezes: são cópias, ninguém vira recorrente',
               (select count(*) from public.banco_entradas_classificadas(:'c', t.dia(2), t.dia(2)) where motivo = 'recorrente')::numeric, 0);
select t.igual('C) e o dia dele conta os 2 Pix reais uma vez (R$ 24), mesmo com a conexão nova ainda sem lista de contas', t.caiu(:'c', 2), 24);
