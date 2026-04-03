-- Remove the SELECT policy that exposes sensitive PII (buyer_cpf, buyer_email, payload) to linked users
-- The app never queries this table from the client, so users don't need read access
DROP POLICY IF EXISTS "Users can view their linked purchases" ON public.unlinked_purchases;