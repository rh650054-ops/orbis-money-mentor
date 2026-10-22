-- CRM com time (22/10/2026): Rayane (suporte do teste + sucesso do cliente),
-- Paulo e Yan (closers). Cada ficha passa a ter UM dono e uma fase:
--   suporte -> closer (rodízio entre os closers) -> sucesso (volta pro suporte).
-- Quem mandou cada mensagem já fica em crm_conversas.por; aqui só ganha nome.
--
-- Nada aqui apaga ou muda dado existente: só cria colunas novas (nulas),
-- uma tabela de equipe, uma de histórico de passagem e funções novas.
-- crm_funil é recriada igual à de produção + 3 campos (dono, dono_nome, fase).

-- 1) equipe do comercial: quem é quem e quais frentes pega sem dono
create table if not exists public.crm_equipe (
  user_id    uuid primary key,
  nome       text not null,
  funcao     text not null check (funcao in ('suporte','closer')),
  -- esteiras do CRM (trial, pagante, perdido, base, upgrade) cujas fichas SEM dono
  -- aparecem na fila dessa pessoa. Ficha com dono aparece só pro dono.
  esteiras   text[] not null default '{}',
  ativo      boolean not null default true,
  criado_em  timestamptz not null default now()
);
alter table public.crm_equipe enable row level security;
drop policy if exists "crm le equipe" on public.crm_equipe;
create policy "crm le equipe" on public.crm_equipe for select using (public.is_orbis_crm());
drop policy if exists "super admin gere equipe" on public.crm_equipe;
create policy "super admin gere equipe" on public.crm_equipe for all
  using (public.is_orbis_super_admin()) with check (public.is_orbis_super_admin());

-- 2) dono e fase da ficha
alter table public.crm_cartoes
  add column if not exists dono       uuid,
  add column if not exists dono_desde timestamptz,
  add column if not exists fase       text;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'crm_cartoes_fase_valida') then
    alter table public.crm_cartoes add constraint crm_cartoes_fase_valida
      check (fase is null or fase in ('suporte','closer','sucesso'));
  end if;
end $$;
create index if not exists crm_cartoes_dono_idx on public.crm_cartoes (dono) where status = 'aberto';

-- 3) histórico de passagem (quem passou pra quem, quando e por quê)
create table if not exists public.crm_passagens (
  id         bigserial primary key,
  cartao_id  bigint not null references public.crm_cartoes(id) on delete cascade,
  de_user    uuid,
  para_user  uuid not null,
  fase       text not null check (fase in ('suporte','closer','sucesso')),
  motivo     text,
  criado_em  timestamptz not null default now()
);
create index if not exists crm_passagens_cartao_idx on public.crm_passagens (cartao_id, criado_em);
alter table public.crm_passagens enable row level security;
drop policy if exists "crm le passagens" on public.crm_passagens;
create policy "crm le passagens" on public.crm_passagens for select using (public.is_orbis_crm());
-- escrita só pelas funções abaixo (security definer)

-- 4) primeira mensagem de alguém da equipe numa ficha sem dono = essa pessoa vira dona
create or replace function public.crm_dono_na_primeira_msg()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_funcao text;
begin
  if new.de <> 'eu' or new.por is null then return new; end if;
  select funcao into v_funcao from public.crm_equipe where user_id = new.por and ativo;
  if v_funcao is null then return new; end if;   -- Rick/admin mandando não toma a ficha
  update public.crm_cartoes
     set dono = new.por, dono_desde = now(), fase = coalesce(fase, v_funcao)
   where id = new.cartao_id and dono is null;
  if found then
    insert into public.crm_passagens (cartao_id, de_user, para_user, fase, motivo)
    values (new.cartao_id, null, new.por, v_funcao, 'primeira mensagem');
  end if;
  return new;
end $$;
drop trigger if exists crm_dono_na_primeira_msg on public.crm_conversas;
create trigger crm_dono_na_primeira_msg after insert on public.crm_conversas
  for each row execute function public.crm_dono_na_primeira_msg();

