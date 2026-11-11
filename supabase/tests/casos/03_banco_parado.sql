-- F-02 (audit 10/11/2026): the bank stopped updating in the morning and the vendor kept selling.
-- The database trusts ONE fact to treat a day as checked by the bank: leitura_ok_em past that
-- day's midnight. The bug was in who wrote it (the edge functions stamped "now" after reading
-- Pluggy's stale copy). PR 2 makes them stamp Pluggy's last real sync with the bank
-- (unit tests: src/test/pluggy-cobertura.test.ts). This case pins the database side of the deal.
begin;
-- C) bank frozen yesterday 08:57. With PR 2 the stamp stays at 08:57, before the day closed.
select t.vendedor('Vendedor C') as c \gset
select t.conexao(:'c', 'Cora', t.hora(5, '09:00'), 'OUTDATED', t.hora(1, '08:57')) as cc \gset
select t.foco(:'c', 1, '06:46', '17:10', 48);
select t.pix(:'cc', t.hora(1, '08:50'), 12, 'CLIENTE QUATRO ROCHA');                -- last entry before the bank froze

-- D) control: a healthy bank, read after the day closed, and a real calote. Must still show.
select t.vendedor('Vendedora D') as d \gset
select t.conexao(:'d', 'Nubank', t.hora(5, '09:00'), 'UPDATED', now()) as cd \gset
select t.foco(:'d', 1, '06:46', '17:10', 48);
select t.pix(:'cd', t.hora(1, '08:50'), 12, 'CLIENTE CINCO PRADO');

-- E) what production did until PR 2: same frozen bank, but stamped "now" by a read of stale data
select t.vendedor('Vendedor E') as e \gset
select t.conexao(:'e', 'Cora', t.hora(5, '09:00'), 'OUTDATED', now()) as ce \gset
select t.foco(:'e', 1, '06:46', '17:10', 48);
select t.pix(:'ce', t.hora(1, '08:50'), 12, 'CLIENTE SEIS VIANA');
commit;

select public.banco_reconciliar(:'c');
select public.banco_reconciliar(:'d');
select public.banco_reconciliar(:'e');
select t.igual('F-02: banco parado antes do fim do dia não cria calote', (select total_debt from public.daily_sales where user_id = :'c'), 0);
select t.igual('F-02: o Pix lançado dele continua como estava (R$ 48)', (select pix_sales from public.daily_sales where user_id = :'c'), 48);
select t.igual('F-02: o dia não é marcado como conferido pelo banco',
               (select pelo_banco::int from public.ranking_valor_dias(t.dia(1), t.dia(1), :'c'))::numeric, 0);
select t.igual('F-02: ranking do dia fica com o lançado (R$ 48)',
               (select valor from public.ranking_valor_dias(t.dia(1), t.dia(1), :'c')), 48);
select public.ranking_cache_atualizar(45);
select t.verdade('F-02: e o prêmio enxerga a pendência "banco não lido" desse vendedor',
               exists (select 1 from jsonb_array_elements(public.premio_pendencias(t.dia(1), t.dia(1))) p
                        where p->>'user_id' = :'c' and p->>'motivo' like 'banco_nao_lido:%'));
select t.igual('controle: banco em dia e calote de verdade continuam aparecendo (R$ 36)',
               (select total_debt from public.daily_sales where user_id = :'d'), 36);
select t.verdade('controle: o dia dela é conferido pelo banco',
               (select pelo_banco from public.ranking_valor_dias(t.dia(1), t.dia(1), :'d')));
select t.igual('por que o carimbo precisa ser verdadeiro: carimbo falso de "lido agora" vira calote de R$ 36',
               (select total_debt from public.daily_sales where user_id = :'e'), 36);
