-- 15/11/2026 · the provider's own reference of a bank entry
-- (20261115190000_entradas_identidade_do_provedor.sql, applied whole by the runner).
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
end $$;
