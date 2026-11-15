-- Open Finance V2 · Module A (connections and consent) · A-PR3: states calculated in parallel.
--
-- ADDITIVE ONLY, AND ONLY FUNCTIONS. This file creates seven functions and nothing else: no table,
-- no column, no index, no trigger, no policy, no cron. It alters nothing that already exists.
--
-- What it is for. Since A-PR2 the webhook records every provider event in of_eventos, with the
-- state of the Item it consulted. A-PR3 reads those records and keeps, in the records A-PR1
-- created, the CONSENT state of each link (of_consentimentos) and the history of its changes
-- (of_mudancas) — next to, and without touching, bank_connections.status, which is what the app,
-- the robot and every financial rule keep using. Then it lists where the new state and what the
-- screen says today disagree. Nothing reads the new state yet.
--
-- Contract (section 4, "Ordem dos eventos"):
--   * an event changes no state by itself; what counts is the state consulted for it;
--   * a consulted state is applied only when the date the provider gives for it (the Item's own
--     update date) is equal to or later than the one of the state applied last (A14). That date
--     is used ONLY to put consulted states in order. It is not, and is never presented as, the
--     time of an event;
--   * when the consultation failed, the state does not change (the attempt stays in the event);
--   * the consent is never deduced from "UPDATED", from data existing or from a read that worked
--     (A12); a value we do not know becomes 'desconhecido', kept raw, never a success (A13);
--   * link, consent and data are independent states (A11): this file never writes a link state
--     (the mirror owns it) and knows nothing about data;
--   * every change keeps what the provider said, the provider's date and the event it came from
--     (A15) — the arrival time is the event's.
--
-- The rules that turn what Pluggy says into a consent state are the SAME as the ones the app and
-- the edge functions use (supabase/functions/_shared/pluggy-estado.ts). The two are kept in step
-- by one list of cases that both test suites run (supabase/modulo-a/estados-casos.json).
--
-- It runs only when somebody calls it: this migration schedules nothing.
-- It writes ONLY to of_consentimentos, of_mudancas and of_eventos.aplicado. It never deletes.
-- Rollback: supabase/modulo-a/rollback-a-pr3.sql. Procedure: supabase/modulo-a/A-PR3.md.
--
-- One transaction that gives up instead of waiting, like A-PR1 (it takes no lock on auth.users:
-- it creates functions only).
begin;
set local lock_timeout = '3s';
set local statement_timeout = '30s';

-- ---------------------------------------------------------------------------------------------
-- The reasons only the vendor can solve, and the consent each one means. null = not one of them.
-- (pluggy-estado.ts: DO_VENDEDOR)
-- ---------------------------------------------------------------------------------------------
create function public.of_consentimento_do_motivo(p_codigo text)
returns text language sql immutable set search_path = public, pg_temp as $$
  select case upper(btrim(coalesce(p_codigo, ''), E' \t\n\r'))
    when 'WAITING_USER_INPUT' then 'aguardando_vendedor'
    when 'WAITING_USER_ACTION' then 'aguardando_vendedor'
    when 'USER_INPUT_TIMEOUT' then 'aguardando_vendedor'
    when 'USER_AUTHORIZATION_PENDING' then 'aguardando_vendedor'
    when 'USER_AUTHORIZATION_NOT_GRANTED' then 'aguardando_vendedor'
    when 'USER_AUTHORIZATION_REVOKED' then 'revogado'
    when 'INVALID_CREDENTIALS' then 'credencial_invalida'
    when 'INVALID_CREDENTIALS_MFA' then 'credencial_invalida'
    when 'LOGIN_ERROR' then 'credencial_invalida'
    else null end;
$$;

-- ---------------------------------------------------------------------------------------------
-- What a STORED status (bank_connections.status) means for the screen today.
-- (pluggy-estado.ts: grupoDoStatus)
-- ---------------------------------------------------------------------------------------------
create function public.of_grupo_do_status(p_status text)
returns text language sql immutable set search_path = public, pg_temp as $$
  select case
    when x.s = 'UPDATED' then 'em_dia'
    when x.s in ('UPDATING', 'LOGIN_IN_PROGRESS') then 'lendo'
    when public.of_consentimento_do_motivo(x.s) is not null then 'precisa_vendedor'
    when x.s in ('OUTDATED', 'ERROR', 'SITE_NOT_AVAILABLE', 'CONNECTION_ERROR') then 'provedor_atrasado'
    when x.s = 'DELETED' then 'removido'
    else 'desconhecido' end
  from (select upper(btrim(coalesce(p_status, ''), E' \t\n\r')) as s) x;
$$;

-- ---------------------------------------------------------------------------------------------
-- The consent, from what the provider says explicitly about an Item at p_quando.
-- (pluggy-estado.ts: consentimentoDoItem, for an Item that exists)
-- ---------------------------------------------------------------------------------------------
create function public.of_consentimento_do_estado(
  p_status text, p_execucao text, p_erro text, p_expira timestamptz, p_quando timestamptz)
