-- Pesquisa de satisfação da VANT (app.orbis.inf.br/pesquisa) — 18/10/2026
-- Uma tabela, duas RPCs: quem responde grava (logado ou não); só admin/comercial lê.

create table if not exists public.pesquisa_respostas (
  id bigserial primary key,
  user_id uuid,                       -- auth.uid() se a pessoa estava logada no app
  nome text,
  whatsapp text,
  respostas jsonb not null,           -- todas as respostas, chave por pergunta
  nps smallint,                       -- 0..10 (copiado de respostas.nps pra filtrar)
  pmf text,                           -- "muito" | "pouco" | "tanto_faz" | "aliviado"
  versao text not null default 'v1',
  origem text,                        -- ?o=whatsapp / app / ...
  ua text,
  criado_em timestamptz not null default now()
);
create index if not exists pesquisa_respostas_criado_idx on public.pesquisa_respostas (criado_em desc);
create index if not exists pesquisa_respostas_user_idx on public.pesquisa_respostas (user_id);
alter table public.pesquisa_respostas enable row level security;
revoke all on public.pesquisa_respostas from anon, authenticated;

-- Grava a resposta. Anon pode (link vai pelo WhatsApp e nem todo mundo está logado no navegador).
-- Travas: tamanho, nps válido, 1 resposta por conta a cada 30 dias (a nova substitui), 300/hora no total.
create or replace function public.pesquisa_enviar(p_respostas jsonb, p_nome text default null, p_whatsapp text default null, p_origem text default null, p_ua text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_nps smallint; v_pmf text; v_id bigint; v_zap text;
begin
  if p_respostas is null or jsonb_typeof(p_respostas) <> 'object' then raise exception 'respostas inválidas'; end if;
  if length(p_respostas::text) > 20000 then raise exception 'resposta grande demais'; end if;
  if (select count(*) from public.pesquisa_respostas where criado_em > now() - interval '1 hour') > 300 then
    raise exception 'muita gente respondendo agora, tenta de novo em alguns minutos';
  end if;
  v_nps := case when (p_respostas->>'nps') ~ '^[0-9]{1,2}$' then (p_respostas->>'nps')::int end;
  if v_nps is not null and (v_nps < 0 or v_nps > 10) then v_nps := null; end if;
  v_pmf := nullif(left(p_respostas->>'pmf', 20), '');
  v_zap := nullif(regexp_replace(coalesce(p_whatsapp,''), '\D', '', 'g'), '');
  if v_zap is not null and length(v_zap) = 13 and v_zap like '55%' then v_zap := substr(v_zap, 3); end if;
  if v_uid is not null then
    delete from public.pesquisa_respostas where user_id = v_uid and versao = 'v1' and criado_em > now() - interval '30 days';
  end if;
  insert into public.pesquisa_respostas (user_id, nome, whatsapp, respostas, nps, pmf, origem, ua)
  values (v_uid, left(nullif(trim(p_nome),''), 80), left(v_zap, 13), p_respostas, v_nps, v_pmf, left(p_origem, 40), left(p_ua, 300))
  returning id into v_id;
  return jsonb_build_object('id', v_id, 'logado', v_uid is not null);
end $$;

-- Admin/comercial: lista tudo, com o que o app sabe da pessoa (nome, plano, cidade, desde quando).
create or replace function public.pesquisa_listar()
returns jsonb language sql stable security definer set search_path = public as $$
  select case when public.is_orbis_crm() then coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', r.id, 'criado_em', r.criado_em, 'user_id', r.user_id,
      'nome', coalesce(nullif(r.nome,''), p.nickname, l.nome, '—'),
      'whatsapp', coalesce(r.whatsapp, p.phone),
      'cidade', nullif(trim(coalesce(p.city,'') || case when coalesce(p.state,'')<>'' then '/'||p.state else '' end), ''),
      'plano', p.plan_status, 'plan_type', p.plan_type, 'conta_desde', p.created_at,
      'vende', p.what_i_sell,
      'nps', r.nps, 'pmf', r.pmf, 'origem', r.origem, 'respostas', r.respostas
    ) order by r.criado_em desc)
    from public.pesquisa_respostas r
    left join public.profiles p on p.user_id = r.user_id
    left join lateral (select nome from public.leads x where r.whatsapp is not null and regexp_replace(coalesce(x.whatsapp,''),'\D','','g') like '%'||right(r.whatsapp,8) order by x.id desc limit 1) l on true
  ), '[]'::jsonb) else null end;
$$;

revoke all on function public.pesquisa_enviar(jsonb,text,text,text,text) from public;
revoke all on function public.pesquisa_listar() from public;
grant execute on function public.pesquisa_enviar(jsonb,text,text,text,text) to anon, authenticated;
grant execute on function public.pesquisa_listar() to authenticated;
