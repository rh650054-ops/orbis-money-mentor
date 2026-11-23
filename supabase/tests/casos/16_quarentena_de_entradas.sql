-- The reversible removal of proven copies (supabase/reconciliacao/quarentena-de-entradas.sql):
-- nothing moves without the documented evidence of the six conditions, each refusal has its own
-- reason, and a restored batch is identical to what was there.
\ir ../../reconciliacao/quarentena-de-entradas.sql

-- A report as pluggy-conferir returns it, for one pair; `p_muda` overrides fields of the pair and
-- `p_rel` fields of the report, to build each kind of faulty evidence.
create or replace function pg_temp.relatorio(p_sai text, p_fica text, p_muda jsonb default '{}', p_rel jsonb default '{}') returns jsonb
language sql as $$
  select jsonb_build_array(jsonb_build_object('gerado_em', now(), 'extrato_completo', true) || p_rel || jsonb_build_object('pares', jsonb_build_array(
    jsonb_build_object(
      'conexao', left(s.bank_connection_id::text, 8), 'conta', 'c0c0c0c0', 'dia', s.transaction_date, 'valor', s.amount,
      'sai', jsonb_build_object('transaction_id', p_sai, 'criada_em', s.created_at, 'na_pluggy', 'nao_existe'),
      'fica', jsonb_build_object('transaction_id', p_fica, 'criada_em', now(), 'na_pluggy', 'listada'),
      'contagem', jsonb_build_object('guardadas', 2, 'no_extrato', 1),
      'condicoes', jsonb_build_object('conta_identificada', true, 'atributos_iguais', true, 'copia_tardia', true, 'sai_nao_existe', true, 'fica_existe', true, 'contagem_confere', true, 'nao_usada', true),
      'classe', 'comprovada_por_id', 'motivos', '[]'::jsonb) || p_muda)))
  from public.auto_detected_sales s where s.transaction_id = p_sai
$$;
create or replace function pg_temp.recusa(p_relatorios jsonb, p_razao text, p_por_contagem boolean default false) returns boolean
language plpgsql as $$
begin
  perform pg_temp.quarentena_mover('l-recusado', 'teste', p_relatorios, p_por_contagem);
  return false;
exception when others then return sqlerrm like '%' || p_razao || '%';
end $$;

do $$
declare
  ana uuid := t.vendedor('ana-quarentena');
  bia uuid := t.vendedor('bia-quarentena');
  con uuid; outra uuid;
  antes jsonb; r jsonb; cond jsonb;
  k text;