returns text language sql immutable set search_path = public, pg_temp as $$
  select coalesce(
    -- a reason that depends on the vendor (never looked for when the provider says UPDATED)
    case when x.s <> 'UPDATED'
         then coalesce(public.of_consentimento_do_motivo(x.motivo), public.of_consentimento_do_motivo(x.s)) end,
    -- an explicit expiry date of the consent
    case when p_expira is not null and p_quando is not null then
      case when p_expira <= p_quando then 'expirado'
           when p_expira - p_quando <= interval '7 days' then 'expirando'
           else 'autorizado' end end,
    -- nothing explicit: not informed — or unknown, when the status itself is one we do not know
    case when public.of_grupo_do_status(x.s) = 'desconhecido' then 'desconhecido' else 'nao_informado' end)
  from (select upper(btrim(coalesce(p_status, ''), E' \t\n\r')) as s,
               coalesce(nullif(upper(btrim(coalesce(p_execucao, ''), E' \t\n\r')), ''),
                        upper(btrim(coalesce(p_erro, ''), E' \t\n\r'))) as motivo) x;
$$;

-- ---------------------------------------------------------------------------------------------
-- Does this consent state ask the vendor to act (reauthorise the same Item)?
-- (pluggy-estado.ts: acaoDoVendedor)
-- ---------------------------------------------------------------------------------------------
create function public.of_consentimento_pede_vendedor(p_consentimento text)
returns boolean language sql immutable set search_path = public, pg_temp as $$
  select coalesce(p_consentimento in ('aguardando_vendedor', 'credencial_invalida', 'expirado', 'revogado'), false);
$$;

-- ---------------------------------------------------------------------------------------------
-- Applies the recorded events, in the order they arrived, to the consent of their link.
-- Idempotent: an event is evaluated once (of_eventos.aplicado: true = its consulted state was
-- applied, false = it was not and will not be, null = not evaluated yet). One run at a time.
-- One bad event never stops the others: it is counted and left for the next run.
-- The run returns numbers and problem kinds only: no vendor, link, Item or event identifier.
-- ---------------------------------------------------------------------------------------------
create function public.of_estados_atualizar()
returns jsonb language plpgsql set search_path = public, pg_temp as $$
declare
  e record;
  r record;
  v public.of_vinculos%rowtype;
  k public.of_consentimentos%rowtype;
  v_cons jsonb;
  v_data timestamptz;
  v_expira timestamptz;
  v_novo text;
  v_bruto text;
  v_restricao text;
  n_aplicados integer := 0;      n_mudancas integer := 0;       n_atrasados integer := 0;
  n_sem_consulta integer := 0;   n_sem_data integer := 0;       n_sem_vendedor integer := 0;
  n_sem_vinculo integer := 0;    n_removidos integer := 0;      n_conflitos integer := 0;
  n_abandonados integer := 0;    n_validade integer := 0;
  v_problemas jsonb := '[]'::jsonb;
