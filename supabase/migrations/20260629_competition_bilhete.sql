-- Bilhete dourado por competição: guarda a personalização do convite (frase,
-- prêmios menores, comissão, etc.) num JSON. Nulo = usa os padrões + dados da comp.
ALTER TABLE public.competitions ADD COLUMN IF NOT EXISTS bilhete_config jsonb;
