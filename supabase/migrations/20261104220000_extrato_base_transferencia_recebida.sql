-- 04/11/2026 — fixes a regression from 20261102110000 (audit finding).
-- That migration took every 'transferencia_recebida' out of the totals, but the importer also
-- uses that category for TEDs/transfers FROM OTHER PEOPLE (customers paying): October lost
-- ~R$ 211k of real income across 31 users.
-- Now: own outgoing transfers ('transferencia_propria') stay out; an incoming
-- 'transferencia_recebida' stays out only when it comes from the account holder himself
-- (extrato_eh_titular). Everything already marked 'entre_contas' is out as before.
create or replace function public.extrato_base(p_ini date, p_fim date)
 returns table(id uuid, data date, hora time without time zone, descricao text, comerciante text, chave text, valor numeric, tipo text, categoria text, esfera text, confianca text, banco text, movimento text, par_id uuid, recorrente boolean, origem text, conta boolean)
 language sql
 stable
 set search_path to 'public'
as $function$
  select l.id, l.data, l.hora, l.descricao, l.comerciante, l.chave, l.valor, l.tipo, l.categoria, l.esfera,
         l.confianca, l.banco, l.movimento, l.par_id, l.recorrente, l.origem,
         (l.categoria is distinct from 'transferencia_propria'
          and not (l.categoria = 'transferencia_recebida'
                   and public.extrato_eh_titular(l.user_id, coalesce(nullif(l.comerciante, ''), l.descricao_norm)))
          and (l.movimento = 'normal' or (l.movimento = 'fatura'
            and not exists (
              select 1 from public.extrato_arquivos a
               where a.user_id = l.user_id and a.documento = 'cartao' and a.mes = date_trunc('month', l.data)::date
                 and (a.banco is not distinct from l.banco
                      or (a.banco is not null and l.descricao_norm like '%' || public.extrato_norm(a.banco) || '%')))
            and not exists (
              select 1 from public.extrato_lancamentos c
               where c.user_id = l.user_id and c.do_cartao
                 and c.data >= date_trunc('month', l.data)::date - 31 and c.data < date_trunc('month', l.data)::date + 31)))) as conta
    from public.extrato_lancamentos l
   where l.user_id = auth.uid() and l.data >= p_ini and l.data < p_fim
$function$;