begin
  perform pg_advisory_xact_lock(hashtextextended('public.of_estados_atualizar', 0));

  -- 0) Records the webhook opened and never completed: nothing was consulted for them.
  update public.of_eventos set aplicado = false
   where aplicado is null and resultado is null and chegou_em < now() - interval '10 minutes';
  get diagnostics n_abandonados = row_count;

  -- 1) Completed records not evaluated yet, in arrival order.
  for e in
    select x.id, x.user_id, x.item_id, x.bruto, x.chegou_em
      from public.of_eventos x
     where x.aplicado is null and x.resultado is not null and x.provedor = 'pluggy'
     order by x.id
  loop
    begin
      -- no vendor or no Item (bank-status events): there is no link to apply anything to
      if e.user_id is null or e.item_id is null then
        update public.of_eventos set aplicado = false where id = e.id;
        n_sem_vendedor := n_sem_vendedor + 1;
        continue;
      end if;

      select * into v from public.of_vinculos l where l.provedor = 'pluggy' and l.item_id = e.item_id;
      if not found then
        -- the mirror has not seen this connection yet: left for the next run
        n_sem_vinculo := n_sem_vinculo + 1;
        continue;
      end if;
      if v.user_id <> e.user_id then
        update public.of_eventos set aplicado = false where id = e.id;
        n_conflitos := n_conflitos + 1;
        v_problemas := v_problemas || jsonb_build_object('onde', 'evento', 'problema', 'vendedor_do_evento_diferente_do_vinculo');
        continue;
      end if;
      if v.estado = 'removido' then
        update public.of_eventos set aplicado = false where id = e.id;
        n_removidos := n_removidos + 1;
        continue;
      end if;

      -- the consultation failed, was not made, or the Item no longer exists: the state does not change
      v_cons := e.bruto -> 'consultado';
      if coalesce(e.bruto ->> 'consulta', '') <> 'ok' or v_cons is null or jsonb_typeof(v_cons) <> 'object' then
        update public.of_eventos set aplicado = false where id = e.id;
        n_sem_consulta := n_sem_consulta + 1;
        continue;
      end if;

      -- the provider's date for the consulted state: the only thing that orders states (A14)
      v_data := (v_cons ->> 'updatedAt')::timestamptz;
      if v_data is null then
        update public.of_eventos set aplicado = false where id = e.id;
        n_sem_data := n_sem_data + 1;
        continue;
      end if;

      insert into public.of_consentimentos (vinculo_id, user_id) values (v.id, v.user_id)
      on conflict (vinculo_id) do nothing;
      select * into k from public.of_consentimentos c where c.vinculo_id = v.id;

      if k.confirmado_em is not null and v_data < k.confirmado_em then
        -- a state older than the one already applied: a late event never takes the state back
        update public.of_eventos set aplicado = false where id = e.id;
        n_atrasados := n_atrasados + 1;
        continue;
      end if;

      v_expira := (v_cons ->> 'consentExpiresAt')::timestamptz;
      v_novo := public.of_consentimento_do_estado(
        v_cons ->> 'status', v_cons ->> 'executionStatus', v_cons ->> 'erro', v_expira, e.chegou_em);
      -- what the provider said, raw (codes only: A-PR2 stores nothing else)
      v_bruto := concat_ws(' ', 'status=' || coalesce(v_cons ->> 'status', '?'),
                                'execucao=' || (v_cons ->> 'executionStatus'), 'erro=' || (v_cons ->> 'erro'));

      if k.estado is distinct from v_novo then
        insert into public.of_mudancas (user_id, vinculo_id, campo, de, para, motivo, fonte, evento_id, provedor_em)
        values (v.user_id, v.id, 'consentimento', k.estado, v_novo, v_bruto, 'provedor', e.id, v_data);
        n_mudancas := n_mudancas + 1;
      end if;
      update public.of_consentimentos
         set estado = v_novo, estado_bruto = v_bruto, valido_ate = v_expira,
             confirmado_em = v_data, atualizado_em = now()
       where vinculo_id = v.id;
      update public.of_eventos set aplicado = true where id = e.id;
      n_aplicados := n_aplicados + 1;
    exception when others then
      -- Never the error text: it can quote values. Only the code and the constraint.
      get stacked diagnostics v_restricao = constraint_name;
      v_problemas := v_problemas || jsonb_build_object('onde', 'evento', 'problema', sqlstate, 'restricao', nullif(v_restricao, ''));
    end;
  end loop;

  -- 2) A consent with an explicit expiry date changes with time alone (no event needed).
  for r in
    select c.vinculo_id, c.user_id, c.estado,
           case when c.valido_ate <= now() then 'expirado'
                when c.valido_ate - now() <= interval '7 days' then 'expirando'
                else 'autorizado' end as novo
      from public.of_consentimentos c
      join public.of_vinculos l on l.id = c.vinculo_id and l.estado <> 'removido'
     where c.valido_ate is not null and c.estado in ('autorizado', 'expirando', 'expirado')
  loop
    if r.estado <> r.novo then
      insert into public.of_mudancas (user_id, vinculo_id, campo, de, para, motivo, fonte)
      values (r.user_id, r.vinculo_id, 'consentimento', r.estado, r.novo, 'validade_do_consentimento', 'sistema');
      update public.of_consentimentos set estado = r.novo, atualizado_em = now() where vinculo_id = r.vinculo_id;
      n_validade := n_validade + 1;
    end if;
  end loop;

  return jsonb_build_object(
    'eventos_aplicados', n_aplicados, 'mudancas_de_consentimento', n_mudancas,
    'mudancas_por_validade', n_validade,
    'nao_aplicados_estado_mais_antigo', n_atrasados, 'nao_aplicados_sem_consulta', n_sem_consulta,
    'nao_aplicados_sem_data_do_provedor', n_sem_data, 'nao_aplicados_sem_vendedor_ou_item', n_sem_vendedor,
    'nao_aplicados_vinculo_removido', n_removidos, 'nao_aplicados_registro_incompleto', n_abandonados,
    'conflitos', n_conflitos, 'aguardando_o_espelho', n_sem_vinculo,
    'problemas', jsonb_array_length(v_problemas),
    'tipos_de_problema', nullif(v_problemas, '[]'::jsonb),
    'ainda_nao_avaliados', (select count(*) from public.of_eventos where aplicado is null),
    'divergencias', (select count(*) from public.of_estados_conferir()));
end $$;

