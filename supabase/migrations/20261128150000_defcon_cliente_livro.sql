-- ============================================================================================
-- DEFCON — the app writes through the ledger (ADR 0001, Phase 2, new client). Requires
-- 20261128130000. Inactive like it: only sessions marked by the server are affected.
-- ============================================================================================

-- The new app identifies itself in x-client-info (a header supabase-js always sends, so the API's
-- CORS already allows it: a custom header would make the browser's preflight fail every request).
-- x-vant-cliente is still accepted (server-to-server and the SQL tests).
create or replace function public.defcon_cliente_novo() returns boolean
language sql stable set search_path to 'public' as $$
  select coalesce(nullif(current_setting('request.headers', true), '')::json ->> 'x-client-info', '') like 'vant-livro/%'
      or coalesce(nullif(current_setting('request.headers', true), '')::json ->> 'x-vant-cliente', '') <> ''
$$;

-- "Como recebeu" / payment split of ONE hour block, by its id (the screens know blocks, not the
-- session index). On a marked session: an explicit, idempotent re-split through the ledger (same
-- block total, refused otherwise). On any other session: {livro:false} and the app keeps today's path.
create or replace function public.defcon_redistribuir_bloco(p_id uuid, p_bloco_id uuid, p_split jsonb) returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare uid uuid := auth.uid(); v_dono uuid; loc record; r jsonb;
begin
  if uid is null then raise exception 'nao_autenticado'; end if;
  select user_id into v_dono from public.hourly_goal_blocks where id = p_bloco_id;
  if v_dono is null or v_dono <> uid then raise exception 'bloco_invalido'; end if;
  select * into loc from public.defcon_idx_do_bloco(p_bloco_id);
  if not found or loc.sessao is null then return jsonb_build_object('livro', false); end if;
  r := public.defcon_lancar_conta(uid, p_id, 'redistribuir', loc.sessao, loc.idx, null, null, null, null, p_split, 'app');
  return jsonb_build_object('livro', true) || r;
end $$;
revoke all on function public.defcon_redistribuir_bloco(uuid, uuid, jsonb) from public, anon;
grant execute on function public.defcon_redistribuir_bloco(uuid, uuid, jsonb) to authenticated;
