-- ============================================================
-- CRM: ESTEIRA "UPGRADE PRO" (Rick, 12/10/2026 — reunião com o comercial)
-- Toda a base de ASSINANTES (quem paga hoje e ainda não é Pro) entra no Dia 1.
--   Dia 1  "Oi, tudo bem?"
--   Dia 2  "Oi, tudo bem?" de novo
--   Dia 3  sem resposta: manda "Oi, tudo bem?" e apaga
--   Dia 4  liga
--   Fez upgrade · Não fez upgrade · Na dúvida
-- O comercial move à mão (arrasta ou "Mover para"); cada movida zera o "dias na
-- coluna" (etapa_desde). Quem vira Pro sozinho cai em "Fez upgrade" no sync.
-- Não manda nada pra quem não é assinante.
-- ============================================================

insert into public.crm_etapas (pipeline, etapa, ordem, titulo, cor) values
  ('upgrade_pro', 'dia1',        1, 'Dia 1 · Oi, tudo bem?',        '#F5B800'),
  ('upgrade_pro', 'dia2',        2, 'Dia 2 · Oi de novo',           '#F5B800'),
  ('upgrade_pro', 'dia3',        3, 'Dia 3 · Oi e apagar',          '#F5B800'),
  ('upgrade_pro', 'ligar',       4, 'Dia 4 · Ligar',                '#F5B800'),
  ('upgrade_pro', 'renovou',     5, '✅ Fez upgrade',                '#3DD68C'),
  ('upgrade_pro', 'nao_renovou', 6, '✖ Não fez upgrade',            '#F2465A'),
  ('upgrade_pro', 'duvida',      7, '🤔 Na dúvida',                  '#b9b3a6')
on conflict (pipeline, etapa) do update set ordem = excluded.ordem, titulo = excluded.titulo, cor = excluded.cor;

-- Assinante de hoje (paga, não é cortesia/demo) e ainda não é Pro.
create or replace function public._crm_assinante_sem_pro(p_user uuid)
returns boolean
language sql stable security definer set search_path to 'public' as $$
  select exists (
    select 1 from public.profiles p
     where p.user_id = p_user
       and not coalesce(p.billing_exempt, false) and not coalesce(p.is_demo, false)
       and (p.plan_status = 'active'
            or exists (select 1 from public.subscriptions s
                        where s.user_id = p.user_id and s.status = 'active'
                          and coalesce(s.grace_until, s.current_period_end) >= now()))
  ) and not public.orbis_pro_ativo(p_user);
$$;
revoke all on function public._crm_assinante_sem_pro(uuid) from public, anon, authenticated;

-- Entra quem é assinante e nunca teve cartão nesta esteira (campanha: quem saiu não volta).
-- Quem virou Pro com cartão aberto vai pra "Fez upgrade" (ganho).
create or replace function public.crm_sync_upgrade()
returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare v_novos int := 0; v_pro int := 0;
begin
  if not public.is_orbis_crm() then raise exception 'apenas admin ou comercial'; end if;

  with novos as (
    insert into public.crm_cartoes (pipeline, etapa, user_id, ref, criado_em, etapa_desde)
    select 'upgrade_pro', 'dia1', p.user_id, nullif(p.origem_ref, ''), now(), now()
      from public.profiles p
     where public._crm_assinante_sem_pro(p.user_id)
       and not exists (select 1 from public.crm_cartoes c where c.pipeline = 'upgrade_pro' and c.user_id = p.user_id)
    returning 1
  ) select count(*) into v_novos from novos;

  with pro as (
    update public.crm_cartoes c
       set etapa = 'renovou', status = 'ganho', etapa_desde = now(),
           fechado_em = coalesce(c.fechado_em, now()), atualizado_em = now()
     where c.pipeline = 'upgrade_pro' and c.status = 'aberto' and c.user_id is not null
       and public.orbis_pro_ativo(c.user_id)
    returning 1
  ) select count(*) into v_pro from pro;

  return jsonb_build_object('upgrade_novos', v_novos, 'upgrade_viraram_pro', v_pro);
end $$;
revoke all on function public.crm_sync_upgrade() from public, anon;
grant execute on function public.crm_sync_upgrade() to authenticated;

