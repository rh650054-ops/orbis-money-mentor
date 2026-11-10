-- Weekly closing. Two verified vendors, banks healthy, no pending item.
-- F-07 (fixed 10/11): with no pending item the result stays provisional until an admin approves.
-- F-17 (fixed 10/11): vendors cannot read the closing table; the app uses premio_resultado().
begin;
select t.vendedor('Vendedora G') as g \gset
select t.conexao(:'g', 'Nubank', t.hora(20, '09:00')) as cg \gset
select t.foco(:'g', 2, '08:00', '17:00', 48);
select t.pix(:'cg', t.hora(2, '09:00'), 24, 'MARIO PAIVA LEAL');
select t.pix(:'cg', t.hora(2, '10:00'), 24, 'NINA CORREA DUTRA');
select t.vendedor('Vendedor H') as h \gset
select t.conexao(:'h', 'Inter', t.hora(20, '09:00')) as ch \gset
select t.foco(:'h', 2, '08:00', '17:00', 24);
select t.pix(:'ch', t.hora(2, '09:00'), 24, 'OLGA BASTOS REIS');
commit;

select public.premio_congelar('semana', t.dia(7), t.dia(1));
select t.igual('a apuração continua funcionando: 2 vendedores no resultado',
               (select count(*) from public.premio_fechamento where tipo = 'semana')::numeric, 2);
select t.igual('1º lugar = quem recebeu mais no banco (R$ 48)',
               (select valor from public.premio_fechamento where tipo = 'semana' and posicao = 1), 48);
select t.igual('F-07: sem aprovação humana nada é homologado',
               (select count(*) from public.premio_fechamento where status = 'homologado')::numeric, 0);
select t.igual('F-07: ninguém é marcado como ganhador sem aprovação humana',
               (select count(*) from public.premio_fechamento where leva_premio)::numeric, 0);
select public.premio_reavaliar();
select t.igual('F-07: a reavaliação de hora em hora também não homologa',
               (select count(*) from public.premio_fechamento where status = 'homologado')::numeric, 0);
select t.igual('o resultado provisório continua sendo recalculado (2 linhas)',
               (select count(*) from public.premio_fechamento where status = 'provisorio')::numeric, 2);
select t.igual('F-17: vendedor comum não lê a tabela de fechamento direto (-1 = acesso negado)',
               t.linhas_como('authenticated', :'h', 'select pendencias from public.premio_fechamento')::numeric, -1);
select t.verdade('o app continua recebendo o resultado pela função premio_resultado',
               t.linhas_como('authenticated', :'h', format('select public.premio_resultado(''semana'', %L) r', t.dia(7))) = 1
               and (select public.premio_resultado('semana', t.dia(7)) ->> 'status') = 'provisorio');

-- only an admin can make it final, and then it is final
do $$ begin
  perform public.premio_homologar_manual('semana', t.dia(7));
  perform t.verdade('quem não é admin não homologa', false);
exception when others then
  perform t.verdade('quem não é admin não homologa', true);
end $$;
select set_config('teste.admin', 'on', false);
select t.igual('admin homologa: as 2 linhas viram definitivas', public.premio_homologar_manual('semana', t.dia(7))::numeric, 2);
select t.igual('depois da aprovação, exatamente 1 ganhadora', (select count(*) from public.premio_fechamento where leva_premio)::numeric, 1);
select t.verdade('e é a 1ª colocada', (select leva_premio from public.premio_fechamento where posicao = 1));