-- ---------------------------------------------------------------------------------------------
-- Where the new state and what the screen says today disagree. One row per problem; an empty
-- result means they agree for every live connection. REPORT ONLY: nothing is corrected.
--   com_evento = false: the consent of that link has not been confirmed by any recorded event yet
--   (events are recorded since A-PR2; the robot's own consultations are not events), so the new
--   state is still the initial one and the difference says nothing about the provider.
-- ---------------------------------------------------------------------------------------------
create function public.of_estados_conferir()
returns table (conexao_id uuid, vinculo_id uuid, problema text, status_atual text, grupo_atual text,
               consentimento text, com_evento boolean)
language sql stable set search_path = public, pg_temp as $$
  with base as (
    select b.id as conexao_id, v.id as vinculo_id, b.status,
           public.of_grupo_do_status(b.status) as grupo,
           c.estado as cons, (c.confirmado_em is not null) as com_evento,
           public.of_consentimento_pede_vendedor(c.estado) as novo_pede,
           (select x.bruto ->> 'consulta' from public.of_eventos x
             where x.provedor = 'pluggy' and x.item_id = b.item_id and x.resultado is not null
             order by x.id desc limit 1) as ultima_consulta
      from public.bank_connections b
      left join public.of_vinculos v on v.origem_conexao_id = b.id
      left join public.of_consentimentos c on c.vinculo_id = v.id
     where coalesce(b.status, '') <> 'deleted'
  )
  select b.conexao_id, b.vinculo_id, p.problema, b.status, b.grupo, b.cons, coalesce(b.com_evento, false)
    from base b
   cross join lateral (values
     ('sem_vinculo', b.vinculo_id is null),
     ('sem_consentimento', b.vinculo_id is not null and b.cons is null),
     ('novo_pede_o_vendedor_e_a_tela_nao', b.novo_pede and b.grupo <> 'precisa_vendedor'),
     ('tela_pede_o_vendedor_e_o_novo_nao', b.grupo = 'precisa_vendedor' and b.cons is not null and not b.novo_pede),
     ('consentimento_desconhecido', b.cons = 'desconhecido'),
     ('status_desconhecido', b.grupo = 'desconhecido'),
     ('item_nao_existe_no_provedor', b.ultima_consulta = 'item_nao_existe')
   ) as p(problema, tem)
   where p.tem;
$$;

-- ---------------------------------------------------------------------------------------------
-- Report in numbers only (no ids): what the new states hold and how they compare with the screen.
-- ---------------------------------------------------------------------------------------------
create function public.of_estados_relatorio()
returns jsonb language plpgsql stable set search_path = public, pg_temp as $$
begin
  return jsonb_build_object(
    'consentimentos_por_estado', (select coalesce(jsonb_object_agg(estado, n), '{}'::jsonb)
        from (select c.estado, count(*) n from public.of_consentimentos c
                join public.of_vinculos l on l.id = c.vinculo_id and l.estado <> 'removido' group by c.estado) z),
    'consentimentos_confirmados_por_evento', (select count(*) from public.of_consentimentos c
        join public.of_vinculos l on l.id = c.vinculo_id and l.estado <> 'removido' where c.confirmado_em is not null),
    'vinculos_vivos', (select count(*) from public.of_vinculos where estado <> 'removido'),
    'eventos', (select count(*) from public.of_eventos),
    'eventos_aplicados', (select count(*) from public.of_eventos where aplicado),
    'eventos_nao_aplicados', (select count(*) from public.of_eventos where aplicado = false),
    'eventos_ainda_nao_avaliados', (select count(*) from public.of_eventos where aplicado is null),
    'mudancas_de_consentimento', (select count(*) from public.of_mudancas where campo = 'consentimento'),
    'status_na_tela_por_grupo', (select coalesce(jsonb_object_agg(g, n), '{}'::jsonb)
        from (select public.of_grupo_do_status(b.status) g, count(*) n from public.bank_connections b
               where coalesce(b.status, '') <> 'deleted' group by 1) z),
    'divergencias', (select count(*) from public.of_estados_conferir()),
    'divergencias_por_tipo', (select coalesce(jsonb_object_agg(problema, n), '{}'::jsonb)
        from (select problema, count(*) n from public.of_estados_conferir() group by problema) z),
    'divergencias_sem_evento', (select count(*) from public.of_estados_conferir() where not com_evento)
  );
end $$;

-- Functions: server only, like everything else in the module.
do $$
declare f text;
begin
  foreach f in array array[
    'public.of_consentimento_do_motivo(text)', 'public.of_grupo_do_status(text)',
    'public.of_consentimento_do_estado(text, text, text, timestamptz, timestamptz)',
    'public.of_consentimento_pede_vendedor(text)',
    'public.of_estados_atualizar()', 'public.of_estados_conferir()', 'public.of_estados_relatorio()'] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;

commit;
