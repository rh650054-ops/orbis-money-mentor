-- The rollback of the F-07 hotfix is a switch. This proves the switch works both ways: turned ON,
-- the closing behaves exactly as before the hotfix (final by itself when nothing is pending).
begin;
select t.vendedor('Vendedora I') as i \gset
select t.conexao(:'i', 'Nubank', t.hora(20, '09:00')) as ci \gset
select t.foco(:'i', 2, '08:00', '17:00', 24);
select t.pix(:'ci', t.hora(2, '09:00'), 24, 'TIAGO ROCHA LINS');
commit;

select t.verdade('a chave nasce desligada', not public.premio_homologacao_automatica());
create or replace function public.premio_homologacao_automatica() returns boolean language sql immutable as $$ select true $$;
select public.premio_congelar('semana', t.dia(7), t.dia(1));
select t.igual('chave ligada (rollback): volta a homologar sozinho', (select count(*) from public.premio_fechamento where status = 'homologado')::numeric, 1);
