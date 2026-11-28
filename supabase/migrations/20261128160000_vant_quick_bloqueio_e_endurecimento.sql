-- ============================================================================================
-- VANT Quick: cut ONE account off at once (even with a DEFCON session running) + hardening
-- found by the Supabase security advisor after 20261128130000..150000 were applied (28/11/2026).
-- Not applied. Changes nothing while no account is switched on.
-- ============================================================================================

-- Before this, revoking an account's credentials stopped its taps at once, but the app issued a new
-- credential at the next opening (vant_quick_disponivel kept answering true). The block below is
-- checked on every tap, on every issue and on the "show the buttons?" question.
alter table public.defcon_persistencia_contas add column if not exists vant_quick_bloqueado boolean not null default false;

create or replace function public.vant_quick_bloquear_conta(p_user uuid, p_bloquear boolean default true) returns integer
language plpgsql security definer set search_path to 'public' as $$
declare n integer := 0;
begin
  insert into public.defcon_persistencia_contas (user_id, ativo, vant_quick_bloqueado)
  values (p_user, false, p_bloquear)
  on conflict (user_id) do update set vant_quick_bloqueado = excluded.vant_quick_bloqueado;
  if p_bloquear then
    update public.vant_quick_credenciais set revogado_em = now() where user_id = p_user and revogado_em is null;
    get diagnostics n = row_count;
  end if;
  return n;   -- credentials revoked now
end $$;
revoke all on function public.vant_quick_bloquear_conta(uuid, boolean) from public, anon, authenticated;

create or replace function public.vant_quick_bloqueada(p_user uuid) returns boolean
language sql stable security definer set search_path to 'public' as $$
  select coalesce((select vant_quick_bloqueado from public.defcon_persistencia_contas where user_id = p_user), false)
$$;
revoke all on function public.vant_quick_bloqueada(uuid) from public, anon, authenticated;

create or replace function public.vant_quick_disponivel() returns jsonb
language sql stable security definer set search_path to 'public' as $$
  select jsonb_build_object('interativo',
    auth.uid() is not null
    and coalesce((select vant_quick and marcar_novas from public.defcon_persistencia_config), false)
    and exists (select 1 from public.defcon_persistencia_contas where user_id = auth.uid() and ativo and not vant_quick_bloqueado))
$$;

-- issuing: refused for a blocked account (the app then keeps the buttons hidden)
do $$
declare v text; antes text;
begin
  select pg_get_functiondef('public.vant_quick_emitir(text)'::regprocedure) into v;
  antes := v;
  v := replace(v, $r$  if uid is null then raise exception 'nao_autenticado'; end if;$r$,
                  $r$  if uid is null then raise exception 'nao_autenticado'; end if;
  if public.vant_quick_bloqueada(uid) then raise exception 'bloqueado'; end if;$r$);
  if v = antes then raise exception 'vant_quick_emitir mudou: bloqueio nao inserido'; end if;
  execute v;
  -- every tap (and the status question): a blocked account is refused before anything else
  select pg_get_functiondef('public.vant_quick_executar(text,text,uuid,text)'::regprocedure) into v;
  antes := v;
  v := replace(v, $r$  if cr.expira_em <= now() then return jsonb_build_object('ok', false, 'motivo', 'credencial_expirada'); end if;$r$,
                  $r$  if cr.expira_em <= now() then return jsonb_build_object('ok', false, 'motivo', 'credencial_expirada'); end if;
  if public.vant_quick_bloqueada(cr.user_id) then return jsonb_build_object('ok', false, 'motivo', 'bloqueado'); end if;$r$);
  if v = antes then raise exception 'vant_quick_executar mudou: bloqueio nao inserido'; end if;
  execute v;
end $$;

-- ---------- hardening (advisor) ----------
-- trigger functions: never callable as RPC anyway, but not executable by clients either
revoke all on function public.defcon_guarda_bloco_hora(), public.defcon_guarda_contadores(), public.defcon_guarda_sessao(),
  public.defcon_lancamento_mudou(), public.defcon_marcar_sessao(), public.defcon_saldo_inicial(), public.defcon_venda_alterada()
  from public, anon, authenticated;
-- signed-in only (they refuse without a user inside, now also at the door)
revoke all on function public.vant_quick_salvar_config(numeric, text), public.vant_quick_disponivel() from public, anon;
grant execute on function public.vant_quick_salvar_config(numeric, text), public.vant_quick_disponivel() to authenticated;
-- fixed search_path on the two helpers the advisor flagged
alter function public.defcon_recalculando() set search_path to 'public';
alter function public.vant_quick_limites() set search_path to 'public';
