-- 15/11/2026 · the provider's own reference of a bank entry
-- (20261115220000_entradas_identidade_do_provedor.sql, applied whole by the runner).
-- The migration is additive. What its unique index may and may not refuse is the whole point:
-- it must stop the same payment being stored twice, and it must never refuse a real payment.
do $$
declare
  ana uuid := t.vendedor('ana-identidade');
  con1 uuid; con2 uuid;
  recusou boolean;
  n int;
begin
  con1 := t.conexao(ana, 'Mercado Pago', now() - interval '20 days');
  con2 := t.conexao(ana, 'Mercado Pago', now() - interval '10 days');

  perform t.igual('identity: the three columns exist',
    (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'auto_detected_sales'
      and column_name in ('conta_id', 'provedor_ref', 'ids_anteriores'))::numeric, 3);

  -- rows as they are stored today: no reference. Any number of identical ones is accepted
  -- (the migration cannot fail on, or change the meaning of, what already exists)
  insert into public.auto_detected_sales (user_id, bank_connection_id, transaction_id, amount, transaction_date)
    values (ana, con1, 'antiga-1', 20, date '2026-11-09'), (ana, con1, 'antiga-2', 20, date '2026-11-09');
  perform t.igual('identity: rows without a reference are never constrained',
    (select count(*) from public.auto_detected_sales where bank_connection_id = con1 and provedor_ref is null)::numeric, 2);
  perform t.verdade('identity: ids_anteriores starts empty, not null',
    (select bool_and(ids_anteriores = '{}') from public.auto_detected_sales where bank_connection_id = con1));

  insert into public.auto_detected_sales (user_id, bank_connection_id, transaction_id, amount, transaction_date, conta_id, provedor_ref)
    values (ana, con1, 'a1', 20, date '2026-11-09', 'conta-1', 'code:C1');

  -- the same payment under another Pluggy id: refused
  begin
    insert into public.auto_detected_sales (user_id, bank_connection_id, transaction_id, amount, transaction_date, conta_id, provedor_ref)
      values (ana, con1, 'b1', 20, date '2026-11-09', 'conta-1', 'code:C1');
    recusou := false;
  exception when unique_violation then recusou := true;
  end;
  perform t.verdade('identity: same connection, account, reference, day and amount under another id is refused', recusou);

  -- real payments that must all be accepted
  insert into public.auto_detected_sales (user_id, bank_connection_id, transaction_id, amount, transaction_date, conta_id, provedor_ref) values
    (ana, con1, 'c1', 20, date '2026-11-09', 'conta-1', 'code:C2'),   -- another reference: a second Pix of R$ 20
    (ana, con1, 'c2', 20, date '2026-11-09', 'conta-2', 'code:C1'),   -- another account of the same connection
    (ana, con2, 'c3', 20, date '2026-11-09', 'conta-1', 'code:C1'),   -- another connection
    (ana, con1, 'c4', 20, date '2026-11-10', 'conta-1', 'code:C1'),   -- another day: not assumed to be the same
    (ana, con1, 'c5', 25, date '2026-11-09', 'conta-1', 'code:C1'),   -- another amount: not assumed to be the same
    (ana, con1, 'c6', 20, date '2026-11-09', null,      'code:C1');   -- no account: not constrained
  get diagnostics n = row_count;
  perform t.igual('identity: other reference, account, connection, day, amount or no account are all accepted', n::numeric, 6);

  -- a re-issue is recorded by moving the id, and the row keeps its own history
  update public.auto_detected_sales set transaction_id = 'b1', ids_anteriores = array_append(ids_anteriores, 'a1') where transaction_id = 'a1';
  perform t.verdade('identity: the stored row can take the new id and remember the old one',
    (select ids_anteriores = array['a1'] from public.auto_detected_sales where transaction_id = 'b1'));
  -- the table of divergences: server only, and tied to the seller so deleting the account empties it
  perform t.verdade('divergences: row level security is on',
    (select relrowsecurity from pg_class where oid = 'public.banco_entradas_divergencias'::regclass));
  perform t.igual('divergences: the app roles have no privilege on it',
    (select count(*) from information_schema.role_table_grants where table_schema = 'public' and table_name = 'banco_entradas_divergencias'
      and grantee in ('anon', 'authenticated'))::numeric, 0);
  insert into public.banco_entradas_divergencias (user_id, bank_connection_id, conta_id, provedor_ref, transaction_id_guardado, transaction_id_novo, data_guardada, valor_guardado, data_nova, valor_novo)
    values (ana, con1, 'conta-1', 'code:C1', 'b1', 'd1', date '2026-11-09', 20, date '2026-11-09', 25);
  insert into public.banco_entradas_divergencias (user_id, bank_connection_id, conta_id, provedor_ref, transaction_id_guardado, transaction_id_novo, data_guardada, valor_guardado, data_nova, valor_novo)
    values (ana, con1, 'conta-1', 'code:C1', 'b1', 'd2', date '2026-11-09', 20, date '2026-11-09', 25)
    on conflict (bank_connection_id, conta_id, provedor_ref, data_nova, valor_novo) do nothing;
  perform t.igual('divergences: the same one seen again (even under a re-issued id) is one row',
    (select count(*) from public.banco_entradas_divergencias where bank_connection_id = con1)::numeric, 1);
  perform t.igual('divergences: recording one adds nothing to the entries',
    (select count(*) from public.auto_detected_sales where transaction_id in ('d1', 'd2'))::numeric, 0);
  delete from public.bank_connections where id = con1;
  perform t.igual('divergences: removing the connection removes its divergences',
    (select count(*) from public.banco_entradas_divergencias where bank_connection_id = con1)::numeric, 0);
end $$;