-- 5) leitura da equipe pro CRM (quem sou eu + nomes pra mostrar quem mandou o quê)
create or replace function public.crm_equipe_lista()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_orbis_crm() then raise exception 'apenas admin ou comercial'; end if;
  return jsonb_build_object(
    'eu', auth.uid(),
    'equipe', coalesce((select jsonb_agg(jsonb_build_object(
        'user_id', e.user_id, 'nome', e.nome, 'funcao', e.funcao,
        'esteiras', to_jsonb(e.esteiras), 'ativo', e.ativo) order by e.nome)
      from public.crm_equipe e), '[]'::jsonb),
    -- admins aparecem pelo apelido nas mensagens (Rick)
    'nomes', coalesce((select jsonb_object_agg(p.user_id, split_part(coalesce(p.nickname, ''), ' ', 1))
      from public.profiles p
      where p.user_id in (select distinct por from public.crm_conversas where por is not null
                            and criado_em > now() - interval '120 days')), '{}'::jsonb));
end $$;

-- 6) assumir uma ficha (sem dono, ou o admin redistribuindo)
create or replace function public.crm_assumir(p_cartao bigint)
returns jsonb language plpgsql security definer set search_path = public as $$
declare c public.crm_cartoes; v_funcao text;
begin
  if not public.is_orbis_crm() then raise exception 'apenas admin ou comercial'; end if;
  select * into c from public.crm_cartoes where id = p_cartao for update;
  if not found then raise exception 'cartão não existe'; end if;
  if c.dono is not null and c.dono <> auth.uid() and not public.is_orbis_dono() then
    raise exception 'essa ficha já tem dono';
  end if;
  select funcao into v_funcao from public.crm_equipe where user_id = auth.uid() and ativo;
  update public.crm_cartoes set dono = auth.uid(), dono_desde = now(),
         fase = coalesce(v_funcao, fase), atualizado_em = now()
   where id = p_cartao;
  insert into public.crm_passagens (cartao_id, de_user, para_user, fase, motivo)
  values (p_cartao, c.dono, auth.uid(), coalesce(v_funcao, c.fase, 'suporte'), 'assumiu');
  return jsonb_build_object('dono', auth.uid(), 'fase', coalesce(v_funcao, c.fase));
end $$;

