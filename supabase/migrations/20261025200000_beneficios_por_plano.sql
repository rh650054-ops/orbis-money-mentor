-- ============================================================
-- BENEFÍCIOS POR PLANO (Rick, 25/10/2026 — caderno dos planos)
--
-- Essencial (R$ 29,90): Foco manual, Ranking, Relatório, Gestão manual, Comunidade.
-- Pro (R$ 49,90): + Foco automático, Verificado, 1 banco, Mentor IA limitado, Gestão
--   automática, Caça-Sinal, Produtos/mercadoria, Diária definida (meta adaptativa), X1.
-- Pro anual: tudo do Pro + 2 bancos + Mentor IA completo.
--
-- 1) vant_recursos_pro(u): quem usa os recursos do Pro = Pro (ou banco avulso, como hoje),
--    teste grátis valendo, equipe/cortesia (billing_exempt), conta de revisão (is_demo), admin.
--    O banco avulso do Essencial continua liberando tudo (decisão pendente do Rick).
-- 2) vant_plano(u): o nome do plano pra tela e pro limite do Mentor.
-- 3) Mentor IA por plano (mensagens/dia, ai_limites): teste 10, Essencial 10, Pro 40, anual 80.
--    Equipe/cortesia e conta de revisão = anual. Admin segue ilimitado.
--    bump_ai_usage('chat', ...) passa a usar o limite do plano (o número que a função de chat
--    manda é ignorado no chat), então não precisa publicar a função de novo.
-- 4) Caça-Sinal: caca_sinais_quentes só responde pra quem tem recursos do Pro. O "seu ponto de
--    hoje" do DEFCON (caca_sinais_proximos_nome, caca_sinal_meus) continua pra todos: é como
--    o vendedor marca o próprio ponto.
-- 5) Meta adaptativa (Diária definida): só liga com recursos do Pro; quem perde o Pro volta
--    pra meta do planejamento sozinho.
-- 6) X1: criar, aceitar e entrar em sala exige recursos do Pro (antes só a tela travava),
--    e não dá pra desafiar quem não tem o Pro.
-- 7) Finanças: Essencial cria até 5 contas abertas e 2 objetivos ativos.
-- Nada é apagado.
-- ============================================================

create or replace function public.vant_recursos_pro(p_user uuid default null)
returns boolean language sql stable security definer set search_path to 'public' as $$
  with u as (select coalesce(p_user, auth.uid()) as id)
  select (select id from u) is not null and (
    public.orbis_pro_ativo((select id from u))
    or public.orbis_is_admin_user((select id from u))
    or exists (
      select 1 from public.profiles p
       where p.user_id = (select id from u)
         and (coalesce(p.billing_exempt, false) or coalesce(p.is_demo, false)
              or (coalesce(p.is_trial_active, false) and p.trial_end >= (now() at time zone 'America/Sao_Paulo')::date))
    ));
$$;
revoke all on function public.vant_recursos_pro(uuid) from public, anon;
grant execute on function public.vant_recursos_pro(uuid) to authenticated, service_role;

create or replace function public.vant_plano(p_user uuid default null)
returns text language sql stable security definer set search_path to 'public' as $$
  with u as (select coalesce(p_user, auth.uid()) as id),
  p as (select * from public.profiles where user_id = (select id from u))
  select case
    when (select id from u) is null then 'sem_plano'
    when coalesce((select billing_exempt from p), false) or coalesce((select is_demo from p), false) then 'equipe'
    when public.pro_anual((select id from u)) then 'pro_anual'
    when public.vant_pro_pleno((select id from u)) then 'pro'
    when public.orbis_pro_ativo((select id from u)) then 'essencial_banco'
    when (select plan_status from p) = 'active' then 'essencial'
    when coalesce((select is_trial_active from p), false)
         and (select trial_end from p) >= (now() at time zone 'America/Sao_Paulo')::date then 'teste'
    else 'sem_plano' end;
$$;
revoke all on function public.vant_plano(uuid) from public, anon;
grant execute on function public.vant_plano(uuid) to authenticated, service_role;

-- limites do Mentor por plano (UPDATE em ai_limites muda na hora)
insert into public.ai_limites (chave, valor, descricao) values
  ('chat_limite_essencial', 10, 'Mensagens por dia no Mentor IA, plano Essencial (25/10/2026).'),
  ('chat_limite_pro', 40, 'Mensagens por dia no Mentor IA, Pro mensal (25/10/2026).'),
  ('chat_limite_anual', 80, 'Mensagens por dia no Mentor IA, Pro anual, equipe e conta de revisão (25/10/2026).')