begin
  con := t.conexao(ana, 'Mercado Pago', now() - interval '20 days');
  outra := t.conexao(bia, 'Mercado Pago', now() - interval '20 days');
  -- 09/11: three real Pix (20, 20, 30). The ids of the day itself are gone at Pluggy (q-a*); the
  -- current ones (q-b*) were stored again on 12/11, when 09/11 was the oldest day of the window.
  insert into public.auto_detected_sales (user_id, bank_connection_id, transaction_id, amount, description, transaction_date, transacted_at, is_pix, created_at) values
    (ana, con, 'q-a1', 20, 'Transferência PIX recebida', date '2026-11-09', '2026-11-09 03:00+00', true, '2026-11-09 15:00:00.111111+00'),
    (ana, con, 'q-a2', 20, 'Transferência PIX recebida', date '2026-11-09', '2026-11-09 03:00+00', true, '2026-11-09 16:00:00.222222+00'),
    (ana, con, 'q-a3', 30, 'Transferência PIX recebida', date '2026-11-09', '2026-11-09 03:00+00', true, '2026-11-09 17:00:00.333333+00'),
    (ana, con, 'q-b1', 20, 'Transferência PIX recebida', date '2026-11-09', '2026-11-09 03:00+00', true, '2026-11-12 22:10:07.123456+00'),
    (ana, con, 'q-b2', 20, 'Transferência PIX recebida', date '2026-11-09', '2026-11-09 03:00+00', true, '2026-11-12 22:10:07.223456+00'),
    (ana, con, 'q-b3', 30, 'Transferência PIX recebida', date '2026-11-09', '2026-11-09 03:00+00', true, '2026-11-12 22:10:07.323456+00'),
    -- two identical Pix of the day itself, never copied
    (ana, con, 'q-c1', 7, 'Transferência PIX recebida', date '2026-11-09', '2026-11-09 03:00+00', true, '2026-11-09 18:00+00'),
    (ana, con, 'q-c2', 7, 'Transferência PIX recebida', date '2026-11-09', '2026-11-09 03:00+00', true, '2026-11-09 19:00+00'),
    (bia, outra, 'q-z1', 20, 'Transferência PIX recebida', date '2026-11-09', '2026-11-09 03:00+00', true, '2026-11-12 22:10+00');
  select jsonb_agg(to_jsonb(s) order by s.transaction_id) into antes from public.auto_detected_sales s where s.user_id = ana;

  -- 1. evidence: every one of the conditions must be documented as met
  foreach k in array array['conta_identificada', 'atributos_iguais', 'copia_tardia', 'sai_nao_existe', 'fica_existe', 'contagem_confere', 'nao_usada'] loop
    cond := jsonb_build_object('conta_identificada', true, 'atributos_iguais', true, 'copia_tardia', true, 'sai_nao_existe', true, 'fica_existe', true, 'contagem_confere', true, 'nao_usada', true)
            || jsonb_build_object(k, false);
    perform t.verdade('evidence: refused when ' || k || ' is not documented as met',
      pg_temp.recusa(pg_temp.relatorio('q-a1', 'q-b1', jsonb_build_object('condicoes', cond)), 'a condition is not documented as met'));
  end loop;
  perform t.verdade('evidence: a pair with a reason against it is refused even if every flag says yes',
    pg_temp.recusa(pg_temp.relatorio('q-a1', 'q-b1', '{"motivos":["sai_nao_existe"]}'), 'a condition is not documented as met'));
  perform t.verdade('evidence: no conditions at all (a bare pair of ids) is refused',
    pg_temp.recusa(jsonb_build_array(jsonb_build_object('gerado_em', now(), 'extrato_completo', true, 'pares', '[{"sai":{"transaction_id":"q-a1"},"fica":{"transaction_id":"q-b1"},"classe":"comprovada_por_id","motivos":[]}]'::jsonb)), 'a condition is not documented as met'));
  perform t.verdade('evidence: an ambiguous pair is refused', pg_temp.recusa(pg_temp.relatorio('q-a1', 'q-b1', '{"classe":"ambigua"}'), 'class not approvable'));
  perform t.verdade('evidence: proven only by count is refused unless that standard was approved by name',
    pg_temp.recusa(pg_temp.relatorio('q-a1', 'q-b1', '{"classe":"comprovada_por_contagem"}'), 'class not approvable'));
  perform t.verdade('evidence: a report from a statement that was not whole is refused',
    pg_temp.recusa(pg_temp.relatorio('q-a1', 'q-b1', '{}', '{"extrato_completo":false}'), 'statement was not whole'));
  perform t.verdade('evidence: a report older than 24 hours is refused',
    pg_temp.recusa(pg_temp.relatorio('q-a1', 'q-b1', '{}', jsonb_build_object('gerado_em', now() - interval '25 hours')), 'older than 24 hours'));
  perform t.verdade('evidence: a report without its date is refused',
    pg_temp.recusa(jsonb_build_array((pg_temp.relatorio('q-a1', 'q-b1')->0) - 'gerado_em'), 'older than 24 hours'));

  -- 2. the database now must agree with the evidence
  perform t.verdade('now: evidence written for another row (amount) is refused',
    pg_temp.recusa(pg_temp.relatorio('q-a1', 'q-b1', '{"valor":25}'), 'not the one the evidence describes'));
  perform t.verdade('now: evidence written for another connection is refused',
    pg_temp.recusa(pg_temp.relatorio('q-a1', 'q-b1', '{"conexao":"ffffffff"}'), 'not the one the evidence describes'));
  perform t.verdade('now: a pair with another amount is refused', pg_temp.recusa(pg_temp.relatorio('q-a1', 'q-b3'), 'pair differs'));
  perform t.verdade('now: a pair in another connection (another seller) is refused', pg_temp.recusa(pg_temp.relatorio('q-a1', 'q-z1'), 'pair differs'));
  perform t.verdade('now: two identical Pix of the day itself are never a pair, whatever the evidence says',
    pg_temp.recusa(pg_temp.relatorio('q-c1', 'q-c2'), 'neither entry of the pair was created on or after day + 3'));
  perform t.verdade('now: the statement listed 2 like it and only 2 are stored: removing one is refused',
    pg_temp.recusa(pg_temp.relatorio('q-a1', 'q-b1', '{"contagem":{"guardadas":4,"no_extrato":4}}'), 'fewer identical entries would stay'));
  perform t.verdade('now: one bad pair aborts the batch',
    pg_temp.recusa(pg_temp.relatorio('q-a1', 'q-b1') || pg_temp.relatorio('q-a2', 'q-b2', '{"sai":{"transaction_id":"nao-existe"}}'), 'entry to remove not found'));
  perform t.verdade('now: an entry cannot be both removed and kept',
    pg_temp.recusa(pg_temp.relatorio('q-a1', 'q-b1') || pg_temp.relatorio('q-b1', 'q-a2'), 'listed twice or on both sides'));
  update public.auto_detected_sales set status = 'ignored' where transaction_id = 'q-a3';
  perform t.verdade('now: an entry the seller used after the report was made is refused',
    pg_temp.recusa(pg_temp.relatorio('q-a3', 'q-b3'), 'was used'));
  update public.auto_detected_sales set status = 'pending' where transaction_id = 'q-a3';
  insert into public.banco_entradas_revisao (transaction_id, user_id, amount, motivo, status) values ('q-a3', ana, 30, 'grande', 'pendente');
  perform t.verdade('now: an entry with a review decision is refused', pg_temp.recusa(pg_temp.relatorio('q-a3', 'q-b3'), 'was used'));
  delete from public.banco_entradas_revisao where transaction_id = 'q-a3';

  perform t.verdade('nothing was moved or recorded by any refused batch',
    (select jsonb_agg(to_jsonb(s) order by s.transaction_id) from public.auto_detected_sales s where s.user_id = ana) = antes
    and not exists (select 1 from public.auto_detected_sales_quarentena));

  -- 3. the approved batch: two pairs with their evidence
  r := pg_temp.quarentena_mover('lote-1', 'copia comprovada: id reemitido',
         pg_temp.relatorio('q-a1', 'q-b1', '{"contagem":{"guardadas":4,"no_extrato":2}}') || pg_temp.relatorio('q-a2', 'q-b2', '{"contagem":{"guardadas":4,"no_extrato":2}}'));
  perform t.igual('quarantine: the batch moves exactly its entries', (r->>'movidas')::numeric, 2);
  perform t.igual('quarantine: the day keeps its real payments', (select sum(amount) from public.auto_detected_sales where user_id = ana), 114);
  perform t.igual('quarantine: the other seller is untouched', (select count(*) from public.auto_detected_sales where user_id = bia)::numeric, 1);
  perform t.verdade('quarantine: each row is kept whole with the evidence that justified it',
    (select bool_and(evidencia->'condicoes'->>'sai_nao_existe' = 'true' and evidencia ? 'relatorio_gerado_em' and linha->>'transaction_id' = transaction_id)
       from public.auto_detected_sales_quarentena where lote = 'lote-1'));
  begin perform pg_temp.quarentena_mover('lote-1', 'de novo', pg_temp.relatorio('q-a3', 'q-b3')); perform t.verdade('quarantine: lote reused must fail', false);
  exception when others then perform t.verdade('quarantine: the same batch name cannot be used twice', sqlerrm like '%already used%'); end;

  -- 4. only by count, when that standard is approved by name
  r := pg_temp.quarentena_mover('lote-2', 'copia comprovada por contagem',
         pg_temp.relatorio('q-b3', 'q-a3', '{"classe":"comprovada_por_contagem","condicoes":{"conta_identificada":true,"atributos_iguais":true,"copia_tardia":true,"sai_nao_existe":true,"fica_existe":false,"contagem_confere":true,"nao_usada":true}}'), true);
  perform t.igual('quarantine: by count, with the standard approved, the late copy goes and the original stays', (r->>'movidas')::numeric, 1);

  -- 5. reversal
  r := pg_temp.quarentena_restaurar('lote-2');
  r := pg_temp.quarentena_restaurar('lote-1');
  perform t.igual('restore: the batch comes back whole', (r->>'restauradas')::numeric, 2);
  perform t.verdade('restore: every row is identical to what it was (id, created_at to the microsecond, every column)',
    (select jsonb_agg(to_jsonb(s) order by s.transaction_id) from public.auto_detected_sales s where s.user_id = ana) = antes);
  perform t.igual('restore: the quarantine keeps the record of what was done',
    (select count(*) from public.auto_detected_sales_quarentena where restaurada_em is not null)::numeric, 3);
  begin perform pg_temp.quarentena_restaurar('lote-1'); perform t.verdade('restore: twice must fail', false);
  exception when others then perform t.verdade('restore: a batch is restored once', sqlerrm like '%nothing to restore%'); end;
  perform t.verdade('quarantine table: row level security on, no privilege for the app roles',
    (select relrowsecurity from pg_class where oid = 'public.auto_detected_sales_quarentena'::regclass)
    and not exists (select 1 from information_schema.role_table_grants where table_name = 'auto_detected_sales_quarentena' and grantee in ('anon', 'authenticated')));
end $$;