-- 7) passar a ficha: pro closer (rodízio) ou de volta pro sucesso do cliente
--    p_para = 'closer'  -> closer ativo que recebeu passagem há mais tempo (alterna Paulo/Yan)
--    p_para = 'sucesso' -> o suporte que passou a ficha pro closer; se saiu, o suporte ativo com menos fichas
--    p_user  opcional: o admin escolhe a pessoa na mão
create or replace function public.crm_passar(p_cartao bigint, p_para text, p_motivo text default null, p_user uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare c public.crm_cartoes; v_para uuid; v_nome text;
begin
  if not public.is_orbis_crm() then raise exception 'apenas admin ou comercial'; end if;
  if p_para not in ('closer','sucesso') then raise exception 'p_para deve ser closer ou sucesso'; end if;
  select * into c from public.crm_cartoes where id = p_cartao for update;
  if not found then raise exception 'cartão não existe'; end if;
  if c.dono is not null and c.dono <> auth.uid() and not public.is_orbis_dono() then
    raise exception 'só o dono da ficha (ou o admin) passa ela adiante';
  end if;

  if p_user is not null then
    if not public.is_orbis_dono() then raise exception 'só o admin escolhe a pessoa'; end if;
    v_para := p_user;
  elsif p_para = 'closer' then
    select e.user_id into v_para from public.crm_equipe e
     where e.ativo and e.funcao = 'closer'
     order by (select max(x.criado_em) from public.crm_passagens x
                where x.para_user = e.user_id and x.fase = 'closer') asc nulls first, e.nome
     limit 1;
  else
    select x.de_user into v_para from public.crm_passagens x
      join public.crm_equipe e on e.user_id = x.de_user and e.ativo and e.funcao = 'suporte'
     where x.cartao_id = p_cartao and x.fase = 'closer'
     order by x.criado_em desc limit 1;
    if v_para is null then
      select e.user_id into v_para from public.crm_equipe e
       where e.ativo and e.funcao = 'suporte'
       order by (select count(*) from public.crm_cartoes k
                  where k.dono = e.user_id and k.status = 'aberto') asc, e.nome
       limit 1;
    end if;
  end if;
  if v_para is null then raise exception 'ninguém ativo na equipe pra receber (%).', p_para; end if;

  update public.crm_cartoes set dono = v_para, dono_desde = now(), fase = p_para, atualizado_em = now()
   where id = p_cartao;
  insert into public.crm_passagens (cartao_id, de_user, para_user, fase, motivo)
  values (p_cartao, coalesce(c.dono, auth.uid()), v_para, p_para, nullif(trim(coalesce(p_motivo,'')), ''));
  select nome into v_nome from public.crm_equipe where user_id = v_para;
  return jsonb_build_object('dono', v_para, 'dono_nome', v_nome, 'fase', p_para);
end $$;

-- 8) liberar alguém no CRM como comercial (só super admin): admin_access + crm_equipe numa tacada.
--    A pessoa precisa ter criado a conta no app ANTES (o CPF do perfil é a chave).
--    role 'demo' = entra no app sem paywall, mas sem o card de Administração do app.
create or replace function public.crm_liberar_time(p_user uuid, p_funcao text, p_esteiras text[] default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_cpf text; v_nome text; v_est text[];
begin
  if not public.is_orbis_super_admin() then raise exception 'apenas super admin'; end if;
  if p_funcao not in ('suporte','closer') then raise exception 'função deve ser suporte ou closer'; end if;
  select regexp_replace(coalesce(cpf,''),'\D','','g'), split_part(coalesce(nickname, email, 'Comercial'),' ',1)
    into v_cpf, v_nome from public.profiles where user_id = p_user;
  if coalesce(length(v_cpf),0) <> 11 then raise exception 'essa conta não tem CPF completo no perfil'; end if;
  v_est := coalesce(p_esteiras, case when p_funcao = 'suporte' then array['trial','pagante'] else '{}'::text[] end);

  insert into public.admin_access (cpf, role, papel, enabled, user_id, notes)
  values (v_cpf, 'demo', 'comercial', true, p_user, 'CRM comercial · ' || p_funcao)
  on conflict (cpf) do update set enabled = true, user_id = excluded.user_id,
     -- nunca rebaixa quem já é admin
     papel = case when public.admin_access.papel = 'admin' then 'admin' else 'comercial' end;

  insert into public.crm_equipe (user_id, nome, funcao, esteiras, ativo)
  values (p_user, v_nome, p_funcao, v_est, true)
  on conflict (user_id) do update set funcao = excluded.funcao, esteiras = excluded.esteiras, ativo = true;
  return jsonb_build_object('nome', v_nome, 'funcao', p_funcao, 'esteiras', to_jsonb(v_est));
end $$;

revoke all on function public.crm_equipe_lista()                         from public, anon;
revoke all on function public.crm_assumir(bigint)                        from public, anon;
revoke all on function public.crm_passar(bigint, text, text, uuid)       from public, anon;
revoke all on function public.crm_liberar_time(uuid, text, text[])       from public, anon;
grant execute on function public.crm_equipe_lista()                      to authenticated;
grant execute on function public.crm_assumir(bigint)                     to authenticated;
grant execute on function public.crm_passar(bigint, text, text, uuid)    to authenticated;
grant execute on function public.crm_liberar_time(uuid, text, text[])    to authenticated;

-- 9) crm_funil: igual à de produção (lida em 22/10) + dono, dono_nome e fase em cada cartão
create or replace function public.crm_funil(p_pipeline text)
returns jsonb language plpgsql security definer set search_path to 'public' as $function$
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
        'dono', c.dono,
        'dono_nome', eq.nome,
        'fase', c.fase,
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
      left join crm_equipe eq on eq.user_id = c.dono
      where c.pipeline = p_pipeline
        and (c.status = 'aberto' or c.fechado_em > now() - interval '30 days'))
  ) into resultado;

  return resultado;
end $function$;