on conflict (chave) do nothing;
update public.ai_limites set valor = 10, descricao = 'Mensagens por dia no Mentor IA, teste grátis (25/10/2026: era 25).', atualizado_em = now()
 where chave = 'chat_limite_trial';

create or replace function public.mentor_limite_dia(p_user uuid default null)
returns integer language sql stable security definer set search_path to 'public' as $$
  select coalesce((select valor::int from public.ai_limites where chave = case public.vant_plano(p_user)
            when 'pro_anual' then 'chat_limite_anual'
            when 'equipe' then 'chat_limite_anual'
            when 'pro' then 'chat_limite_pro'
            when 'essencial_banco' then 'chat_limite_essencial'
            when 'essencial' then 'chat_limite_essencial'
            else 'chat_limite_trial' end), 10);
$$;
revoke all on function public.mentor_limite_dia(uuid) from public, anon;
grant execute on function public.mentor_limite_dia(uuid) to authenticated, service_role;

create or replace function public.bump_ai_usage(p_feature text, p_limit integer)
returns jsonb language plpgsql security definer set search_path to 'public' as $function$
declare
  d date := (now() at time zone 'America/Sao_Paulo')::date;
  c int;
  lim int := p_limit;
begin
  if auth.uid() is null then
    return jsonb_build_object('over', false, 'count', 0);
  end if;
  -- Admins do app (Mohamed, Rick, Yan): uso ILIMITADO.
  if public.orbis_is_admin_user(auth.uid()) then
    return jsonb_build_object('over', false, 'count', 0, 'admin', true);
  end if;
  -- 25/10: o Mentor (chat) segue o limite do plano
  if p_feature = 'chat' then lim := public.mentor_limite_dia(auth.uid()); end if;
  insert into public.ai_usage (user_id, dia, feature, count)
  values (auth.uid(), d, p_feature, 1)
  on conflict (user_id, dia, feature) do update set count = ai_usage.count + 1, updated_at = now()
  returning count into c;
  return jsonb_build_object('over', c > lim, 'count', c, 'limite', lim);
end;
$function$;

-- o app: plano, recursos e Mentor de hoje numa leitura só
create or replace function public.vant_acesso()
returns jsonb language sql stable security definer set search_path to 'public' as $$
  select jsonb_build_object(
    'plano', public.vant_plano(auth.uid()),
    'recursos_pro', public.vant_recursos_pro(auth.uid()),
    'mentor_limite', public.mentor_limite_dia(auth.uid()),
    'mentor_hoje', coalesce((select count from public.ai_usage where user_id = auth.uid() and feature = 'chat'
                              and dia = (now() at time zone 'America/Sao_Paulo')::date), 0)
  ) where auth.uid() is not null;
$$;
revoke all on function public.vant_acesso() from public, anon;
grant execute on function public.vant_acesso() to authenticated;

-- 4) Caça-Sinal: a busca dos sinais quentes é do Pro
do $$ begin
  if not exists (select 1 from pg_proc where proname = 'caca_sinais_quentes_todos' and pronamespace = 'public'::regnamespace) then
    alter function public.caca_sinais_quentes(double precision, double precision, double precision) rename to caca_sinais_quentes_todos;
  end if;
end $$;
revoke all on function public.caca_sinais_quentes_todos(double precision, double precision, double precision) from public, anon, authenticated;
grant execute on function public.caca_sinais_quentes_todos(double precision, double precision, double precision) to service_role;

create or replace function public.caca_sinais_quentes(p_lat double precision, p_lng double precision, p_raio_km double precision default 5)
returns table(osm_id bigint, lat double precision, lng double precision, vias text, distancia_km numeric, densidade integer,
              vendedores integer, sessoes integer, total numeric, minutos integer, rs_hora numeric, horas integer[],
              bom integer, medio integer, ruim integer, duracao text, duracao_votos integer, score numeric)
language sql stable security definer set search_path to 'public' as $$
  select * from public.caca_sinais_quentes_todos(p_lat, p_lng, p_raio_km)
   where public.vant_recursos_pro(auth.uid());
$$;
revoke all on function public.caca_sinais_quentes(double precision, double precision, double precision) from public, anon;
grant execute on function public.caca_sinais_quentes(double precision, double precision, double precision) to authenticated, service_role;

