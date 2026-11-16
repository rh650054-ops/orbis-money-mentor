-- ============================================================
-- CRM: ESTEIRA "TRIAL QUE NÃO ASSINOU" (Rick, 16/11/2026)
-- "Criar uma nova lista no CRM de todos os leads que já passaram pelo trial e não assinaram
--  a VANT, dividir esses leads igual para o Yan e para o Paulo."
--
-- Who enters: the trial already ended, never paid (no subscription, no Hotmart purchase or
-- subscription on record), not a courtesy/demo account, not on the sales team, not Pro.
-- Same cadence as Upgrade Pro: Dia 1/2/3 message, Dia 4 call, then Assinou / Não assinou / Na dúvida.
-- Split: equal parts between the active closers (crm_equipe.closer), in random order, so each
-- one gets the same mix of recent and old trials.
-- Nothing is removed from the other lists: the Trial cards of these people are already closed
-- ("Não renovou", status perdido) and stay as they are.
-- ============================================================

insert into public.crm_etapas (pipeline, etapa, ordem, titulo, cor) values
  ('resgate_trial', 'dia1',        1, 'Dia 1 · Oi, tudo bem?', '#F5B800'),
  ('resgate_trial', 'dia2',        2, 'Dia 2 · Oi de novo',    '#F5B800'),
  ('resgate_trial', 'dia3',        3, 'Dia 3 · Oi e apagar',   '#F5B800'),
  ('resgate_trial', 'ligar',       4, 'Dia 4 · Ligar',         '#F5B800'),
  ('resgate_trial', 'assinou',     5, '✅ Assinou',             '#3DD68C'),
  ('resgate_trial', 'nao_assinou', 6, '✖ Não assinou',         '#F2465A'),
  ('resgate_trial', 'duvida',      7, '🤔 Na dúvida',           '#b9b3a6')
on conflict (pipeline, etapa) do update set ordem = excluded.ordem, titulo = excluded.titulo, cor = excluded.cor;

-- trial over and never paid anything
create or replace function public._crm_trial_sem_assinar(p_user uuid)
returns boolean
language sql stable security definer set search_path to 'public' as $$
  select exists (
    select 1 from public.profiles p
     where p.user_id = p_user
       and not coalesce(p.billing_exempt, false) and not coalesce(p.is_demo, false)
       and p.trial_end < now()
       and coalesce(p.plan_status, '') <> 'active'
       and not exists (select 1 from public.subscriptions s where s.user_id = p.user_id)
       and not exists (select 1 from public._crm_compras_hotmart h where h.user_id = p.user_id)
       and not exists (select 1 from public.orbis_hotmart_assinatura a where a.user_id = p.user_id)
       and not exists (select 1 from public.crm_equipe e where e.user_id = p.user_id)
  ) and not public.orbis_pro_ativo(p_user);
$$;
revoke all on function public._crm_trial_sem_assinar(uuid) from public, anon, authenticated;

-- One-off load (run from the SQL editor, not callable by the app): everyone who qualifies and
-- has no card in this list yet, split in equal parts between the active closers.
create or replace function public.crm_resgate_carregar()
returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare v_closers uuid[]; v_n int; v_por jsonb;
begin
  select array_agg(e.user_id order by e.user_id) into v_closers from public.crm_equipe e where e.closer and e.ativo;
  v_n := coalesce(array_length(v_closers, 1), 0);
  if v_n = 0 then raise exception 'nenhum closer ativo em crm_equipe'; end if;

  with cand as (
    select p.user_id, nullif(p.origem_ref, '') as ref, row_number() over (order by random()) as rn
      from public.profiles p
     where public._crm_trial_sem_assinar(p.user_id)
       and not exists (select 1 from public.crm_cartoes c where c.pipeline = 'resgate_trial' and c.user_id = p.user_id)
  ),
  novos as (
    insert into public.crm_cartoes (pipeline, etapa, status, user_id, ref, criado_em, etapa_desde, responsavel, responsavel_em)
    select 'resgate_trial', 'dia1', 'aberto', c.user_id, c.ref, now(), now(), v_closers[1 + ((c.rn - 1) % v_n)], now()
      from cand c
    returning responsavel
  )
  select coalesce(jsonb_object_agg(coalesce(split_part(btrim(pr.nickname), ' ', 1), x.responsavel::text), x.n), '{}'::jsonb) into v_por
    from (select responsavel, count(*) as n from novos group by 1) x
    left join public.profiles pr on pr.user_id = x.responsavel;
  return v_por;
end $$;
revoke all on function public.crm_resgate_carregar() from public, anon, authenticated;

-- On every CRM load: whoever subscribed (or became Pro) leaves the open columns and goes to "Assinou".
create or replace function public.crm_sync_resgate()
returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare v_assinou int := 0;
begin
  if not public.is_orbis_crm() then raise exception 'apenas admin ou comercial'; end if;
  with x as (
    update public.crm_cartoes c
       set etapa = 'assinou', status = 'ganho', etapa_desde = now(),
           fechado_em = coalesce(c.fechado_em, now()), atualizado_em = now()
     where c.pipeline = 'resgate_trial' and c.status = 'aberto' and c.user_id is not null
       and not public._crm_trial_sem_assinar(c.user_id)
       and exists (select 1 from public.profiles p where p.user_id = c.user_id
                    and (p.plan_status = 'active' or public.orbis_pro_ativo(c.user_id)
                         or exists (select 1 from public.subscriptions s where s.user_id = c.user_id and s.status = 'active')))
    returning 1
  ) select count(*) into v_assinou from x;
  return jsonb_build_object('resgate_assinaram', v_assinou);
end $$;
revoke all on function public.crm_sync_resgate() from public, anon;
grant execute on function public.crm_sync_resgate() to authenticated;
