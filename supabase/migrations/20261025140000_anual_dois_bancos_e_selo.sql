-- ============================================================
-- Auditoria dos planos (Rick, 25/10/2026)
-- 1) Pro ANUAL = 2 bancos. Só reconhecia as ofertas ew11enu0 e 6vkxbh8c; a anual nova
--    t9xt3k4z (19/10) e anual vinda só pelo nome do plano ficavam com 1 banco.
--    Agora: lista das ofertas anuais (mesma de hotmart-webhook/planos.ts) OU Pro que
--    vale mais de 6 meses pra frente (anual comprado por oferta que a lista ainda não tem).
-- 2) Selo "Verificado da Vant" = Pro + banco conectado (usuario_verificado). O selo era
--    gravado ao ligar o banco e nunca saía. Revisão de hora em hora: tira de quem deixou
--    de ser Pro ou ficou sem banco, dá pra quem é Pro com banco e ainda não tinha.
--    Só mexe no selo vindo do banco (verificado_por = 'banco'); selo dado à mão fica.
-- ============================================================

create or replace function public.pro_anual(p_user uuid)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists (
    select 1 from public.orbis_pro
     where user_id = p_user and ativo and cancelado_em is null
       and (expira_em is null or expira_em > now())
       and (produto_id in ('ew11enu0', '6vkxbh8c', 't9xt3k4z')
            or (expira_em is not null and expira_em > now() + interval '180 days'))
  );
$$;
revoke all on function public.pro_anual(uuid) from public, anon, authenticated;
grant execute on function public.pro_anual(uuid) to service_role;

create or replace function public.open_finance_limite(p_user uuid default null)
returns jsonb language sql stable security definer set search_path to 'public' as $function$
  with u as (select coalesce(p_user, auth.uid()) as id),
  x as (select * from public.bancos_extra where user_id = (select id from u)),
  pro as (select produto_id from public.orbis_pro where user_id = (select id from u) and ativo and cancelado_em is null and (expira_em is null or expira_em > now())),
  pagos as (select count(*)::int n from public.bancos_extra_compras where user_id = (select id from u) and ativo and ate > now()),
  anual as (select public.pro_anual((select id from u)) as sim),
  base as (select case when (select sim from anual) then 2 when exists (select 1 from pro) then 1 else 0 end as n),
  ext as (select coalesce((select extras from x), 0) + (select n from pagos) as n),
  usados as (select count(*)::int n from public.bank_connections where user_id = (select id from u) and coalesce(status, '') <> 'deleted')
  select jsonb_build_object(
    'usados', (select n from usados),
    'isento', coalesce((select isento from x), false),
    'incluidos', (select n from base),
    'extras', (select n from ext),
    'limite', case when coalesce((select isento from x), false) then null else (select n from base) + (select n from ext) end,
    'pode_conectar', coalesce((select isento from x), false) or (select n from usados) < (select n from base) + (select n from ext),
    'liberado', public.orbis_pro_ativo((select id from u)),
    'plano', case when (select sim from anual) then 'pro_anual'
                  when public.vant_pro_pleno((select id from u)) then 'pro'
                  when (select n from pagos) > 0 then 'essencial_banco'
                  else 'essencial' end
  )
  where (select id from u) is not null and (p_user is null or p_user = auth.uid() or auth.role() = 'service_role');
$function$;

create or replace function public.selo_revisar()
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare tirou int; deu int;
begin
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  update public.profiles p set verificado = false
   where p.verificado and coalesce(p.verificado_por, 'banco') = 'banco'
     and not public.usuario_verificado(p.user_id);
  get diagnostics tirou = row_count;
  update public.profiles p set verificado = true, verificado_em = coalesce(p.verificado_em, now()), verificado_por = 'banco'
   where not coalesce(p.verificado, false)
     and coalesce(p.verificado_por, 'banco') = 'banco'   -- quem o admin tirou à mão não volta sozinho
     and public.usuario_verificado(p.user_id);
  get diagnostics deu = row_count;
  return jsonb_build_object('tirou', tirou, 'deu', deu);
end $$;
revoke all on function public.selo_revisar() from public, anon, authenticated;
grant execute on function public.selo_revisar() to service_role;
