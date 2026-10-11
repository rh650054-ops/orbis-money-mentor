-- Estado "antes" parecido com produção
set request.jwt.claims = '{"role":"service_role"}';
insert into auth.users (id, email) values
 ('00000000-0000-0000-0000-00000000000a', '52998224725@orbis.internal'),  -- confirmado pelo app (ms)
 ('00000000-0000-0000-0000-00000000000b', '11144477735@orbis.internal'),  -- lote 29/09 (µs)
 ('00000000-0000-0000-0000-00000000000c', '39053344705@orbis.internal'),  -- nunca confirmou
 ('00000000-0000-0000-0000-00000000000d', '86288366757@orbis.internal');  -- super admin, lote
insert into public.profiles (user_id, cpf, email, nickname) values
 ('00000000-0000-0000-0000-00000000000a', '52998224725', 'ana@ex.com', 'Ana'),
 ('00000000-0000-0000-0000-00000000000b', '11144477735', 'bia@ex.com', 'Bia'),
 ('00000000-0000-0000-0000-00000000000c', '39053344705', 'caio@ex.com', 'Caio'),
 ('00000000-0000-0000-0000-00000000000d', '86288366757', 'rick@ex.com', 'Rick');
insert into public.admin_access values ('86288366757', true, true);
update public.profiles set email_verificado_em = '2026-10-02 22:08:10.429+00' where cpf = '52998224725';
update public.profiles set email_verificado_em = '2026-09-29 17:37:01.123456+00' where cpf in ('11144477735', '86288366757');
-- pendências antigas: um link do cadastro (24h) e um código (15 min)
insert into public.email_codigos (user_id, email, codigo_hash, expira_em, enviado_em) values
 ('00000000-0000-0000-0000-00000000000c', 'caio@ex.com', 'h-link', now() + interval '23 hours', now() - interval '1 hour'),
 ('00000000-0000-0000-0000-00000000000b', 'bia@ex.com', 'h-cod', now() + interval '10 minutes', now() - interval '5 minutes');
insert into auth.sessions (id, user_id) values ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a');
insert into auth.refresh_tokens (user_id, session_id, token) values ('00000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-00000000000a', 'rt');
create table public._antes as select user_id, updated_at from public.profiles;
reset request.jwt.claims;
