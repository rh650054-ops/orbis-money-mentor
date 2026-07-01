-- Orbis — TRAVA DE ESCRITA no extrato do desafio (correcao critica anti-fraude).
--
-- Problema: extrato_uploads.total_verificado alimenta o placar da competicao
-- (get_weekly_ranking_verified / recalculate_competition_scores + trigger trg_extrato_recalc).
-- A RLS permitia o usuario gravar a propria linha direto (extrato_insert_own / extrato_update_own),
-- entao dava pra chamar a API do Supabase sem passar pela function verificar-extrato e gravar
-- total_verificado: 999999, pulando a IA e inflando o ranking.
--
-- Correcao: SO o service_role (dentro da function verificar-extrato) pode INSERIR/ATUALIZAR.
-- O service_role tem BYPASSRLS, entao a function continua gravando normalmente.
-- O usuario continua LENDO (extrato_select_own) e APAGANDO (extrato_delete_own) o proprio extrato
-- — apagar so reduz a propria nota, nao da pra inflar.
--
-- Cole TUDO no Supabase -> SQL Editor -> Run.

drop policy if exists "extrato_insert_own" on public.extrato_uploads;
drop policy if exists "extrato_update_own" on public.extrato_uploads;

-- Mantidas de proposito (a UI usa, e nao permitem fraude):
--   extrato_select_own  -> SELECT using (auth.uid() = user_id)
--   extrato_delete_own  -> DELETE using (auth.uid() = user_id)
