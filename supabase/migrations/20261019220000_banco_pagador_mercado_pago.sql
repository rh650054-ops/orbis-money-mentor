-- 19/10/2026 (cliente do Pro anual, Mercado Pago): o Mercado Pago não manda o nome de
-- quem pagou — todo Pix vem como "Transferência PIX recebida" ou "PIX recebido de
-- (XXXXXXXXXXX)". banco_pagador devolvia esse texto como se fosse o NOME do pagador,
-- então dezenas de Pix de clientes diferentes viravam "o mesmo pagador" e caíam na
-- regra de recorrente (não é venda). Resultado: o banco lia R$ 0 de Pix e o dia
-- inteiro virava calote. Rótulo genérico ou nome mascarado agora = pagador desconhecido
-- (null): conta como venda normal e nunca entra em "recorrente".
create or replace function public.banco_pagador(p_nome text, p_descr text)
returns text language sql immutable set search_path to 'public' as $function$
  with t as (
    select nullif(trim(regexp_replace(regexp_replace(lower(
             coalesce(nullif(trim(p_nome), ''),
                      nullif(trim(split_part(coalesce(p_descr, ''), '|', 2)), ''),
                      coalesce(p_descr, ''))),
             '^(pix recebido( c6)?( de)?|transfer[êe]ncia recebida\|?|pix|cr[ée]dito pix|recebimento pix)\s*', ''),
             '[0-9./-]+', ' ', 'g')), '') as v
  )
  select case
           when t.v is null then null
           when t.v ~ '^(transfer[êe]ncia )?(pix )?(recebid[ao]|recebimento)( (de )?pix)?$' then null
           when t.v ~ '^\(?[x*\s]+\)?$' then null
           else t.v
         end
    from t;
$function$;

-- Mercado Pago manda só a DATA do Pix (hora 00:00 de Brasília). Tratado como hora
-- real, todo Pix caía antes do início do Foco e era jogado pro dia ANTERIOR
-- (14/10 aparecia em 13/10). Meia-noite exata = "sem hora": vale a data do banco.
create or replace function public.banco_entradas_detalhe(p_user uuid, p_de date, p_ate date)
returns table(dia date, amount numeric, maq boolean, quando timestamp with time zone, visto_em timestamp with time zone)
language sql stable security definer set search_path to 'public' as $function$
  with sess as (
    select cs.date as d, min(cs.started_at) as ini
    from public.challenge_sessions cs
    where cs.user_id = p_user and cs.started_at is not null
      and cs.date between p_de - 3 and p_ate + 3
    group by cs.date
  ),
  vendeu as (
    select ds.date as d from public.daily_sales ds
     where ds.user_id = p_user and ds.date between p_de - 3 and p_ate + 3
       and coalesce(ds.total_profit, 0) + coalesce(ds.total_debt, 0) > 0
  ),
  base as (
    select a.amount, a.transaction_date, a.transaction_id, a.bank_connection_id, a.created_at as visto,
           public.banco_eh_maquininha(a.description) and not coalesce(a.is_pix, false) as maq,
           case
             when a.transacted_at is not null
                  and (a.transacted_at at time zone 'America/Sao_Paulo')::time = time '00:00' then null
             else coalesce(a.transacted_at,
               case when (a.created_at at time zone 'America/Sao_Paulo')::date <= a.transaction_date + 1 then a.created_at end)
           end as quando
    from public.banco_entradas_classificadas(p_user, p_de, p_ate + 1) a
    where a.motivo is null
      and not exists (
        select 1 from public.auto_detected_sales b
         where b.user_id = p_user
           and b.bank_connection_id is distinct from a.bank_connection_id
           and b.amount = a.amount and b.transaction_date = a.transaction_date
           and lower(coalesce(b.description, '')) = lower(coalesce(a.description, ''))
           and coalesce(b.status, 'pending') <> 'ignored'
           and public.banco_conta_de_venda(b.bank_connection_id, coalesce(b.transacted_at, b.created_at))
           and ((b.transacted_at is not null and a.transacted_at is null)
                or ((b.transacted_at is null) = (a.transacted_at is null) and b.transaction_id < a.transaction_id)))
  ),
  tx as (
    select x.amount, x.maq, x.quando, x.visto,
           (x.quando at time zone 'America/Sao_Paulo')::date as dia_cal,
           (x.quando at time zone 'America/Sao_Paulo')::time as hora,
           (select s.d from sess s
             where x.quando is not null and s.ini <= x.quando
               and x.quando < (((s.d + 2)::timestamp) at time zone 'America/Sao_Paulo')
             order by s.ini desc limit 1) as dia_defcon,
           x.transaction_date
    from base x
  ),
  atribuido as (
    select t.amount, t.maq, t.quando, t.visto,
           case
             when t.quando is null then t.transaction_date
             when t.dia_defcon = t.dia_cal then t.dia_cal
             when exists (select 1 from sess s where s.d = t.dia_cal)
               then coalesce(t.dia_defcon, t.dia_cal - 1)
             when t.hora >= time '06:00' and exists (select 1 from vendeu v where v.d = t.dia_cal) then t.dia_cal
             when t.dia_defcon is not null then t.dia_defcon
             else t.dia_cal
           end as dia
    from tx t
  )
  select a.dia, a.amount, a.maq, a.quando, a.visto
    from atribuido a
   where a.dia between p_de and p_ate;
$function$;
