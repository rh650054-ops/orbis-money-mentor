-- ============================================================
-- TRAVAS ANTI-BURLA DO OPEN FINANCE — 10/10/2026
-- Rick: "me passe erros que o open finance pode ter de formas das pessoas burlarem".
-- Achado: com a chave pública do app + o próprio login, qualquer usuário consegue
-- chamar a API do Supabase direto (sem passar pela tela) e:
--   • INSERIR Pix falso em auto_detected_sales → o "caiu no banco" vira o que ele quiser
--   • mudar valor/descrição de um Pix lido
--   • mudar bank_connections (papel trabalho/pessoal, last_synced_at, status) e
--     furar a regra de "troca de papel 1x por semana" e a trava do ranking
--   • gravar qualquer faturamento_total_mes em leaderboard_stats (pódio, posição, X1)
-- O app só LÊ essas duas tabelas do banco; quem escreve é a Pluggy pelas edge
-- functions (service role) e as RPCs security definer. Então:
--   1) cliente perde INSERT/UPDATE/DELETE em auto_detected_sales e bank_connections
--   2) leaderboard_stats: o cliente ainda grava foto/nome, mas o faturamento é
--      sempre recalculado no servidor (ranking_total_mes) — o número que ele mandar
--      é ignorado. Posição também não muda pelo cliente.
-- Sem comandos de apagar. Idempotente.
-- ============================================================

-- 1) dados do banco: só o servidor escreve
revoke insert, update, delete on public.auto_detected_sales from anon, authenticated;
revoke insert, update, delete on public.bank_connections from anon, authenticated;

-- 2) faturamento do ranking: o cliente não escolhe o número
create or replace function public.leaderboard_faturamento_do_servidor()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  -- só mexe quando quem escreve é o app (PostgREST); RPCs/cron/admin passam direto
  if current_user in ('authenticated', 'anon') and not public.is_orbis_admin() then
    new.faturamento_total_mes := public.ranking_total_mes(new.user_id, new.mes_referencia);
    if tg_op = 'UPDATE' then
      new.posicao_faturamento := old.posicao_faturamento;
      new.posicao_constancia := old.posicao_constancia;
    else
      new.posicao_faturamento := null;
      new.posicao_constancia := null;
    end if;
  end if;
  return new;
end $$;
revoke all on function public.leaderboard_faturamento_do_servidor() from public, anon, authenticated;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'leaderboard_faturamento_do_servidor'
                   and tgrelid = 'public.leaderboard_stats'::regclass) then
    create trigger leaderboard_faturamento_do_servidor
      before insert or update on public.leaderboard_stats
      for each row execute function public.leaderboard_faturamento_do_servidor();
  end if;
end $$;
