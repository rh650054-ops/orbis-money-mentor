-- 04/11/2026 (Rick: "pode subir").
-- 1) A NEW connection counts its whole first day (from 00:00 Brasília), not only from the
--    minute it was connected: a seller who connects at 15:44 does not lose the morning's Pix.
--    Days before the connection still don't count. A role switched by hand later
--    (papel_auto = false) keeps the exact time, as before (anti-fraud).
-- 2) Mercado Pago sends some card-machine sales with the description "Concepto" (Spanish).
--    They now count as card-machine sales (they were "nao_e_venda").
create or replace function public.banco_conta_de_venda(p_conexao uuid, p_quando timestamp with time zone)
 returns boolean
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select exists (
    select 1 from public.bank_connections bc
     where bc.id = p_conexao and coalesce(bc.status, '') <> 'deleted'
       and (
         bc.papel is null
         or (bc.papel = 'trabalho' and (bc.papel_desde is null or p_quando is null
             or p_quando >= case when coalesce(bc.papel_auto, false)
                                 then (date_trunc('day', bc.papel_desde at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo')
                                 else bc.papel_desde end))
         or (select count(*) from public.bank_connections o
              where o.user_id = bc.user_id and coalesce(o.status, '') <> 'deleted') = 1
       ));
$function$;

create or replace function public.banco_eh_maquininha(p_descr text)
 returns boolean
 language sql
 immutable
 set search_path to 'public'
as $function$
  select coalesce(lower(trim(p_descr)), '') ~
    '^(vendas?|recebimento de vendas?|liquida[cç][aã]o de vendas?|vendas? (no |com )?(cart[aã]o|d[eé]bito|cr[eé]dito).*|antecipa[cç][aã]o de vendas?.*|concepto)$';
$function$;

-- past days of the ranking come from this cache: rebuild it now
select public.ranking_cache_atualizar(45);
