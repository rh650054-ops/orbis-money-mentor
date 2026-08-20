-- Painel admin: números por PERÍODO (dia / mês / personalizado) + rateio por afiliado.
-- (Aplicada em produção via apply_migration; este arquivo é o registro no repo.)
-- Motivo: o painel só mostrava o total acumulado, e pra pagar comissão é preciso
-- saber quantos entraram e quantos ASSINARAM dentro da janela que vai ser paga.
-- Atribuição: leads guarda o ?ref= do link do afiliado junto com o e-mail; o e-mail
-- liga lead -> perfil -> assinatura. Primeiro toque vence (se dois refs trouxeram
-- o mesmo e-mail, quem chegou primeiro leva).

create index if not exists leads_email_lower_idx on public.leads (lower(trim(email)));
create index if not exists leads_created_at_idx on public.leads (created_at desc);
create index if not exists subscriptions_created_at_idx on public.subscriptions (created_at desc);
create index if not exists profiles_created_at_idx on public.profiles (created_at desc);

create or replace function public.orbis_painel_periodo(
  p_inicio date,
  p_fim date,
  p_comissao numeric default 11.96
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

  -- O dia é o dia de São Paulo, não UTC.
  ini := (p_inicio::timestamp at time zone 'America/Sao_Paulo');
  fim := ((p_fim + 1)::timestamp at time zone 'America/Sao_Paulo');

  with
  primeiro_ref as (
    select distinct on (lower(trim(email)))
           lower(trim(email)) as email, ref, created_at as lead_em
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
    select s.user_id, lower(trim(p.email)) as email, s.created_at, s.status
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
  por_ref as (
    select r.ref,
      (select count(*) from public.leads l
        where l.ref = r.ref and l.created_at >= ini and l.created_at < fim) as leads,
      (select count(*) from cadastros_periodo c
        join primeiro_ref pr on pr.email = c.email where pr.ref = r.ref) as cadastros,
      (select count(*) from assinaturas_periodo a
        join primeiro_ref pr on pr.email = a.email where pr.ref = r.ref) as assinaturas
    from (select distinct ref from primeiro_ref) r
  )
  select jsonb_build_object(
    'inicio', p_inicio,
    'fim', p_fim,
    'comissao_unitaria', p_comissao,
    'cadastros', (select count(*) from cadastros_periodo),
    'leads', (select count(*) from public.leads where created_at >= ini and created_at < fim),
    'assinaturas_novas', (select count(*) from assinaturas_periodo),
    'assinaturas_ativas_agora', (select count(*) from public.subscriptions where status = 'active'),
    'cadastros_total', (select count(*) from public.profiles),
    'por_dia', coalesce((select jsonb_agg(jsonb_build_object(
        'dia', dia, 'cadastros', cadastros, 'assinaturas', assinaturas) order by dia) from por_dia), '[]'::jsonb),
    'por_ref', coalesce((select jsonb_agg(jsonb_build_object(
        'ref', ref, 'leads', leads, 'cadastros', cadastros, 'assinaturas', assinaturas,
        'comissao', round((assinaturas * p_comissao)::numeric, 2))
        order by assinaturas desc, cadastros desc, leads desc)
      from por_ref where leads > 0 or cadastros > 0 or assinaturas > 0), '[]'::jsonb),
    'comissao_total', coalesce((select round(sum(assinaturas * p_comissao)::numeric, 2) from por_ref), 0)
  ) into resultado;

  return resultado;
end;
$$;

revoke all on function public.orbis_painel_periodo(date, date, numeric) from public, anon;
grant execute on function public.orbis_painel_periodo(date, date, numeric) to authenticated;
