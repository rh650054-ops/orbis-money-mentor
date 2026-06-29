-- Orbis — pontuação da competição AO VIVO + verificada.
-- pix_revenue: cada dia com extrato conta o valor VERIFICADO; o dia de HOJE (enquanto
-- nao subiu extrato) conta o DEFCON AO VIVO (card+pix). Subiu o extrato -> troca pro verificado.
-- Dinheiro vivo nunca entra. Recalcula sozinho a cada venda do DEFCON e a cada extrato.

CREATE OR REPLACE FUNCTION public.recalculate_competition_scores(_competition_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  comp RECORD;
  hoje date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
BEGIN
  SELECT * INTO comp FROM public.competitions WHERE id = _competition_id;
  IF comp IS NULL THEN RETURN; END IF;

  IF comp.metric = 'pix_revenue' THEN
    UPDATE public.competition_participants cp
    SET score = COALESCE(sub.total, 0), updated_at = now()
    FROM (
      SELECT uid AS user_id, SUM(valor) AS total FROM (
        -- dias COM extrato = valor verificado (inclui hoje, se ja subiu)
        SELECT user_id AS uid, SUM(COALESCE(total_verificado, 0)) AS valor
        FROM public.extrato_uploads
        WHERE dia >= comp.starts_at::date AND dia <= comp.ends_at::date
        GROUP BY user_id
        UNION ALL
        -- HOJE ao vivo (DEFCON card+pix), so pra quem ainda NAO subiu extrato hoje
        SELECT ds.user_id AS uid, COALESCE(ds.pix_sales, 0) + COALESCE(ds.card_sales, 0) AS valor
        FROM public.daily_sales ds
        WHERE ds.date = hoje
          AND hoje BETWEEN comp.starts_at::date AND comp.ends_at::date
          AND NOT EXISTS (
            SELECT 1 FROM public.extrato_uploads e WHERE e.user_id = ds.user_id AND e.dia = hoje
          )
      ) z GROUP BY uid
    ) sub
    WHERE cp.competition_id = _competition_id AND cp.user_id = sub.user_id;

    UPDATE public.competition_participants
    SET score = 0, updated_at = now()
    WHERE competition_id = _competition_id
      AND user_id NOT IN (
        SELECT user_id FROM public.extrato_uploads
        WHERE dia >= comp.starts_at::date AND dia <= comp.ends_at::date
        UNION
        SELECT ds2.user_id FROM public.daily_sales ds2
        WHERE ds2.date = hoje AND hoje BETWEEN comp.starts_at::date AND comp.ends_at::date
      );

  ELSIF comp.metric = 'pix_sales_count' THEN
    UPDATE public.competition_participants cp
    SET score = COALESCE(sub.cnt, 0), updated_at = now()
    FROM (
      SELECT user_id, SUM(COALESCE(qtd_vendas, 0))::numeric AS cnt
      FROM public.extrato_uploads
      WHERE dia >= comp.starts_at::date AND dia <= comp.ends_at::date
      GROUP BY user_id
    ) sub
    WHERE cp.competition_id = _competition_id AND cp.user_id = sub.user_id;

    UPDATE public.competition_participants
    SET score = 0, updated_at = now()
    WHERE competition_id = _competition_id
      AND user_id NOT IN (
        SELECT user_id FROM public.extrato_uploads
        WHERE dia >= comp.starts_at::date AND dia <= comp.ends_at::date
      );

  ELSIF comp.metric = 'streak' THEN
    UPDATE public.competition_participants cp
    SET score = COALESCE(ls.constancia_streak_atual, 0), updated_at = now()
    FROM public.leaderboard_stats ls
    WHERE cp.competition_id = _competition_id AND ls.user_id = cp.user_id;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.recalculate_competition_scores(uuid) TO authenticated;

-- Gatilho 1: extrato subido/atualizado -> recalcula as competicoes ativas do usuario.
CREATE OR REPLACE FUNCTION public.on_extrato_upload_recalc()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c RECORD;
BEGIN
  FOR c IN
    SELECT DISTINCT cp.competition_id
    FROM public.competition_participants cp
    JOIN public.competitions comp ON comp.id = cp.competition_id
    WHERE cp.user_id = NEW.user_id AND comp.status = 'active'
      AND NEW.dia >= comp.starts_at::date AND NEW.dia <= comp.ends_at::date
  LOOP
    PERFORM public.recalculate_competition_scores(c.competition_id);
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_extrato_recalc ON public.extrato_uploads;
CREATE TRIGGER trg_extrato_recalc
  AFTER INSERT OR UPDATE ON public.extrato_uploads
  FOR EACH ROW EXECUTE FUNCTION public.on_extrato_upload_recalc();

-- Gatilho 2: venda no DEFCON (daily_sales muda) -> recalcula AO VIVO as competicoes ativas.
CREATE OR REPLACE FUNCTION public.on_defcon_sale_recalc()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c RECORD;
BEGIN
  FOR c IN
    SELECT DISTINCT cp.competition_id
    FROM public.competition_participants cp
    JOIN public.competitions comp ON comp.id = cp.competition_id
    WHERE cp.user_id = NEW.user_id AND comp.status = 'active'
      AND NEW.date >= comp.starts_at::date AND NEW.date <= comp.ends_at::date
  LOOP
    PERFORM public.recalculate_competition_scores(c.competition_id);
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_defcon_recalc ON public.daily_sales;
CREATE TRIGGER trg_defcon_recalc
  AFTER INSERT OR UPDATE ON public.daily_sales
  FOR EACH ROW EXECUTE FUNCTION public.on_defcon_sale_recalc();

-- Realtime: o app escuta o competition_participants pra atualizar o ranking AO VIVO.
ALTER TABLE public.competition_participants REPLICA IDENTITY FULL;
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.competition_participants;
EXCEPTION WHEN OTHERS THEN NULL;  -- ja estava na publicacao
END $$;
