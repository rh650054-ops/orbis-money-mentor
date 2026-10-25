-- Reembolsos: "Não reembolsar" tira a cobrança da lista (Rick, 25/10/2026: ex. cobrança antiga,
-- mês já usado e fora do prazo). Fica registrado em hotmart_reembolsos com
-- resultado 'dispensado' e por quem; a lista não mostra mais.
create or replace function public.admin_reembolso_dispensar(p_purchase text)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if not public.is_orbis_admin() then raise exception 'apenas admin'; end if;
  insert into public.hotmart_reembolsos (purchase_id, user_id, subscription_id, valor, motivo, por, resultado)
  select s.purchase_id, s.user_id, s.subscription_id, s.valor, s.motivo, auth.uid(), 'dispensado'
    from public.admin_reembolsos_sugeridos() s where s.purchase_id = p_purchase and s.reembolsado_em is null
  on conflict (purchase_id) do nothing;
end $$;
revoke all on function public.admin_reembolso_dispensar(text) from public, anon;
grant execute on function public.admin_reembolso_dispensar(text) to authenticated;

-- a lista não mostra o que foi dispensado
create or replace function public.admin_reembolsos_sugeridos()
returns table(purchase_id text, user_id uuid, nome text, subscription_id text, manteve text,
              motivo text, valor numeric, cobrado_em timestamptz, reembolsado_em timestamptz, resultado text)
language sql stable security definer set search_path to 'public' as $$
  with pag as (   -- 1 linha por cobrança aprovada
    select distinct on (e.purchase_id) e.purchase_id, e.subscription_id, e.valor, e.user_id,
           coalesce(case when (e.payload #>> '{data,purchase,approved_date}') ~ '^\d+$'
                         then to_timestamp((e.payload #>> '{data,purchase,approved_date}')::bigint / 1000) end, e.recebido_em) as em
      from public.hotmart_eventos e
     where e.event_type in ('PURCHASE_APPROVED','PURCHASE_COMPLETE') and e.purchase_id is not null and e.subscription_id is not null
     order by e.purchase_id, e.recebido_em
  ), c as (
    select distinct on (a.subscription_id) a.* from public.hotmart_cancelamentos_auto a order by a.subscription_id, a.em desc
  ), sug as (
    select p.purchase_id, c.user_id, c.subscription_id, c.manteve, 'duplicada'::text motivo, p.valor, p.em
      from c join pag p on p.subscription_id = c.subscription_id
     where c.motivo = 'duplicada'
       and exists (select 1 from pag k where k.subscription_id = c.manteve and abs(extract(epoch from (k.em - p.em))) <= 2 * 86400)
    union all
    select p.purchase_id, c.user_id, c.subscription_id, c.manteve, 'depois_pro', p.valor, p.em
      from c join pag p on p.subscription_id = c.subscription_id
     where c.motivo = 'upgrade_pro'
       and (p.em at time zone 'America/Sao_Paulo')::date >=
           (select min((k.em at time zone 'America/Sao_Paulo')::date) from pag k where k.subscription_id = c.manteve)
  )
  select s.purchase_id, s.user_id, coalesce(pr.nickname, '—'), s.subscription_id, s.manteve, s.motivo, s.valor, s.em,
         r.em, r.resultado
    from sug s
    left join public.profiles pr on pr.user_id = s.user_id
    left join public.hotmart_reembolsos r on r.purchase_id = s.purchase_id
   where public.is_orbis_admin()
     and r.resultado is distinct from 'dispensado'   -- 25/10: "Não reembolsar" some da lista
     -- já reembolsado pela própria Hotmart (painel/cliente) não aparece como pendente
     and not exists (select 1 from public.hotmart_eventos x where x.purchase_id = s.purchase_id and x.event_type in ('PURCHASE_REFUNDED','PURCHASE_CHARGEBACK') and r.purchase_id is null)
   order by r.em nulls first, s.em desc;
$$;
