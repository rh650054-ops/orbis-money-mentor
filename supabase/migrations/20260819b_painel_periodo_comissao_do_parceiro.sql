-- v2 do orbis_painel_periodo: a comissao sai da tabela parceiros (cada um tem a
-- sua: 5,00 / 6,50 / 9,90) em vez de um valor fixo, e traz nome, tipo e se e
-- recorrente. E o que alimenta a tela de FECHAMENTO DE COMISSOES.
-- (Aplicada em producao via apply_migration; este arquivo e o registro no repo.)

create or replace function public.orbis_painel_periodo(
  p_inicio date,
  p_fim date,
  p_comissao numeric default null   -- só usado pra quem não está cadastrado em parceiros
)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  ini timestamptz;
  fim timestamptz;
  resultado jsonb;
begin
  if not public.is_orbis_admin() then
    raise exception 'apenas admin';
  end if;

  ini := (p_inicio::timestamp at time zone 'America/Sao_Paulo');
  fim := ((p_fim + 1)::timestamp at time zone 'America/Sao_Paulo');

  with
  -- primeiro toque: se dois códigos trouxeram o mesmo e-mail, o primeiro leva
  primeiro_ref as (
    select distinct on (lower(trim(email)))
           lower(trim(email)) as email, upper(trim(ref)) as ref
    from public.leads
    where ref is not null and ref <> '' and email is not null and email <> ''
    order by lower(trim(email)), created_at asc
  ),
  cadastros_periodo as (
    select p.user_id, lower(trim(p.email)) as email, p.created_at
    from public.profiles p
    where p.created_at >= ini and p.created_at < fim
  ),
  assinaturas_periodo as (
    select s.user_id, lower(trim(p.email)) as email, s.created_at
    from public.subscriptions s
    join public.profiles p on p.user_id = s.user_id
    where s.created_at >= ini and s.created_at < fim
  ),
  por_dia as (
    select d::date as dia,
      (select count(*) from cadastros_periodo c
        where (c.created_at at time zone 'America/Sao_Paulo')::date = d::date) as cadastros,
      (select count(*) from assinaturas_periodo a
        where (a.created_at at time zone 'America/Sao_Paulo')::date = d::date) as assinaturas
    from generate_series(p_inicio, p_fim, interval '1 day') d
  ),
  codigos as (
    select upper(trim(code)) as ref, nome, tipo, comissao, recorrente from public.parceiros
    union
    select r.ref, r.ref, 'sem cadastro', coalesce(p_comissao, 0), false
    from (select distinct ref from primeiro_ref) r
    where not exists (select 1 from public.parceiros pa where upper(trim(pa.code)) = r.ref)
  ),
  por_ref as (
    select c.ref, c.nome, c.tipo, c.comissao, c.recorrente,
      (select count(*) from public.leads l
        where upper(trim(l.ref)) = c.ref and l.created_at >= ini and l.created_at < fim) as leads,
      (select count(*) from cadastros_periodo cp
        join primeiro_ref pr on pr.email = cp.email where pr.ref = c.ref) as cadastros,
      (select count(*) from assinaturas_periodo ap
        join primeiro_ref pr on pr.email = ap.email where pr.ref = c.ref) as assinaturas
    from codigos c
  )
  select jsonb_build_object(
    'inicio', p_inicio,
    'fim', p_fim,
    'cadastros', (select count(*) from cadastros_periodo),
    'leads', (select count(*) from public.leads where created_at >= ini and created_at < fim),
    'assinaturas_novas', (select count(*) from assinaturas_periodo),
    'assinaturas_ativas_agora', (select count(*) from public.subscriptions where status = 'active'),
    'cadastros_total', (select count(*) from public.profiles),
    'leads_total', (select count(*) from public.leads),
    'por_dia', coalesce((select jsonb_agg(jsonb_build_object(
        'dia', dia, 'cadastros', cadastros, 'assinaturas', assinaturas) order by dia) from por_dia), '[]'::jsonb),
    'por_ref', coalesce((select jsonb_agg(jsonb_build_object(
        'ref', ref, 'nome', nome, 'tipo', tipo, 'recorrente', recorrente,
        'comissao_unitaria', comissao,
        'leads', leads, 'cadastros', cadastros, 'assinaturas', assinaturas,
        'comissao', round((assinaturas * comissao)::numeric, 2))
        order by (assinaturas * comissao) desc, assinaturas desc, leads desc)
      from por_ref where leads > 0 or cadastros > 0 or assinaturas > 0), '[]'::jsonb),
    'comissao_total', coalesce((select round(sum(assinaturas * comissao)::numeric, 2) from por_ref), 0)
  ) into resultado;

  return resultado;
end;
$$;

revoke all on function public.orbis_painel_periodo(date, date, numeric) from public, anon;
grant execute on function public.orbis_painel_periodo(date, date, numeric) to authenticated;
