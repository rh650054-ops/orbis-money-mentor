-- 02/11/2026 (Rick: "acho que está duplicando, mandei dinheiro de uma conta pra outra").
-- Not duplicated: 4 Pix between his own accounts (R$ 806) were counted as money OUT and IN,
-- because they were still movimento = 'normal'. The import already tagged them
-- transferencia_propria / transferencia_recebida, but the step that turns them into
-- "entre contas" (extrato_analisar_padroes) did not run after the Pluggy webhook import.
-- Safety net: those two categories never count as spending or income, whatever the movimento.
-- (The webhook now also runs the analysis — pluggy-webhook/index.ts.)
create or replace function public.extrato_base(p_ini date, p_fim date)
 returns table(id uuid, data date, hora time without time zone, descricao text, comerciante text, chave text, valor numeric, tipo text, categoria text, esfera text, confianca text, banco text, movimento text, par_id uuid, recorrente boolean, origem text, conta boolean)
 language sql
 stable
 set search_path to 'public'
as $function$
  select l.id, l.data, l.hora, l.descricao, l.comerciante, l.chave, l.valor, l.tipo, l.categoria, l.esfera,
         l.confianca, l.banco, l.movimento, l.par_id, l.recorrente, l.origem,
         (l.categoria not in ('transferencia_propria', 'transferencia_recebida')
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
