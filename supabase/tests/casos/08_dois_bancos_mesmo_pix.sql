-- Asked by the owner before deploying PR 1: two LEGITIMATE entries in DIFFERENT banks with the same
-- amount, day and description are two sales, not one sale and its copy. A copy only exists when
-- the SAME bank was connected more than once.
begin;
-- A) the recurrence rule: the same customer really pays 3 times in a day, 2 in one bank, 1 in another
select t.vendedor('Vendedora Dois Bancos') as a \gset
select t.conexao(:'a', 'Nubank', t.hora(10, '09:00')) as an \gset
select t.conexao(:'a', 'C6 Bank', t.hora(10, '09:30')) as ac \gset
select t.foco(:'a', 2, '08:00', '17:00', 60);
select t.pix(:'an', t.hora(2, '09:00'), 12, 'MARCOS FIEL DUARTE');
select t.pix(:'an', t.hora(2, '11:00'), 12, 'MARCOS FIEL DUARTE');
select t.pix(:'ac', t.hora(2, '15:00'), 12, 'MARCOS FIEL DUARTE');
select t.pix(:'an', t.hora(2, '10:00'), 24, 'NADIA OUTRA CLIENTE');

-- B) Dia de Vendas: one customer pays R$ 12 into each bank, same day, same description
select t.vendedor('Vendedor Duas Contas') as b \gset
select t.conexao(:'b', 'Nubank', t.hora(10, '09:00')) as bn \gset
select t.conexao(:'b', 'C6 Bank', t.hora(10, '09:30')) as bc \gset
select t.foco(:'b', 2, '08:00', '17:00', 48);
select t.pix(:'bn', t.hora(2, '09:00'), 12, 'OLGA PAGA DUAS');
select t.pix(:'bc', t.hora(2, '09:40'), 12, 'OLGA PAGA DUAS');
select t.pix(:'bn', t.hora(2, '12:00'), 24, 'PLINIO UMA VEZ');
commit;

select t.igual('A) 3 Pix reais em 2 bancos valem 3 para a regra (não viram "1 Pix e suas cópias")',
               (select count(*) from public.banco_entradas_classificadas(:'a', t.dia(2), t.dia(2)) where motivo = 'recorrente')::numeric, 3);
select t.igual('A) o dia dela fica igual ao de produção hoje: só a outra cliente conta (R$ 24)', t.caiu(:'a', 2), 24);
select t.igual('B) nenhuma das duas entradas é excluída pela regra do recorrente',
               (select count(*) from public.banco_entradas_classificadas(:'b', t.dia(2), t.dia(2)) where motivo is null)::numeric, 3);
select t.pendente('F-20', 'Dia de Vendas soma os dois Pix de bancos diferentes (12 + 12 + 24)', t.caiu(:'b', 2), 48);
