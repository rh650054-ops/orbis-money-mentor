-- Shorthands for the Apple cases (casos/46..49). Fictional identifiers only.
select now() + interval '10 days' as fim \gset
select now() + interval '30 days' as fim30 \gset
select now() + interval '365 days' as fim365 \gset
select now() - interval '3 hours' as t0 \gset
select now() - interval '2 hours' as t1 \gset
select now() - interval '1 hour' as t2 \gset
select now() - interval '30 minutes' as t3 \gset
select now() as t4 \gset
-- one Apple status (Production unless told otherwise), signed at p_assinado
create or replace function pg_temp.apple(p_k text, p_original text, p_produto text, p_expira timestamptz, p_assinado timestamptz,
  p_ambiente text default 'Production', p_revogada timestamptz default null, p_tolerancia timestamptz default null,
  p_renova boolean default true, p_transacao text default null)
returns text language sql as $$
  select public.apple_assinatura_gravar(pg_temp.id(p_k), p_original, p_produto, p_ambiente, p_expira, p_assinado, 'ativa', p_tolerancia, p_renova, p_revogada, p_transacao)
$$;
create or replace function pg_temp.admin(p_ligado boolean) returns void language plpgsql as $$
begin
  perform set_config('teste.admin', case when p_ligado then 'on' else 'off' end, false);
  if p_ligado then perform pg_temp.app(pg_temp.id('adm')); else perform pg_temp.servidor(); end if;
end $$;
select pg_temp.conta('adm');
