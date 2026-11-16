-- ============================================================
-- CRM: META DA LISTA "TRIAL QUE NÃO ASSINOU" (Rick, 16/11/2026)
-- "Mensure as metas e coloque no CRM deles a meta e quantos eles estão chamando por dia,
--  cada um separado. Yan 70 leads por dia, Paulo 60. A meta vai ser 10 dias. Preciso que o
--  CRM me mostre o que estão fazendo."
--
-- "Chamou um lead" = the closer did something with one of his cards in this list that day:
-- moved it to another column (each column is a message sent / a call made) or recorded an
-- activity, note or result on it. Each lead counts once per day, however many things were done.
-- Automatic moves (whoever subscribed goes to "Assinou" on its own) never count.
--
-- The goal (start, number of days, leads per day per person) lives in crm_ajustes
-- ('meta_resgate'), so it can be changed without a deploy.
-- ============================================================

create table if not exists public.crm_contatos (
  id bigserial primary key,
  cartao_id bigint not null references public.crm_cartoes(id) on delete cascade,
  pipeline text not null,
  por uuid not null,
  acao text not null,
  em timestamptz not null default now()
);
create index if not exists crm_contatos_pipeline_por_em on public.crm_contatos (pipeline, por, em);
alter table public.crm_contatos enable row level security;  -- read only through crm_resgate_metas
revoke all on public.crm_contatos from anon, authenticated;

-- a move made by a person (not by the sync)
create or replace function public.crm_contato_do_cartao()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or coalesce(current_setting('crm.automatico', true), '') = '1' then return new; end if;
  insert into public.crm_contatos (cartao_id, pipeline, por, acao)
  values (new.id, new.pipeline, auth.uid(), 'mover:' || coalesce(old.etapa, '') || '>' || coalesce(new.etapa, ''));
  return new;
end $$;
drop trigger if exists crm_contato_do_cartao on public.crm_cartoes;
create trigger crm_contato_do_cartao after update of etapa, status on public.crm_cartoes
  for each row when (new.pipeline = 'resgate_trial'
                     and (old.etapa is distinct from new.etapa or old.status is distinct from new.status))
  execute function public.crm_contato_do_cartao();

-- an activity, note or result recorded on the card
create or replace function public.crm_contato_do_estado()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_pipe text; v_por uuid := coalesce(auth.uid(), new.por);
begin
  if v_por is null then return new; end if;
  select c.pipeline into v_pipe from public.crm_cartoes c where c.id = new.cartao_id;
  if v_pipe is distinct from 'resgate_trial' then return new; end if;
  insert into public.crm_contatos (cartao_id, pipeline, por, acao) values (new.cartao_id, v_pipe, v_por, 'atividade');
  return new;
end $$;
drop trigger if exists crm_contato_do_estado on public.crm_estado;
create trigger crm_contato_do_estado after insert or update on public.crm_estado
  for each row execute function public.crm_contato_do_estado();

-- the sync's own moves are not contacts
create or replace function public.crm_sync_resgate()
returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare v_assinou int := 0;
begin
  if not public.is_orbis_crm() then raise exception 'apenas admin ou comercial'; end if;
  perform set_config('crm.automatico', '1', true);
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
  perform set_config('crm.automatico', '', true);
  return jsonb_build_object('resgate_assinaram', v_assinou);
end $$;
revoke all on function public.crm_sync_resgate() from public, anon;
grant execute on function public.crm_sync_resgate() to authenticated;

-- the goal panel: for each closer, leads called per day of the campaign vs the goal
create or replace function public.crm_resgate_metas()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  cfg jsonb := (select a.valor from public.crm_ajustes a where a.chave = 'meta_resgate');
  hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_ini date; v_dias int;
begin
  if not public.is_orbis_crm() then raise exception 'apenas admin ou comercial'; end if;
  if cfg is null then return null; end if;
  v_ini := (cfg->>'inicio')::date;
  v_dias := greatest(1, coalesce((cfg->>'dias')::int, 10));
  return jsonb_build_object(
    'inicio', v_ini, 'dias', v_dias, 'hoje', hoje,
    'pessoas', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'user_id', m.key::uuid,
        'nome', split_part(btrim(coalesce(pr.nickname, '')), ' ', 1),
        'meta', (m.value)::int,
        'leads', (select count(*) from public.crm_cartoes c where c.pipeline = 'resgate_trial' and c.responsavel = m.key::uuid),
        'abertos', (select count(*) from public.crm_cartoes c where c.pipeline = 'resgate_trial' and c.responsavel = m.key::uuid and c.status = 'aberto'),
        'assinaram', (select count(*) from public.crm_cartoes c where c.pipeline = 'resgate_trial' and c.responsavel = m.key::uuid and c.etapa = 'assinou'),
        'por_dia', (
          select jsonb_agg(jsonb_build_object('d', d::date, 'n', (
                   select count(distinct k.cartao_id) from public.crm_contatos k
                    where k.pipeline = 'resgate_trial' and k.por = m.key::uuid
                      and (k.em at time zone 'America/Sao_Paulo')::date = d::date)) order by d)
            from generate_series(v_ini, v_ini + v_dias - 1, interval '1 day') d)
      ) order by (m.value)::int desc), '[]'::jsonb)
      from jsonb_each_text(coalesce(cfg->'metas', '{}'::jsonb)) m
      left join public.profiles pr on pr.user_id = m.key::uuid));
end $$;
revoke all on function public.crm_resgate_metas() from public, anon;
grant execute on function public.crm_resgate_metas() to authenticated;
