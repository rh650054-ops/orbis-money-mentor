-- 02/11/2026 (Rick: "não está identificando de onde é a compra e joga tudo pro mesmo lugar").
-- The learning key (extrato_chave) was the first 5 letters of the first "useful" word. Bank
-- prefixes were not cleaned, so the key was the bank's prefix, not the shop:
--   "DEBITO VISA ELECTRON BRASIL <loja>"  → ELECT  (every Santander debit: pharmacy, Atacadão, pet shop…)
--   "COMPRA NO DEBITO <loja>"             → NO     (every C6 / MP debit)
--   "TRANSFERENCIA ENVIADA PELO PIX <x>"  → PELO   (every Pix to any person)
-- and 5 letters merged people (GABRI, MARIA, PAULO, SILVA = Silvana + Silva e Barbosa).
-- One correction then moved ALL of them. Fix:
--   1) more noise words are dropped (bank/acquirer prefixes, numbers);
--   2) key = first word (12 letters) + 4 letters of the second: "ATACADAO AS", "PET FELI",
--      "SILVA BARB", "GABRIEL MESQ". Bank truncation ("SILVA E BARB") still matches.
--   3) learned rules are moved to the new keys. A rule whose old key now splits into more than
--      3 different shops was a bank prefix, not a shop: it is dropped and the rows it dragged
--      are unlocked (category kept, no longer marked as "the user chose this").
-- Also: "Mercado / rancho" → "Mercado de casa" (Rick: rancho doesn't say personal grocery).

create or replace function public.extrato_tokens(p text)
 returns text[]
 language sql immutable
 set search_path to 'public'
as $function$
  select coalesce(array_agg(w order by i), '{}'::text[])
  from unnest(regexp_split_to_array(public.extrato_norm(p), '\s+')) with ordinality as u(w, i)
  where w <> '' and w !~ '^[0-9]+$' and not (w = any (array[
    'PIX','ENVIADO','ENVIADA','RECEBIDO','RECEBIDA','TRANSF','TRANSFERENCIA','TRANSFERENCI','TED','DOC',
    'PAG','PAGTO','PGTO','PAGAMENTO','PAGAMENTOS','COMPRA','COMPRAS','DEBITO','DEB','CREDITO','CRED',
    'CARTAO','ELO','VISA','MASTER','MASTERCARD','QR','QRCODE','SISPAG','INT','LANCAMENTO','AUT','BOLETO',
    'RECEBIMENTO','ENVIO','REM','CP','DE','DA','DO','DOS','DAS','PARA','EM','E','A','O','LTDA','ME','EPP',
    'EIRELI','SA','S',
    -- 02/11: bank / acquirer prefixes that are never the shop
    'ELECTRON','BRASIL','BRA','NO','NA','PELO','PELA','CODE','PRODUTO','MP','BR','BR1','EMV',
    'PAGSEGURO','PAGBANK','SUMUP','STONE','CIELO','GETNET','IFOOD','FOOD','COM']))
$function$;

create or replace function public.extrato_chave(p text)
 returns text
 language plpgsql immutable
 set search_path to 'public'
as $function$
declare t text[] := public.extrato_tokens(p);
begin
  if coalesce(array_length(t, 1), 0) = 0 then return null; end if;
  if array_length(t, 1) = 1 then return left(t[1], 12); end if;
  return left(t[1], 12) || ' ' || left(t[2], 4);
end $function$;

-- old key → new keys, per user (old key is still in the column)
create temp table _mapa on commit drop as
select l.user_id, l.tipo, l.chave as velha,
       coalesce(public.extrato_chave(l.comerciante), public.extrato_chave(l.descricao_norm)) as nova
  from public.extrato_lancamentos l
 where l.chave is not null;

create temp table _regra on commit drop as
select r.user_id, r.tipo, r.comerciante as velha, r.categoria, r.esfera, r.valor_min,
       (select count(distinct m.nova) from _mapa m
         where m.user_id = r.user_id and m.tipo = r.tipo and m.velha = r.comerciante and m.nova is not null) as n
  from public.extrato_regras_usuario r;

-- generic (bank prefix): unlock what it dragged, keep the category
update public.extrato_lancamentos l set confianca = 'padrao'
  from _regra g
 where g.n > 3 and l.user_id = g.user_id and l.tipo = g.tipo and l.chave = g.velha
   and l.confianca = 'usuario' and not l.categoria_fixa;

-- a real shop/person (1 to 3 variants): the rule follows it to the new key(s)
insert into public.extrato_regras_usuario (user_id, comerciante, tipo, categoria, esfera, valor_min)
select distinct g.user_id, m.nova, g.tipo, g.categoria, g.esfera, g.valor_min
  from _regra g join _mapa m on m.user_id = g.user_id and m.tipo = g.tipo and m.velha = g.velha
 where g.n between 1 and 3 and m.nova is not null
on conflict (user_id, comerciante, tipo) do nothing;

-- old keys go away (unless the old key is also a valid new key)
delete from public.extrato_regras_usuario r
 using _regra g
 where r.user_id = g.user_id and r.tipo = g.tipo and r.comerciante = g.velha
   and (g.n = 0 or g.n > 3
        or not exists (select 1 from _mapa m where m.user_id = g.user_id and m.tipo = g.tipo and m.nova = g.velha));

-- every row gets its new key
update public.extrato_lancamentos l
   set chave = coalesce(public.extrato_chave(l.comerciante), public.extrato_chave(l.descricao_norm))
 where l.chave is distinct from coalesce(public.extrato_chave(l.comerciante), public.extrato_chave(l.descricao_norm));

update public.extrato_categorias set rotulo = 'Mercado de casa'
 where slug = 'mercado' and user_id is null;