-- crm_funil: na esteira de upgrade, cada cartão leva quanto a pessoa faz (mês atual,
-- mês passado, média por dia trabalhado, dias usados em 30) e desde quando assina.
create or replace function public.crm_funil(p_pipeline text)
returns jsonb
language plpgsql security definer set search_path to 'public' as $function$
declare
  hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  ini_mes date := date_trunc('month', hoje)::date;
  resultado jsonb;
begin
  if not public.is_orbis_crm() then
    raise exception 'apenas admin';
  end if;

  select jsonb_build_object(
    'etapas', (select coalesce(jsonb_agg(jsonb_build_object(
                 'etapa', e.etapa, 'ordem', e.ordem, 'titulo', e.titulo, 'cor', e.cor)
                 order by e.ordem), '[]'::jsonb)
               from crm_etapas e where e.pipeline = p_pipeline),
    'tarefas', (select coalesce(jsonb_agg(jsonb_build_object(
                 'id', t.id, 'etapa', t.etapa, 'ordem', t.ordem, 'titulo', t.titulo)
                 order by t.etapa, t.ordem), '[]'::jsonb)
                from crm_tarefas_modelo t where t.pipeline = p_pipeline),
    'cartoes', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', c.id, 'user_id', c.user_id,
        'etapa', c.etapa,
        'status', c.status,
        'ref', c.ref,
        'parceiro', pa.nome,
        'parceiro_tipo', pa.tipo,
        'nome', coalesce(pr.nickname, l.nome, pr.email, l.email, '—'),
        'email', coalesce(pr.email, l.email),
        'whatsapp', coalesce(pr.phone, l.whatsapp),
        'cidade', nullif(trim(coalesce(pr.city,'') || case when coalesce(pr.state,'')<>'' then '/'||pr.state else '' end), ''),
        'dia_do_teste', case when c.pipeline = 'trial' and pr.trial_start is not null
                             then greatest(1, (hoje - pr.trial_start) + 1) end,
        'dias_na_etapa', greatest(0, (hoje - (c.etapa_desde at time zone 'America/Sao_Paulo')::date)),
        'trial_end', pr.trial_end,
        'period_end', (select to_char(s.current_period_end at time zone 'America/Sao_Paulo','YYYY-MM-DD')
                         from subscriptions s where s.user_id = c.user_id limit 1),
        'notas', c.notas,
        'criado_em', to_char(c.criado_em at time zone 'America/Sao_Paulo','DD/MM'),
        'fechado_em', to_char(c.fechado_em at time zone 'America/Sao_Paulo','DD/MM'),
        'feitas', (select coalesce(jsonb_agg(f.tarefa_id), '[]'::jsonb)
                    from crm_tarefas_feitas f
                   where f.cartao_id = c.id
                     and (c.pipeline <> 'relacionamento'
                          or date_trunc('month', f.feito_em at time zone 'America/Sao_Paulo')
                             = date_trunc('month', hoje::timestamp))),
        'faz', case when c.pipeline = 'upgrade_pro' then (
            select jsonb_build_object(
              'mes', coalesce(sum(coalesce(d.total_profit,0) + coalesce(d.total_debt,0)) filter (where d.date >= ini_mes), 0),
              'mes_passado', coalesce(sum(coalesce(d.total_profit,0) + coalesce(d.total_debt,0))
                               filter (where d.date >= (ini_mes - interval '1 month')::date and d.date < ini_mes), 0),
              'dias_30', count(distinct d.date) filter (where d.date > hoje - 30
                               and coalesce(d.total_profit,0) + coalesce(d.total_debt,0) > 0),
              'media_dia', round(coalesce(avg(coalesce(d.total_profit,0) + coalesce(d.total_debt,0))
                               filter (where d.date > hoje - 30 and coalesce(d.total_profit,0) + coalesce(d.total_debt,0) > 0), 0), 2),
              'assina_desde', (select to_char(min(s.created_at) at time zone 'America/Sao_Paulo','DD/MM/YYYY')
                                 from subscriptions s where s.user_id = c.user_id))
              from daily_sales d
             where d.user_id = c.user_id and d.date >= (ini_mes - interval '1 month')::date)
          end
      ) order by c.atualizado_em desc), '[]'::jsonb)
      from crm_cartoes c
      left join profiles pr on pr.user_id = c.user_id
      left join leads l on l.id = c.lead_id
      left join parceiros pa on pa.code = c.ref
      where c.pipeline = p_pipeline
        and (c.status = 'aberto' or c.fechado_em > now() - interval '30 days'))
  ) into resultado;

  return resultado;
end $function$;
