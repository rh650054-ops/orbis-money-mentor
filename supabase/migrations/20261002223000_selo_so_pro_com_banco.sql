-- ============================================================
-- SELO VERIFICADO SÓ PRA PRO COM BANCO — 02/10/2026 (pedido do Rick)
--   O selo virou a estrela azul do Instagram ("número com prova do banco"),
--   mas usuario_verificado() ainda dava selo pela regra antiga de veterano
--   (conta com 90+ dias e 5+ dias de DEFCON): 41 pessoas sem Pro nem banco
--   apareciam com a estrela no ranking. E 2 perfis tinham o selo marcado à
--   mão pelo admin em 07/09 sem Pro nem banco.
--   Regra nova, única: selo = Vant Pro ativo E banco ligado (não apagado).
-- ============================================================
create or replace function public.usuario_verificado(p_user uuid)
returns boolean
language sql stable security definer set search_path to 'public' as $$
  select public.orbis_pro_ativo(p_user)
     and exists (select 1 from public.bank_connections b
                  where b.user_id = p_user and coalesce(b.status, '') <> 'deleted');
$$;

-- O selo gravado no perfil (usado pelo X1 pra liberar luta valendo dinheiro)
-- segue a mesma regra: quem não tem Pro com banco perde. Roda como servidor:
-- o gatilho protect_profile_billing_columns só deixa o service role mexer no selo.
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
update public.profiles p
   set verificado = false, verificado_por = 'removido_sem_pro', verificado_em = now()
 where coalesce(p.verificado, false)
   and not public.usuario_verificado(p.user_id);
