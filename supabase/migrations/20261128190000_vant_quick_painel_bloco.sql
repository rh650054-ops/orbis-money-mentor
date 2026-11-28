-- ============================================================================================
-- VANT Quick: the Dynamic Island showed R$ 0,00 while the lock screen showed R$ 120,00 (Rick, 28/11).
-- Same Live Activity, two fields: the lock screen draws the DAY (faturamentoDia), the Dynamic Island
-- draws the current BLOCK (faturamentoBloco, metaHora, vendasBloco). After a VANT Quick tap the
-- iPhone copies the server's panel into the Live Activity, but the panel only had day numbers, so
-- the block fields kept whatever the app wrote when the block started (R$ 0). In production the
-- block held R$ 120 (achieved_amount 120, 6 sales, all in block 1) while the island said R$ 0.
-- The panel now also carries the current block, from the same columns the app reads:
-- hourly_goal_blocks.achieved_amount / target_amount and challenge_blocks.sales_count.
-- Additive: builds 29/31/32 ignore the new keys. Nothing else in the panel changes.
-- ============================================================================================
create or replace function public.vant_quick_painel(p_uid uuid) returns jsonb
language plpgsql stable security definer set search_path to 'public' as $$
declare s record; b record; c record; v_vendas integer; v_ab integer; v_bloco_inicio timestamptz; v_fat numeric; v_opcoes jsonb;
        v_vendas_bloco integer;
begin
  v_opcoes := public.vant_quick_opcoes(p_uid);
  select * into c from public.vant_quick_config where user_id = p_uid;
  select * into s from public.challenge_sessions
   where user_id = p_uid and date = (now() at time zone 'America/Sao_Paulo')::date;
  if not found then return jsonb_build_object('sessao', null, 'opcoes', v_opcoes); end if;
  select count(*) filter (where not late and coalesce(method,'') <> 'gorjeta') into v_vendas from public.defcon_sales where session_id = s.id;
  select v_vendas + count(*) into v_ab from public.defcon_abordagens where session_id = s.id;
  select hb.* into b from public.hourly_goal_blocks hb where hb.id = public.defcon_bloco_do_plano(s.id, s.current_block_index);
  select cb.sales_count into v_vendas_bloco from public.challenge_blocks cb where cb.session_id = s.id and cb.block_index = s.current_block_index;
  v_bloco_inicio := b.timer_started_at;
  -- the same total the DEFCON screen shows: the plan's hour blocks (cash, card, Pix, calote)
  select coalesce(round(sum(coalesce(hb.valor_dinheiro,0) + coalesce(hb.valor_cartao,0) + coalesce(hb.valor_pix,0) + coalesce(hb.valor_calote,0)), 2), 0)
    into v_fat from public.daily_goal_plans p join public.hourly_goal_blocks hb on hb.plan_id = p.id
   where p.user_id = p_uid and p.date = s.date;
  return jsonb_build_object(
    'sessao', s.id, 'data', s.date, 'estado', s.status, 'servidor', s.totais_servidor,
    'faturamento', v_fat, 'meta', s.daily_goal,
    'restante', greatest(0, round(s.daily_goal - v_fat, 2)),
    'progresso', case when s.daily_goal > 0 then least(1, round(v_fat / s.daily_goal, 4)) else 0 end,
    'vendas', v_vendas, 'abordagens', v_ab,
    'conversao', case when v_ab > 0 then round(v_vendas::numeric / v_ab, 4) end,
    'bloco', s.current_block_index + 1, 'totalBlocos', s.total_blocks,
    'blocoEstado', b.timer_status,
    'blocoInicio', v_bloco_inicio, 'blocoFim', v_bloco_inicio + interval '1 hour',
    -- the current block, as the DEFCON screen shows it (what the Dynamic Island draws)
    'faturamentoBloco', coalesce(round(b.achieved_amount, 2), 0),
    'metaHora', coalesce(round(b.target_amount, 2), 0),
    'vendasBloco', coalesce(v_vendas_bloco, 0),
    'opcoes', v_opcoes,
    'rapida', case when c.user_id is null then null else jsonb_build_object('valor', c.valor, 'metodo', c.metodo) end);
end $$;
revoke all on function public.vant_quick_painel(uuid) from public, anon, authenticated;
