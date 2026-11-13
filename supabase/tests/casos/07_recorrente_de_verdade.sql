-- PR 1 (F-01) guard rails: the fix only stops COPIES from counting. A customer who really pays
-- many times is still "recorrente", with one connection or with three; identical legitimate
-- entries are still kept apart; two live connections of the same bank count each Pix once.
begin;
-- A) one bank, one connection: the same person really pays 3 times in a day
select t.vendedor('Vendedor Recorrente') as a \gset
select t.conexao(:'a', 'Nubank', t.hora(10, '09:00')) as ca \gset
select t.foco(:'a', 2, '08:00', '17:00', 60);
select t.pix(:'ca', t.hora(2, '09:00'), 12, 'MARIA PARENTE SILVA');
select t.pix(:'ca', t.hora(2, '11:00'), 12, 'MARIA PARENTE SILVA');
select t.pix(:'ca', t.hora(2, '15:00'), 12, 'MARIA PARENTE SILVA');
select t.pix(:'ca', t.hora(2, '10:00'), 12, 'JOAO CLIENTE REAL');
select t.pix(:'ca', t.hora(2, '10:00'), 12, 'JOAO CLIENTE REAL');     -- same customer, same minute, same amount: 2 real Pix

-- B) the same real recurrence seen through 3 connections of the same bank (2 deleted)
select t.vendedor('Vendedor Reconectou') as b \gset
select t.conexao(:'b', 'Cora', t.hora(4, '12:00'), 'deleted') as b1 \gset
select t.conexao(:'b', 'Cora', t.hora(3, '12:00'), 'deleted') as b2 \gset
select t.conexao(:'b', 'Cora', t.hora(1, '09:00'), 'UPDATED') as b3 \gset
select t.foco(:'b', 2, '08:00', '17:00', 60);
select t.pix(c, t.hora(2, '09:00'), 12, 'MARIA PARENTE SILVA') from unnest(array[:'b1', :'b2', :'b3']::uuid[]) c;
select t.pix(c, t.hora(2, '11:00'), 12, 'MARIA PARENTE SILVA') from unnest(array[:'b1', :'b2', :'b3']::uuid[]) c;
select t.pix(c, t.hora(2, '15:00'), 12, 'MARIA PARENTE SILVA') from unnest(array[:'b1', :'b2', :'b3']::uuid[]) c;
select t.pix(c, t.hora(2, '10:00'), 12, 'JOAO CLIENTE REAL')   from unnest(array[:'b1', :'b2', :'b3']::uuid[]) c;
select t.pix(c, t.hora(2, '10:00'), 12, 'JOAO CLIENTE REAL')   from unnest(array[:'b1', :'b2', :'b3']::uuid[]) c;

-- C) the same person pays once a day on 5 different days (5 in 30 days), one connection
select t.vendedor('Vendedor Cinco Dias') as c \gset
select t.conexao(:'c', 'Nubank', t.hora(20, '09:00')) as cc \gset
select t.foco(:'c', 2, '08:00', '17:00', 24);
select t.pix(:'cc', t.hora(n, '09:00'), 12, 'PEDRO TODO DIA') from generate_series(2, 6) n;
select t.pix(:'cc', t.hora(2, '12:00'), 12, 'LUCIA PASSANTE ROCHA');

-- D) two LIVE connections of the same bank (nobody deleted the old one): each Pix exists twice
select t.vendedor('Vendedor Duas Vivas') as d \gset
select t.conexao(:'d', 'Cora', t.hora(9, '09:00'), 'UPDATED') as d1 \gset
select t.conexao(:'d', 'Cora', t.hora(5, '09:00'), 'UPDATED') as d2 \gset
select t.foco(:'d', 2, '08:00', '17:00', 48);
select t.pix(c, t.hora(2, '09:00'), 12, 'RITA UMA VEZ') from unnest(array[:'d1', :'d2']::uuid[]) c;
select t.pix(c, t.hora(2, '10:00'), 12, 'RITA UMA VEZ') from unnest(array[:'d1', :'d2']::uuid[]) c;
select t.pix(c, t.hora(2, '11:00'), 24, 'SAULO UMA VEZ') from unnest(array[:'d1', :'d2']::uuid[]) c;
commit;

select t.igual('A) quem paga 3 vezes no dia continua recorrente: só os 2 Pix do outro cliente contam', t.caiu(:'a', 2), 24);
select t.igual('A) os 3 Pix dela são marcados como recorrente',
               (select count(*) from public.banco_entradas_classificadas(:'a', t.dia(2), t.dia(2)) where motivo = 'recorrente')::numeric, 3);
select t.igual('B) com 3 conexões o resultado é o MESMO do vendedor de 1 conexão', t.caiu(:'b', 2), 24);
select t.igual('B) a recorrente de verdade continua excluída na conexão viva',
               (select count(*) from public.banco_entradas_classificadas(:'b', t.dia(2), t.dia(2)) c
                 where c.motivo = 'recorrente' and c.bank_connection_id = :'b3')::numeric, 3);
select t.igual('B) o cliente de 2 Pix reais não vira recorrente por causa das 6 linhas',
               (select count(*) from public.banco_entradas_classificadas(:'b', t.dia(2), t.dia(2)) c
                 where c.motivo is null and c.bank_connection_id = :'b3')::numeric, 2);
select t.igual('C) 5 Pix em 5 dias continua recorrente: só a passante conta', t.caiu(:'c', 2), 12);
select t.igual('D) duas conexões vivas: cada Pix conta uma vez (12 + 12 + 24)', t.caiu(:'d', 2), 48);
select t.igual('D) 2 Pix reais vistos 2 vezes não tornam a cliente recorrente',
               (select count(*) from public.banco_entradas_classificadas(:'d', t.dia(2), t.dia(2)) where motivo = 'recorrente')::numeric, 0);
select public.banco_reconciliar(:'b');
select t.igual('B) reconciliação: Pix do dia = R$ 24, calote = 60 − 24', (select total_debt from public.daily_sales where user_id = :'b'), 36);
select t.igual('B) ranking do dia = R$ 24', (select valor from public.ranking_valor_dias(t.dia(2), t.dia(2), :'b')), 24);
