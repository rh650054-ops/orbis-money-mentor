-- The reversible removal of proven copies (supabase/reconciliacao/quarentena-de-entradas.sql):
-- what it refuses, what it moves, and that a restored batch is identical to what was there.
\ir ../../reconciliacao/quarentena-de-entradas.sql
do $$
declare
  ana uuid := t.vendedor('ana-quarentena');
  bia uuid := t.vendedor('bia-quarentena');
  con uuid; outra uuid;
  antes jsonb; r jsonb;
  recusou boolean;
begin
  con := t.conexao(ana, 'Mercado Pago', now() - interval '20 days');
  outra := t.conexao(bia, 'Mercado Pago', now() - interval '20 days');
  -- 09/11: three real Pix (20, 20, 30) stored twice; one of the copies was already used by the seller
  insert into public.auto_detected_sales (user_id, bank_connection_id, transaction_id, amount, description, transaction_date, transacted_at, is_pix, created_at) values
    (ana, con, 'q-a1', 20, 'Transferência PIX recebida', date '2026-11-09', '2026-11-09 03:00+00', true, '2026-11-09 15:00+00'),
    (ana, con, 'q-a2', 20, 'Transferência PIX recebida', date '2026-11-09', '2026-11-09 03:00+00', true, '2026-11-09 16:00+00'),
    (ana, con, 'q-a3', 30, 'Transferência PIX recebida', date '2026-11-09', '2026-11-09 03:00+00', true, '2026-11-09 17:00+00'),
    (ana, con, 'q-b1', 20, 'Transferência PIX recebida', date '2026-11-09', '2026-11-09 03:00+00', true, '2026-11-12 22:10:07.123456+00'),
    (ana, con, 'q-b2', 20, 'Transferência PIX recebida', date '2026-11-09', '2026-11-09 03:00+00', true, '2026-11-12 22:10:07.223456+00'),
    (ana, con, 'q-b3', 30, 'Transferência PIX recebida', date '2026-11-09', '2026-11-09 03:00+00', true, '2026-11-12 22:10:07.323456+00'),
    (bia, outra, 'q-z1', 20, 'Transferência PIX recebida', date '2026-11-09', '2026-11-09 03:00+00', true, '2026-11-09 15:00+00');
  update public.auto_detected_sales set status = 'ignored' where transaction_id = 'q-b3';
  select jsonb_agg(to_jsonb(s) order by s.transaction_id) into antes from public.auto_detected_sales s where s.user_id = ana;

  -- refusals: each one aborts the whole batch
  begin perform pg_temp.quarentena_mover('l0', 'teste', '[{"sai":"q-b1","fica":"q-a3"}]'); recusou := false; exception when others then recusou := sqlerrm like '%pair differs%'; end;
  perform t.verdade('quarantine: a pair with another amount is refused', recusou);
  begin perform pg_temp.quarentena_mover('l0', 'teste', '[{"sai":"q-b1","fica":"q-z1"}]'); recusou := false; exception when others then recusou := sqlerrm like '%pair differs%'; end;
  perform t.verdade('quarantine: a pair in another connection (another seller) is refused', recusou);
  begin perform pg_temp.quarentena_mover('l0', 'teste', '[{"sai":"q-b3","fica":"q-a3"}]'); recusou := false; exception when others then recusou := sqlerrm like '%was used%'; end;
  perform t.verdade('quarantine: an entry the seller already used is refused', recusou);
  begin perform pg_temp.quarentena_mover('l0', 'teste', '[{"sai":"q-b1","fica":"q-a1"},{"sai":"q-b2","fica":"q-a1"}]'); recusou := false; exception when others then recusou := sqlerrm like '%kept for two removals%'; end;
  perform t.verdade('quarantine: one kept entry cannot justify two removals', recusou);
  begin perform pg_temp.quarentena_mover('l0', 'teste', '[{"sai":"q-b1","fica":"q-a1"},{"sai":"q-a1","fica":"q-b2"}]'); recusou := false; exception when others then recusou := sqlerrm like '%listed twice or on both sides%'; end;
  perform t.verdade('quarantine: an entry cannot be both removed and kept', recusou);
  begin perform pg_temp.quarentena_mover('l0', 'teste', '[{"sai":"q-b1","fica":"q-a1"},{"sai":"nao-existe","fica":"q-a2"}]'); recusou := false; exception when others then recusou := sqlerrm like '%entry to remove not found%'; end;
  perform t.verdade('quarantine: one bad pair aborts the batch...', recusou);
  perform t.igual('quarantine: ...and nothing was moved by any refused batch',
    (select count(*) from public.auto_detected_sales where user_id = ana)::numeric, 6);
  perform t.igual('quarantine: ...nor recorded', (select count(*) from public.auto_detected_sales_quarentena)::numeric, 0);

  r := pg_temp.quarentena_mover('lote-1', 'copia comprovada: id reemitido', '[{"sai":"q-b1","fica":"q-a1"},{"sai":"q-b2","fica":"q-a2"}]');
  perform t.igual('quarantine: the batch moves exactly its entries', (r->>'movidas')::numeric, 2);
  perform t.igual('quarantine: the day now holds the real payments plus the used one', (select sum(amount) from public.auto_detected_sales where user_id = ana), 100);
  perform t.igual('quarantine: the other seller is untouched', (select count(*) from public.auto_detected_sales where user_id = bia)::numeric, 1);
  begin perform pg_temp.quarentena_mover('lote-1', 'de novo', '[{"sai":"q-a2","fica":"q-a1"}]'); recusou := false; exception when others then recusou := sqlerrm like '%already used%'; end;
  perform t.verdade('quarantine: a batch name is used once', recusou);

  r := pg_temp.quarentena_restaurar('lote-1');
  perform t.igual('restore: the batch comes back whole', (r->>'restauradas')::numeric, 2);
  perform t.verdade('restore: every row is identical to what it was (id, created_at to the microsecond, every column)',
    (select jsonb_agg(to_jsonb(s) order by s.transaction_id) from public.auto_detected_sales s where s.user_id = ana) = antes);
  perform t.igual('restore: the quarantine keeps the record of what was done',
    (select count(*) from public.auto_detected_sales_quarentena where lote = 'lote-1' and restaurada_em is not null)::numeric, 2);
  begin perform pg_temp.quarentena_restaurar('lote-1'); recusou := false; exception when others then recusou := sqlerrm like '%nothing to restore%'; end;
  perform t.verdade('restore: a batch is restored once', recusou);
  perform t.verdade('quarantine table: row level security on, no privilege for the app roles',
    (select relrowsecurity from pg_class where oid = 'public.auto_detected_sales_quarentena'::regclass)
    and not exists (select 1 from information_schema.role_table_grants where table_name = 'auto_detected_sales_quarentena' and grantee in ('anon', 'authenticated')));
end $$;