-- 5) meta adaptativa só com recursos do Pro
-- quem perdeu o Pro com a adaptativa ligada volta pra meta do planejamento (sem apagar a escolha)
do $$
declare d text := pg_get_functiondef('public.vant_meta_calcular(uuid,date)'::regprocedure); n text;
begin
  if position('vant_recursos_pro(p_user)' in d) = 0 then
    n := replace(d, 'if v_meta_mensal is null then return null; end if;',
      'if v_meta_mensal is null then return null; end if;
  if v_adaptativa and not public.vant_recursos_pro(p_user) then v_adaptativa := false; end if;  -- 25/10: adaptativa é do Pro');
    if n = d then raise exception 'vant_meta_calcular: trecho não encontrado'; end if;
    execute n;
  end if;
end $$;

create or replace function public.meta_definir_modo(p_adaptativa boolean)
returns public.metas_dia language plpgsql security definer set search_path to 'public' as $$
declare
  u uuid := auth.uid();
  d date := (now() at time zone 'America/Sao_Paulo')::date;
  r public.metas_dia;
begin
  if u is null then return null; end if;
  if coalesce(p_adaptativa, false) and not public.vant_recursos_pro(u) then
    raise exception 'A meta adaptativa é do VANT Pro' using errcode = 'P0001';
  end if;
  update public.profiles set meta_adaptativa = coalesce(p_adaptativa, false) where user_id = u;
  r := public.vant_meta_calcular(u, d);
  return r;
end $$;

-- 6) X1 exige recursos do Pro de quem age (criar, aceitar, entrar em sala).
--    Rotinas do sistema (sem usuário logado: cron, admin pelo service role) passam.
create or replace function public.x1_exigir_pro()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  if auth.uid() is null then return new; end if;
  -- desafiar alguém sem Pro: o convite chegaria pra quem não pode aceitar
  if tg_table_name = 'x1_challenges' and tg_op = 'INSERT' and new.opponent_id is not null
     and not public.vant_recursos_pro(new.opponent_id) then
    raise exception 'Esse vendedor ainda não tem o VANT Pro, então não pode entrar no X1' using errcode = 'P0001';
  end if;
  if public.vant_recursos_pro(auth.uid()) then return new; end if;
  if tg_op = 'INSERT'
     or (tg_table_name = 'x1_challenges' and old.status in ('pending', 'open')
         and new.status in ('accepted', 'active') and auth.uid() = new.opponent_id) then
    raise exception 'O X1 é do VANT Pro' using errcode = 'P0001';
  end if;
  return new;
end $$;

drop trigger if exists trg_x1_challenges_pro on public.x1_challenges;
create trigger trg_x1_challenges_pro before insert or update on public.x1_challenges
  for each row execute function public.x1_exigir_pro();
drop trigger if exists trg_x1_salas_pro on public.x1_salas;
create trigger trg_x1_salas_pro before insert on public.x1_salas
  for each row execute function public.x1_exigir_pro();
drop trigger if exists trg_x1_sala_participantes_pro on public.x1_sala_participantes;
create trigger trg_x1_sala_participantes_pro before insert on public.x1_sala_participantes
  for each row execute function public.x1_exigir_pro();

-- 7) Finanças no Essencial (mockup aprovado 25/10): até 5 contas abertas e 2 objetivos
--    ativos. Só barra CRIAR além do limite; quem já tinha mais fica com o que tem.
--    Recursos do Pro (Pro, teste, equipe) = sem limite. Rotinas do sistema passam.
create or replace function public.financas_limite_essencial()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare n int;
begin
  if auth.uid() is null or public.vant_recursos_pro(new.user_id) then return new; end if;
  if tg_table_name = 'planned_bills' then
    select count(*) into n from public.planned_bills where user_id = new.user_id and not coalesce(paid, false);
    if n >= 5 then
      raise exception 'No Essencial são até 5 contas. No VANT Pro é sem limite.' using errcode = 'P0001';
    end if;
  elsif tg_table_name = 'financial_goals' then
    select count(*) into n from public.financial_goals where user_id = new.user_id and coalesce(status, 'active') <> 'completed';
    if n >= 2 then
      raise exception 'No Essencial são até 2 objetivos. No VANT Pro é sem limite.' using errcode = 'P0001';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_planned_bills_limite on public.planned_bills;
create trigger trg_planned_bills_limite before insert on public.planned_bills
  for each row execute function public.financas_limite_essencial();
drop trigger if exists trg_financial_goals_limite on public.financial_goals;
create trigger trg_financial_goals_limite before insert on public.financial_goals
  for each row execute function public.financas_limite_essencial();
